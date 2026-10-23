#!/usr/bin/env python3
"""푸시 알림용 작은 피드 — 내부자 장내 매수·매도 + 추적 기관 13F 신규 편입·청산.

푸시 워커(worker/mir-push.js)는 무료 플랜 CPU 10ms 안에서 돈다. 원본 insider_trades(5MB)·
institutional_13f(13MB)는 너무 크고, 배포 스테이징도 이 큰 .json 짝을 뺀다. 그래서 원본에서 알림에
필요한 최근 사실만 뽑아 수십 KB 로 만든다. 새 원천은 없다(이미 발행한 두 파일만 읽는다).

- insider: 최근 INSIDER_DAYS 일 신고분 중 코드 P(장내 매수)·S(장내 매도)만. (종목·신고일·보고자·코드)로 합친다.
  10b5-1 계획 거래가 하나라도 섞이면 plan=1(문구에 '10b5-1 계획' 표시).
- inst13f: 추적 기관(institutions_13f_registry) 각각 최신 분기 vs 직전 분기. 저장된 보유가 상위 25종목뿐이라
  목록이 잘리지 않은 쪽에서만 신규 편입(new)·전량 청산(exit)이라 하고, 아니면 상위 25 진입(in25)·이탈(out25)이다
  (inst_changes 참고). 13F 는 분기말 기준·마감 45일 뒤 공개라 '최대 45일 지연'이다.
  seen = 이 빌더가 그 제출(accession)을 처음 본 날(KST). 워커는 seen 이 최근 7일인 것만 알린다
  (13F 스냅샷이 제출보다 며칠 늦게 갱신되므로 제출일이 아니라 처음 본 날로 판단).

산출물: data/push_smart_money.json + .js(window.PUSH_SMART_MONEY).
  --push : 쓴 뒤 sec.git_publish 로 커밋·푸시.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import sec_client as sec  # noqa: E402

INSIDER = ROOT / "data" / "insider_trades.json"
INST13F = ROOT / "data" / "institutional_13f.json"
OUT_JSON = ROOT / "data" / "push_smart_money.json"
OUT_JS = ROOT / "data" / "push_smart_money.js"
INSIDER_DAYS = 7
SEEN_KEEP_DAYS = 30   # 13F 변화 행은 처음 본 지 30일까지만 싣는다(워커는 7일만 쓴다)
INSIDER_COLS = ["t", "fd", "td", "owner", "rel", "code", "shares", "value", "plan"]
INST_COLS = ["t", "inst", "name", "kind", "q", "filed", "valueM", "seen"]
KST = timezone(timedelta(hours=9))


def kst_now() -> datetime:
    return datetime.now(KST)


def clip(s, n: int) -> str:
    t = " ".join(str(s or "").split())
    return t if len(t) <= n else t[: n - 1] + "…"


def insider_rows(trades: list[dict], floor: str) -> list[list]:
    groups: dict[tuple, dict] = {}
    for x in trades or []:
        code = x.get("code")
        if code not in ("P", "S") or str(x.get("fileDate") or "") < floor or not x.get("ticker"):
            continue
        k = (str(x["ticker"]).upper(), x["fileDate"], str(x.get("owner") or ""), code)
        g = groups.setdefault(k, {"td": x.get("txDate") or "", "rel": x.get("relation") or "", "shares": 0.0, "value": 0.0, "plan": 0})
        g["shares"] += float(x.get("shares") or 0)
        g["value"] += float(x.get("value") or 0)
        g["td"] = max(g["td"], x.get("txDate") or "")
        if x.get("plan10b51") is True:
            g["plan"] = 1
    rows = [[t, fd, g["td"], clip(owner, 28), clip(g["rel"], 28), code, round(g["shares"]), round(g["value"]), g["plan"]]
            for (t, fd, owner, code), g in groups.items()]
    rows.sort(key=lambda r: (r[1], r[7]), reverse=True)
    return rows


def _tickers(holdings) -> dict[str, float]:
    out = {}
    for h in holdings or []:
        t = str(h.get("ticker") or "").upper()
        if not t or h.get("putCall"):
            continue  # 옵션 포지션(풋·콜)은 보유 종목 변화로 보지 않는다
        out[t] = out.get(t, 0.0) + float(h.get("valueM") or 0)
    return out


TOP_HOLDINGS = 25  # build_13f_snapshot.TOP_HOLDINGS — 기관별 분기 보유는 상위 25종목까지만 저장돼 있다


def inst_changes(inst: dict) -> list[tuple]:
    """기관 하나 → [(ticker, kind, valueM)]. 분기 2개 미만이면 [].

    보유 목록이 상위 25종목으로 잘려 있어서 '직전에 없음'이 곧 신규 편입은 아니다(25위 밖에 있었을 수 있다).
    - new  : 직전 분기 목록이 잘리지 않았는데(25종목 미만) 없던 종목 → 확실한 신규 편입
    - exit : 최신 분기 목록이 잘리지 않았는데 빠진 종목 → 확실한 전량 청산
    - in25 / out25 : 목록이 잘린 쪽이라 '상위 25 진입 / 상위 25 이탈'까지만 말할 수 있는 경우
    """
    qs = [q for q in inst.get("quarters") or [] if isinstance(q, dict) and q.get("holdings") is not None]
    qs.sort(key=lambda q: str(q.get("reportDate") or ""), reverse=True)
    if len(qs) < 2:
        return []
    cur, prev = _tickers(qs[0]["holdings"]), _tickers(qs[1]["holdings"])
    if not cur or not prev:
        return []  # 한쪽이 비면(파싱 실패 등) 전부 신규·청산으로 잘못 보인다
    prev_full = len(qs[1]["holdings"]) < TOP_HOLDINGS
    cur_full = len(qs[0]["holdings"]) < TOP_HOLDINGS
    out = [(t, "new" if prev_full else "in25", round(v, 1)) for t, v in cur.items() if t not in prev]
    out += [(t, "exit" if cur_full else "out25", round(v, 1)) for t, v in prev.items() if t not in cur]
    return sorted(out)


def inst_rows(institutions: list[dict], seen_prev: dict[str, str], today: str) -> tuple[list[list], dict[str, str]]:
    seen = {}
    rows = []
    keep_floor = (date.fromisoformat(today) - timedelta(days=SEEN_KEEP_DAYS)).isoformat()
    for inst in institutions or []:
        if inst.get("status") not in (None, "ok"):
            continue
        qs = sorted([q for q in inst.get("quarters") or [] if isinstance(q, dict)],
                    key=lambda q: str(q.get("reportDate") or ""), reverse=True)
        if not qs or not qs[0].get("accession"):
            continue
        acc = qs[0]["accession"]
        # 첫 실행(기준선)에는 이미 있던 제출을 '제출일에 봤다'로 둔다 — 배포 첫날 지난 분기 변화가 한꺼번에 울리지 않게.
        first = seen_prev.get(acc) or (today if seen_prev else (qs[0].get("filedDate") or today))
        seen[acc] = first
        if first < keep_floor:
            continue
        label = qs[0].get("reportLabel") or qs[0].get("reportDate") or ""
        for t, kind, v in inst_changes(inst):
            rows.append([t, inst.get("id") or "", clip(inst.get("name"), 24), kind, label, qs[0].get("filedDate") or "", v, first])
    rows.sort(key=lambda r: (r[7], r[1], r[0]), reverse=True)
    return rows, seen


def build(today: str | None = None) -> dict | None:
    today = today or kst_now().date().isoformat()
    payload = {"updatedAtKst": kst_now().strftime("%Y-%m-%d %H:%M KST"),
               "source": "SEC Form 4(내부자) · SEC 13F-HR(추적 기관) — 미르 발행 데이터에서 추림",
               "insiderCols": INSIDER_COLS, "insider": [], "instCols": INST_COLS, "inst13f": [], "seen": {}}
    prev = {}
    if OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            prev = {}
    ok = False
    if INSIDER.exists():
        ins = json.loads(INSIDER.read_text(encoding="utf-8"))
        floor = (date.fromisoformat(today) - timedelta(days=INSIDER_DAYS)).isoformat()
        payload["insider"] = insider_rows(ins.get("trades") or [], floor)
        payload["insiderAsOf"] = ins.get("lastFileDate")
        ok = True
        del ins
    if INST13F.exists():
        f13 = json.loads(INST13F.read_text(encoding="utf-8"))
        rows, seen = inst_rows(f13.get("institutions") or [], prev.get("seen") or {}, today)
        payload["inst13f"], payload["seen"] = rows, seen
        ok = True
        del f13
    if not ok:
        return None
    payload["count"] = len(payload["insider"]) + len(payload["inst13f"])
    return payload


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    print("=== 푸시용 내부자·13F 피드 ===")
    payload = build()
    if not payload:
        print("[smart-money] 원본 파일 없음 — 기존 파일 유지")
        return 1
    # 조용한 주(내부자 P·S 0건, 새 13F 없음)는 0건이 정상이다.
    sec.write_data(OUT_JSON, OUT_JS, "PUSH_SMART_MONEY", payload, indent=None, allow_empty=True)
    print(f"내부자 {len(payload['insider'])}건(최근 {INSIDER_DAYS}일 P·S) · 13F 변화 {len(payload['inst13f'])}건 · 제출 {len(payload['seen'])}개")
    if args.push:
        if not sec.git_publish(["data/push_smart_money.json", "data/push_smart_money.js"], "push smart-money feed"):
            print("[smart-money] 푸시 실패")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
