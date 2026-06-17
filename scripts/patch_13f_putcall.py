#!/usr/bin/env python3
"""기존 institutional_13f 스냅샷에 put/call·티커 필드 재파싱."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from build_13f_snapshot import holdings_from_13finfo  # noqa: E402

ROOT = SCRIPTS.parent
OUT_JSON = ROOT / "data" / "institutional_13f.json"
OUT_JS = ROOT / "data" / "institutional_13f.js"


def write_outputs(payload: dict) -> None:
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(
        "window.INSTITUTIONAL_13F = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    ok_inst = [i for i in payload.get("institutions", []) if i.get("status") == "ok"]
    updated = 0
    failed = 0
    print(f"Patching {len(ok_inst)} institutions...", flush=True)
    for n, inst in enumerate(ok_inst, start=1):
        inst_ok = 0
        for quarter in inst.get("quarters", []):
            acc = quarter.get("accessionRaw")
            if not acc:
                continue
            try:
                quarter["holdings"] = holdings_from_13finfo(acc)
                updated += 1
                inst_ok += 1
            except Exception as exc:
                failed += 1
                print(f"[err] {inst.get('name')} {quarter.get('reportLabel')}: {exc}", flush=True)
            time.sleep(0.08)
        quarters = inst.get("quarters") or []
        if quarters:
            latest = quarters[0]
            inst["holdings"] = latest.get("holdings", [])
            inst["reportDate"] = latest.get("reportDate", "")
            inst["filedDate"] = latest.get("filedDate", "")
            inst["accession"] = latest.get("accession", "")
        if n % 5 == 0 or n == len(ok_inst):
            write_outputs(payload)
            print(f"[{n}/{len(ok_inst)}] {inst.get('name')} quarters={inst_ok}", flush=True)

    write_outputs(payload)
    print(f"Done updated={updated} failed={failed} -> {OUT_JSON}", flush=True)


if __name__ == "__main__":
    main()