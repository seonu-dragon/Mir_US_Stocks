#!/usr/bin/env python3
"""기술 점수 캘리브레이션 — "이 점수가 실제로 맞았나" 를 오프라인으로 재는 빌더.

배경. 종목 분석 화면의 헤드라인 숫자는 PR #143 에서 "기술 점수" 로 이름이 바뀌었고
(확률이라 부르지 않기로 했다), 과거 유사 상황 실측에는 윌슨 구간이 붙었다. 그런데
**점수 자체가 뭘 예측하는지에 대한 증거는 여전히 없었다.** 이 빌더가 그 증거를 만든다.

무엇을 하나.
  - 로컬 스냅샷 이력(data/details/*.json = US, data/korea/details/*.json = KR, 5년 일봉)에
    대해 워크포워드로 기술 점수를 다시 계산하고, 같은 기간 뒤 실제로 올랐는지를 센다.
  - 점수는 **사이트가 쓰는 그 함수** 로 계산한다. 파이썬 포팅본을 따로 두지 않고
    scripts/prob_calibration_worker.js 가 indicators.js + pattern_detectors_extended.js +
    analysis.js 를 노드에 그대로 올려 window.MirProb.technicalScoreRows() 를 부른다.
    구현이 하나여야 캘리브레이션 표가 화면의 점수를 실제로 설명한다.
  - 룩어헤드 없음: 봉 i 의 점수는 rows[0..i] 만 보고, 실현 수익률은 rows[i+h] 로만 잰다.

정직성(중요, CLAUDE.md '데이터 정직성').
  - 표본이 겹친다. stride 5 봉으로 뽑고 20/60 거래일 뒤를 재므로 이웃 표본끼리 기간이
    겹쳐 독립이 아니다. 그래서 신뢰구간은 원시 n 이 아니라 **유효표본수**
    nEff = n / max(1, horizon/stride) 로 계산하고, 두 숫자를 모두 내보낸다.
  - 종목 간 상관(같은 날 시장이 통째로 움직이는 것)은 보정하지 않는다 — 그만큼 구간은
    여전히 낙관적이다. 이 한계는 산출물의 caveats 에 그대로 적어 화면에서도 읽게 한다.
  - data/details 에는 **현재 상장된 종목만** 있다(생존 편향). 상장폐지된 종목의 하락은
    표본에 없다.
  - pattern_stats.json 은 전 구간으로 만든 모집단 통계다. 점수의 '패턴' 신호가 이 표를
    참조하므로 그 성분에는 약한 인샘플 편향이 있다. 봉 데이터 자체는 엄격히 인과적이다.

산출물: data/prob_calibration.json + data/prob_calibration.js(window.PROB_CALIBRATION).

사용:
    py scripts/build_prob_calibration.py                 # 기본 샘플(US 260 · KR 200)
    py scripts/build_prob_calibration.py --limit-us 40 --limit-kr 20 --stride 10   # 빠른 확인
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from briefing_store import atomic_write_text  # noqa: E402  중단 시 잘린 JSON 방지

WORKER = ROOT / "scripts" / "prob_calibration_worker.js"
OUT_JSON = ROOT / "data" / "prob_calibration.json"
OUT_JS = ROOT / "data" / "prob_calibration.js"

# 기술 점수는 12~88 로 클램프된다(analysis.js consensusProbability). 분포가 몰리는
# 중앙부는 5점 폭, 바깥은 10점 폭으로 끊는다.
BUCKETS = [12, 20, 30, 40, 45, 50, 55, 60, 70, 80, 88]
HORIZONS = [5, 20, 60]
MIN_BARS = 300          # 점수 계산에 필요한 최소 이력(주봉/월봉 정렬·패턴 감지가 요구)

WIN_NODE_FALLBACK = "C:/Users/user/AppData/Local/ms-playwright-go/1.57.0/node.exe"


def kst_now_str() -> str:
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")


def find_node(cli_arg: str | None) -> str | None:
    for cand in (cli_arg, os.environ.get("MIR_NODE_BIN"), shutil.which("node")):
        if cand and Path(cand).exists():
            return cand
    if sys.platform == "win32":
        home = Path.home()
        found = sorted(
            glob.glob(str(home / "AppData" / "Local" / "ms-playwright-go" / "*" / "node.exe")),
            reverse=True,
        )
        for cand in [*found, WIN_NODE_FALLBACK]:
            if Path(cand).exists():
                return cand
    return None


# 이력이 짧은 detail 은 어차피 워커가 건너뛴다(minBars + 최대 호라이즌). 파일 크기로
# 미리 걸러 낭비되는 파싱을 줄인다 — 봉 하나가 대략 55바이트라 370봉 ≈ 21KB.
MIN_FILE_BYTES = 22_000


def pick_files(market: str, limit: int, min_bytes: int = MIN_FILE_BYTES) -> list[dict]:
    """티커 알파벳 순으로 균등 추출 — 시드 없이 재현 가능하고 특정 구간에 쏠리지 않는다."""
    base = ROOT / ("data/korea/details" if market == "kr" else "data/details")
    if not base.is_dir():
        return []
    paths = sorted(p for p in base.glob("*.json")
                   if not p.name.startswith("_") and p.stat().st_size >= min_bytes)
    if not paths:
        return []
    if limit <= 0 or limit >= len(paths):
        chosen = paths
    else:
        step = len(paths) / limit
        chosen = [paths[min(len(paths) - 1, int(i * step))] for i in range(limit)]
    return [{"market": market, "ticker": p.stem, "path": str(p)} for p in chosen]


def wilson(successes: int, n: float, z: float = 1.96) -> tuple[float, float]:
    """이항 비율의 윌슨 신뢰구간. n 은 유효표본수(실수)일 수 있다."""
    if n <= 0:
        return (0.0, 1.0)
    p = successes / n
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    half = (z * math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
    return (max(0.0, center - half), min(1.0, center + half))


def summarize(acc: dict, buckets: list[int], horizons: list[int], stride: int) -> dict:
    """워커의 누적기 → 시장×호라이즌×버킷 표. 구간은 유효표본수로 계산한다."""
    out: dict = {}
    for market, per_h in acc.items():
        out[market] = {}
        for h_key, data in per_h.items():
            h = int(h_key)
            overlap = max(1.0, h / float(stride))     # 겹치는 표본 보정 계수
            all_n = data["all"]["n"]
            all_up = data["all"]["up"]
            all_rate = (all_up / all_n * 100) if all_n else None
            rows = []
            for i, cell in enumerate(data["buckets"]):
                n = cell["n"]
                if not n:
                    continue
                up = cell["up"]
                n_eff = n / overlap
                lo, hi = wilson(up * (n_eff / n), n_eff)
                rows.append({
                    "lo": buckets[i],
                    "hi": buckets[i + 1],
                    "n": n,
                    "nEff": round(n_eff, 1),
                    "upRate": round(up / n * 100, 2),
                    "ciLow": round(lo * 100, 2),
                    "ciHigh": round(hi * 100, 2),
                    "avgReturn": round(cell["sumRet"] / n * 100, 3),
                    # 시장 평균(같은 시장·같은 호라이즌 전체 표본)과 유의하게 "다른가".
                    # 위로 다를 수도 아래로 다를 수도 있다 — 이름을 beats(우위)로 두면
                    # 평균보다 낮은 구간까지 우위로 읽힌다. 구간이 평균을 품고 있으면 차이 없음.
                    "differsFromBase": bool(all_rate is not None and (lo * 100 > all_rate or hi * 100 < all_rate)),
                })
            base_lo, base_hi = wilson(all_up / overlap, all_n / overlap) if all_n else (0.0, 1.0)
            solid = [r for r in rows if r["nEff"] >= 100]
            spread = (max(r["upRate"] for r in solid) - min(r["upRate"] for r in solid)) if solid else None
            out[market][str(h)] = {
                # 요약: 유의하게 시장 평균과 다른 버킷 수 / 표본이 충분한 버킷들의 상승률 폭.
                # 둘 다 0에 가까우면 "점수가 방향을 못 맞춘다" 는 뜻이다.
                "significantBuckets": sum(1 for r in rows if r["differsFromBase"]),
                "spreadPp": round(spread, 2) if spread is not None else None,
                "baseRate": round(all_rate, 2) if all_rate is not None else None,
                "baseN": all_n,
                "baseNEff": round(all_n / overlap, 1) if all_n else 0,
                "baseCiLow": round(base_lo * 100, 2),
                "baseCiHigh": round(base_hi * 100, 2),
                "avgReturn": round(data["all"]["sumRet"] / all_n * 100, 3) if all_n else None,
                "buckets": rows,
            }
    return out


def run_worker(node: str, files: list[dict], stride: int, horizons: list[int]) -> dict:
    job = {
        "horizons": horizons,
        "buckets": BUCKETS,
        "minBars": MIN_BARS,
        "stride": stride,
        "files": files,
    }
    proc = subprocess.run(
        [node, str(WORKER)],
        input=json.dumps(job),
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(ROOT),
    )
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"node 워커 실패(exit {proc.returncode})")
    if not proc.stdout.strip():
        raise RuntimeError("node 워커가 빈 출력을 냈다")
    return json.loads(proc.stdout)


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="기술 점수 캘리브레이션 표 생성")
    ap.add_argument("--limit-us", type=int, default=260, help="US 표본 종목 수(0=전체)")
    ap.add_argument("--limit-kr", type=int, default=200, help="KR 표본 종목 수(0=전체)")
    ap.add_argument("--stride", type=int, default=5, help="몇 봉마다 평가할지")
    ap.add_argument("--node", default=None, help="node 실행 파일 경로")
    ap.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 표만 출력")
    args = ap.parse_args()

    node = find_node(args.node)
    if not node:
        print("[calib] node 실행 파일을 찾지 못했습니다 — --node 로 지정하세요.", file=sys.stderr)
        return 1
    if not WORKER.exists():
        print(f"[calib] 워커가 없습니다: {WORKER}", file=sys.stderr)
        return 1

    started = time.time()
    print("=== 기술 점수 캘리브레이션 ===")
    print(f"node: {node}")

    merged_acc: dict = {}
    merged_meta = {"stocks": 0, "skipped": 0, "evals": 0, "firstDate": None, "lastDate": None}
    for market, limit in (("us", args.limit_us), ("kr", args.limit_kr)):
        files = pick_files(market, limit)
        if not files:
            print(f"[{market}] detail 파일 없음 — 건너뜀")
            continue
        print(f"[{market}] {len(files)}종목 · stride {args.stride}봉 · 호라이즌 {HORIZONS}")
        res = run_worker(node, files, args.stride, HORIZONS)
        merged_acc.update(res["acc"])
        m = res["meta"]
        merged_meta["stocks"] += m["stocks"]
        merged_meta["skipped"] += m["skipped"]
        merged_meta["evals"] += m["evals"]
        for key, cmp_ in (("firstDate", min), ("lastDate", max)):
            if m.get(key):
                cur = merged_meta[key]
                merged_meta[key] = m[key] if cur is None else cmp_(cur, m[key])
        print(f"[{market}] 평가 {m['evals']}건 · 사용 {m['stocks']}종목 · 스킵 {m['skipped']}")

    if not merged_acc:
        print("[calib] 집계 결과가 비었습니다 — 쓰지 않습니다.", file=sys.stderr)
        return 1

    table = summarize(merged_acc, BUCKETS, HORIZONS, args.stride)
    elapsed = time.time() - started

    payload = {
        "updatedAtKst": kst_now_str(),
        "generatedInSec": round(elapsed, 1),
        "source": "walk-forward over local snapshot history (data/details, data/korea/details)",
        "scoreFn": "analysis.js window.MirProb.technicalScoreRows (사이트와 동일 구현)",
        "buckets": BUCKETS,
        "horizons": HORIZONS,
        "stride": args.stride,
        "minBars": MIN_BARS,
        "sample": {
            "stocks": merged_meta["stocks"],
            "skipped": merged_meta["skipped"],
            "evaluations": merged_meta["evals"],
            "limitUs": args.limit_us,
            "minFileBytes": MIN_FILE_BYTES,
            "limitKr": args.limit_kr,
            "selection": "이력 22KB 이상 detail 중 티커 알파벳 순 균등 추출",
        },
        "barRange": {"first": merged_meta["firstDate"], "last": merged_meta["lastDate"]},
        "caveats": [
            "표본이 겹친다(stride 5봉 · 최대 60거래일 전망). 신뢰구간은 유효표본수 "
            "nEff = n / (horizon/stride) 로 계산했다.",
            "종목 간 상관(같은 날 시장 전체가 움직이는 효과)은 보정하지 않았다 — 구간은 여전히 낙관적이다.",
            "data/details 에는 현재 상장 종목만 있다(생존 편향).",
            "점수의 패턴 신호는 전 구간으로 만든 pattern_stats.json 을 참조하므로 그 성분에 약한 인샘플 편향이 있다.",
            "수익률은 배당·거래비용을 반영하지 않은 종가 대비 단순 등락이다.",
        ],
        "markets": table,
    }

    for market, per_h in table.items():
        for h, blk in sorted(per_h.items(), key=lambda kv: int(kv[0])):
            print(f"\n[{market.upper()}] {h}거래일 · 시장 평균 상승률 {blk['baseRate']}% "
                  f"(n={blk['baseN']}, nEff={blk['baseNEff']})")
            print(f"  {'버킷':>9} {'n':>7} {'nEff':>7} {'상승률':>7} {'95% 구간':>15} {'평균수익':>8}  판정")
            print(f"  유의 버킷 {blk['significantBuckets']}개 · 버킷 간 상승률 폭 {blk['spreadPp']}%p")
            for r in blk["buckets"]:
                verdict = "평균과 다름" if r["differsFromBase"] else "차이 없음"
                print(f"  {r['lo']:>3}~{r['hi']:<4} {r['n']:>7} {r['nEff']:>7.0f} "
                      f"{r['upRate']:>6.1f}% {r['ciLow']:>6.1f}~{r['ciHigh']:<6.1f} "
                      f"{r['avgReturn']:>7.2f}%  {verdict}")

    if args.dry_run:
        print(f"\n(dry-run) {elapsed:.0f}초 — 파일을 쓰지 않았습니다.")
        return 0

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    atomic_write_text(OUT_JSON, compact)
    atomic_write_text(OUT_JS, f"window.PROB_CALIBRATION = {compact};\n")
    print(f"\nWrote {OUT_JSON.name}, {OUT_JS.name} ({elapsed:.0f}초, 평가 {merged_meta['evals']}건)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[calib] 실패: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
