// 증권사 CSV 가져오기(broker-csv-core.js) 단위 테스트. 네트워크·DOM 없음.
// 실행: node scripts/tests/test_broker_csv_core.mjs   (CI 의 "Lookthrough / broker CSV tests" 스텝)
// 픽스처: scripts/tests/fixtures/broker_csv/*.csv (CP949 파일은 바이트 그대로 — .gitattributes -text)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const core = require("../../broker-csv-core.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => new Uint8Array(readFileSync(path.join(here, "fixtures", "broker_csv", name)));

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) { failures.push(`${name}: ${err && err.message}`); }
}

const KR = [
  { ticker: "005930", company: "삼성전자" },
  { ticker: "005935", company: "삼성전자우" },
  { ticker: "000660", company: "SK하이닉스" },
  { ticker: "035720", company: "카카오" },
  { ticker: "323410", company: "카카오뱅크" },
  { ticker: "005380", company: "현대차" },
  { ticker: "066570", company: "LG전자" },
  { ticker: "069500", company: "KODEX 200" },
];
const US = [
  { ticker: "AAPL", company: "Apple Inc." },
  { ticker: "BRK.B", company: "Berkshire Hathaway Inc." },
  { ticker: "VOO", company: "Vanguard S&P 500 ETF" },
  { ticker: "NVDA", company: "NVIDIA Corporation" },
  { ticker: "QQQ", company: "Invesco QQQ Trust" },
  { ticker: "MSFT", company: "Microsoft Corporation" },
];

// ----- 인코딩 -----
test("CP949 바이트는 EUC-KR 로 판별해 한글이 온전하다", () => {
  const d = core.decodeCsvBytes(fixture("kiwoom_opw00018_cp949.csv"));
  assert.equal(d.encoding, "EUC-KR (CP949)");
  assert.ok(d.text.includes("삼성전자") && d.text.includes("보유수량"));
});
test("UTF-8 BOM 은 떼고 UTF-8 로", () => {
  const d = core.decodeCsvBytes(fixture("mir_export_utf8bom.csv"));
  assert.equal(d.encoding, "UTF-8 (BOM)");
  assert.ok(d.text.startsWith("티커"));
});

// ----- 파싱·숫자 -----
test("따옴표 안 천 단위 쉼표는 한 칸", () => {
  const rows = core.parseCsvText('a,b,c\n삼성,"1,200","71,500"\n');
  assert.deepEqual(rows[1], ["삼성", "1,200", "71,500"]);
});
test("탭 구분·엑셀 수식 감싼 코드", () => {
  const rows = core.parseCsvText('종목코드\t수량\n="005930"\t3\n');
  assert.deepEqual(rows[1], ["005930", "3"]);
});
test("parseNumber: 쉼표·통화·단위·괄호 음수", () => {
  assert.equal(core.parseNumber("1,234"), 1234);
  assert.equal(core.parseNumber("₩71,500"), 71500);
  assert.equal(core.parseNumber("$1,012.50"), 1012.5);
  assert.equal(core.parseNumber("10주"), 10);
  assert.equal(core.parseNumber("(1,000)"), -1000);
  assert.ok(Number.isNaN(core.parseNumber("-")));
  assert.ok(Number.isNaN(core.parseNumber("abc")));
});
test("normCode: A 접두·ISIN·.KS·슬래시 클래스", () => {
  assert.equal(core.normCode("A005930", "kr"), "005930");
  assert.equal(core.normCode("KR7005930003", "kr"), "005930");
  assert.equal(core.normCode("005930.KS", "kr"), "005930");
  assert.equal(core.normCode("5930", "kr"), "005930");
  assert.equal(core.normCode("brk/b", "us"), "BRK.B");
});

