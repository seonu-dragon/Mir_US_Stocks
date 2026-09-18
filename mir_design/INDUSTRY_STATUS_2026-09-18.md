# 산업·매크로 선행지표 — 구현 현황·미완·할 일·추가 데이터 후보 (2026-09-18)

> 기획서 `INDUSTRY_INDICATORS_DESIGN.md`(10장 인수인계)의 실행 결과 정리. 다음 세션은 이 문서 → 기획서 10.10 → 카탈로그 순으로 보면 된다.
> 라이브: https://seonu-dragon.github.io/Mir_US_Stocks/index.html?tab=industry

---

## 1. 오늘 한 것 (PR #193 ~ #200, 전부 머지·배포·라이브 확인)

| PR | 내용 | 결과 |
| :-- | :-- | :-- |
| #193 | 수집기 P0-a — `scripts/build_industry_indicators.py`(FRED·TWSE/TPEx 월매출·ECOS·OECD), 게이트, 워크플로우 `Industry indicators`(매일 06:10 KST), 배포 트리거·신선도 게이트·feature-data·신뢰도 센터 등록, 기획서·카탈로그 git 등록 | 지표 66 |
| #194 | **산업 지표 탭**(시장 탭 다섯 번째 잎, `industry.js`) — 좌측 내비·카테고리 홈·지표 상세(헤더·기간·변환·주가 겹치기·±σ·침체 음영·기간 등락·동월 비교·5년 통계·관련 상장사·같이 보는 지표·해석·CSV·링크), 딥링크 `?tab=industry&i=&t=`, 홈 검색 라우팅, sitemap 66 URL | 라이브 |
| #195 | 종목 분석 뷰 **역방향 위젯**(이 종목이 따라가는 산업 지표) · AI 모드 패널 · AI 리포트 컨텍스트 · 오늘 탭 **산업 신호등 카드** · 섹터 ETF 카드 **선행지표 스트립** | 라이브 |
| #196 | P0-b 무키 묶음 — Cboe(VIX9D·VIX3M·VVIX·SKEW·풋콜 적립), OFR FSI, 재무부 TGA 일별, IMF PCPS 8종, 일본은행 메모리 IC·장비 물가, BIS(REER·신용갭·DSR·주택), Census 데이터센터·제조·전력 건설지출, NRC 원자로 출력, FRED +20(CCC/BBB OAS·H.8·할인창구·CP·리볼빙·카드 상각·SLOOS·MMF·KC FSI·기대인플레·Sticky CPI·임금·5y5y·OVX·GVZ·경유), 크립토(스테이블코인·DVOL·공포탐욕) | 지표 119 |
| #197 | KR 묶음 — 관세청 HS 10단위(DRAM·플래시·MCP 수출단가, MCP 수출액, NCM 양극재·MLCC 단가, 탄산리튬 수입단가, 변압기·라면·화장품·톡신·태양광 수출액), ECOS +9(전자 BSI·전자부품 재고·예탁금·신용융자·건설수주·미분양·면세점·제조업 전력·여행비 CSI), 지역 연준 3종 + 합성, 용량 축소(일간 520·주간 400점, 점별 yoy 화면 계산) | 지표 144 |
| #198 | P0-c 파서 — 리치몬드·캔자스시티 연준 xlsx(합성 5/5), World Bank Pink Sheet 6종(요소·DAP·염화칼륨·고무·제재목·팜유) | 지표 152 |
| #199 | **8.1 선행 상관 검증 하네스** `industry_sensitivity.py` — 겹치지 않는 변화율·섹터 초과수익·lag 전반 60% 고정·후반 40% 단회·n_eff t 검정·블록 부트스트랩·BH FDR 10%. 통과 쌍만 꼬리표 | 478쌍 검사 · 통과 1 |
| #200 | FEATURES.md 산업 지표 절, 기획서 10.10 구현 이력 | 문서 |

