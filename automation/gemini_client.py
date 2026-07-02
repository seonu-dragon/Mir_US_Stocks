"""Gemini API client (urllib-based, mirrors daily_news_pipeline.py)."""

from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_MODEL_FALLBACKS = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)
RETRYABLE_GEMINI_HTTP_CODES = frozenset({429, 500, 502, 503, 504})
MIN_REQUEST_INTERVAL_SEC = float(os.getenv("GEMINI_MIN_INTERVAL_SEC", "4"))
_CACHE_DIR = Path(__file__).resolve().parents[1] / "outputs" / "gemini_cache"
_last_request_at = 0.0


def clean_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0]
    return json.loads(cleaned.strip())


class GeminiClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_GEMINI_MODEL,
        timeout: int = 120,
    ) -> None:
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY가 필요합니다.")
        self.timeout = timeout
        ordered = []
        for candidate in (model, *GEMINI_MODEL_FALLBACKS):
            if candidate and candidate not in ordered:
                ordered.append(candidate)
        self.models = tuple(ordered)

    def _image_part(self, image_path: Path | None) -> dict | None:
        if not image_path or not image_path.exists():
            return None
        mime, _ = mimetypes.guess_type(str(image_path))
        mime = mime or "image/png"
        data = base64.b64encode(image_path.read_bytes()).decode("ascii")
        return {"inline_data": {"mime_type": mime, "data": data}}

    def _call(self, prompt: str, model: str, image_path: Path | None = None) -> dict:
        parts: list[dict] = [{"text": prompt}]
        image_part = self._image_part(image_path)
        if image_part:
            parts.append(image_part)

        url = f"{GEMINI_API_BASE}/{model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.3,
                "responseMimeType": "application/json",
            },
        }
        request = Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
                "User-Agent": "MirKiwoomContentPipeline/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            error = RuntimeError(f"Gemini HTTP {exc.code}: {detail[:500]}")
            error.http_code = exc.code  # type: ignore[attr-defined]
            raise error from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Gemini 요청 실패: {exc}") from exc

        try:
            text = result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Gemini 응답 형식을 읽을 수 없습니다: {result}") from exc
        return clean_json_response(text)

    @staticmethod
    def _retry_delay(attempt: int, http_code: int | None) -> float:
        if http_code in RETRYABLE_GEMINI_HTTP_CODES:
            return min(15 * (2 ** (attempt - 1)), 120)
        return min(10 * attempt, 60)

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        if isinstance(exc, (ValueError, json.JSONDecodeError)):
            return True
        http_code = getattr(exc, "http_code", None)
        if isinstance(http_code, int):
            if http_code in RETRYABLE_GEMINI_HTTP_CODES:
                return True
            if 400 <= http_code < 500:
                return False
        message = str(exc).lower()
        return any(token in message for token in ("timeout", "temporarily", "high demand", "unavailable"))

    @staticmethod
    def _cache_key(prompt: str, image_path: Path | None) -> str:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        if image_path and image_path.exists():
            digest += "_" + hashlib.sha256(image_path.read_bytes()).hexdigest()[:12]
        return digest

    def _read_cache(self, key: str) -> dict | None:
        path = _CACHE_DIR / f"{key}.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def _write_cache(self, key: str, payload: dict) -> None:
        try:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            (_CACHE_DIR / f"{key}.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    @staticmethod
    def _throttle() -> None:
        global _last_request_at
        elapsed = time.time() - _last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_SEC:
            time.sleep(MIN_REQUEST_INTERVAL_SEC - elapsed)
        _last_request_at = time.time()

    def generate_json(
        self,
        prompt: str,
        image_path: Path | None = None,
        retries: int = 3,
        use_cache: bool = True,
    ) -> dict:
        cache_key = self._cache_key(prompt, image_path)
        if use_cache:
            cached = self._read_cache(cache_key)
            if cached is not None:
                print(f"[Gemini] cache hit {cache_key}")
                return cached

        last_error: Exception | None = None
        attempt = 0
        total = retries * len(self.models)
        for model in self.models:
            for model_attempt in range(1, retries + 1):
                attempt += 1
                try:
                    print(f"[Gemini] {model} 시도 {model_attempt}/{retries}")
                    self._throttle()
                    result = self._call(prompt, model, image_path=image_path)
                    if use_cache:
                        self._write_cache(cache_key, result)
                    return result
                except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                    last_error = exc
                    print(f"[Gemini] 실패: {exc}")
                    if attempt >= total or not self._is_retryable(exc):
                        break
                    time.sleep(self._retry_delay(model_attempt, getattr(exc, "http_code", None)))
        raise RuntimeError("Gemini 요청이 모든 재시도에서 실패했습니다.") from last_error