// ----- 형식 판별 -----
test("키움: opw00018 항목명 → kiwoom, 종목번호 A접두로 매칭, 합계 행 제외", () => {
  const p = core.buildImportPreview(fixture("kiwoom_opw00018_cp949.csv"), KR, "kr");
  assert.equal(p.format.id, "kiwoom");
  assert.equal(p.rows.length, 3);
  const [ss, hy, kk] = p.rows;
  assert.equal(ss.selected, "005930");
  assert.equal(ss.qty, 1200);
  assert.equal(ss.avg, 71500);
  assert.equal(hy.selected, "000660");
  assert.equal(kk.selected, "035720");
  assert.equal(kk.match.via, "code");
});
test("일반 형식(국내): 제목 줄 건너뛰고 머리글, (주)·(원) 단위 머리글, 매입금액→평단, USD 행은 다른 시장", () => {
  const p = core.buildImportPreview(fixture("generic_kr_cp949.csv"), KR, "kr");
  assert.equal(p.format.id, "generic");
  assert.equal(p.headerLine, 3);   // 빈 줄은 세지 않는다
  const byName = Object.fromEntries(p.rows.map((r) => [r.rawName, r]));
  assert.equal(byName["삼성전자"].selected, "005930");
  assert.equal(byName["KODEX 200"].selected, "069500");
  // 코드 없는 행: 이름으로 정확히 일치 → 자동, 평단 = 매입금액 ÷ 수량
  assert.equal(byName["현대차"].selected, "005380");
  assert.equal(byName["현대차"].match.via, "name");
  assert.equal(byName["현대차"].avg, 200000);
  // 해외주식 행
  assert.equal(byName["애플"].selected, "");
  assert.match(byName["애플"].skip, /다른 시장/);
  // 애매한 이름 → 후보만, 자동 선택 안 함
  assert.equal(byName["전자"].match.status, "ambiguous");
  assert.equal(byName["전자"].selected, "");
  assert.ok(byName["전자"].match.candidates.some((c) => c.ticker === "005930"));
  assert.ok(byName["전자"].match.candidates.some((c) => c.ticker === "066570"));
  assert.ok(!p.rows.some((r) => r.rawName === "총계"));
});
test("일반 형식(미국): Symbol/Quantity/Average Cost, BRK/B → BRK.B, 소수 수량", () => {
  const p = core.buildImportPreview(fixture("generic_us_utf8.csv"), US, "us");
  assert.equal(p.format.id, "generic");
  assert.deepEqual(p.rows.map((r) => r.selected), ["AAPL", "BRK.B", "VOO"]);
  assert.equal(p.rows[1].avg, 1012);
  assert.equal(p.rows[2].qty, 4.5);
});
test("Mir 내보내기 형식", () => {
  const p = core.buildImportPreview(fixture("mir_export_utf8bom.csv"), US, "us");
  assert.equal(p.format.id, "mir");
  assert.deepEqual(p.rows.map((r) => [r.selected, r.qty, r.avg]), [["NVDA", 3, 120.5], ["QQQ", 2, 450]]);
});
test("머리글 없는 3열", () => {
  const p = core.buildImportPreview(fixture("legacy_noheader.csv"), US, "us");
  assert.equal(p.format.id, "legacy");
  assert.deepEqual(p.rows.map((r) => r.selected), ["AAPL", "MSFT"]);
});
test("인식 못 하는 파일은 오류 메시지", () => {
  const p = core.buildImportPreview("날짜,메모\n2026-01-01,안녕\n", KR, "kr");
  assert.equal(p.format, null);
  assert.ok(p.error);
});
test("이름 매칭: 영문 법인 표기 무시, 우선주는 따로", () => {
  const idxUs = core.buildUniverseIndex(US);
  assert.equal(core.matchInstrument({ rawName: "APPLE INC", rawCode: "" }, idxUs, "us").ticker, "AAPL");
  const idxKr = core.buildUniverseIndex(KR);
  assert.equal(core.matchInstrument({ rawName: "삼성전자우", rawCode: "" }, idxKr, "kr").ticker, "005935");
  assert.equal(core.matchInstrument({ rawName: "(주)카카오", rawCode: "" }, idxKr, "kr").ticker, "035720");
  assert.equal(core.matchInstrument({ rawName: "삼성전자(005930)", rawCode: "" }, idxKr, "kr").via, "code");
  assert.equal(core.matchInstrument({ rawName: "없는회사", rawCode: "" }, idxKr, "kr").status, "none");
});

// ----- 반영 -----
test("applyImport: 같은 종목 여러 계좌는 수량 합·평단 가중평균, 기존은 갱신", () => {
  const rows = [
    { selected: "005930", qty: 10, avg: 70000, skip: "" },
    { selected: "005930", qty: 30, avg: 80000, skip: "" },
    { selected: "000660", qty: 1, avg: 100, skip: "" },
    { selected: "", qty: 1, avg: 1, skip: "" },
    { selected: "035720", qty: 1, avg: 1, skip: "수량 없음" },
  ];
  const r = core.applyImport([{ ticker: "000660", qty: 5, avgCost: 90 }, { ticker: "069500", qty: 1, avgCost: 1 }], rows);
  assert.equal(r.added, 1);
  assert.equal(r.updated, 1);
  const ss = r.next.find((p) => p.ticker === "005930");
  assert.equal(ss.qty, 40);
  assert.equal(ss.avgCost, 77500);
  assert.equal(r.next.length, 3);
  const rep = core.applyImport([{ ticker: "069500", qty: 1, avgCost: 1 }], rows, { replace: true });
  assert.ok(!rep.next.some((p) => p.ticker === "069500"));
});
test("applyImport: 상한 초과는 건너뜀", () => {
  const r = core.applyImport([{ ticker: "A", qty: 1, avgCost: 1 }], [{ selected: "B", qty: 1, avg: 1, skip: "" }], { limit: 1 });
  assert.equal(r.skipped, 1);
});

if (failures.length) {
  console.error(`broker-csv-core: ${failures.length} 실패 / ${passed} 통과`);
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log(`broker-csv-core: ${passed}개 통과`);
