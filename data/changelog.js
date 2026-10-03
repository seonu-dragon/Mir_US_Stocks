window.MIR_CHANGELOG = {
  "note": "업데이트 소식(손으로 쓰는 파일, 빌더 없음). 새 항목은 맨 위에 추가하고 data/changelog.js 도 같은 내용으로 고칠 것 — scripts/tests/test_changelog_core.mjs 가 두 파일이 같은지, id·날짜·링크·화면 id 가 올바른지 본다. targets 는 index.html/analysis.html 의 요소 id(그 화면 맨 위에 '새 기능' 카드), 비우면 목록에만 나온다.",
  "updatedAt": "2026-10-03",
  "entries": [
    {
      "id": "2026-10-03-theme-flow",
      "date": "2026-10-03",
      "title": "테마 화면을 흐름 중심으로",
      "desc": "테마 탭을 강세·약세 요약 카드, 테마 지도, 테마 로테이션(시장 대비 1주·1개월), 내 관심·보유 종목이 든 테마, 주도주를 붙인 전체 표로 다시 짰습니다. 테마를 누르면 테마 지수 차트(코스피 200 비교), 종목별 등락 기여, 오늘 움직인 이유, 연관 테마를 한 화면에서 봅니다. 하루 ±30%를 넘는 미수정 가격 종목은 테마 등락에서 빼고 기본 집계는 중앙값입니다.",
      "link": "?tab=krtheme&market=kr",
      "targets": [
        "tab-krtheme"
      ],
      "market": "kr",
      "pr": null
    },
    {
      "id": "2026-10-01-stock-chart-tab",
      "date": "2026-10-01",
      "title": "종목 상세에 차트 탭을 따로",
      "desc": "개요 탭에 함께 있던 종목 차트를 맨 앞 '차트' 탭으로 분리했습니다. 종목을 열면 차트 탭이 먼저 보이고, 기술 점수 분석과 일별 시세도 이 탭에 있습니다. 한눈 요약·뉴스·산업 지표·위험·기업개요는 개요 탭에서 봅니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us",
      "targets": [],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-10-01-named-filters",
      "date": "2026-10-01",
      "title": "찾기에 규칙을 공개한 필터 목록",
      "desc": "'52주 고점 5% 이내'처럼 규칙을 이름으로 쓴 필터를 시장별로 13~14개 모았습니다. 지금 통과 종목 수, 복사하거나 수식 스크리너에서 열 수 있는 수식, 백테스트 데이터가 있으면 기간·연환산 수익률·과적합 검사 한 줄을 보여 줍니다(과거 결과이며 미래 수익을 뜻하지 않습니다).",
      "link": "?tab=find&filter=near-52w-high",
      "targets": [
        "sub-filters"
      ],
      "focus": [
        "nfDetail"
      ],
      "market": "all"
    },
    {
      "id": "2026-10-01-fin-shareholder-return",
      "date": "2026-10-01",
      "title": "재무 탭에 주주환원 카드(배당·자사주)",
      "desc": "연도별 주당배당금과 배당성향(적자 해는 '적자'), 배당 주기·최근 1년 배당·현재 배당수익률, 자사주 공시와 주식수 변화를 한곳에 모았습니다. 출처·기준일을 달았고 배당 기록이 없는 종목·ETF 는 숨깁니다. 배당 랭킹으로 바로 갈 수 있습니다.",
      "link": "?tab=search&sub=analysis&ticker=KO&market=us&view=fin",
      "targets": [
        "sdv-fin"
      ],
      "focus": [
        "shareholderSection"
      ],
      "market": "all",
      "pr": 281
    },
    {
      "id": "2026-10-01-fin-mcap-overlay",
      "date": "2026-10-01",
      "title": "재무 차트에 시가총액(우) 겹쳐 보기",
      "desc": "매출·영업이익, 순이익·EPS 카드에서 '시가총액(우)'을 켜면 기말 종가 × 기말 주식수 선이 오른쪽 축에 겹칩니다. 액면분할·무상증자는 주식수를 같은 기준으로 환산했고, 맞출 수 없으면 수정주가만 그립니다. 같이 그렸을 뿐 인과 관계를 뜻하지 않습니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us&view=fin",
      "targets": [
        "sdv-fin"
      ],
      "focus": [
        "financialsSection"
      ],
      "market": "all",
      "pr": 281
    },
    {
      "id": "2026-10-01-today-market-feed",
      "date": "2026-10-01",
      "title": "오늘 탭에 '오늘 피드' — 시장 전체 하루 타임라인",
      "desc": "오늘 탭에 하위 탭 '오늘 피드'를 더했습니다. 미국은 8-K 요약·실적·특징주·내부자 거래·Form 144·경제지표, 국내는 DART 공시·특징주·IR·보호예수 해제를 하루 단위로 모읍니다. 종류 칩으로 거르고 종목을 누르면 분석으로 갑니다. 오늘 자료가 없으면 최근 자료일을 날짜와 함께 보여 줍니다.",
      "link": "?tab=today&sub=feed",
      "targets": [
        "tab-feed"
      ],
      "focus": [
        "marketFeed"
      ],
      "market": "all",
      "pr": 280
    },
    {
      "id": "2026-10-01-mobile-bottom-nav",
      "date": "2026-10-01",
      "title": "휴대폰 하단 탭 바와 종목 미니 바",
      "desc": "휴대폰에서 오늘·시장·종목·내 투자·검색을 화면 아래 탭 바로 바로 오갑니다. 종목 화면을 내리면 맨 위에 로고·이름·가격·등락과 관심(☆) 버튼이 한 줄로 고정되고, 개요·재무·밸류 등 6개 보기는 그 아래 칩 줄로 붙어 따라옵니다. 종목 검색 입력칸은 돋보기 버튼 안으로 접었습니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us",
      "targets": [],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-10-01-stock-summary-event-strip",
      "date": "2026-10-01",
      "title": "종목 상세에 한눈 요약 카드와 오늘·임박 이벤트 줄",
      "desc": "개요 탭 맨 위에 시가총액·최근 연간 매출·영업이익(전년 대비)·목표주가 컨센서스를 문장으로 정리하고, 5개년 실적 표와 최근 공시 5건을 함께 보여 줍니다. 가격 아래에는 실적 발표 7일 이내·배당·보호예수 해제·새 공시 중 가까운 일정을 한 줄로 띄우고, 누르면 이벤트·공시 탭으로 갑니다. 숫자마다 기준일·출처를 달았고 매매 추천이 아닙니다.",
      "link": "?tab=search&sub=analysis&ticker=005930&market=kr&view=overview",
      "targets": [
        "sdv-overview"
      ],
      "focus": [
        "stockSummaryCard",
        "stockEventStrip"
      ],
      "market": "all",
      "pr": 277
    },
    {
      "id": "2026-10-01-fin-val-chart-cards",
      "date": "2026-10-01",
      "title": "재무·밸류 탭 차트를 같은 틀의 카드로",
      "desc": "재무 탭의 매출·이익·현금흐름 등 차트 5종과 밸류 탭의 PER·PBR·PSR 밴드를 같은 모양의 카드로 나란히 보여 줍니다. 카드마다 차트↔표 전환이 있고, 고른 보기는 이 브라우저에 기억합니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us&view=fin",
      "targets": [
        "sdv-fin",
        "sdv-val"
      ],
      "focus": [
        "financialsSection",
        "valuationBand"
      ],
      "market": "all",
      "pr": 276
    },
    {
      "id": "2026-10-01-kr-daily-naver",
      "date": "2026-10-01",
      "title": "국내 일봉을 네이버 금융(수정주가) 기준으로 통일",
      "desc": "국내 종목 차트·일별 시세의 과거 종가를 야후 대신 네이버 금융 수정주가로 맞췄습니다. 거래량은 KRX·NXT 합산이며, 네이버 일봉이 없는 종목만 야후 값을 쓰고 각주에 출처를 적습니다.",
      "link": "?market=kr&tab=search&sub=analysis&ticker=005930",
      "targets": [],
      "market": "kr",
      "pr": 274
    },
    {
      "id": "2026-10-01-kr-session-consistency",
      "date": "2026-10-01",
      "title": "국내 종목 화면, 같은 날짜는 같은 시세로",
      "desc": "머리글·시세정보 카드·일별 시세 표가 같은 기준일 종가와 시가·고가·저가를 보여 줍니다. 아직 확정되지 않은 오늘 봉에는 '장중'·'잠정' 표시를 붙였습니다.",
      "link": "?market=kr&tab=search&sub=analysis&ticker=005930",
      "targets": [],
      "market": "kr",
      "pr": 272
    },
    {
      "id": "2026-10-01-analysis-13f-card",
      "date": "2026-10-01",
      "title": "차트 분석 페이지의 기관·내부자 수급 카드",
      "desc": "'상세 분석 더보기'를 펼치면 SEC 13F 보고 기관 전체 기준 보유 현황과 최근 내부자 거래를 불러옵니다. 예전에는 이 페이지에서 늘 '데이터 없음'으로 나왔습니다.",
      "link": "analysis.html?t=NVDA&market=us",
      "targets": [
        "caMain"
      ],
      "focus": [
        ".cprob-more"
      ],
      "market": "us",
      "pr": 270
    },
    {
      "id": "2026-09-28-8k-summary-form144",
      "date": "2026-09-28",
      "title": "8-K 3줄 한국어 요약 · Form 144 매도 예정",
      "desc": "공시 › 8-K 피드에 계약·인수·임원 변동 등 주요 항목의 3줄 요약(규칙/AI 라벨)을 붙였습니다. 내부자 탭에서는 계열인의 매도 예정 신고(Form 144)를 실제 매도(Form 4)와 대조해 봅니다.",
      "link": "?market=us&tab=search&sub=events",
      "targets": [
        "sub-inst-events",
        "sub-inst-insider"
      ],
      "focus": [
        "sub-inst-events",
        "sub-inst-insider"
      ],
      "market": "us",
      "pr": 268
    },
    {
      "id": "2026-09-28-risk-factor-changes",
      "date": "2026-09-28",
      "title": "10-K 위험요인 전년 대비 변화",
      "desc": "연차보고서 위험요인(Item 1A)을 직전 해와 문단 단위로 비교해 새로 생긴·빠진·크게 바뀐 문단과 전체 유사도를 보여 줍니다. 종목 › 이벤트·공시 탭 맨 아래에 있습니다.",
      "link": "?market=us&tab=search&sub=analysis&ticker=NVDA&view=events",
      "targets": [
        "sdv-events"
      ],
      "focus": [
        "riskFactorsSection"
      ],
      "market": "us",
      "pr": 267
    },
    {
      "id": "2026-09-27-inst-holders-13f",
      "date": "2026-09-27",
      "title": "종목별 기관 보유 변화 (13F)",
      "desc": "이 종목을 13F로 보고한 기관이 분기마다 얼마나 늘리고 줄였는지 신규·증가·감소·청산으로 나눠 보여 줍니다. 종목 › 수급·보유 탭에 있습니다.",
      "link": "?market=us&tab=search&sub=analysis&ticker=NVDA&view=flow",
      "targets": [
        "sdv-flow"
      ],
      "focus": [
        "instHoldersCard"
      ],
      "market": "us",
      "pr": 265
    },
    {
      "id": "2026-09-27-segments",
      "date": "2026-09-27",
      "title": "사업부문·지역별 매출",
      "desc": "SEC 연차보고서 XBRL에서 사업부문·지역·제품별 매출을 뽑아 비중과 전년 대비 증감을 보여 줍니다. 종목 › 재무 탭, 재무 섹션 아래에 있습니다.",
      "link": "?market=us&tab=search&sub=analysis&ticker=AAPL&view=fin",
      "targets": [
        "sdv-fin"
      ],
      "focus": [
        "segmentsSection"
      ],
      "market": "us",
      "pr": 264
    },
    {
      "id": "2026-09-27-kr-lockups",
      "date": "2026-09-27",
      "title": "보호예수 해제 캘린더 · 공모주 경쟁률",
      "desc": "신규 상장주의 의무보유 해제 예정일(상장일 + 기간으로 계산한 추정일)을 캘린더 '보호예수 해제' 칩으로 모았습니다. 종목 화면에는 수요예측·청약 경쟁률과 확약 비율도 나옵니다.",
      "link": "?market=kr&tab=calendar&sub=all",
      "targets": [
        "tab-calendar"
      ],
      "focus": [
        "tab-calendar"
      ],
      "market": "kr",
      "pr": 263
    },
    {
      "id": "2026-09-27-kr-themes",
      "date": "2026-09-27",
      "title": "국내 테마 — 사업보고서 근거 문장으로 분류",
      "desc": "DART 사업보고서 원문에 근거 문장이 있는 종목만 테마에 넣고, 그 문장을 함께 보여 줍니다. 시장 › 테마에서 테마별 등락을, 종목 화면에서 '이 종목의 테마'를 볼 수 있습니다.",
      "link": "?market=kr&tab=krtheme",
      "targets": [
        "tab-krtheme"
      ],
      "focus": [
        "tab-krtheme"
      ],
      "market": "kr",
      "pr": 261
    },
    {
      "id": "2026-09-27-cross-market",
      "date": "2026-09-27",
      "title": "국내↔미국 연관 종목",
      "desc": "직접 정리한 관계 사전과 과거 수익률 상관으로 국내·미국 연관 종목을 잇습니다. 오늘 탭에 '간밤 미국 연관주'(국내)·'국내 장 연관주'(미국)가, 종목 개요 탭에 연관 종목 카드가 나옵니다.",
      "link": "?tab=today",
      "targets": [
        "tab-today-summary"
      ],
      "focus": [
        "crossMarketHome",
        "crossMarketCard"
      ],
      "market": "all",
      "pr": 260
    },
    {
      "id": "2026-09-27-lookthrough-csv",
      "date": "2026-09-27",
      "title": "ETF 룩스루 · 증권사 CSV 가져오기",
      "desc": "보유 ETF를 구성 종목으로 펼쳐 실제 종목·섹터 노출과 ETF 간 중복을 계산합니다(ETF를 보유했을 때). 키움 잔고 등 증권사 CSV로 보유 종목을 한 번에 넣을 수 있습니다.",
      "link": "?tab=bulk&sub=holdings",
      "targets": [
        "sub-bulk-holdings"
      ],
      "focus": [
        "lookthroughCard",
        "pfImportCsv"
      ],
      "market": "all",
      "pr": 259
    },
    {
      "id": "2026-09-27-risk-check",
      "date": "2026-09-27",
      "title": "재무 위험 점검 체크리스트",
      "desc": "Piotroski F-Score·Altman Z·Beneish M·주식 수 희석·이자보상배율 등을 '통과 n/m'과 근거 수치로 보여 줍니다. 종목 › 재무 탭, 재무 섹션 바로 아래에 있습니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us&view=fin",
      "targets": [
        "sdv-fin"
      ],
      "focus": [
        "riskCheckSection"
      ],
      "market": "all",
      "pr": 258
    },
    {
      "id": "2026-09-27-timeline",
      "date": "2026-09-27",
      "title": "종목 통합 타임라인 · 차트 키 모먼트",
      "desc": "공시·실적·배당·지분 변동·특징주를 한 종목의 최신순 목록으로 모았습니다. 큰 등락이 있던 날은 차트에 표시되고 같은 무렵의 사건을 함께 보여 줍니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us&view=events",
      "targets": [
        "sdv-events"
      ],
      "focus": [
        "stockTimeline"
      ],
      "market": "all",
      "pr": 257
    },
    {
      "id": "2026-09-27-my-digest",
      "date": "2026-09-27",
      "title": "\"오늘 내 주식은\" 보유·관심 요약",
      "desc": "보유·관심 종목의 오늘 움직임과 사건을 3줄로, 주간 모드에서는 종목별 기여도로 정리합니다. 오늘 › 요약과 내 투자 › 보유·관심 맨 위에 있습니다.",
      "link": "?tab=bulk&sub=holdings",
      "targets": [
        "tab-today-summary",
        "sub-bulk-holdings"
      ],
      "focus": [
        "myDigestToday",
        "myDigestBulk"
      ],
      "market": "all",
      "pr": 256
    },
    {
      "id": "2026-09-26-market-indicators",
      "date": "2026-09-26",
      "title": "시장지표 탭 · 환율 계산기",
      "desc": "지수·지수 선물·환율·5개국 국채 10년·기준금리·원자재를 한 화면 표로 모았습니다. 환율 표 아래에는 원화 기준 환율 계산기가 있습니다.",
      "link": "?tab=marketindex",
      "targets": [
        "tab-marketindex"
      ],
      "focus": [
        "tab-marketindex"
      ],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-09-26-unified-calendar",
      "date": "2026-09-26",
      "title": "통합 캘린더 '전체 일정'",
      "desc": "실적·배당·공모주·경제지표·휴장·만기 일정을 주/월 달력 한 곳에서 보고, 칩으로 종류를 거르거나 관심·보유 종목만 볼 수 있습니다.",
      "link": "?tab=calendar&sub=all",
      "targets": [
        "tab-calendar"
      ],
      "focus": [
        "tab-calendar"
      ],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-09-26-formula-screener",
      "date": "2026-09-26",
      "title": "수식 스크리너 · 과거 백테스트",
      "desc": "pe < sectorMedian(pe) 같은 수식으로 종목을 거르고, 그 조건을 과거에 적용했을 때의 성과와 과적합 검사 결과를 함께 봅니다. 수식은 링크로 공유할 수 있습니다.",
      "link": "?tab=search&sub=formula",
      "targets": [
        "sub-formula"
      ],
      "focus": [
        "sub-formula"
      ],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-09-26-event-study",
      "date": "2026-09-26",
      "title": "이벤트 스터디",
      "desc": "실적·계약·자사주·증자 같은 공시 유형별로 발표 뒤 초과수익이 평균적으로 어땠는지 표본 수·신뢰구간과 함께 보여 줍니다. 공시 칩 줄 맨 앞에 있습니다.",
      "link": "?tab=search&sub=eventstudy",
      "targets": [
        "sub-eventstudy"
      ],
      "focus": [
        "sub-eventstudy"
      ],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-09-26-reverse-dcf",
      "date": "2026-09-26",
      "title": "역DCF · 시나리오 DCF",
      "desc": "현재 주가가 앞으로 몇 %의 현금흐름 성장을 가정하고 있는지 역산하고, 가정을 바꿔 적정가 범위를 계산해 봅니다. 종목 › 밸류 탭에 있습니다.",
      "link": "?tab=search&sub=analysis&ticker=NVDA&market=us&view=val",
      "targets": [],
      "focus": [
        "dcfSection"
      ],
      "market": "all",
      "pr": null
    },
    {
      "id": "2026-09-26-thesis-tracker",
      "date": "2026-09-26",
      "title": "투자 가설 추적",
      "desc": "종목을 산 근거와 측정 가능한 폐기 조건을 적어 두면, 방문할 때마다 조건 위반·근접 여부와 벤치마크 대비 성적을 점검합니다. 내 투자 › 도구에 있습니다.",
      "link": "?tab=tools&tool=thesis",
      "targets": [
        "sub-bulk-tools"
      ],
      "focus": [
        "thesisFold"
      ],
      "market": "all",
      "pr": null
    }
  ]
};
