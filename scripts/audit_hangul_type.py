#!/usr/bin/env python3
"""한글 타이포그래피 DOM 감사 — 화면별로 보이는 한글 텍스트 노드의
(font-size / font-weight / line-height / letter-spacing) 조합을 세고,
12px 미만·음수 자간·1.45 미만 행간을 찾아낸다.

사용:
    py -m http.server 8114 --bind 127.0.0.1
    py scripts/audit_hangul_type.py --base http://127.0.0.1:8114 --out outputs/type_audit/before
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

from playwright.sync_api import sync_playwright

JS_AUDIT = r"""
() => {
  const HANGUL = /[가-힣]/;
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const txt = (n.nodeValue || '').trim();
    if (!txt || !HANGUL.test(txt)) continue;
    const el = n.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TITLE') continue;
    // 가시성
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    let hidden = false;
    for (let p = el; p; p = p.parentElement) {
      if (p.hasAttribute && p.hasAttribute('hidden')) { hidden = true; break; }
      const ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden') { hidden = true; break; }
    }
    if (hidden) continue;
    const fs = parseFloat(cs.fontSize);
    let lhRaw = cs.lineHeight;
    let lh;
    if (lhRaw === 'normal') lh = null;
    else lh = Math.round((parseFloat(lhRaw) / fs) * 100) / 100;
    let ls = cs.letterSpacing;
    let lsEm;
    if (ls === 'normal') lsEm = 0;
    else lsEm = Math.round((parseFloat(ls) / fs) * 1000) / 1000;
    const key = [Math.round(fs * 10) / 10, cs.fontWeight, lh, lsEm].join('|');
    out.push({
      key,
      fs: Math.round(fs * 10) / 10,
      fw: cs.fontWeight,
      lh: lh,
      ls: lsEm,
      sel: (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')),
      text: txt.slice(0, 40),
    });
  }
  // 집계
  const combos = {};
  for (const o of out) {
    if (!combos[o.key]) combos[o.key] = { count: 0, fs: o.fs, fw: o.fw, lh: o.lh, ls: o.ls, sample: o.sel, text: o.text };
    combos[o.key].count += 1;
  }
  const under12 = out.filter(o => o.fs < 11.95);
  const negLs = out.filter(o => o.ls < -0.0005);
  const tightLh = out.filter(o => o.lh !== null && o.lh < 1.45);
  return {
    nodes: out.length,
    combos: Object.entries(combos).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.count - a.count),
    under12: under12.map(o => ({ fs: o.fs, sel: o.sel, text: o.text })),
    negLs: negLs.map(o => ({ ls: o.ls, fs: o.fs, sel: o.sel, text: o.text })),
    tightLh: tightLh.map(o => ({ lh: o.lh, fs: o.fs, sel: o.sel, text: o.text })),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
}
"""

SCREENS = [
    ("home", "/index.html", None),
    ("today", "/index.html?tab=today", None),
    ("market", "/index.html?tab=market", None),
    ("search", "/index.html?tab=search", None),
    ("bulk", "/index.html?tab=bulk", None),
    ("search-analysis-AAPL", "/index.html?tab=search&sub=analysis&ticker=AAPL", None),
    ("search-disclosures", "/index.html?tab=search&sub=disclosures", None),
    ("analysis-AAPL", "/analysis.html?t=AAPL", None),
]

VIEWPORTS = [("1440x900", 1440, 900), ("390x844", 390, 844)]
THEMES = ["light", "dark"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8114")
    ap.add_argument("--out", default="outputs/type_audit/before")
    ap.add_argument("--shots", action="store_true", default=True)
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    overflow_fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in THEMES:
            for vp_name, w, h in VIEWPORTS:
                ctx = browser.new_context(viewport={"width": w, "height": h},
                                          device_scale_factor=1,
                                          locale="ko-KR")
                ctx.add_init_script(
                    "try{localStorage.setItem('mir_ui_prefs_v1', JSON.stringify({theme:'%s',density:'comfortable'}));}catch(e){}"
                    % theme)
                page = ctx.new_page()
                for name, path, _ in SCREENS:
                    url = args.base + path
                    try:
                        page.goto(url, wait_until="load", timeout=45000)
                    except Exception as e:
                        print(f"[goto-fail] {name} {theme} {vp_name}: {e}")
                        continue
                    page.wait_for_timeout(3500)
                    try:
                        data = page.evaluate(JS_AUDIT)
                    except Exception as e:
                        print(f"[eval-fail] {name} {theme} {vp_name}: {e}")
                        continue
                    key = f"{name}__{theme}__{vp_name}"
                    results[key] = data
                    if w == 390 and data["scrollWidth"] > data["innerWidth"] + 1:
                        overflow_fails.append(
                            f"{key}: scrollWidth={data['scrollWidth']} > innerWidth={data['innerWidth']}")
                    if args.shots:
                        shot = out_dir / f"{key}.png"
                        try:
                            page.screenshot(path=str(shot), full_page=False)
                        except Exception:
                            pass
                    print(f"[ok] {key}: nodes={data['nodes']} combos={len(data['combos'])} "
                          f"<12px={len(data['under12'])} neg-ls={len(data['negLs'])} "
                          f"lh<1.45={len(data['tightLh'])} sw={data['scrollWidth']}/{data['innerWidth']}")
                ctx.close()
        browser.close()

    (out_dir / "audit.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")

    # 요약
    tot_nodes = sum(r["nodes"] for r in results.values())
    tot_u12 = sum(len(r["under12"]) for r in results.values())
    tot_neg = sum(len(r["negLs"]) for r in results.values())
    tot_tight = sum(len(r["tightLh"]) for r in results.values())
    all_combo_keys = set()
    for r in results.values():
        all_combo_keys.update(c["key"] for c in r["combos"])
    print("\n===== SUMMARY =====")
    print(f"screens={len(results)} hangul nodes={tot_nodes}")
    print(f"distinct combos (all screens)={len(all_combo_keys)}")
    print(f"nodes <12px={tot_u12}  neg letter-spacing={tot_neg}  line-height<1.45={tot_tight}")
    if overflow_fails:
        print("HORIZONTAL OVERFLOW at 390px:")
        for f in overflow_fails:
            print("  " + f)
    else:
        print("no horizontal overflow at 390px")
    return 0


if __name__ == "__main__":
    sys.exit(main())