**지표 152개 원천 요약**: FRED 70여 · 대만 월매출(TWSE/TPEx, 적립) 9 · 한국은행 ECOS 17 · 관세청 12 · OECD 2 · Cboe 5 · OFR 2 · FiscalData 1 · IMF PCPS 8 · 일본은행 2 · BIS 7 · Census 3 · NRC 1 · World Bank 6 · 리치몬드/KC 연준 2 · DefiLlama·Deribit·alternative.me 3 · 자체 계산 2(순유동성·지역 연준 합성). **새로 발급한 키 0개**(ECOS·DATA_GO_KR 은 기존 secret).

---

## 2. 라이브 검증 결과 (2026-09-18 12:0x KST 기준)

| 확인 항목 | 결과 |
| :-- | :-- |
| `data/industry_{indicators,by_ticker,signal,calendar,sensitivity}.js` 라이브 = origin/main | **5개 파일 모두 바이트 동일**(잘림·누락 없음) |
| 지표 수 / 카테고리 | 152 / 13, 실패 0, 승계 0, 카테고리 미배정 0 |
| 시계열 길이 | 일간 520점(30개) · 주간 400점(14개) · 월간 120점(83개, 관세청은 2016~ 45~56점) · 분기 44~60점. 짧은 것은 **대만 월매출 9개(적립 시작이라 3점)·Cboe 풋콜(4점)** — 예상된 상태, 매달/매일 쌓인다 |
| 신호등 | 판정 불가 10개 = 위 짧은 시리즈. 나머지 전부 판정됨 |
| 역인덱스 / 캘린더 | 216종목 / 향후 30일 발표 27건 |
| 화면 | 산업 지표 탭: 내비 13 카테고리·215 항목(한 지표가 여러 카테고리에 걸림), 차트·발표 스트립 정상, 한국 산업 카테고리 표 35행, 선행 검증 꼬리표 1개("7주 선행 · ρ −0.37 (표본외 n=105 · 95% 구간 −0.48~−0.23)"), 콘솔 오류 0 |
| 번들 | `dist/index.bundle.js?v=cd7a5a05de`(새 해시) |

`industry_indicators.js` 는 1.40MB. 2MB 를 넘기면 지표별 파일로 쪼개 lazy 로드(기획서 3장)로 간다.

---

## 3. 미처 못 한 것 (이유와 함께)

| 항목 | 상태 | 이유 / 다음 수 |
| :-- | :-- | :-- |
| 관세청 **10일 단위 수출 잠정치**(data.go.kr 15157908) — "세계에서 가장 빠른 공식 무역 통계" | 미구현 | API 명세가 사이트에 없고 `기술문서_….docx` 안에만 있어 엔드포인트·필드를 확보하지 못함 → **사용자가 docx 를 열어 주면** 반나절 |
| EIA 에너지 묶음(원유·가솔린 재고, 가스 재고, EIA-930 전력수요, 정제가동률, SPR, 원전 정지 MW) | 미구현 | `EIA_API_KEY` 없음(즉시 발급 가능) |
| P0-c 나머지 파서 | 미구현 | STB 철도(7.7MB xlsx), ETF 발행주식수 팩(ProShares·SSGA·iShares), FINRA 격주 공매도 잔고(무인증 POST), EDGAR EX-99 월간 KPI(PGR·카드사·LTL 3사), Q4 IR 피드(ICE·Cboe·Schwab·Costco), Boeing 주문·인도, KOFIA 예탁금 일별, KCCI, 마카오 DICJ XML, Epoch AI zip, Census BTOS xlsx, `bigtech_capex_sum`(10-Q XBRL YTD 차분), TSA 승객·Baker Hughes 리그·LA/LB TEU·Cass xls |
| P1 | 미구현 | 자체 계산 시장 폭(200일선 상회 비율·신고가-신저가·A/D·McClellan), XBRL Frames 바텀업 매크로, Kalshi(약관 확인 후), IMF PortWatch(라이선스 확인 후), 애틀랜타연준 MPT(LICENSE 시트 수동 확인 후), KOSIS·USDA FAS·AFDC(키) |
| 자동 해석 LLM 문장 | 미구현(의도) | 지금은 **사실 요소만 규칙으로** 조립한 한 줄. LLM 워커 경로는 8.4(숫자 일치 검사) 붙일 때 |
| og:image 사전 렌더·임계치 푸시 알림·롤링 상관·카드뉴스 "오늘의 산업 지표" | P2 | 기획서대로 보류 |
| 데이터 한계 표기 | 표시 중 | IMF 리튬(`PLITH`) 단위 미확인("단위 확인 중"), DRAM/플래시/MCP 수출단가(USD/kg)는 믹스에 흔들리는 무역통계 프록시, 월간 지표의 선행 검증은 종목 일봉 5년이라 전부 '표본 부족' |

