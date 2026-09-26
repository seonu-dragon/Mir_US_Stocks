// 산업 지표 차트 전수 검사 — 실제 industry.js 의 industryChartSvg 를 node vm 에서 부르고,
// 지표 152개 × 기간 5종 × 변환(+ ±σ 밴드·관련 종목 겹치기) 조합의 SVG 를 감사한다.
//  (a) 막대·선·격자가 플롯 영역 밖   (b) 날짜 형식·역순·중복·미래   (c) 빈 시리즈인데 축만 그림
//  (d) 축 라벨 잘림·겹침            (e) 겹치기(우축) 선 범위 이탈
// 데이터: data/industry_indicators.js(봇이 매일 갱신). 실행: node scripts/tests/test_industry_charts.mjs [--list]
// 폭 880(데스크톱)·340(모바일) 둘 다 본다.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const core = require(path.join(ROOT, "industry-chart-core.js"));
const LIST = process.argv.includes("--list");

const ctx = {
  window: {}, console, Intl, Date, Math, Number, String, Array, Object, JSON, Set, Map, Promise,
  escapeHtml: (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  byId: () => null, document: { documentElement: { dataset: {} } },
};
ctx.window.MirIndustryChartCore = core;
ctx.MirIndustryChartCore = core;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, "data/industry_indicators.js"), "utf8"), ctx);
vm.runInContext(readFileSync(path.join(ROOT, "industry.js"), "utf8"), ctx);
const data = ctx.window.INDUSTRY_INDICATORS;
ctx.INDUSTRY_INDICATORS = data;
vm.runInContext("window.INDUSTRY_INDICATORS = window.INDUSTRY_INDICATORS;", ctx);

const run = (code) => vm.runInContext(code, ctx);
ctx.__data = data;
run("globalThis.industryData = () => __data;");

const BOX_RE = /data-plot="([\d.\-]+),([\d.\-]+),([\d.\-]+),([\d.\-]+)"/;
const VB_RE = /viewBox="0 0 ([\d.]+) ([\d.]+)"/;
const failures = [];
let charts = 0;
const byInd = new Map();
function flag(id, what) {
  if (!byInd.has(id)) byInd.set(id, new Set());
  byInd.get(id).add(what);
}

const ranges = run("INDUSTRY_RANGES").map((r) => r[0]);
for (const [id, ind] of Object.entries(data.indicators)) {
  // (b) 데이터 무결성
  core.seriesIssues(ind.series, ind.frequency, data.as_of_date).forEach((p) => flag(id, `데이터 ${p.kind} ${p.date}`));
  if (!Array.isArray(ind.series) || ind.series.length < 2) flag(id, "데이터 점 2개 미만");
  for (const width of [880, 340]) {
    for (const range of ranges) {
      for (const transform of ind.transforms_available || ["level"]) {
        for (const variant of ["plain", "band", "overlay"]) {
          if (variant !== "plain" && (range !== "MAX" && range !== "1Y")) continue;
          ctx.__args = { id, range, transform, width, variant };
          const svg = run(`(() => {
            const a = __args, ind = industryData().indicators[a.id];
            industryState.range = a.range; industryState.transform = a.transform; industryState.band = a.variant === "band";
            const points = industrySlice(ind, a.range);
            const primary = industryTransform(ind, points, a.transform);
            const yoyLine = a.transform === "level" && ind.regime_basis === "yoy" ? industryYoyOf(ind, points) : null;
            // (e) 겹치기: 종목 100기준 선 대용 — 극단값(0.2배~5배)을 섞어 우축 범위를 흔든다.
            const overlay = a.variant === "overlay" ? points.map((p, i) => (i % 7 === 3 ? null : 100 * (1 + Math.sin(i) * 0.8) * (i % 11 === 0 ? 5 : 1))) : null;
            return industryChartSvg(ind, points, primary, { yoyLine, overlay, overlayLabel: "TEST", band: a.variant === "band", recession: industryData().recession || [], unit: industryTransformUnit(ind, a.transform), width: a.width });
          })()`);
          charts += 1;
          const tag = `${range}/${transform}/${variant}/${width}`;
          if (!svg.includes("<svg")) {
            // (c) 빈 시리즈면 축 없이 한 줄 안내가 나와야 한다
            if (!/class="muted"/.test(svg)) flag(id, `${tag}: 빈 시리즈인데 안내 문구 없음`);
            continue;
          }
          const primaryNums = (() => { const m = svg.match(/<(rect|path)\b[^>]*data-series="primary"/g); return m ? m.length : 0; })();
          if (!primaryNums) flag(id, `${tag}: 축만 있고 본선·막대 없음`);
          let box;
          const bm = BOX_RE.exec(svg), vb = VB_RE.exec(svg);
          if (bm && vb) {
            const [L, T, R, B] = bm.slice(1).map(Number);
            const W = Number(vb[1]), H = Number(vb[2]);
            box = { W, H, padL: L, padR: W - R, padT: T, padB: H - B };
          } else {
            const W = vb ? Number(vb[1]) : 880, H = vb ? Number(vb[2]) : 320;
            box = { W, H, padL: 56, padR: 56, padT: 16, padB: 34 };
          }
          const onlySvg = svg.slice(0, svg.indexOf("</svg>"));
          core.auditSvg(onlySvg, box).forEach((p) => flag(id, `${tag}: ${p}`));
        }
      }
    }
  }
}

for (const [id, set] of byInd) {
  const arr = [...set];
  failures.push(`${id} (${data.indicators[id].name_kr}) — ${arr.length}건: ${arr.slice(0, LIST ? 1e9 : 3).join(" | ")}`);
}
console.log(`산업 지표 차트 검사: 지표 ${Object.keys(data.indicators).length}개 · 차트 ${charts}장 · 문제 지표 ${byInd.size}개`);
if (failures.length) {
  failures.slice(0, LIST ? 1e9 : 40).forEach((f) => console.log("  ✕ " + f));
  process.exit(1);
}
console.log("  ✓ 전부 통과");
