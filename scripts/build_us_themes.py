"""미국 테마 분류 — 테마 ETF 의 SEC Form N-PORT 보유 내역으로 편입한다.

국내 테마(build_kr_themes.py)가 DART 사업보고서 원문 문장을 근거로 삼듯, 미국은 '이 테마를 표방하는
ETF 가 실제로 담은 종목'을 근거로 삼는다. 키워드·LLM 판정 없이 공시된 보유 비중만 쓴다.

입력(build_us_etf_holdings.py 산출, 레포 안 — 네트워크 없음):
  data/etf_holdings/etf/<ETF>.json   ETF 별 상위 25 보유(티커·비중)·기준일(asOf)
  data/etf_holdings/rev/<첫글자>.json 종목 → 그 종목 비중이 큰 ETF 상위 10
  data/market_snapshot.json          미국 유니버스(스냅샷에 있는 보통주만 편입 — 등락을 낼 수 있어야 한다)

편입: 테마 ETF 상위 25 보유 종목 전부 + 역조회에서 테마 ETF 비중이 MIN_REV_WEIGHT% 이상인 종목.
     종목별 근거 e = [[ETF, 비중%], ...](비중 내림차순). 테마당 MAX_MEMBERS 까지(최대 비중순).

출력: data/us_themes.json / data/us_themes.js (window.US_THEMES) — kr-themes.js 가 국내와 같은 화면으로 그린다.
등락은 화면이 스냅샷으로 계산하므로 이 파일은 ETF 보유가 바뀔 때(월 1회, market-calendar.yml etf 잡)만 다시 만든다.

실행: py scripts/build_us_themes.py [--push]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

ETF_DIR = ROOT / "data" / "etf_holdings" / "etf"
REV_DIR = ROOT / "data" / "etf_holdings" / "rev"
SNAPSHOT = ROOT / "data" / "market_snapshot.json"
OUT_JSON = ROOT / "data" / "us_themes.json"
OUT_JS = ROOT / "data" / "us_themes.js"

MIN_REV_WEIGHT = 0.5   # 역조회로만 걸린 종목은 테마 ETF 비중 0.5% 이상일 때만(지수형 꼬리 보유 제외)
MAX_MEMBERS = 40

# (id, 이름, 분류, ETF 목록, 설명). ETF 는 data/etf_holdings 에 있는 것만 실제로 쓰인다.
THEMES = [
    ("ai", "AI·인공지능", "AI·소프트웨어", ["AIQ", "WTAI", "AIS", "IGPT"],
     "AI 모델·플랫폼과 이를 돌리는 반도체·클라우드 기업들이다. 빅테크의 AI 설비투자와 AI 서비스 수익화 속도가 흐름을 좌우한다."),
    ("cybersecurity", "사이버보안", "AI·소프트웨어", ["CIBR", "BUG", "IHAK"],
     "네트워크·엔드포인트·신원 보안 소프트웨어 기업들이다. 기업 보안 예산과 대형 해킹 사고, 정부 규제가 수요를 움직인다."),
    ("cloud", "클라우드", "AI·소프트웨어", ["SKYY"],
     "퍼블릭 클라우드 인프라와 SaaS 기업들이다. 기업 IT 지출과 AI 워크로드 이전이 성장률을 좌우한다."),
    ("software", "소프트웨어", "AI·소프트웨어", ["IGV"],
     "기업용·소비자용 소프트웨어 기업들이다. 구독 매출 성장률과 AI 기능 도입에 따른 가격 정책이 관건이다."),
    ("internet", "인터넷 플랫폼", "AI·소프트웨어", ["FDN"],
     "검색·전자상거래·소셜·스트리밍 등 인터넷 플랫폼 기업들이다. 광고 경기와 이용자 지표가 실적을 움직인다."),
    ("quantum", "양자컴퓨팅", "AI·소프트웨어", ["QTUM"],
     "양자컴퓨터 하드웨어·소프트웨어와 관련 반도체·클라우드 기업들이다. 기술 이정표 발표와 정부 지원이 주가를 크게 흔든다."),
    ("fintech", "핀테크·블록체인", "AI·소프트웨어", ["ARKF", "BLOK"],
     "디지털 결제·온라인 금융·가상자산 거래소와 채굴 기업들이다. 금리와 가상자산 가격, 규제 변화에 민감하다."),
    ("semis", "반도체", "반도체", ["SMH", "SOXX", "PSI", "XSD", "FTXL", "SOXQ"],
     "반도체 설계·파운드리·메모리·장비 기업들이다. AI 가속기 수요와 메모리 가격 사이클, 수출 규제가 업황을 좌우한다."),
    ("datacenter", "데이터센터·디지털 인프라", "반도체", ["DTCR"],
     "데이터센터 리츠·통신탑·네트워크 장비 기업들이다. AI 데이터센터 증설 규모와 전력 확보가 성장의 병목이다."),
    ("ai_power", "AI 전력 인프라", "에너지·전력", ["AIPO"],
     "AI 데이터센터가 쓰는 전력을 만들고 보내는 발전·전력기기·냉각 기업들이다. 데이터센터 전력 계약과 전력망 투자가 수요를 만든다."),
    ("nuclear", "원전·우라늄", "에너지·전력", ["NLR", "URA", "NUKZ"],
     "원전 운영·SMR 개발·우라늄 채굴과 농축 기업들이다. 원전 정책과 빅테크의 원전 전력 구매 계약, 우라늄 가격이 변수다."),
    ("smart_grid", "전력망·스마트그리드", "에너지·전력", ["GRID"],
     "송배전 설비·전력 관리·계량기 기업들이다. 노후 전력망 교체와 전력 수요 증가에 따른 유틸리티 설비투자가 수요다."),
    ("clean_energy", "클린에너지", "에너지·전력", ["ICLN", "QCLN"],
     "태양광·풍력·연료전지·전기차 관련 기업들이다. 금리 수준과 정부 보조금 정책이 수익성을 크게 좌우한다."),
    ("solar", "태양광", "에너지·전력", ["TAN"],
     "태양광 모듈·인버터·설치 기업들이다. 세액공제 정책과 모듈 가격, 금리가 수요를 움직인다."),
    ("oil_services", "유전 서비스", "에너지·전력", ["OIH"],
     "시추·유전 장비·해양 플랜트 서비스 기업들이다. 유가와 석유회사들의 탐사·생산 투자 규모를 따라간다."),
    ("oil_ep", "석유·가스 탐사생산", "에너지·전력", ["XOP"],
     "원유·천연가스를 직접 탐사하고 생산하는 기업들이다. 유가·가스 가격에 실적이 거의 그대로 연동된다."),
    ("midstream", "미드스트림·파이프라인", "에너지·전력", ["AMLP", "MLPA"],
     "원유·가스 파이프라인과 저장·처리 시설 기업들이다. 물동량 기반 수수료 사업이라 배당이 높고 금리에 민감하다."),
    ("gold_miners", "금광", "소재", ["GDX", "GDXJ"],
     "금을 캐는 광산 기업들이다. 금 가격에 레버리지가 걸려 금값보다 크게 움직인다."),
    ("silver_miners", "은광", "소재", ["SIL", "SLVP"],
     "은과 귀금속을 캐는 광산 기업들이다. 은 가격과 태양광·전자 산업용 수요가 변수다."),
    ("copper", "구리", "소재", ["COPX"],
     "구리를 캐는 광산 기업들이다. 전기화·전력망·데이터센터 투자로 늘어나는 구리 수요와 중국 경기가 가격을 좌우한다."),
    ("lithium_battery", "리튬·배터리", "소재", ["LIT"],
     "리튬 채굴·정련과 2차전지 셀·소재 기업들이다. 전기차 판매와 리튬 가격 사이클에 크게 흔들린다."),
    ("rare_earth", "희토류·전략금속", "소재", ["REMX"],
     "희토류·리튬·우라늄 등 전략 광물 기업들이다. 중국의 수출 통제와 각국의 공급망 확보 정책이 변수다."),
    ("metals_mining", "금속·광업", "소재", ["XME", "PICK"],
     "철강·알루미늄·구리·광산 기업들이다. 경기와 원자재 가격, 관세 정책에 민감하다."),
    ("defense", "방산·항공우주", "산업·인프라", ["ITA", "PPA", "XAR"],
     "방산 장비·항공기·부품 기업들이다. 국방 예산과 지정학 긴장, 민항기 인도 일정이 실적을 좌우한다."),
    ("space", "우주·자율기술", "산업·인프라", ["ARKX"],
     "위성·발사체·우주 통신과 자율 시스템 기업들이다. 정부·민간 발사 계약과 위성 인터넷 확장이 변수다."),
    ("robotics", "로봇·자동화", "산업·인프라", ["BOTZ", "ROBO", "ARKQ"],
     "산업용 로봇·자동화 장비·머신비전·자율주행 기업들이다. 제조업 설비투자와 인건비, AI 로봇 상용화 속도가 관건이다."),
    ("infrastructure", "미국 인프라 건설", "산업·인프라", ["PAVE", "IFRA"],
     "도로·교량·전력·건설기계와 건자재 기업들이다. 연방 인프라 예산 집행과 리쇼어링 공장 건설이 수요를 만든다."),
    ("reshoring", "제조업 리쇼어링", "산업·인프라", ["AIRR"],
     "미국 내 공장 건설·산업 장비·지역 은행 등 제조업 회귀 수혜 기업들이다. 관세와 산업 보조금 정책을 따라간다."),
    ("water", "물·수처리", "산업·인프라", ["FIW", "PHO", "CGW"],
     "수도 유틸리티·수처리 장비·계량기 기업들이다. 노후 수도관 교체와 수질 규제가 안정적인 수요를 만든다."),
    ("airlines", "항공사", "산업·인프라", ["JETS"],
     "미국·글로벌 항공사와 공항 관련 기업들이다. 여행 수요와 유가(연료비)가 이익을 좌우한다."),
    ("homebuilders", "주택건설", "산업·인프라", ["ITB", "XHB"],
     "주택 건설사와 건자재·인테리어 기업들이다. 모기지 금리와 주택 착공·판매 지표에 민감하다."),
    ("biotech", "바이오텍", "헬스케어", ["XBI", "IBB", "FBT"],
     "신약을 개발하는 바이오 기업들이다. 임상 결과와 FDA 승인, M&A, 금리에 크게 흔들린다."),
    ("genomics", "유전체·정밀의료", "헬스케어", ["ARKG"],
     "유전자 분석·편집·정밀 진단 기업들이다. 임상 성과와 기술 상용화 속도가 변수다."),
    ("med_devices", "의료기기", "헬스케어", ["IHI"],
     "수술 로봇·심혈관·당뇨 기기 등 의료기기 기업들이다. 수술 건수와 신제품 승인이 실적을 움직인다."),
    ("pharma", "대형 제약", "헬스케어", ["IHE", "PPH"],
     "대형 제약사들이다. 비만·항암 신약 매출과 약가 정책, 특허 만료가 변수다."),
    ("health_providers", "헬스케어 서비스·보험", "헬스케어", ["IHF"],
     "건강보험사·병원·의료 서비스 기업들이다. 의료 이용률과 정부 보험(메디케어) 수가 정책에 민감하다."),
    ("regional_banks", "지역은행", "금융", ["KRE", "IAT"],
     "미국 지역 은행들이다. 금리 곡선과 예금 이탈, 상업용 부동산 대출 건전성이 변수다."),
    ("big_banks", "대형은행", "금융", ["KBWB", "KBE"],
     "미국 대형·중대형 은행들이다. 순이자마진과 IB·트레이딩 수익, 자본 규제가 실적을 좌우한다."),
    ("brokers", "증권·거래소", "금융", ["IAI"],
     "증권사·자산운용·거래소 기업들이다. 증시 거래대금과 IPO·M&A 경기를 따라간다."),
    ("cannabis", "대마초", "소비재", ["MSOS"],
     "미국 대마초 생산·판매 기업들이다. 연방 규제 완화(재분류) 기대에 주가가 크게 흔들린다."),
    ("agribusiness", "농업·애그리비즈니스", "소비재", ["MOO"],
     "비료·농기계·종자·곡물 가공 기업들이다. 곡물 가격과 날씨, 농가 소득이 수요를 좌우한다."),
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build() -> dict:
    snap = load_json(SNAPSHOT)
    universe = {}
    for s in snap.get("stocks", []):
        t = str(s.get("ticker") or "")
        sector = str(s.get("sector") or "").upper()
        if t and sector not in ("ETF", "EXCHANGE TRADED FUNDS"):
            universe[t] = s

    etf_meta: dict[str, dict] = {}
    holdings: dict[str, dict[str, float]] = {}   # ETF → {티커: 비중}
    for path in sorted(ETF_DIR.glob("*.json")):
        d = load_json(path)
        e = d.get("ticker") or path.stem
        etf_meta[e] = {"name": d.get("name") or e, "asOf": d.get("asOf"), "n": d.get("holdingsCount")}
        holdings[e] = {h["t"]: float(h.get("w") or 0) for h in d.get("top", []) if h.get("t") and h.get("k", "equity") == "equity"}

    # 역조회: 상위 25 밖이라도 테마 ETF 가 의미 있게(MIN_REV_WEIGHT% 이상) 담은 종목
    for path in sorted(REV_DIR.glob("*.json")):
        for t, row in load_json(path).items():
            for e, w in row.get("top", []):
                if e in holdings and float(w) >= MIN_REV_WEIGHT:
                    holdings[e].setdefault(t, float(w))

    themes = []
    used_etfs: set[str] = set()
    count = 0
    for tid, name, group, etfs, about in THEMES:
        have = [e for e in etfs if e in holdings]
        if not have:
            print(f"  ! {tid}: 보유 데이터가 있는 ETF 없음 ({', '.join(etfs)}) — 건너뜀")
            continue
        used_etfs.update(have)
        ev: dict[str, list] = {}
        for e in have:
            for t, w in holdings[e].items():
                if t in universe and w > 0:
                    ev.setdefault(t, []).append([e, round(w, 2)])
        members = []
        for t, pairs in ev.items():
            pairs.sort(key=lambda p: -p[1])
            members.append({"t": t, "by": "etf", "e": pairs})
        members.sort(key=lambda m: (-m["e"][0][1], -len(m["e"]), m["t"]))
        members = members[:MAX_MEMBERS]
        members.sort(key=lambda m: m["t"])
        count += len(members)
        themes.append({"id": tid, "name": name, "group": group, "desc": about.split(".")[0], "about": about,
                       "etfs": have, "members": members})

    as_of = sorted({m["asOf"] for e, m in etf_meta.items() if e in used_etfs and m.get("asOf")})
    kst = datetime.now(timezone(timedelta(hours=9)))
    return {
        "schema": 1,
        "market": "us",
        "updatedAtKst": kst.strftime("%Y-%m-%d %H:%M KST"),
        "source": "SEC Form N-PORT — 테마 ETF 보유 내역(상위 25 + 비중 0.5% 이상 역조회)",
        "asOfRange": [as_of[0], as_of[-1]] if as_of else None,
        "count": count,
        "themeCount": len(themes),
        "etfs": {e: etf_meta[e] for e in sorted(used_etfs)},
        "themes": themes,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    payload = build()
    from sec_client import write_data
    write_data(OUT_JSON, OUT_JS, "US_THEMES", payload, indent=None)
    print(f"미국 테마 {payload['themeCount']}개 · 편입 {payload['count']}건 · ETF {len(payload['etfs'])}개 · 기준 {payload['asOfRange']}")
    if args.push:
        from sec_client import git_publish
        if not git_publish(["data/us_themes.json", "data/us_themes.js"], "US themes (ETF N-PORT)"):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