---

## 4. 사용자가 해야 할 일 (Claude 가 대신 못 하는 것)

| # | 할 일 | 언제 | 효과 |
| :-- | :-- | :-- | :-- |
| 1 | **`EIA_API_KEY` 발급**(https://www.eia.gov/opendata/register.php, 이메일만) → GitHub Secrets 등록 | 다음 세션 전 | 에너지 지표 7~10개(재고·전력수요·정제·SPR·원전) |
| 2 | data.go.kr **15157908 기술문서 docx** 열어서 엔드포인트 URL·요청변수·응답필드 부분을 알려주기(스크린샷·복사 아무거나) | 아무 때나 | 10일 잠정치(반도체 포함) — KR 킬러 지표 |
| 3 | (선택) KOSIS OpenAPI 키, USDA NASS/FAS 키, NREL AFDC 키 | P1 때 | 반도체 출하·재고(KOSIS), 작황·수출판매, EV 충전소 |
| 4 | 광고·유료 플랜 계획이 생기면 알려주기 | 그때 | CC BY-NC 소스(Cloudflare Radar·Coin Metrics·Ookla)를 넣지 않았는데, 넣게 되면 그때 제거 |
| 5 | `AI/mir_ind_sens_wt`, `AI/mir_ind_docs_wt` 폴더 삭제 | 아무 때나 | OneDrive 가 잡고 있어 삭제 실패. git 등록은 해제됨 |
| 6 | (참고) Cloudflare 워커는 이번 작업에서 건드리지 않았다 — 수동 배포 불필요 | — | — |

---

## 5. 추가 데이터 후보 — 인베스팅닷컴·야후 파이낸스를 기준으로 본 빈 칸

두 서비스가 첫 화면·메뉴에 두는 것 가운데 **우리 사이트에 없거나 얇은 것**만 골랐다. 전부 무료·재게시 가능한 원천 기준. "난이도"는 소스 하나에 PR 하나 기준.

### 5.1 인베스팅닷컴 메뉴 대조

| 인베스팅 메뉴 | 우리 현황 | 채울 무료 원천 | 난이도 |
| :-- | :-- | :-- | :-- |
| **경제 캘린더 — 예측치·이전치·실제치·서프라이즈** | 캘린더 탭에 일정은 있으나 **컨센서스 칸이 비어 있음** | EIA STEO(공식 전망), Kalshi 내재확률(약관 확인 후), 우리 지표의 "추세 대비 서프라이즈"(8.2) | 중 |
| **원자재 시세 보드**(원유·금·은·구리·천연가스·밀·옥수수·대두·설탕·커피·코코아·목재·팔라듐·백금) | 금·WTI 만. 지수 띠에 GC=F 하나 | 야후 선물 확장(`CL=F BZ=F NG=F HG=F SI=F PL=F PA=F ZW=F ZC=F ZS=F SB=F KC=F CC=F LBR=F HRC=F ALI=F`, 카탈로그 C-6 생존 확인) — 워커 `?indices=` 목록에 넣으면 지수 띠·산업 탭 둘 다 | 하 |
| **세계 지수**(유로스톡스·DAX·FTSE·닛케이·항셍·상해·인도) | 미국 4·한국 2 | 야후 `^STOXX50E ^GDAXI ^FTSE ^N225 ^HSI 000001.SS ^BSESN` | 하 |
| **채권 — 국가별 10년물·스프레드** | 미국 곡선만 | FRED `IRLTLT01DEM156N`(독일) 등 OECD 장기금리 월간, 일본은행·ECB 일별은 각 API | 중 |
| **중앙은행 금리 보드** | 없음 | BIS `WS_CBPOL`(40여 개국 일별, 이미 쓰는 SDMX 패턴) | 하 |
| **ETF 자금흐름** | 없음 | 발행주식수 차분×NAV 자체 계산(ProShares·Direxion·SSGA·ARK·iShares CSV, 카탈로그 E-8) | 중 |
| **휴장일 캘린더** | 없음 | NYSE·KRX 휴장일 정적 표(연 1회 갱신) | 하 |
| **배당·분할 캘린더** | 배당 플래너 있음, 분할 없음 | 야후 `?ticker=` events / SEC 8-K | 중 |
| **통화 — 크로스 환율 표·실질실효환율** | USD/KRW·EUR·JPY·CNY·GBP | BIS REER(이미 KR·JP 있음 → US·CN·EU 추가는 한 줄) | 하 |
| **크립토 보드** | BTC·ETH 시세, 스테이블코인·DVOL·공포탐욕 | CoinGecko 상장사 BTC 보유(MSTR 등), blockchain.com 해시레이트·채굴수익, DEX 거래량 | 하 |

### 5.2 야후 파이낸스 메뉴 대조

| 야후 메뉴 | 우리 현황 | 채울 원천 | 난이도 |
| :-- | :-- | :-- | :-- |
| **Trending tickers / Most active / Gainers·Losers** | 급등·주도주 서브탭에 일부 | 스냅샷 거래량·등락률로 자체 계산(외부 소스 불필요) — 홈 카드로 노출 | 하 |
| **Analyst upgrades/downgrades 피드** | 컨센서스(Finnhub)는 있음, 변경 이벤트 피드는 없음 | Finnhub `/stock/upgrade-downgrade`(기존 키) | 하 |
| **Earnings calendar 주간 보드 + EPS 서프라이즈 이력** | 실적 일정·이력 있음 | `earningsHistory` 로 서프라이즈 승률 표 | 하 |
| **Holders(기관·내부자 비중)** | 13F·Form 4 있음 | 있는 데이터를 종목 헤더에 "기관 보유 비중" 한 줄로 | 하 |
| **Statistics(52주·베타·평균 거래량·유통주식수)** | 대부분 있음 | 유통주식수·베타는 Finnhub metric | 하 |
| **Sector/Industry performance heatmap** | 트리맵·섹터 탭 있음 | — | 완료 |
| **Options(IV·풋콜)** | 옵션 패널 있음 | Cboe 시장 전체 풋콜(이번에 추가) | 완료 |
| **Sustainability(ESG)** | 없음 | 무료 원천 없음(Sustainalytics 유료) | 넣지 않음 |

### 5.3 산업 지표 탭 자체에 더 넣을 것 (카탈로그에서 아직 안 쓴 것, 키 없음·고정 URL 우선)

| 지표 | 원천 | 난이도 | 비고 |
| :-- | :-- | :-- | :-- |
| 베이커휴즈 리그 수(주간) | bakerhughes.com 주간 Excel(링크 추출) | 중 | 업스트림 활동의 가장 빠른 실측 |
| TSA 일일 승객 | tsa.gov HTML 표 | 중 | 항공 수요 킬러 |
| LA/LB 항만 TEU | 항만 통계 HTML | 중 | 미국 수입 실측 |
| FINRA 신용융자 잔고(월) · ICI 주간 펀드 자금흐름 | Excel | 중 | 레버리지·리테일 자금 |
| 뉴욕연준 스태프 나우캐스트 · GSCPI · 침체확률 | xlsx / xls(GSCPI 는 실제 xls) | 중 | GDPNow 와 교차 |
| Shiller CAPE · Damodaran 내재 ERP · Fama-French 팩터 | xls/xlsx/zip | 중 | 밸류·팩터 기준선 |
| Indeed 섹터별 구인공고 | GitHub CSV(CC BY 4.0) | 하 | 산업 카테고리별 노동수요 |
| Redfin 주간 주택시장 · Zillow ZHVI/ZORI | S3 TSV / CSV | 하 | Census 월간보다 빠름 |
| Steam 하드웨어 GPU 점유율 · 동시접속 | HTML / JSON | 중 | NVDA·AMD 소비자 GPU |
| Epoch AI 칩 판매 추정 · Census BTOS AI 사용률 | zip CSV(CC BY 4.0) / xlsx | 중 | AI 실물 |
| 마카오 DICJ 월간 카지노 · LVCVA | XML / xlsx | 중 | LVS·WYNN·MGM |
| 노르웨이 EV 등록 · 현대차·기아 미국 판매 · NIO/XPEV/LI 월간 인도 | 보도자료 / 6-K | 중 | EV 실측 |
| 애틀랜타연준 Market Probability Tracker | xlsx 6.9MB(LICENSE 시트 확인 후) | 중 | FedWatch 무료 대체 |
| 적립형(AAII·NAAIM·Harpex·Drewry·Cameco 우라늄·AAR 철도·클리블랜드 나우캐스트) | HTML 최신값 1행 | 하~중 | 히스토리는 쌓이는 만큼만 |

### 5.4 우선순위 제안(다음 세션 첫 PR 후보)

1. **야후 선물·세계 지수 확장 + BIS 정책금리 보드**(전부 기존 패턴, 반나절) — 인베스팅닷컴 첫 화면과의 격차를 가장 싸게 줄인다.
2. **EIA 키 묶음**(키만 등록되면 하루) — 에너지 카테고리가 완성된다.
3. **캘린더 컨센서스 칸**(EIA STEO → Kalshi 순, 8.2 서프라이즈 반응) — "예측치 없는 캘린더"가 인베스팅닷컴 대비 가장 큰 약점.
4. 베이커휴즈·TSA·LA/LB·FINRA 신용융자·ICI(파서 5개, 소스당 PR 하나).
5. ETF 자금흐름 자체 계산(섹터 로테이션 일별).

---

## 6. 운영 메모 (다음 작업자용, 이번에 실측한 함정)

- 로컬엔 ECOS·DATA_GO_KR 키가 없어 로컬 빌드는 KR 지표를 '승계(carriedSince)' 처리한다 → **데이터 파일은 커밋하지 말고 머지 후 `gh workflow run "Industry indicators"`** 로 재생성.
- 소스별 UA 가 반대다: FRB·OFR·NRC·FRED 는 식별 UA, Cboe CDN 은 브라우저 UA. TWSE/TPEx 인증서는 Python 3.13 `VERIFY_X509_STRICT` 에 걸린다(strict 만 끔). BoJ 는 gzip 을 헤더 없이 준다. TGA 마감잔고는 `open_today_bal`. KC 연준·World Bank 는 파일명이 바뀌어 링크 추출.
- 로컬 DNS 가 `cdn.cboe.com`·`financialresearch.gov` 를 간헐적으로 못 풀어 로컬 실패가 뜨지만 Actions 는 정상.
- 패치 스크립트는 CRLF·BOM 을 보존해야 한다. 로컬에 node 가 없어 JS 문법은 CI 가 본다.
