# Mir 산업·투자 지표 외부 데이터 카탈로그 (3차 조사 전문)

> 조사일 2026-09-17 · `INDUSTRY_INDICATORS_DESIGN.md` 1B장의 부속 문서. 설계서에는 요약·우선순위·색인만 있고, **접근 URL·파라미터·라이선스·실측값 전문은 여기**에 있다.  
> 다섯 영역을 병렬 조사했고(각 조사자가 curl/WebFetch 로 실호출), 통합 단계에서 5건(ECOS DRAM 수출물가, TPEx 5274·6488, Cboe VIX3M CSV, OFR FSI CSV, Epoch AI zip)을 다시 호출해 같은 값을 확인했다.  
> 검증 표기 **F**=직접 응답 확인 · **S**=공식 문서·스니펫만 · **U**=미확인. 등급 A=공식 무료 API · B=공식 파일·HTML 파서 · C=프록시·제3자 · D=유료 · X=재배포 금지.  
> 조사 회선은 한국 가정용 IP다. GitHub Actions(미국 Azure IP)에서는 차단 양상이 다를 수 있으므로 모든 수집기는 `continue-on-error` + 실패 시 기존 파일 유지로 시작한다.  
> 영역 간 중복 5행(`gpr_daily`·`nyfed_gscpi`·`census_datacenter_construction`·`hood_monthly_metrics`·`appstore_ai_rank`)은 한쪽만 남겼다. `appstore_ai_rank` 의 쓰임(ChatGPT·Gemini·Claude·Coinbase·Robinhood 순위 적립)은 D 영역 `apple_appstore_top_charts` 의 파생 지표로 구현한다.

---

## A. 한국 공식 통계·한국 산업 (KR 모드 직결)


- 검증 표기: **F**=이번 세션에 직접 응답 확인(본 값 기재) / **S**=공식 문서·data.go.kr Swagger 명세만 확인 / **U**=미확인
- 등급: A=공식 무료 API, B=공식 HTML·파일 파서, C=프록시·제3자, D=유료, X=재배포 금지
- 기존 문서(INDUSTRY_INDICATORS_DESIGN.md)·레포에 이미 있는 것(ECOS 매크로 6종, 관세청 HS 8종 월수출, 10일 잠정치 15157908, DART, pykrx 공매도/외국인지분, 네이버 종목별 수급, NPS 연말 보유, 나라장터, OECD CLI, 완성차 5사 판매)은 제외했다.
- 종목코드는 전부 `data/korea/details/<코드>.json` 존재 확인 + `nps_holdings/map_fundamentals` 의 회사명과 대조했다. (LIG넥스원 079550·엔씨소프트 036570·HDC현대산업개발 294870 은 파일은 있으나 이름 맵에 없어 회사명은 상식 기준.)

### A-0. 핵심 발견 3가지

1. **ECOS 하나로 20개 넘는 지표가 추가 키 없이 들어온다.** 기존 `ECOS_API_KEY` 재사용. 통계표 839개를 `sample` 키로 전수 나열해 확인했다(`sample` 키는 호출당 10행 제한이지만 페이징은 된다 — 항목코드 조사용으로 충분). 특히 **수출물가지수(품목별) 402Y016 에 `DRAM`·`플래시메모리` 품목이 달러 기준으로 1971년/2000년부터 월별**로 있다 → TrendForce(D) 를 대체하는 무료·공식·재배포 가능한 메모리 가격 프록시. 수입물가지수 401Y017 에는 `탄산리튬`·`수산화리튬`이 있다.
2. **관세청에 `시군구별 품목별 수출입실적` API(15134343)가 실재한다.** HS 6단위 + 시도코드 필수, 응답에 `sggNm`(시군구명). 밀양=삼양식품 라면(190230) 같은 "지역 수출 트래커"가 공식 API 로 가능. 단 중량 필드는 없다(금액·건수만).
3. **중량 필드(`expWgt`/`impWgt`)는 `Itemtrade`(15101609)에 있다.** 레포의 기존 빌더가 쓰는 `nitemtrade` 는 data.go.kr 상 **15100475 "품목별 국가별"** 의 엔드포인트라 국가별 행이 나오는 것이었다. 품목 합계·단가는 `Itemtrade/getItemtradeList` 가 맞는 API(HS 2·4·6·10단위, 국가 분해 없음).

---

### A-1. 한국은행 ECOS (키: 기존 `ECOS_API_KEY`, 등급 A)

공통 URL: `https://ecos.bok.or.kr/api/StatisticSearch/{KEY}/json/kr/1/1000/{통계표}/{주기}/{시작}/{끝}/{항목1}/{항목2}`
항목 목록: `https://ecos.bok.or.kr/api/StatisticItemList/{KEY}/json/kr/1/1000/{통계표}` · 라이선스: 기존 ECOS 빌더와 동일(한국은행 출처 표기, 가공 시 가공 사실 표기). 항목 순서는 `StatisticItemList` 의 GRP 순서를 따른다(BSI 는 `BSI코드/업종코드` 순 — 뒤집으면 INFO-200).

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근(통계표/주기/항목) | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `kr_xpi_dram` | 수출물가지수 DRAM (달러기준) | 2020=100, 월(익월 중순), 1971.01~ | 공식 DRAM 수출가격 지수. 현물보드 대체 프록시, 메모리 사이클 | 삼성전자(005930), SK하이닉스(000660), 한미반도체(042700); US `MU` | `402Y016/M/{s}/{e}/30911201AA/D` (D=달러, W=원화, C=계약통화) | ECOS | 출처표기 | A | **F** 2026-04 233.82 → 05 251.21 → 06 252.74 → 07 274.79 → **08 282.77** |
| `kr_xpi_flash` | 수출물가지수 플래시메모리 (달러) | 2020=100, 월, 2000.01~ | NAND 가격 프록시 | 삼성전자(005930), SK하이닉스(000660); US `MU`,`WDC` | `402Y016/M/../30911202AA/D` | ECOS | 〃 | A | **F** 2026-04 173.58 → 07 228.29 → **08 247.43** |
| `kr_xpi_items` | 수출물가지수 품목 팩 | 2020=100, 월 | 품목별 수출 판가. 관세청 단가와 교차검증 | 아래 매핑 | `402Y016/M/../{코드}/D` — 시스템반도체 `30911203AA`(1990~), OLED `30921201AA`(2017.12~), 모니터용LCD `30921102AA`, 컴퓨터기억장치 `30941201AA`, 2차전지 `31013101AA`, **송배전변압기 `31012101AA`**, 축전기 `30932101AA`, 라면 `30115201AA`, 화장품 `30562201AA`(2013~), 반도체조립장비 `31124101AA`, 평판디스플레이제조장비 `31124201AA` | ECOS | 〃 | A | **F**(코드 전부 항목목록에서 확인, 종료 202608). 값은 변압기만 조회: 2026-07 147.73 / 08 147.73. 변압기→HD현대일렉트릭(267260)·효성중공업(298040)·LS ELECTRIC(010120), 2차전지→LG에너지솔루션(373220)·삼성SDI(006400), 라면→삼양식품(003230)·농심(004370), 화장품→아모레퍼시픽(090430)·에이피알(278470), OLED→LG디스플레이(034220) |
| `kr_mpi_lithium` | 수입물가지수 탄산리튬·수산화리튬 (달러) | **2022.12=100**, 월, 2022.12~ | 리튬 가격 무료 공식 프록시. 양극재 판가·재고평가손 선행 | 에코프로비엠(247540), 엘앤에프(066970), 포스코퓨처엠(003670), LG화학(051910); US `ALB`,`SQM` | `401Y017/M/../30512205AA/D`(탄산), `30512204AA`(수산화) | ECOS | 〃 | A | **F** 탄산 2026-06 25.43 → 07 24.06 → **08 22.94**; 수산화 33.95 → 32.51 → **31.48** |
| `kr_mpi_raw` | 수입물가지수 원재료 팩 | 2020=100, 월 | 원가 측 지표(정유·화학·철강·식품) | S-Oil(010950), SK이노베이션(096770), 롯데케미칼(011170), POSCO홀딩스(005490), 고려아연(010130), CJ제일제당(097950), 농심(004370), 한국가스공사(036460) | `401Y017` — 원유 `20112101AA`, LNG `20112201AA`, 나프타 `30412101AA`, 유연탄 `20111201AA`, 철광석 `20121101AA`, 동광석 `20121201AA`, 니켈괴 `30721501AA`, 실리콘웨이퍼 `30911105AA`, 밀 `10111201AA`, 옥수수 `10111202AA`, 원당 `30114101AA`, 대두박 `30116202AA`, 화학펄프 `30321101AA` | ECOS | 〃 | A | **F**(코드·종료월 202608 확인, 값 미조회) |
| `kr_bsi_industry` | 업종별 BSI 실적 (업황·수출·신규수주·재고·가동률·채산성) | 지수, 월말, 2009.08~ | 업종 체감경기. 업종 25개 × 지표 15개 | 업종 매핑: C2600 전자 → 삼성전자(005930); C3000 자동차 → 현대차(005380); C3100 조선 → HD한국조선해양(009540); C2000 화학; C2400 1차금속; C2800 전기장비; F4100 건설; I5500 숙박 | `512Y007/M/../{BSI코드}/{업종코드}` — BSI: AA 업황, AM 수출, AD 신규수주, AG 제품재고, AK 가동률, AE 채산성, AF 판매가격, AN 원자재구입가격 | ECOS | 〃 | A | **F** 전자·영상·통신장비 업황 2026-07 97 → **08 96**. 전망표 `512Y008` 은 표 존재 F, 내 조회(202608~09)는 INFO-200 → 기간 규약 U |
| `kr_csi` | 소비자동향조사(CCSI + 세부 지출전망) | 지수, 월말, 2008.07~ | 내수·여행·내구재 선행 | 호텔신라(008770), 신세계(004170), 하나투어(039130), 이마트(139480) | `511Y002/M/../FME/99988`(소비자심리지수). 세부: 여행비 `FMCCD`, 내구재 `FMCCA`, 의류비 `FMCCB`, 외식비 `FMCCC`, 소비지출전망 `FMCB`, 금리수준전망 `FMBG` | ECOS | 〃 | A | **F** CCSI 2026-08 **104.5** |
| `kr_esi` | 경제심리지수(원계열·순환변동치) | 지수, 월 | BSI+CSI 합성. KR 신호등용 | 시장 전체 | `513Y001/M/../` (항목 생략 시 2계열) | ECOS | 〃 | A | **F** 2026-08 원계열 99.4 / 순환변동치 96.9 |
| `kr_mfg_inventory_ratio` | 제조업 재고율(재고/출하) | 2020=100, 월, 1985~ | 재고 사이클의 고전 선행지표 | 삼성전자(005930), SK하이닉스(000660), 현대차(005380) | `901Y026/M/../I33A` ; 평균가동률 `901Y025/M/../I31A`(%) | ECOS | 〃(원자료 통계청) | A | **F** 2026-06 93.8 → **07 97.2** |
| `kr_ip_ship_inv` | 산업별 생산·출하·재고 지수(중분류) | 2020=100, 월, 1975~ | 전자부품·자동차·전기장비·의약품 재고/출하 | 위와 같음 + HD현대일렉트릭(267260), 삼성바이오로직스(207940) | `901Y032/M/../{산업}/{구분}` 산업: `I11ACQ` 전자부품·컴퓨터·통신, `I11ACU` 자동차, `I11ACS` 전기장비, `I11ACL` 의약품, `I11ACK` 화학. 구분: 1 생산, 3 출하, 5 재고(원), 2/4/6 계절조정 | ECOS | 〃 | A | **F** 전자부품 재고(계절조정) 2026-06 106.1 → **07 115.5**. 주의: ECOS 는 중분류까지만 — **반도체(C261) 단독은 KOSIS 필요**(§2) |
| `kr_item_output` | 품목별 생산·출하·재고·내수·수출량 | 물량(M/T·㎘·대), 월, 1995~ | 화학·철강·정유 실물 수급 | 롯데케미칼(011170), 대한유화(006650), LG화학(051910), S-Oil(010950) | `901Y039/M/../{품목}/{T40 생산 \| T41 출하 \| T42 재고 \| T43 내수 \| T44 수출}` — 에틸렌 `20120102`, 프로필렌 `20120103`, 파라자일렌 `20120108`, 폴리에틸렌 `20220203`, 휘발유 `19219201`, 경유 `19219204`, 나프타 `19219207`, 철근 `24124105`, 형강 `24124107` | ECOS | 〃 | A | **F** 에틸렌 재고 2026-06 80,001t → **07 84,657t**; 철근 출하 2026-07 605,704t. 주의: 품목 71개뿐, 반도체·배터리·라면 없음 |
| `kr_market_funds_m` | 증시주변자금(예탁금·신용융자·미수금·RP) | 원, 월말, 1998.06~ | 개인 레버리지·대기자금 장기 시계열(일별은 §7 KOFIA) | 키움증권(039490), 미래에셋증권(006800), 삼성증권(016360), NH투자증권(005940), 한국금융지주(071050) | `901Y056/M/../S23A`(예탁금), `S23E`(신용융자), `S23D`(미수금), `S23F`(신용대주) | ECOS | 〃(원자료 KOFIA) | A | **F** 예탁금 2026-07 104.1조 → **08 99.7조**; 신용융자 28.9조 → **33.3조** |
| `kr_investor_trading_m` | 투자자별 주식거래(시장 합계) | 백만원·천주, 월, 2004~ | 외국인·기관·개인 순매수 장기 시계열 | 시장 전체 | `901Y055/M/../S22CC/VA`(외국인 순매수 대금); `S22CA` 기관, `S22CB` 개인 | ECOS | 〃(원자료 KRX) | A | **F** 외국인 2026-08 **−10.18조원** |
| `kr_foreign_net_daily` | 외국인 순매수 일별(코스피/코스닥)·거래대금·시총 | 억원, **일**, 2003~ | 키 하나로 일별 외국인 수급(pykrx 로그인 불필요) | 시장 전체 | `802Y001/D/../0030000`(코스피 외인), `0113000`(코스닥 외인), `0088000` 거래대금, `0183000` 시총 | ECOS | 〃 | A | **F** 2026-09-15 −15,542억 / **09-16 −16,821억**(pykrx 값 −1.68조와 일치) |
| `kr_cli_bok` | 경기종합지수(선행·동행 순환변동치) | 2020=100, 월 | 통계청 선행지수. OECD CLI 와 교차 | 시장 전체 | `901Y067/M/../` (5계열) | ECOS | 〃 | A | **F** 2026-07 선행 순환변동치 104.2 / 동행 101.2 |
| `kr_machinery_orders` | 기계수주액 / 설비투자지수 | 백만원, 월 | 설비투자 선행(반도체 장비·공작기계) | 원익IPS(240810), 한미반도체(042700), 두산에너빌리티(034020) | `901Y018/M/../`(총수주·민간·공공 등 30계열), `901Y066` | ECOS | 〃 | A | **F** 2026-07 총수주 10.49조 |
| `kr_construction_orders` | 국내건설수주액(발주자·공종별) | 백만원, 월, 1976~ | 건설사 매출 1~2년 선행 | 현대건설(000720), GS건설(006360), DL이앤씨(375500), 대우건설(047040), HDC현대산업개발(294870) | `901Y020/M/../I42A`(총), `I42AAA` 공공, `I42AAB` 민간 | ECOS | 〃 | A | **F** 2026-06 18.22조 → **07 14.36조** |
| `kr_housing_supply` | 미분양·인허가·착공 | 호, 월, 2007~ | 주택 경기·건설사 리스크 | 위 건설 5사 | 미분양 `901Y074/M/../I410A`(전국·시도별), 인허가 `901Y105`, 착공 `901Y103`, 건축허가 `901Y037` | ECOS | 〃(원자료 국토부) | A | **F** 미분양 2026-06 67,464 → **07 68,217호**. 인허가 2026-07 142,328호는 **연 누계로 보임 — 구현 시 확인** |
| `kr_retail_channel` | 소매업태별 판매액지수 | 2020=100, 월 | **면세점**·백화점·편의점·인터넷쇼핑 업태별 | 호텔신라(008770), 신세계(004170), 현대백화점(069960), 롯데쇼핑(023530), BGF리테일(282330), GS리테일(007070), 이마트(139480) | `901Y098/M/../{업태}/{I74A 경상 \| I74B 불변 \| I74C 계절조정}` 업태: 면세점 `I74F`, 백화점 `I74B`, 대형마트 `I74C`, 편의점 `I74J`, 인터넷쇼핑 `I74VA`, 승용차 `I74N` | ECOS | 〃 | A | **F** 면세점 경상 2026-06 87.3 → **07 82.5** |
| `kr_retail_goods` | 재별·상품군별 판매액지수 | 2020=100, 월 | 화장품·의복·가전·승용차 상품군 | 아모레퍼시픽(090430), LG생활건강(051900) | `901Y100/M/../{상품군}/{구분}` | ECOS | 〃 | A | **F** 총지수 2026-07 경상 122.9 (상품군 코드는 `StatisticItemList` 로 확인 필요 — U) |
| `kr_current_account` | 경상수지(계절조정)·상품수지 | 백만달러, 월 | 원화·외국인 수급 배경 | 시장 전체 | `301Y017/M/../` | ECOS | 〃 | A | **F** 2026-06 경상 44,427.6 / 상품수지 43,458.2 |
| `kr_export_volume_idx` | 수출물량지수(품목별)·교역조건 | 2020=100, 월 | 금액이 아닌 **물량** — 가격효과 분리 | 수출주 전반 | `403Y002/M/../*AA`(총지수), 품목코드 717개; 교역조건 `403Y005` | ECOS | 〃 | A | **F** 총지수 2026-08 153.48 |
| `kr_household_credit` | 가계신용(업권별) | 십억원, 분기, 2002Q4~ | 은행·카드 업황 | KB금융(105560), 신한지주(055550), 삼성카드(029780) | `151Y001/Q/../1000000` | ECOS | 〃 | A | S(항목·종료 2026Q2 확인, 값 미조회) |
| `kr_power_usage` | 부문별 전력사용량 | MWh, 월, 2002~ | 제조업 가동 실측·한전 판매량 | 한국전력(015760) | `901Y019/M/../I41AF`(제조업), `I41A` 총 | ECOS | 〃 | A | F(항목 종료 202606, 값 미조회) |

폐기 확인: `601Y002` 지역별·소비유형별 개인 신용카드는 **2023-08 에서 중단**(항목목록 종료월) → 쓰지 말 것.

---

### A-2. KOSIS / 통계청 (키: KOSIS OpenAPI 무료 발급, 등급 A)

URL: `https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList&apiKey={KEY}&orgId=101&tblId={표}&itmId={항목}&objL1={분류}&format=json&jsonVD=Y&prdSe=M&newEstPrdCnt=24`
무키 호출 응답: `{"err":"11","errMsg":"유효하지 않은 인증KEY입니다."}` (F). 표 목록은 무키 내부 AJAX `POST https://kosis.kr/statisticsList/selectTreeData.do (vwcd=MT_ZTITLE, rootId, lev)` 로 확인했다(F). 라이선스: KOSIS 자료는 출처표시 조건 이용(S).

| 지표 ID | 지표 | 단위·주기 | 분석 가치 | 연관 종목 | 접근 | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `kr_semi_ship_inv` | **반도체 생산·출하·재고지수 → 재고율** | 2020=100, 월(월말 산업활동동향), 1975~ | 메모리 사이클 유명 선행지표(재고/출하). ECOS 에는 중분류까지만 있어 KOSIS 가 유일 | 삼성전자(005930), SK하이닉스(000660), 한미반도체(042700); US `MU` | `orgId=101&tblId=DT_1F02001` (시도/산업별 광공업생산지수). itmId: `T11` 출하(원), `T12` 재고(원), `T21` 출하(계절조정), `T22` 재고(계절조정) | KOSIS | 출처표시 | A | **F** 표 존재·수록기간 1975.01~**2026.07**·itmId 확인. 반도체 산업 분류코드(objL)는 **U** — 키 발급 후 `getMeta` 로 확인 |
| `kr_mfg_inventory_ratio_kosis` | 제조업 재고율(원자료) | 월 | ECOS 901Y026 의 원천 | 〃 | `tblId=DT_1F02013` | KOSIS | 〃 | A | F(표 존재 ~2026.07). ECOS 로 대체 가능 |
| `kr_item_output_kosis` | 품목별 생산·출하·재고·내수·수출량 | 월 | ECOS 901Y039 의 원천 | 화학·철강 | `tblId=DT_1F02012` | KOSIS | 〃 | A | F(표 존재) |
| `kr_shipment_dom_exp` | 내수/수출 출하지수 | 월, 1985~ | 내수 vs 수출 출하 분리 | 수출주 | `tblId=DT_1F02016` | KOSIS | 〃 | A | F(표 존재) |
| `kr_online_shopping` | 온라인쇼핑 상품군별 거래액 | 백만원, 월(익익월 초), 2017~ | 화장품·음식서비스·여행 온라인 거래 | NAVER(035420), 이마트(139480), CJ대한통운(000120); US `CPNG` | `tblId=DT_1KE10041`(취급범위/상품군), `DT_1KE10071`(모바일) | KOSIS | 〃 | A | **F** 표 존재 2017.01~**2026.07** |
| `kr_online_overseas_sales` | 온라인 해외직접판매(역직구, 면세점 포함)·직구 | 분기, 2014~ | K-뷰티 역직구·중국 수요 | 아모레퍼시픽(090430), 실리콘투(257720), 에이피알(278470), 호텔신라(008770) | `tblId=DT_1KE10081`(판매), `DT_1KE1009`(구매) | KOSIS | 〃 | A | **F** 표 존재 ~2026 2/4 |

---

### A-3. 관세청 수출입 (키: 기존 `DATA_GO_KR_KEY`, 개발계정 일 10,000콜, 전부 "이용허락범위 제한 없음", 등급 A)

data.go.kr 페이지의 Swagger JSON 을 직접 파싱해 호스트·파라미터·응답필드를 확인했다(F=명세 확인, 실호출은 로컬 키 부재로 미실시).

| 지표 ID | 데이터셋 | 엔드포인트·파라미터 | 응답 필드 | 분석 가치 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `kr_trade_hs10` | **15101609 품목별 수출입실적(GW)** | `GET https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList?serviceKey=&strtYymm=YYYYMM&endYymm=YYYYMM&hsSgn=` (hsSgn 선택, HS **2·4·6·10단위**) | `year, hsCode, statKor, expDlr, **expWgt(KG)**, impDlr, **impWgt(KG)**, balPayments` | 금액÷중량 = **수출단가/수입단가**. 국가 분해가 없어 호출 수가 적다 | S(명세 F, 수정일 2026-08-20). 기존 빌더의 "연도 넘으면 0건·버스트 차단" 제약은 같은 게이트웨이라 동일할 것으로 가정 |
| `kr_trade_hs_country` | 15100475 품목별 국가별(GW) — **기존 빌더가 쓰는 `nitemtrade`** | `https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList` (+`cntyCd`) | 국가별 행 | 대미 변압기, 대중 화장품 등 **국가 분해**가 필요할 때만 | F(페이지에 엔드포인트 명시). 중량 필드 유무 U(기술문서 docx 미열람) |
| `kr_trade_sigungu_item` | **15134343 시군구별 품목별 수출입실적** | `GET https://apis.data.go.kr/1220000/sigunguperprlstperacrs/getSigunguPerPrlstPerAcrs?serviceKey=&strtYymm=&endYymm=&HsSgn=(6단위, 필수)&sidoCd=(필수)` | `priodTitle, sggNm, hsSgn, korePrlstNm, expUsdAmt, expCnt, impUsdAmt, impCnt, cmtrBlncAmt` | **공장 소재지 = 회사** 트래커: 밀양·원주 190230(삼양식품 003230), 청주·이천 854232(SK하이닉스 000660), 구미 853224 등. 중량 없음 | S(명세 F, 수정 2026-08-20). `sidoCd` 값은 참고문서 `관세청조회코드_v1.3.xlsx` — U |
| `kr_trade_sido_item` | 15101641 시도별 품목별(GW) | `https://apis.data.go.kr/1220000/sidoitemtrade/getSidoitemtradeList?strtYymm&endYymm&sidoCd(필수)` — 요청에 hsSgn 파라미터 없음(시도 전체 품목 반환) | `priodTitle, hsSgn, korePrlstNm, expUsdAmt, expLnCnt, ...` | 시군구 API 의 폴백 | S |
| `kr_trade_sigungu_total` | 15134344 시군구별 수출입실적 | `https://apis.data.go.kr/1220000/sigunguperimexacrs/getSigunguPerImexAcrs?strtYymm&endYymm&sidoCd` | `sidoSggNm, expUsdAmt, ...` | 지역 총수출(품목 없음) | S |

#### HS 코드 검증표 (관세청 `HS부호_20260101` xlsx — data.go.kr 15049722 를 무키로 내려받아 12,469행 대조, **F**)

| 추적 품목 | 확정 코드 (HSK 10단위 / 품목명) | 단가 단위 | 연관 종목 | 비고 |
| :-- | :-- | :-- | :-- | :-- |
| 라면 | **1902301010 라면** (상위 190230 = 파스타류 조제품, 1902301090 기타 인스턴트면) | KG | 삼양식품(003230), 농심(004370), 오뚜기(007310) | 6단위(190230)는 당면·파스타 섞임 → 10단위 권장. 시군구 API 는 6단위뿐 |
| DRAM / 플래시 / HBM·MCP | **8542321010 디램**, **8542321030 플래시 메모리**, **8542323000 복합구조칩 집적회로(MCP — HBM 이 여기로 분류된다는 것이 업계 통설, 문서상 명시는 없음)**, 8542321020 SRAM | U·KG | 삼성전자(005930), SK하이닉스(000660); US `MU` | 기존 문서의 `hbm_export_unit` 을 구현할 실제 코드. 단가 = expDlr/expWgt |
| SSD | 8523511000 (기록 안 된 SSD 매체) / 8471702090 (기타 보조기억장치) | U·KG | 삼성전자(005930), SK하이닉스(000660) | "솔리드 스테이트" 명칭 행이 HSK 에 없음 → 어느 쪽이 SSD 인지 **U**. 둘 다 받아 비교 후 결정 |
| MLCC | **8532240000 세라믹 유전체(다층)** | U·KG | 삼성전기(009150) | 확정 |
| 초고압 변압기 | **8504230000 (>10,000kVA)**, 8504229030 (5,000~10,000kVA) | U·KG | HD현대일렉트릭(267260), 효성중공업(298040), LS ELECTRIC(010120), 산일전기(062040), 제룡전기(033100) | 산일·제룡은 배전용(850421·850422) |
| 고압 전선 | 8544603010/3090 (>100kV), 8544602010 (10~100kV) | KG | LS(006260), 대한전선(001440), LS에코에너지(229640) | 확정 |
| 보툴리눔 톡신 | **3002491000 독소·톡소이드·항독소** | KG | 휴젤(145020), 메디톡스(086900), 대웅제약(069620) | HS2022 개정으로 3002.90 → 3002.49. "보툴리눔" 단독 코드는 없음(F: 키워드 0건) |
| 치과 임플란트 | 9021290000 (치과용 기타) | KG | 덴티움(145720) | "임플란트" 명칭 행 없음 — 통설 코드, 품목 혼재 |
| 미용의료기기 | **9018908110 피부과용 레이저 기기**, 9018908190 피부과용 기타, 8543702020 가정용 미용기기 | U·KG | 클래시스(214150), 파마리서치(214450), 에이피알(278470) | 에이피알 디바이스 = 8543702020 |
| 양극재 | **2841909020 NCM**, **2841909030 NCA**, 2841909040 NCMA, 2841909010 LCO | KG | 에코프로비엠(247540), 엘앤에프(066970), 포스코퓨처엠(003670), LG화학(051910) | 수출단가(USD/kg) = 판가 프록시. 4종 합산 권장 |
| 리튬 **수입단가** | **2825202000 수산화리튬**, **2836910000 탄산리튬** | KG | 위 양극재 4사; US `ALB`,`SQM` | impDlr/impWgt. §1 ECOS `kr_mpi_lithium` 과 교차검증 |
| 동박 | 7410110000 (정제 구리 박) | KG | 롯데에너지머티리얼즈(020150), SKC(011790), 솔루스첨단소재(336370) | 확정 |
| 배터리 셀 세분 | 8507602000 전기차용, 8507603000 ESS용, 8507901000 분리막 | U·KG | LG에너지솔루션(373220), 삼성SDI(006400) | 기존 빌더의 850760 을 EV/ESS 로 쪼갤 수 있음 |
| 타이어 | 4011101000 승용 래디알 | U·KG | 한국타이어앤테크놀로지(161390), 금호타이어(073240), 넥센타이어(002350) | 확정 |
| 굴착기 | 8429521021 무한궤도식 신품, 8429521011 휠 신품 | U·KG | 두산밥캣(241560) | 확정 |
| 방산 | 8710001000 전차, 8710002000 장갑차량, 9306900000 기타 탄약, 930190 군용무기 | U·KG | 한화에어로스페이스(012450), 현대로템(064350), LIG넥스원(079550), 풍산(103140), 한국항공우주(047810) | 인도 시점에 덩어리로 찍혀 변동 큼. 일부 방산 수출은 통계 비공개 처리될 수 있음(U) |
| 김 | 1212211010 건조 김 | KG | CJ제일제당(097950), CJ씨푸드(011150), 대상(001680) | 조미김은 2008.99 계열 — U |
| 담배 | 2402201000 필터담배 | U·KG | KT&G(033780) | 확정 |
| 바이오의약품 | 3002150000 면역물품(소매포장) | EA·KG | 삼성바이오로직스(207940), 셀트리온(068270) | 확정 |
| 화장품 세분 | 3304991000 기초, 3304992000 메이크업 | KG | 아모레퍼시픽(090430), 코스맥스(192820), 한국콜마(161890), 실리콘투(257720) | 기존 3304 를 세분 + 국가별(nitemtrade) |
| 태양광 모듈 | 8541430000 | U·KG | 한화솔루션(009830) | 확정 |

---

### A-4. 해운·에너지

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `kcci` | KOBC 컨테이너운임지수(KCCI) 종합 + 13개 항로 | 지수, **주간(월)**, 2022-11~ | 부산발 운임 — SCFI 의 한국판. 페이지가 최근 2주만 보여 **적립형** | HMM(011200), CJ대한통운(000120); US `ZIM` | `GET https://www.kobc.or.kr/ebz/shippinginfo/kcci/gridList.do?mId=0304000000` HTML 표(Code·Route·Weight·Current·Previous) | 없음 | 페이지 하단 "COPYRIGHT KOBC ALL RIGHTS RESERVED"; data.go.kr 15131881 등록분은 "이용허락범위 제한 없음"(링크형 데이터). 출처 표기 + 지수값만 | B | **F** 2026-09-14 종합 **4,696**(전주 4,697, −0.02%), KUWI 미서안 7,485, KUEI 미동안 11,019, KNEI 유럽 4,187 |
| `kdci` | KOBC 건화물선운임지수(KDCI) + 선형별 | 지수(USD/day 기반), **일간** | BDI 무료 대체(한국 공공기관 산출) | 팬오션(028670), 대한해운(005880) | `GET https://www.kobc.or.kr/ebz/shippinginfo/kdci/gridList.do?mId=0304000000` HTML(최근 6영업일) | 없음 | 〃 (data.go.kr 15131503) | B | **F** 2026-09-17 KDCI **31,416**, CAPE 54,962, PANAMAX 22,646, SUPRAMAX 21,793 |
| `kpx_smp` | 육지 SMP 시간별·일 가중평균 | 원/kWh, 일 | 발전사·한전 마진 | 한국전력(015760), 한국가스공사(036460), SK이노베이션(096770) | (a) HTML `https://new.kpx.or.kr/smpInland.es?mid=a10606080100&device=pc` 최근 7일 24시간 표 + 최대·최소·가중평균 (b) API `https://apis.data.go.kr/B552115/SmpWithForecastDemand/getSmpWithForecastDemand?serviceKey&pageNo&numOfRows&dataType=json&date=YYYYMMDD` → `smp, mlfd(육지 예측수요), slfd` | (a) 없음 (b) data.go.kr | 15131225 제한 없음 | A/B | (a) **F** 2026-09-17 가중평균 **103.56**, 09-11 126.99 (b) S |
| `kpx_demand` | 전력수급(공급능력·현재부하·예비율) | MW, 5분 | 폭염·한파 피크, 산업 가동 | 한국전력(015760), HD현대일렉트릭(267260), LS ELECTRIC(010120) | `https://apis.data.go.kr/B552115/Sukub5mToday/getSukub5mToday?serviceKey&dataType=json` → `baseDatetime, suppAbility, currPwrTot, suppReserveRate` | data.go.kr | 15158703 제한 없음 | A | S. 당일분만 → 일 최대부하 적립형 |
| `opinet_crude` | 국제 원유(Dubai 현물·Brent·WTI) | $/bbl, 일(화~토), 2008~ | 공식 Dubai 가격(야후에 없음) | S-Oil(010950), SK이노베이션(096770), GS(078930) | `GET https://www.opinet.co.kr/glopcoilSelect.do` HTML(기본 최근 2일; 기간 폼·CSV 저장 있음) | 없음 | 한국석유공사. 저작권정책 페이지 미열람(U) — 출처 표기 | B | **F** 2026-09-16 Dubai **128.00**, Brent 105.83, WTI 102.43 |
| `opinet_sg_products` | 싱가포르 석유제품가(휘발유 92/95RON·등유·경유 0.001%·고유황중유·**나프타**) | $/bbl, 일 | **복합 크랙스프레드**(제품−Dubai) = 정제마진 프록시. 나프타는 NCC 원가 | S-Oil(010950), SK이노베이션(096770), 롯데케미칼(011170), 대한유화(006650) | `GET https://www.opinet.co.kr/glopopdSelect.do` HTML | 없음 | 〃 | B/C | **F** 2026-09-16 휘발유92 145.22, 경유0.001% 200.72, 등유 188.15, 나프타 ≈102 (09-15 102.50). 주의: 공식 "정제마진" 시계열은 페트로넷·오피넷에 없음 → 자체 계산은 "프록시" 배지 |
| `opinet_domestic` | 전국 주유소 평균가 | 원/L, 일 | 내수 유가 | S-Oil(010950) | data.go.kr 15150932 (오피넷 API, 별도 오피넷 키 신청형일 수 있음) | 오피넷 키 | 제한 없음 | A | S |
| `mof_port_container` | 항만별 수출입 컨테이너 처리실적 | TEU, 월 | 부산항 물동량 = 수출 물량 실측 | HMM(011200), CJ대한통운(000120) | `https://apis.data.go.kr/1192000/SsopCargContnImxprt2/Ym`(수출입), `.../SsopCargContnNat2/Ym`(국가별) — 파라미터 U | data.go.kr | 15059131·15057250 제한 없음 | A | S(엔드포인트 F, 파라미터·최신월 U, 수정일 2025-08-05) |

---

### A-5. 부동산·건설

| 지표 ID | 지표 | 접근 | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `rone_weekly_apt` | 주간 아파트 매매·전세가격지수(지역별), 매주 목 | `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=&Type=json&pIndex=1&pSize=100&STATBL_ID=&DTACYCLE_CD=WK&WRTTIME_IDTFR_ID=` ; 표 목록 `SttsApiTbl.do` | R-ONE 무료 발급 | data.go.kr 15134761 "제한 없음", 공공누리 1유형(S) | A | **F**(엔드포인트 생존: 무키 시 `ERROR-290 인증키가 유효하지 않습니다`). `STATBL_ID` 는 **U** — 통계코드 파일 data.go.kr 15068719 로 확인. 연관: 현대건설(000720), GS건설(006360), DL이앤씨(375500), KB금융(105560) |
| `molit_unsold` | 미분양(규모별·준공후·시군구별) | `https://stat.molit.go.kr/portal/cate/statView.do?hRsId=32` | 없음 | 공공누리(S) | B | **F** 페이지에 수록기간 200701~**202607**. 전국·시도는 ECOS `901Y074` 가 더 쉽다 — **준공후 미분양**만 여기서 |

---

### A-6. 소비·콘텐츠·관광

| 지표 ID | 지표 | 단위·주기 | 분석 가치 | 연관 종목 | 접근 | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `kobis_boxoffice` | 일별 박스오피스(매출액·관객·스크린·배급) | 원·명, **일**(D-1), 2003~ | 극장·배급사 실적 선행 | CJ CGV(079160), 콘텐트리중앙(036420), 쇼박스(086980) | `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=&targetDt=YYYYMMDD` | KOBIS 무료(일 3,000콜) | data.go.kr 3070263 "제한 없음"; KOBIS 약관상 출처 표기 | A | **F**(엔드포인트 생존: 무키 시 `errorCode 320010 유효하지않은 키값`) — 값은 키 발급 후 |
| `kr_inbound_tourists` | 방한 외래객(국적·목적·입국항별)·관광수지 | 명, 월(익월 말) | 면세·카지노·화장품·항공 | 호텔신라(008770), 파라다이스(034230), GKL(114090), 롯데관광개발(032350), 아모레퍼시픽(090430), 대한항공(003490) | `https://apis.data.go.kr/B551940/EdrcntTourismStatsService/getEdrcntTourismStatsList?serviceKey&YM=YYYYMM&NAT_CD=&ED_CD=` ; 세부 `getForeignTuristStatsList`; 관광수지 `getTourismBalcList` | data.go.kr | 15158830 **공공누리 1유형(출처표시)** | A | S(명세 F, 수정 2026-08-26). data.go.kr **파일** 15136774 는 2024-07 에서 멈춤(F) → 쓰지 말 것. 데이터랩 페이지는 도달 F 이나 데이터 AJAX 미해독 |
| `kr_airport_traffic` | 전국공항 월 수송실적(공항×노선×여객/화물) | 명·KG, 월(전월까지) | 항공사·여행사 월간 수요(항공사 월 공시 없음 — §8) | 대한항공(003490), 아시아나항공(020560), 제주항공(089590), 진에어(272450), 하나투어(039130), 모두투어(080160) | `https://apis.data.go.kr/B551178/airport-transport-stats/info?serviceKey&startDePd=YYYYMM&endDePd=YYYYMM&routeBe=1&pasngrCargoBe=0&type=json` | data.go.kr | 15158834 제한 없음 | A | S(명세 F, 수정 2026-08-19) |
| `icn_airport_stats` | 인천공항 공항별(노선별) 운항·여객·화물 | 월 | 중국·일본·미주 노선별 회복, **항공화물 = 반도체 수출 물류** | 대한항공(003490), 아시아나항공(020560) | `https://apis.data.go.kr/B551177/AviationStatsByAirport/getTotalNumberOfFlight` (파라미터 U) | data.go.kr(개발 일 1,000) | 15095069 제한 없음 | A | S |
| `motie_retail_sales` | 주요 유통업체 매출 증감률(대형마트·백화점·편의점·SSM·온라인 × 상품군) | %, YoY, 월(익월 말) | 유통주 월간 실적 프록시 | 이마트(139480), 롯데쇼핑(023530), 신세계(004170), 현대백화점(069960), BGF리테일(282330), GS리테일(007070) | data.go.kr 파일 **15061360**(CSV, 무키): `fileData.do` 페이지에서 uddi → `/tcs/dss/selectFileDataDownload.do?publicDataPk=15061360&publicDataDetailPk={uddi}&fileDetailSn=1` → `atchFileId` → `/cmm/cmm/fileDownload.do?atchFileId={id}&fileDetailSn=1&insertDataPrcus=N` (Referer 필요) | 없음 | 제한 없음 | B | **F** 최신행 **2026-07-31**: 대형마트 총계 −11.2%, 백화점 +17.9%(34개 컬럼). cp949. 차기 등록 2026-10-04. 참고: motie.go.kr 이 **motir.go.kr(산업통상부)** 로 리다이렉트됨(F) — 기존 문서의 motie URL 점검 필요 |
| `naver_datalab_search` | 네이버 검색어 트렌드 / 쇼핑인사이트 | 상대지수(0~100), 일·주·월, 2016~ | 브랜드·제품 관심도(불닭·올리브영·메디큐브 등) | 삼양식품(003230), 에이피알(278470), 하이브(352820), 크래프톤(259960) | `POST https://openapi.naver.com/v1/datalab/search` (JSON: startDate,endDate,timeUnit,keywordGroups≤5) ; `.../v1/datalab/shopping/categories` | NAVER_CLIENT_ID/SECRET(레포 .env 에 있음) | 네이버 API 약관: 출처 표기, 일 1,000콜 | A | **F(실패 기록)**: 로컬 .env 키로 두 엔드포인트 모두 **HTTP 401 errorCode 024 인증 실패** → 해당 애플리케이션에 "데이터랩" API 가 미등록이거나 키가 만료. developers.naver.com 에서 API 추가 후 재시험 |
| `kdfa_dutyfree` | 면세점협회 월 매출·이용객(내/외국인) | 원·명, 월 | 면세 업황 | 호텔신라(008770), 신세계(004170) | `https://www.kdfa.or.kr/ko/trend/region_krw.php` | 없음 | 협회 저작권 | B | **U** 페이지 200 이나 정적 HTML 에 수치 없음(스크립트 렌더). 대체: ECOS `901Y098` 면세점 판매액지수(F) |
| (제외) | 게임트릭스 PC방 점유율 | — | — | 크래프톤(259960), 엔씨소프트(036570), 넷마블(251270) | gametrics.com | — | 상업 리서치("유료서비스안내" 명시) | **X** | 페이지 도달 F, 재게시 불가로 판단 |
| (제외) | 써클차트 앨범 판매 | — | — | 하이브(352820), 에스엠(041510), JYP Ent.(035900), 와이지엔터테인먼트(122870) | circlechart.kr | — | 한국음악콘텐츠협회 저작권, API 없음 | **X** | 페이지 도달 F |
| (미확인) | 여신금융협회 카드승인실적 | 월 | 소비 총량 | 삼성카드(029780) | crefia.or.kr 자료실(hwp/pdf) | — | — | B | **U** 시도한 게시판 URL 404. ECOS 개인카드 표(601Y002)는 2023-08 중단 |

---

### A-7. 수급·시장구조

| 지표 ID | 지표 | 단위·주기 | 분석 가치 | 연관 종목 | 접근 | 키 | 라이선스 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `kofia_market_funds_d` | **투자자예탁금·미수금·반대매매(일별)** | 백만원, **일(T+1~2)** | 개인 대기자금·강제청산 압력 | 키움증권(039490), 미래에셋증권(006800), 삼성증권(016360), NH투자증권(005940), 한국금융지주(071050) | `POST https://freesis.kofia.or.kr/meta/getMetaDataList.do` Content-Type: application/json, body `{"dmSearch":{"tmpV40":"1000000","tmpV41":"1","tmpV1":"D","tmpV45":"YYYYMMDD","tmpV46":"YYYYMMDD","OBJ_NM":"STATSCU0100000060BO"}}` → `ds1[]`: TMPV1 일자, TMPV2 예탁금, TMPV5 위탁매매 미수금, TMPV6 반대매매금액, TMPV7 미수금 대비 반대매매 비중(%) (TMPV3·4 는 파생예수금·RP 로 추정 — 화면 헤더로 확정 필요) | 없음 | KOFIA 저작권. 비공식(화면용) 엔드포인트 → 출처 표기·일 1회. 약관 재게시 조항 **U** | B | **F** 2026-09-16 예탁금 **99.57조**(09-10 107.66조), 반대매매 173.7억(1.8%). ECOS 8월말 99.7조와 정합 |
| `kofia_credit_balance_d` | **신용거래융자 잔고(전체·코스피·코스닥)·신용대주** | 백만원, 일 | 레버리지 과열 지표 | 〃 | 같은 URL, `OBJ_NM":"STATSCU0100000070BO"` → TMPV2 융자 전체, TMPV3 유가증권, TMPV4 코스닥, TMPV5~7 대주 | 없음 | 〃 | B | **F** 2026-09-16 융자 **33.07조**(코스피 25.91조 + 코스닥 7.16조, 합 일치) |
| `kofia_other` | `STATSCU0100000140BO`(대차거래로 추정: 체결·상환·잔고주수·잔고금액) | 일 | 공매도 대기 물량 | — | 같은 URL | 없음 | 〃 | B | F(응답 옴: 2026-09-16 잔고 161.6조 추정) — **컬럼 의미 U** |
| `krx_market_investor_flow` | 시장 전체 투자자별 순매수(일), 투자자별 순매수 상위 종목 | 원, 일 | 기존 `investor_flow`(네이버, 종목별 20일)에 없는 **시장 합계·주체별 Top N** | 시장 전체 | pykrx 1.2.8: `stock.get_market_trading_value_by_date(s,e,"KOSPI")`, `stock.get_market_net_purchases_of_equities(s,e,"KOSPI","외국인")`, `get_market_trading_value_by_investor` | KRX_ID/KRX_PW(기존) | KRX 정보데이터시스템 약관(기존 공매도 빌더와 동일 취급) | A/B | **F** 2026-09-16 코스피 외국인 −1.685조·기관 +1.237조·개인 −1.206조; 외국인 순매수 1위 삼성전기(009150) +1,114억, 효성중공업(298040) +185억. **프로그램매매 함수는 pykrx 에 없음(F: dir 검색)** |
| `nps_5pct_quarterly` | 국민연금 대량보유(5%↑) 보고내역 | %, **분기** | 기존 `nps_holdings`(연 1회 연말)의 분기 보강 | — | data.go.kr 파일 **15106890**(CSV 무키, 위 `motie_retail_sales` 와 같은 다운로드 절차) 컬럼: 발행기관명, 보고서 작성기준일, 지분율 | 없음 | 제한 없음 | B | **F** 20260331 판 142행(예: KB금융지주 8.94%, 한화비전 9.66%). 차기 2026-09-30. 종목코드 없음 → 회사명 매핑 필요 |
| `ksd_els` | ELS/DLS 월별 발행·상환, 일별 ELS 발행잔액, 월별 대차거래 | 원, 일·월 | 녹인·헤지 수급, 증권사 트레이딩 | 증권 5사 | `https://apis.data.go.kr/B552481/DerivesSvc/getMonthlyIssuRedStatusN1?serviceKey&yyyymm=` , `/getELSIssuRemaInfo?schStdDt=` ; 통계 `https://apis.data.go.kr/B552481/SecDepoStat/getSlbTrStat?sch_std_yymm=` , `/getELSIssuRedRemqStat` | data.go.kr | **공공누리 2유형(출처표시·상업적 이용금지)** — 사이트에 광고·유료 기능이 붙으면 불가 | A | S(명세 F, 수정 2026-07-09) |
| (짧게) | 금융위 주식·지수 시세 API (15094808·15094807) | 일(T+1) | 네이버 시세 폴백 | — | `apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2` | data.go.kr | **공공누리 4유형(상업금지·변경금지)** → 가공 지표 재게시에 부적합 | **X에 가까움** | S |

---

### A-8. 기업 공시형 월간 KPI (DART, 기존 `DART_API_KEY`)

| 지표 ID | 지표 | 접근 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- |
| `kr_casino_monthly` | **파라다이스(034230)·GKL(114090) 월 카지노 매출·드롭액** | `https://opendart.fss.or.kr/api/list.json?crtfc_key=&corp_code=&bgn_de=&end_de=&pblntf_ty=I` 에서 `report_nm` 이 `영업(잠정)실적(공정공시)`(GKL) / `연결재무제표기준영업(잠정)실적(공정공시)`(파라다이스)인 **매월 초(2~4일)** 건 → 기존 배당·공급계약 파서처럼 `document.xml` 본문 파싱 | A(목록)/B(본문) | **F** 파라다이스 2026-09-02(rcept 20260902800386)·08-04·07-02, GKL 2026-09-03(20260903800145)·08-04 확인. 분기 실적 공시(8/7, 8/11)와 같은 보고서명이라 **날짜(월초) + 본문의 "월" 표기로 구분**해야 함. 라이선스: DART 공시 = 자유 이용 |
| — | 강원랜드(035250) | 같은 조회 | — | **F** 2026-06~09 에 월간 공시 **없음**(분기 잠정실적만) → 대상 아님 |
| — | 항공사 월 수송실적 | 같은 조회 | — | **F** 대한항공(003490)·아시아나항공(020560)·제주항공(089590) 거래소 공시에 월간 수송실적 없음 → §6 `kr_airport_traffic` 로 대체 |

---

### A-9. 실패·차단·미확인 목록

| 항목 | 상태 | 메모 |
| :-- | :-- | :-- |
| 네이버 데이터랩 API | **401 (errorCode 024)** | 로컬 .env 의 NAVER 키로 인증 실패. 앱에 데이터랩 API 추가 필요 |
| KOSIS OpenAPI 실데이터 | 키 없음 | 표 ID·itmId 는 확인, 반도체 분류코드(objL)는 U |
| data.go.kr 관세청·KPX·관광·공항 API 실호출 | 로컬 키 없음 | Swagger 명세로 호스트·파라미터·필드만 확인(S). Git Bash 에서 키가 `/`로 시작하면 MSYS 경로 변조(기존 빌더 주석) 주의 |
| R-ONE `STATBL_ID` | U | 엔드포인트 생존만 F. 통계코드 파일(15068719) 필요 |
| 한국관광 데이터랩 AJAX | 미해독 | `goUrl()` POST 기반. data.go.kr API(15158830)로 우회 |
| data.go.kr KCCI 파일(15131881) | 404 | 링크형 데이터(파일 없음). KOBC HTML 이 실질 소스 |
| data.go.kr 방한외래객 상세 파일(15136774) | **stale** | 최신행 2024-07. 쓰지 말 것 |
| 한국면세점협회 통계 | U | 정적 HTML 에 수치 없음 |
| 여신금융협회 카드승인실적 | U | URL 404, 파일(hwp/pdf)형 |
| airportal 항공통계 AJAX | 오류 페이지 | `/stats/transport/getDashboardStats.do` 파라미터 미상. KAC·인천공항 API 로 대체 |
| PORT-MIS(new.portmis.go.kr) | WebSquare SPA | 스크래핑 부적합. 해수부 data.go.kr API 로 대체 |
| ECOS `601Y002` 지역·소비유형별 카드 | **2023-08 중단** | 항목 종료월로 확인 |
| ECOS `512Y008` BSI 전망 | INFO-200 | 표는 존재. 기간(전망월 기준) 규약 확인 필요 |
| 페트로넷 정제마진 | 없음 | 공식 정제마진 시계열은 무료로 없음 → 오피넷 제품가−Dubai 자체 계산(C) |
| 게임트릭스·써클차트 | X | 상업 데이터, API 없음 |
| pykrx 프로그램매매 | 없음 | 1.2.8 에 함수 없음. KRX 정보데이터시스템 직접 호출은 미시도(U) |
| SSD HS 코드 | U | 8523511000 vs 8471702090 — HSK 명칭에 SSD 없음 |
| HBM = 8542323000 | 통설 | HSK 표에는 "복합구조칩 집적회로"로만 표기. 실제 월별 금액 추이로 검증 권장 |
| KOFIA freesis 약관 | U | 비공식 화면 엔드포인트. 장애 시 ECOS `901Y056`(월) 폴백 |

---

### A-10. 바로 구현 가능한 상위 10개 (추가 키 발급 없이, 기존 시크릿만으로)

| # | 지표 | 왜 먼저 | 필요한 것 |
| :-- | :-- | :-- | :-- |
| 1 | `kr_xpi_dram` + `kr_xpi_flash` (ECOS 402Y016) | TrendForce 없이 **공식·무료·재배포 가능한 메모리 가격 지수**. 2026-08 DRAM 282.77 / 플래시 247.43 실측. `build_kr_ecos_macro.py` 의 `fetch_series` 에 항목2(`D`)만 추가하면 됨 | `ECOS_API_KEY` |
| 2 | `kr_mpi_lithium` (ECOS 401Y017) | 리튬 가격 무료 프록시(탄산 22.94 / 수산화 31.48, 2022.12=100). 양극재 4사 직결 | 〃 |
| 3 | `kofia_market_funds_d` + `kofia_credit_balance_d` | **일별** 예탁금 99.57조·신용융자 33.07조. 무키 POST 한 번. 장애 시 ECOS 901Y056(월) 폴백 | 없음 |
| 4 | `kr_trade_hs10` 단가 팩 (관세청 Itemtrade) | DRAM·플래시·MCP(HBM)·라면·변압기·양극재·톡신·미용기기 10단위 + **expWgt 로 단가**. HS 코드는 공식 HSK 2026 표로 전부 대조 완료 | `DATA_GO_KR_KEY` (활용신청 15101609 추가) |
| 5 | `kr_trade_sigungu_item` (15134343) | 밀양 라면·청주/이천 메모리 등 **공장=회사** 트래커. 다른 사이트에 거의 없는 차별점 | 〃 (활용신청 15134343) + `sidoCd` 표 |
| 6 | `kr_bsi_industry` + `kr_csi` + `kr_esi` (ECOS) | 업종 25개 체감경기 + 소비심리 세부(여행비·내구재). KR 신호등 재료 | `ECOS_API_KEY` |
| 7 | `kr_mfg_inventory_ratio` + `kr_ip_ship_inv` + `kr_item_output` (ECOS) | 재고율 97.2, 전자부품 재고 115.5, 에틸렌 재고 84,657t — 재고 사이클 패널 | 〃 |
| 8 | `kcci` + `kdci` (KOBC HTML) | 주간 컨테이너·일간 벌크 운임. 적립형 규약(`data/industry_archive/`)에 그대로 맞음. 2026-09-14 KCCI 4,696 / 09-17 KDCI 31,416 | 없음 |
| 9 | `opinet_crude` + `opinet_sg_products` | 공식 Dubai 현물 + 싱가포르 제품가 → 크랙스프레드(프록시 배지). 정유·화학 직결 | 없음 |
| 10 | `kr_casino_monthly` (DART) | 파라다이스·GKL 월 매출 — 기존 `document.xml` 파서 재사용. 월초 공시 실재 확인 | `DART_API_KEY` |

차순위(키 1개 추가): KOSIS `kr_semi_ship_inv`(반도체 재고율 — 가치는 최상위권이나 KOSIS 키 + 분류코드 확인 필요), KOBIS 박스오피스, R-ONE 주간 아파트, data.go.kr 방한외래객·공항 수송실적, `motie_retail_sales`(무키 CSV, 2026-07 확인), ECOS `kr_foreign_net_daily`·`kr_retail_channel`(면세점)·`kr_construction_orders`.

### A-11. 구현 시 주의

- ECOS `sample` 키는 **10행 제한**이라 운영에 못 쓴다(항목코드 탐색 전용). 운영은 기존 `ECOS_API_KEY`.
- ECOS 항목 순서는 통계표마다 다르다(`StatisticItemList` 의 GRP 순서). 402Y016/401Y017 = `품목/통화기준(D·W·C)`, 512Y007 = `BSI코드/업종`, 901Y032 = `산업/구분(1~6)`, 901Y098 = `업태/지수종류`.
- 수입물가 리튬 2종은 기준시점이 **2022.12=100**(다른 품목은 2020=100) — 같은 축에 그리지 말 것.
- 관세청 API 는 기존 빌더의 실측 제약(연도 넘는 기간 0건, 버스트 차단, 1.5초 간격)을 그대로 적용. 10단위 단가는 월별 중량이 작으면 튄다 → 3개월 이동평균 + "수출단가(프록시)" 배지.
- 시군구 API 는 HS 6단위·금액만. 한 시군구에 동종 업체가 여럿이면 회사 귀속을 단정하지 말 것("밀양시 라면 수출" 로 표기, 삼양식품은 연관 종목 태그로만).
- 라이선스 주의: 예탁결제원(2유형 상업금지), 금융위 시세(4유형 변경금지)는 넣지 않거나 비상업 전제 확인. KOBC·KOFIA·오피넷은 출처 표기 + 지수/집계값만(원표 재호스팅 금지).
- 파라다이스·GKL 월 공시는 분기 잠정실적과 **보고서명이 같다** — 본문에서 대상 기간을 읽어 구분.
- 산업부 도메인이 `motir.go.kr` 로 바뀌었다(리다이렉트 확인). 기존 설계 문서의 `motie.go.kr` 보도자료 URL 은 구현 전에 재확인.


---

## B. 미국 매크로·금융여건·시장구조·밸류에이션


조사 범위: `INDUSTRY_INDICATORS_DESIGN.md` 에 **이미 있는 소스는 제외**(FRED 기본 시리즈, EIA, BLS, Census EITS, GDPNow, NY Fed Nowcast, WEI, Sahm, CFNAI, ADS, OECD CLI, 순유동성, FINRA margin debt, ICI, AAII, NAAIM, Kalshi, CFTC COT, 국채 경매, FTD, FINRA 일일 공매도량 등).

**검증 표기**: F = 이번 세션에 curl 로 직접 응답을 받아 최신 날짜·값을 확인 / S = 공식 페이지·검색 스니펫만 / U = 미확인.
**등급**: A = 공식 무료 API(JSON/CSV) · B = 공식 xls/HTML 파서 필요 · C = 프록시·제3자 · D = 유료 · X = 재배포 금지.
**연관 종목**: 전부 `data/details/<TICKER>.json` 존재 확인한 것만 적음(`DFS`, `UUP`, `BKLN`, `EMB`, `CMA` 는 파일 없음 → 제외. 버크셔는 `BRK.B`).

### B-0. 호출 환경에서 실측한 함정 (구현자 필독)

1. **FRED `fredgraph.csv` 는 브라우저 UA(`Mozilla/5.0`)를 주면 `Connection reset`**, 레포의 기존 UA(`Mir US Stocks research (dydtjsdn@gmail.com)`)로는 200. `build_macro_indicators.py` 방식 그대로 쓸 것. 없는 ID 는 HTML(`</html>`)이 돌아오므로 첫 줄이 `observation_date,` 인지로 판정.
2. 이 PC 의 로컬 DNS 가 `philadelphiafed.org`, `richmondfed.org`, `data.financialresearch.gov`, `pages.stern.nyu.edu` 를 간헐적으로 못 푼다(8.8.8.8 로는 풀림 → `curl --resolve` 로 우회해 검증). **GitHub Actions 에서는 문제없을 가능성이 높지만** 로컬 검증 시 "DNS 실패 = 소스 죽음"으로 오판하지 말 것.
3. `banks.data.fdic.gov/api/...` 는 **301 → `https://api.fdic.gov/banks/...`** 로 이전됐다. 새 호스트를 직접 쓸 것.
4. Shiller 의 예전 Yale 주소(`econ.yale.edu/~shiller/data/ie_data.xls`)는 200 이지만 **2023-09 에서 멈춘 파일**. 최신본은 shillerdata.com 의 가변 링크(아래 표).
5. SEC Frames: **현금흐름 항목(CAPEX·자사주)은 Q2·Q3 프레임이 거의 비어 있다**(10-Q 가 누적 YTD 로 보고하기 때문. CAPEX CY2026Q1 2,440개사 vs CY2026Q2 196개사). 아래 §11 참조.
6. KC 연준 xlsx 는 파일명에 발표일이 들어가 매달 바뀜(`/documents/18452/2026Aug27historicalmfg.xlsx`) → 서베이 페이지에서 링크 추출 필요.

---

### B-1. 지역 연준 서베이 — ISM PMI 무료 대체

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `philly_mbos` | 필라델피아연준 제조업(MBOS) 확산지수 — 일반활동·신규주문·출하·가격지불·가격수취·고용 + 6개월 전망 | 확산지수(−100~100), 월 3번째 목, 1968-05~ | ISM 보다 2주 빠른 제조업 헤드라인. 가격지불(PPC)은 PPI 선행 | `XLI`, `CAT`, `HON`, `SPY` | 원천 CSV `https://www.philadelphiafed.org/-/media/frbp/assets/surveys-and-data/mbos/historical-data/diffusion-indexes/bos_dif.csv` (컬럼 GAC/NOC/SHC/PPC/PRC/NEC…+F 접미=전망). FRED: `GACDFSA066MSFRBPHI`(일반), `NOCDFSA066MSFRBPHI`(신규주문), `PPCDFSA066MSFRBPHI`(가격지불), `GAFDFSA066MSFRBPHI`(전망) | 없음 | 연준 공공, 출처 표기 | **A** | **F** CSV 마지막 행 Aug-26 GAC 47.4·NOC 30.1·PPC 40.9, FRED 값 일치 |
| `empire_state_mfg` | 뉴욕연준 Empire State 제조업 | 확산지수, 월 15일경, 2001-07~ | 그 달의 **첫** 제조업 서베이 | `XLI`, `CAT`, `HON` | 원천 CSV `https://www.newyorkfed.org/medialibrary/media/survey/empire/data/esms_seasonallyadjusted_diffusion.csv` (GACDISA/NOCDISA/PPCDISA/PRCDISA…). FRED: `GACDISA066MSFRBNY`, `NOCDISA066MSFRBNY`, `PPCDISA066MSFRBNY`, `GAFDISA066MSFRBNY` | 없음 | 뉴욕연준 Terms of Use, 출처 표기 | **A** | **F** 2026-09: 일반 7.6·신규주문 2.0·가격지불 63.1 |
| `dallas_tmos` | 댈러스연준 텍사스 제조업(TMOS) | 확산지수, 월 마지막 월, 2004-06~ | 에너지·전자 비중 큰 텍사스. 생산·신규주문·원자재가격·임금 | `XLI`, `XLE`, `CAT` | 원천 `https://www.dallasfed.org/~/media/Documents/research/surveys/tmos/documents/index_sa.xls` (**확장자는 .xls 지만 실제는 xlsx** → openpyxl, 시트 'Indexes Seasonally Adjusted', 컬럼 Prod/Vnwo/Prm/Pfg/Wgs/Bact…). FRED: `BACTSAMFRBDAL`(일반), `PRODSAMFRBDAL`(생산), 서비스업 `TSSOSBACTSAMFRBDAL` | 없음 | 연준 공공 | **A** | **F** Aug-26 Prod 16.1·Vnwo 22·Prm 44.1·Bact 11.6, FRED 일치 |
| `richmond_mfg` | 리치몬드연준 제5지구 제조업 | 확산지수, 월 4번째 화, 1993-11~ | 종합지수 = 출하 33%·신규주문 40%·고용 27% | `XLI` | `https://www.richmondfed.org/-/media/RichmondFedOrg/region_communities/regional_data_analysis/regional_economy/surveys_of_business_conditions/manufacturing/data/mfg_historicaldata.xlsx` (시트 'Mfg Historical Series', 컬럼 `nsa_/sa_mfg_*`) — **FRED 미수록** | 없음 | 연준 공공 | **B** | **F** 마지막 행 2026-08-01, 66컬럼 |
| `kcfed_mfg` | 캔자스시티연준 제10지구 제조업 | 확산지수, 월 4번째 목, 2001-07~ | 에너지·농업 지역. 가격지불/수취 포함 | `XLI`, `XLE` | 페이지 `https://www.kansascityfed.org/surveys/manufacturing-survey/` 에서 `href="/documents/\d+/.*historicalmfg\.xlsx"` 추출(이번 값: `/documents/18452/2026Aug27historicalmfg.xlsx`). **가로형**(3행이 날짜, 행이 항목) — FRED 미수록 | 없음 | 연준 공공 | **B** | **F** 컬럼 끝 2026-08-26 |
| `regional_fed_composite_pmi` | **지역 연준 합성 PMI(자체 계산)** | z-점수 또는 ISM 환산, 월 | 5개 서베이의 일반활동·신규주문·가격지불을 각자 장기 평균·표준편차로 z-정규화 후 평균. ISM 환산은 `50 + z×(ISM 역사적 σ≈5)` 로 "환산치"라 표기. 선례: Bespoke 'Five Fed Manufacturing Composite', Yardeni 'Regional Fed average', Apollo(Sløk) 차트 | `XLI`, `SPY`, `IWM` | 위 5개에서 계산. 월중 발표 순서: Empire(15일)→Philly(3목)→Richmond(4화)→KC(4목)→Dallas(말월) — **도착한 것만으로 부분 평균 + "n/5 반영" 표기** | 없음 | 자체 계산 | **A**(계산) | 입력 5개 전부 F |

서비스업판: Philly Nonmanufacturing, NY Fed Business Leaders(서비스), Richmond·KC·Dallas(TSSOS — FRED `TSSOSBACTSAMFRBDAL` **F** 2026-08 4.2) 서비스 서베이가 같은 페이지 구조로 있음(댈러스 외 직접 URL 은 U).

### B-2. 뉴욕연준

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `nyfed_ref_rates` | SOFR·EFFR·OBFR·TGCR·BGCR + 분위수(1/25/75/99%)·거래량, SOFR 평균·지수 | %, 일간 | 분기말·세금일 자금경색 감지: **SOFR 99분위 − IORB**, SOFR 거래량 | `XLF`, `KRE`, `SHY`, `BIL` | `https://markets.newyorkfed.org/api/rates/all/latest.json`, 기간 `…/api/rates/secured/sofr/search.json?startDate=YYYY-MM-DD&endDate=…`. FRED 대체: `SOFR`, `SOFR99`, `SOFRVOL`, `EFFR`, `OBFR`, `IORB` | 없음 | 뉴욕연준 ToU(출처 표기) | **A** | **F** 09-15 EFFR 3.63(목표 3.50–3.75, 거래 $100B), SOFR 3.64, SOFR99 3.72, SOFRVOL 2,952 |
| `nyfed_rrp_ops` | 역레포·레포 오퍼레이션 결과 | USD, 일간 | RRP 잔고 고갈 = 유동성 버퍼 소진 | `SPY`, `QQQ`, `TLT` | `https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate=2026-09-01` (필드 `totalAmtAccepted`) | 없음 | 상동 | **A** | **F** 09-16 RRP $5.375B (사실상 0 근처) |
| `nyfed_soma` | SOMA 보유(국채·MBS·빌·TIPS) 주간 | USD, 주간 수 | QT 실제 속도를 자산군별로 | `TLT`, `IEF` | `https://markets.newyorkfed.org/api/soma/summary.json` (전체 히스토리 320KB) | 없음 | 상동 | **A** | **F** 2026-09-09 총 $6.362T (노트·본드 3.601T, MBS 1.906T, 빌 0.548T) |
| `nyfed_primary_dealer` | 프라이머리 딜러 포지션·파이낸싱·거래량 | 백만 USD, 주간(1주 지연) | 딜러 국채 재고 포화 = 입찰 부진·금리 급등 전조 | `TLT`, `GS`, `MS`, `JPM` | 목록 `https://markets.newyorkfed.org/api/pd/list/timeseries.json` → 시리즈 `https://markets.newyorkfed.org/api/pd/get/{keyid}.json` (예 `PDPOSGST-TOT` = 국채(TIPS 제외) 순포지션 합계) | 없음 | 상동 | **A** | **F** `PDPOSGST-TOT` 2026-09-02 = 455,185 ($M). (`/pd/latest.json` 류는 400) |
| `gscpi` | 글로벌 공급망 압력지수 | 표준편차, 월(첫 주), 1997-09~ | 운임·PMI 납기 합성. 재화 인플레 2~3분기 선행 | `UPS`, `FDX`, `XLI`, `WMT` | `https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx` (**확장자 xlsx 지만 실제 OLE .xls** → xlrd, 시트 'GSCPI Monthly Data') | 없음 | 뉴욕연준 ToU | **A−** | **F** 2026-08-31 = 1.06 |
| `acm_term_premium` | ACM 기간프리미엄·위험중립금리 (1~10년) | %, 일간, 1961-06~ | 장기금리 상승이 "정책 기대" 때문인지 "프리미엄" 때문인지 분해 → 성장주 멀티플 압박의 성격 | `TLT`, `QQQ`, `XLU`, `XLRE` | `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls` (10MB, 시트 'ACM Daily': ACMY·ACMTP·ACMRNY 01~10). 경량 대안 FRED `THREEFYTP10`(Kim-Wright 10년) | 없음 | 뉴욕연준 ToU, Adrian-Crump-Moench 인용 | **A−** | **F** ACM Daily 2026-09-15; `THREEFYTP10` 09-11 = 0.961 |
| `nyfed_sce` | 소비자기대조사(SCE) — 1·3·5년 기대인플레, 실직확률, 소득·지출 기대, 신용접근 | %, 월(2번째 월), 2013-06~ | 미시간보다 표본 크고 정치편향 적음. 연준이 직접 인용 | `XLY`, `XLP`, `WMT`, `TGT` | `https://www.newyorkfed.org/medialibrary/interactives/sce/sce/downloads/data/frbny-sce-data.xlsx` (시트 'Inflation expectations' 등 30여 개) | 없음 | 파일에 **License 시트** 포함(출처 "Source: Survey of Consumer Expectations, © FRBNY" 표기 조건) | **A−** | **F** 2026-08: 1년 3.58%, 3년 3.19% |
| `nyfed_hhdc` | 가계부채·신용 보고서 — 유형별 잔고, 신규 연체 전이율, 연령별 | USD·%, 분기, 2003~ | 카드·오토 **신규 심각연체 전이율** = 소비자금융주 핵심 | `COF`, `SYF`, `AXP`, `ALLY`, `KMX` | `https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/xls/hhd_c_report_{yyyy}q{n}.xlsx` (이번: `2026q2`, 시트 'Page 3 Data'…) | 없음 | 뉴욕연준 ToU / Equifax 패널 집계 | **B** | **F** 2026q2 파일 200·963KB (분기마다 파일명 변경) |
| `nyfed_cmdi` | 회사채시장 디스트레스 지수(CMDI) — 시장·IG·HY | 0~1, 주간값·월 게시(마지막 수), 2005-01~ | 스프레드만이 아니라 발행·유동성·비거래채 가격 괴리까지 합성 | `HYG`, `JNK`, `LQD` | `https://www.newyorkfed.org/medialibrary/research/interactives/data/cmdi/cmdi_interactive_data.xlsx` (컬럼 eow_friday / Market CMDI / IG CMDI / HY CMDI / p5…p99) — 인터랙티브 JS 에서 추출한 경로 | 없음 | 뉴욕연준 ToU | **B** | **F** 2026-08-21: 시장 0.21·IG 0.27·HY 0.08 |
| `nyfed_yc_recession_prob` | 수익률곡선 기반 12개월 후 침체확률 | %, 월, 1959~ | 10Y−3M 프로빗. 신호등용 | `SPY`, `XLF` | `https://www.newyorkfed.org/medialibrary/media/research/capital_markets/allmonth.xls` (시트 rec_prob). 짝: FRED `T10Y3M`, `RECPROUSM156N`(Chauvet-Piger) | 없음 | 뉴욕연준 ToU | **A−** | **F** 마지막 행 확률 0.139; `T10Y3M` 09-16 = 0.87; `RECPROUSM156N` 2026-07 = 0.76% |

### B-3. 금융 스트레스·은행·자금시장

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `ofr_fsi` | OFR 금융스트레스지수 + 5개 기여도(신용·주식밸류·안전자산·펀딩·변동성) + 지역(미국·선진·신흥) | 지수(0=평균), **일간**, 2000~ | NFCI(주간)보다 빠르고 **기여도 분해**가 있어 스택 차트가 바로 나옴 | `SPY`, `HYG`, `XLF`, `VXX` | `https://www.financialresearch.gov/financial-stress-index/data/fsi.csv` | 없음 | 미 정부 공공영역 | **A** | **F** 2026-09-14 = −2.226 (신용 −1.136, 주식 −0.543, 변동성 −0.081) |
| `ofr_stfm_repo` | OFR 단기자금 모니터 — 트라이파티·GCF·DVP 레포 금리·거래량 | %, USD, 일간 | 레포 시장 규모와 금리를 담보·만기별로. SOFR 이면 데이터 | `XLF`, `GS`, `MS`, `BIL` | 목록 `https://data.financialresearch.gov/v1/metadata/mnemonics?dataset=repo`(164개) → `https://data.financialresearch.gov/v1/series/timeseries?mnemonic=REPO-TRI_TV_TOT-P&start_date=2026-08-25` (응답 `[[date,val],…]`) | 없음 | 공공영역 | **A** | **F** 트라이파티 총거래 09-14 = $2.232T; `REPO-GCF_AR_OO-P` 09-15 = 3.70% (결측 null 다수). 없는 니모닉은 400 "Invalid mnemonic" |
| `ofr_mmf` | MMF 총자산·국채/레포/에이전시 배분 (N-MFP) | USD, 월 | "대기자금 $8T" 의 공식 수치와 어디에 들어가 있는지 | `SCHW`, `BLK`, `BIL` | `…/v1/series/timeseries?mnemonic=MMF-MMF_TOT-M` (목록 `?dataset=mmf` 42개). 주간 대안 FRED `WRMFNS`(소매 MMF) | 없음 | 공공영역 | **A** | **F** 2026-07-31 = $8.412T; `WRMFNS` 08-03 = 3,009.1 |
| `ofr_hedge_fund` | OFR 헤지펀드 모니터 — 전략별 레버리지·총명목익스포저·자산군별 롱/숏 (Form PF 집계) | 배·USD, 분기(2분기 지연) | 베이시스 트레이드·레버리지 과열 감시 | `GS`, `MS`, `JPM` | `https://data.financialresearch.gov/hf/v1/metadata/mnemonics?dataset=fpf`(329개) → `https://data.financialresearch.gov/hf/v1/series/timeseries?mnemonic=FPF-STRATEGY_EQUITY_LEVERAGERATIO_GAVWMEAN` | 없음 | 공공영역 | **A** | **F** 주식전략 레버리지 2026-03-31 = 2.77 |
| `stlfsi4` / `kcfsi` | 세인트루이스연준 FSI(주간)·캔자스시티연준 FSI(월간) | 지수(0=평균) | OFR FSI 와 교차검증용 | `SPY`, `XLF` | FRED `STLFSI4`, `KCFSI` | 없음 | 연준 공공 | **A** | **F** `STLFSI4` 09-11 = −0.848; `KCFSI` 2026-08 = −0.946 |
| `nfci_subindexes` | NFCI 하위지수(위험·신용·레버리지) + 조정 NFCI | 지수, 주간 수 | 설계서의 `NFCI` 에 분해를 붙임: 레버리지만 양(+)이면 "밸류는 비싸고 신용은 느슨" | `SPY`, `XLF`, `HYG` | FRED `NFCIRISK`, `NFCICREDIT`, `NFCILEVERAGE`, `ANFCI` | 없음 | 연준 공공 | **A** | **F** 09-11: −0.629 / −0.071 / **+0.060** / −0.582 |
| `fed_fci_g` | 연준 FCI-G (금융여건의 GDP 성장 임펄스) + 7개 구성(FFR·10년·모기지·BBB·주식·주택·달러) | %p, 월 | "금융여건이 향후 1년 성장에 주는 역풍/순풍"을 %p 로 — 기여도 분해 포함 | `SPY`, `XHB`, `XLF` | `https://www.federalreserve.gov/econres/notes/feds-notes/fci_g_public_monthly_3yr.csv` (1년 룩백판은 `_1yr` — U) | 없음 | 연준 공공(FEDS Note, 인용) | **A** | **F** 2026-07-31 = −0.877 (주식 기여 −0.669) |
| `gz_ebp` | Gilchrist-Zakrajšek 초과채권프리미엄(EBP)·GZ 스프레드·침체확률 | %p, 월, 1973~ | 부도위험을 뺀 "신용시장 심리". 침체 예측력이 학술적으로 가장 검증된 신용지표 | `HYG`, `LQD`, `SPY` | `https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv` (date, gz_spread, ebp, est_prob) | 없음 | 연준 공공, Favara et al. 인용 | **A** | **F** 2026-07: EBP −0.319, 침체확률 10.8% |
| `h8_bank_credit` | H.8 주간 은행 대출·예금·은행신용 | 십억 USD, 주간 금 | 예금 유출·대출 증가율 = 지역은행 스트레스의 1차 실측 | `KRE`, `KBE`, `JPM`, `BAC`, `WFC`, `ZION`, `WAL` | FRED `TOTLL`(대출·리스), `DPSACBW027SBOG`(예금), `TOTBKCR`(은행신용), `H8B1058NCBCMG`(예금 증가율 월) | 없음 | 연준 공공 | **A** | **F** 09-02: 대출 14,028.3 / 예금 19,565.9 / 신용 19,835.3 |
| `fed_discount_window` | 할인창구(프라이머리 크레딧)·전체 유동성 대출, 지준 | 백만 USD, 주간 수(H.4.1) | 은행 긴급 차입 급증 = 2023-03 식 사건의 실시간 경보 | `KRE`, `KBE`, `WAL`, `ZION` | FRED `WLCFLPCL`(프라이머리), `WLCFLL`(전체), `WRESBAL`(지준), `DPCREDIT`(금리). BTFP `H41RESPPALDKNWW` 는 0 으로 종료 | 없음 | 연준 공공 | **A** | **F** 09-09: 5,838 / 5,907 / 지준 2,991,310; BTFP 2026-05-06 = 0 |
| `sloos_standards` | SLOOS 대출태도(C&I 대형·카드) | 순강화 %, 분기 | 신용사이클 선행 2~3분기 (설계서엔 ID 없이 언급만) | `XLF`, `KRE`, `COF` | FRED `DRTSCILM`, `DRTSCLCC` | 없음 | 연준 공공 | **A** | **F** 2026-07: 0.0 / 6.7 |
| `g19_consumer_credit` | G.19 소비자신용(총·리볼빙)·카드 금리 | 백만 USD·%, 월 | 리볼빙 증가율 + 카드금리 = 카드사 NII | `COF`, `SYF`, `AXP`, `V`, `MA` | FRED `TOTALSL`, `REVOLSL`, `TERMCBCCALLNS` | 없음 | 연준 공공 | **A** | **F** 2026-07: 5,186,204 / 1,357,221; 카드금리 2026-05 = 20.94% |
| `bank_delinq_chargeoff` | 상업은행 연체·상각률 (전체·카드·소비자·C&I·CRE·주택) | %, 분기 | 설계서의 `DRCCLACBS` 옆에 나머지를 세트로 | `JPM`, `BAC`, `COF`, `SYF`, `KRE` | FRED `DRALACBS`, `DRCLACBS`, `DRBLACBS`, `DRCRELEXFACBS`, `DRSFRMACBS`, `CORCCACBS`(카드 상각) | 없음 | 연준 공공 | **A** | **F** 2026-Q2: 1.42 / 2.62 / 1.27 / 1.53 / 1.86 / 카드 상각 3.82 |
| `commercial_paper` | 상업어음 잔고·금리·CP-FF 스프레드 | 십억 USD·%, 주간/일간 | 단기 기업 자금조달 경색 | `XLF`, `GS` | FRED `COMPOUT`, `DCPF3M`(금융 3M), `DCPN3M`(비금융), `CPFF` | 없음 | 연준 공공 | **A** | **F** `COMPOUT` 09-09 = 1,436.9; `DCPF3M` 09-11 = 3.90; `CPFF` 0.27 |
| `credit_spread_ladder` | 등급별 스프레드 사다리: CCC OAS, BBB OAS, Baa−10Y, Aaa−10Y | %p, 일간 | HY 평균이 조용해도 **CCC−BB 괴리**가 먼저 벌어짐 | `HYG`, `JNK`, `LQD` | FRED `BAMLH0A3HYC`, `BAMLC0A4CBBB`, `BAA10Y`, `AAA10Y` | 없음 | ICE BofA 시리즈는 FRED 에 **최근 3년치만**·제3자 저작 → 소량 스냅샷+출처. Moody's 계열도 제3자 | **A**(제3자) | **F** 09-15: CCC 10.85 / BBB 0.98 / Baa 1.48 / Aaa 1.04 |

### B-4. 불확실성·심리·기대 (학술지수)

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `epu_daily` | 경제정책 불확실성(EPU) 일별 — 미국 | 지수, 일간, 1985~ | 관세·셧다운·선거 국면의 정량화. VIX 와 괴리 시 신호 | `SPY`, `VXX`, `GLD` | `https://www.policyuncertainty.com/media/All_Daily_Policy_Data.csv` (day,month,year,daily_policy_index). FRED `USEPUINDXD`, 월 `USEPUINDXM`, 글로벌 `GEPUCURRENT`, 주식시장 불확실성 `WLEMUINDXD`, 주식변동성 뉴스 `EMVOVERALLEMV` | 없음 | 무료, **Baker-Bloom-Davis(2016) 인용 요구** | **A** | **F** CSV 09-16 = 106.54; FRED 09-15 = 147.41(7일 이동 아님, 원값 차이는 개정·집계 시점); `GEPUCURRENT` 2026-07 = 241.7 |
| `gpr_daily` | 지정학 리스크(GPR) 일별 — 총·행위(ACT)·위협(THREAT) | 지수(1985–2019=100), 일간, 1985~ | 전쟁·테러 뉴스 빈도. 방산·원유·금과 직결 | `LMT`, `RTX`, `NOC`, `GD`, `XLE`, `GLD` | `https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls` (3.3MB; 컬럼 DAY, N10D, GPRD, GPRD_ACT, GPRD_THREAT). 월간·국가별 `data_gpr_export.xls` (U) | 없음 | 무료, **Caldara & Iacoviello (AER 2022) 인용** | **A−** | **F** 2026-09-14: GPRD 189.5 · ACT 246.4 · THREAT 219.3 |
| `sf_news_sentiment` | SF연준 일별 뉴스 심리지수 | 지수, 일간(주 1회 갱신), 1980~ | 24개 신문 경제기사 감성. 소비심리 조사보다 빠름 | `SPY`, `XLY` | `https://www.frbsf.org/wp-content/uploads/news_sentiment_data.xlsx` (시트 'Data') | 없음 | 연준 공공, Shapiro-Sudhof-Wilson 인용 | **A−** | **F** 2026-09-13 = 0.0248 |
| `atl_wage_tracker` | 애틀랜타연준 임금상승 추적기(전체·이직자/잔류자·연령·학력) | %, 월 | 이직자−잔류자 격차 = 노동시장 과열도 | `PAYX`, `ADP`, `XLY` | FRED `FRBATLWGT3MMAUMHWGO`(3MMA 전체). 분해: `https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/datafiles/chcs/wage-growth-tracker/wage-growth-data.xlsx` | 없음 | 연준 공공 | **A** | **F** 2026-08 = 4.1% (FRED·xlsx 일치) |
| `atl_sticky_cpi` | 애틀랜타연준 Sticky CPI (근원 12개월) | %, 월 | 끈적한 물가 = 연준 피벗 제약 | `TLT`, `TIP`, `SPY` | FRED `CORESTICKM159SFRBATL` | 없음 | 연준 공공 | **A** | **F** 2026-08 = 2.70 |
| `clev_expected_inflation` | 클리블랜드연준 기대인플레(1·10년)·10년 실질금리 | %, 월 | 서베이+스왑+국채 모형. 브레이크이븐의 유동성 왜곡 제거 | `TIP`, `TLT`, `GLD` | FRED `EXPINF1YR`, `EXPINF10YR`, `REAINTRATREARAT10Y` | 없음 | 연준 공공 | **A** | **F** 2026-09: 2.64 / 2.57 / 2.24 |
| `umich_subindexes` | 미시간 하위지수 — 현재여건(ICC)·기대(ICE)·1년/5년 기대인플레 | 지수·%, 월, 1952~ | `UMCSENT` 만으론 안 보이는 기대/현재 괴리 | `XLY`, `WMT`, `TGT` | `https://www.sca.isr.umich.edu/files/tbmics.csv`(ICS), `…/tbmiccice.csv`(ICC·ICE), `…/tbmpx1px5.csv`(PX_MD·PX5_MD). FRED `MICH`(1년) | 없음 | © Univ. of Michigan — 출처 표기 필수, **상업적 재배포는 허락 필요** → 최신값·소량 | **B** | **F** 2026-08: ICS 51.7 · ICC 51.9 · ICE 51.5 · 1년 4.0% · 5년 3.3% (`data.sca.isr…get-table.php` 는 Not Found) |
| `atl_market_prob_tracker` | **애틀랜타연준 Market Probability Tracker — FOMC 금리 경로 확률분포** | bp·%, 일간, 2023-03~ | 설계서가 X 로 뺀 **CME FedWatch 의 공식·무료 대체**(SOFR 옵션 기반). 회의별 평균·최빈·분위수·구간확률 | `TLT`, `SHY`, `XLF`, `KRE`, `QQQ` | `https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/cenfis/market-probability-tracker/mpt_histdata.xlsx` (6.9MB, 시트 'DATA' long 형식: date, reference_start, target_range, field, value; 30만 행 → **최근 날짜만 필터해 저장**) | 없음 | 파일에 LICENSE 시트 있음(텍스트가 도형이라 파서로 못 읽음 → **수동 확인 필요**). 입력은 CME 옵션이지만 산출물은 연준 공표 | **B** | **F** 마지막 행 date 2026-09-15 |
| `truflation` | Truflation 일별 CPI | %, 일간 | — | — | truflation.com (홈에 "usInflation 2.4" 노출, 데이터는 API 상품) | 유료 | 독점 | **D** | S — 무료 시계열 경로 못 찾음 |

(애틀랜타연준 Business Inflation Expectations: FRED `ATLSBUSRGEP` 는 BIE 가 **아니라** 'Survey of Business Uncertainty 매출성장 기대'(2026-08 = 5.66, F). BIE 의 FRED ID 는 **U**.)

### B-5. 옵션·변동성·시장구조

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `vix_term_structure` | VIX 기간구조: VIX9D / VIX / VIX3M (+ 비율 VIX/VIX3M) | 포인트, 일간 | **VIX > VIX3M(백워데이션)** = 패닉 구간. 가장 검증된 단기 리스크 스위치 | `SPY`, `VXX`, `UVXY`, `SVXY`, `VIXY`, `CBOE` | `https://cdn.cboe.com/api/global/us_indices/daily_prices/{SYM}_History.csv`, SYM = `VIX`, `VIX9D`, `VIX3M` (DATE,OPEN,HIGH,LOW,CLOSE; MM/DD/YYYY). FRED 폴백 `VXVCLS`(=VIX3M) | 없음 | © Cboe — 사이트 약관상 상업적 재배포 제한 가능 → **파생 비율 + 출처 표기**, 원시 전 히스토리 재게시는 피함 | **A−** | **F** 09-16 종가: VIX 17.71 · VIX9D 17.40 · VIX3M 19.73 → 비율 0.90 |
| `vvix_skew` | VVIX(변동성의 변동성)·SKEW(꼬리위험) | 포인트, 일간 | SKEW 140+ 와 낮은 VIX 의 조합 = 헤지 수요 누적 | `SPY`, `VXX`, `CBOE` | 같은 패턴 `VVIX_History.csv`, `SKEW_History.csv` (컬럼 DATE, 값 1개) | 없음 | 상동 | **A−** | **F** 09-16: VVIX 95.41 · SKEW 145.95 |
| `cboe_putcall_daily` | Cboe 풋콜비율 — 총·지수·ETP·**주식**·VIX·SPX | 비율, 일간 | 주식 풋콜 0.5 이하 = 과열, 1.0 이상 = 공포. 레포의 옵션 패널(종목별)과 달리 **시장 전체** | `SPY`, `QQQ`, `CBOE`, `HOOD`, `IBKR` | `https://cdn.cboe.com/data/us/options/market_statistics/daily/{YYYY-MM-DD}_daily_options` (JSON, `ratios[]` + 상품군별 거래량). 히스토리는 날짜 루프 또는 적립. 구 아카이브 `…/resources/options/volume_and_call_put_ratios/totalpc.csv` 는 **2019-10-04 에서 종료** | 없음 | 상동 | **A−** | **F** 09-16: 총 0.98 · 지수 1.02 · ETP 1.39 · **주식 0.69** · VIX 0.40 · SPX 1.28 |
| `other_vol_indexes` | 원유 VIX(OVX)·금 VIX(GVZ)·MOVE(채권 변동성) | 포인트, 일간 | 자산군 간 변동성 전이 | `XLE`, `GLD`, `TLT` | FRED `OVXCLS`, `GVZCLS`. MOVE 는 Yahoo `https://query1.finance.yahoo.com/v8/finance/chart/%5EMOVE?range=5d&interval=1d` | 없음 | OVX/GVZ © Cboe(FRED 경유), **MOVE 는 ICE 독점지수·야후 비공식 → 표시용만** | A− / **C** | **F** 09-15 OVX 61.73 · GVZ 26.90; MOVE 80.73 |
| `finra_short_interest` | FINRA 통합 공매도 잔고(격주) — 종목별 잔고·전기 대비·Days-to-cover | 주, 월 2회(결제일 기준 ~7영업일 후) | 레포의 '일일 공매도량'은 **거래 비중**, 이건 **잔고** — 숏스퀴즈 스캐너의 정식 입력. 전 거래소 통합(2021~) | 종목 전체; `IWM`, `KRE` | `POST https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest` body `{"limit":5000,"compareFilters":[{"compareType":"EQUAL","fieldName":"settlementDate","fieldValue":"2026-08-31"}]}` (+`offset` 페이지). GET 은 기본 정렬이 2020 년부터라 쓸모없음 | **없음**(otcMarket 그룹은 무인증 통과) | FINRA Data 약관 — 출처 표기, 대량 재판매 금지 조항 **S**(약관 본문 미확인) | **A** | **F** NVDA 2026-08-31: 잔고 298,301,619주(+4.32%), DTC 2.14 |
| `finra_ats_darkpool` | FINRA OTC/ATS 투명성 — 주간 다크풀(ATS)·비ATS OTC 거래량, 종목×ATS | 주·건·USD, 주간(2~4주 지연) | 종목별 **다크풀 비중** 추이, 시장 전체 장외 비중 | `VIRT`, `HOOD`, `SCHW`, `IBKR`, `NDAQ`, `ICE` | `POST https://api.finra.org/data/group/otcMarket/name/weeklySummary` body 필터 `weekStartDate`, `summaryTypeCode`(`ATS_W_VOL_STATS` 집계 / `ATS_W_SMBL` 종목별 / `OTC_W_SMBL`), `tierIdentifier`(T1/T2/OTC) | 없음 | 상동 | **A** | **F** 2026-08-03 주 집계 행: 62.3억 주·$537.7B, lastUpdate 2026-09-08 |
| `sec_midas` | SEC MIDAS 시장구조 지표 — 종목별 취소/체결비, 오드랏 비중, 히든 비중 | 분기 zip | HFT 활동·호가 품질. 분기 지연이라 리서치용 | `NDAQ`, `ICE`, `CBOE`, `VIRT` | 인덱스 `https://www.sec.gov/opa/data/market-structure/marketstructuredownloadshtml-by_security` → `/files/opa/data/market-structure/metrics-individual-security/individual_security_{yyyy}_q{n}.zip` | 없음(UA 필요) | 공공영역 | **B** | **F**(페이지) 최신 링크 `individual_security_2026_q2` 확인, zip 자체는 미다운로드 |
| `occ_volume` | OCC 옵션 청산 거래량(일·월, 계약 유형별) | 계약, 일간 | 0DTE·리테일 옵션 붐 | `CBOE`, `CME`, `HOOD`, `IBKR` | theocc.com 통계 페이지 | — | — | B | **F(403)** 페이지 봇 차단, `marketdata.theocc.com/mdapi/volume-query` 400 → 위 Cboe JSON 의 거래량으로 대체 |
| `nyse_nasdaq_hilo` | 거래소 공식 신고가·신저가 | — | — | — | 무료 1차 출처 없음(WSJ Markets Diary 는 봇 차단·약관) | — | — | X | U → §10 자체 계산으로 대체 |

### B-6. 밸류에이션·학술 데이터셋

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `shiller_cape` | Shiller CAPE·실질 주가·실질 이익·배당·초과 CAPE 수익률 | 배, 월, 1871~ | 장기 밸류에이션의 표준 | `SPY`, `VTI`, `RSP` | `https://shillerdata.com/` HTML 에서 `img1.wsimg.com/blobby/go/…/downloads/…/ie_data.xls` 링크 추출(이번 값: `//img1.wsimg.com/blobby/go/e5e77e0b-59d1-44d9-ab25-4763ac982e53/downloads/70fec4f5-727f-4e53-b5f1-179af109c5fa/ie_data.xls`). 시트 'Data', 8행 헤더, 날짜는 `2026.09` 실수형(10월은 `.1` 주의) | 없음 | 무료, Shiller 인용 | **B** | **F** 2026-09 CAPE **40.58** (P 7,631.47), 2026-08 41.12. 구 Yale URL 은 2023-09 에서 정지 |
| `damodaran_implied_erp` | Damodaran 월간 내재 주식위험프리미엄 | %, 월초, 2008-09~ | "주식이 채권 대비 얼마나 비싼가"를 한 숫자로 | `SPY`, `TLT` | `https://pages.stern.nyu.edu/~adamodar/pc/implprem/ERPbymonth.xlsx` (시트 'Historical ERP') | 없음 | 무료, Damodaran 인용 | **A−** | **F** 2026-09-01: S&P 7,686.14, ERP 4.75%(T12M 현금수익 기준)·4.53% |
| `damodaran_industry` | Damodaran 산업별 멀티플(PE·EV/EBITDA·마진·베타·WACC) | 연 1회(1월) | 섹터 밸류 벤치마크. 레포 피어 패널의 "산업 평균" 칸 | 섹터 ETF `XLK`, `XLF`, `XLE`, `XLV` 등 | `https://pages.stern.nyu.edu/~adamodar/pc/datasets/pedata.xls` (그 외 `vebitda.xls`, `margin.xls`, `betas.xls`, `wacc.xls` — 뒤 4개 U) | 없음 | 상동 | **B** | **F** `pedata.xls` 200·62KB (내용 날짜 미확인) |
| `french_factors` | Fama-French 3·5팩터 + 모멘텀 일별 수익률 | %, 일간, 1926/1963~, 월 1회 갱신(1~2개월 지연) | 레포의 '검증된 팩터 순위'·팩터/위험 패널의 **외부 기준선**. 최근 1·3·12개월 팩터 성과 표 | `MTUM`, `QUAL`, `VLUE`, `USMV`, `IWD`, `IWF`, `IWM` | `https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip`, `…/F-F_Research_Data_5_Factors_2x3_daily_CSV.zip`, `…/F-F_Momentum_Factor_daily_CSV.zip` (zip 안 CSV, 머리말 3~4줄 건너뜀, 날짜 YYYYMMDD) | 없음 | © Fama & French — 연구·교육 자유 이용, 출처 표기. 집계 성과표는 무난 | **A−** | **F** 마지막 행 2026-07-31: Mkt-RF 0.68 · SMB −0.49 · HML −0.59 · RMW 1.09 · CMA −2.90 · Mom −0.86 |
| `aqr_factors` | AQR QMJ·BAB·HML-Devil·TSMOM | %, 월/일 | 퀄리티·저베타 팩터의 학술 표준 | `QUAL`, `USMV`, `SPLV`, `SPHB` | `https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Quality-Minus-Junk-Factors-Monthly.xlsx` (2.3MB; Daily 는 **31.8MB** → Actions 에서 비권장) | 없음 | AQR 약관: 정보 제공용·출처 표기, **재배포 조항 확인 필요** → 집계만 | **B** | **F** 200 (내용 최신월 미확인) |
| `sp500_eps_est` | S&P DJI 지수 EPS·바이백 xlsx | 분기/주 | — | — | `https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-eps-est.xlsx` | — | S&P 독점, 재배포 금지 | **X** | **F(403)** 봇 차단 + 라이선스 → 넣지 않음. 대체: §11 XBRL 합산 |
| `buffett_indicator` | 버핏 지표(시총/GDP) 자체 계산 | %, 분기(+일간 보간) | 총량 밸류에이션 | `VTI`, `SPY`, `BRK.B` | FRED `NCBEILQ027S`(비금융 기업 주식 시가, 백만 USD) ÷ `GDP`(십억 USD)×1000. 분기 사이는 `VTI` 종가 변화율로 보간하고 "추정" 표기. **Wilshire 5000 은 FRED 에서 삭제됨**(`WILL5000PR` → HTML 오류), Yahoo `^FTW5000` 은 시세 갱신 정지(regularMarketTime 2026-03) | 없음 | 연준 Z.1 공공 | **A** | **F** 2026-Q2: 83,050,847 ÷ 32,486.066 → **255.6%** |
| `multpl` | multpl.com (PER·배당수익률 표) | — | — | — | 제3자 스크랩 | — | 약관 불명 | C/X | U — Shiller 로 충분, 넣지 않음 |

### B-7. 재무부·재정

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `dts_tga_daily` | 일일 재무부 명세서 — **TGA 일별 잔고** | 백만 USD, 일간(T+1 16:00 ET), 2005~ | 설계서의 순유동성은 주간 `WTREGEN` — 이걸로 **일별**화. 세금일·부채한도 국면 | `SPY`, `QQQ`, `TLT`, `BIL` | `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=1&filter=account_type:eq:Treasury General Account (TGA) Closing Balance&fields=record_date,account_type,open_today_bal` — **함정: 마감잔고가 `open_today_bal` 필드에 들어 있고 `close_today_bal` 은 "null"** | 없음 | 공공영역 | **A** | **F** 2026-09-15 마감 $991,557M (개시 871,224; 법인세 납부일) |
| `dts_tax_receipts` | 일별 원천징수세(소득·FICA)·법인세 입금 | 백만 USD, 일간 | **원천징수세 YoY = 실시간 임금총액** 프록시(고용보고서보다 빠름) | `SPY`, `PAYX`, `ADP`, `XLY` | `…/v1/accounting/dts/deposits_withdrawals_operating_cash?sort=-record_date&filter=transaction_catg:eq:Taxes - Withheld Individual/FICA&fields=record_date,transaction_today_amt,transaction_mtd_amt,transaction_fytd_amt` (법인세 카테고리명은 `Taxes - Corporate Income` — U). 요일·월말 효과가 커서 **20영업일 합계 YoY** 로 가공 | 없음 | 공공영역 | **A** | **F** 09-15: 당일 7,819 · MTD 136,877 · FYTD 3,424,816 |
| `treasury_buybacks` | 재무부 바이백 오퍼레이션(유동성 지원·현금관리) | USD, 주 1~2회, 2024-05~ | 장기물 수급 보조. 만기 버킷별 매입액 | `TLT`, `IEF` | `…/v1/accounting/od/buybacks_operations?sort=-operation_date&page[size]=20` (operation_type, maturity_bucket, max_par_amt_redeemed, total_par_amt_accepted) | 없음 | 공공영역 | **A** | **F** 최신 예고 2026-09-17, 7Y–10Y, 최대 $4B |
| `mts_deficit_interest` | 월간 재무부 명세서 — 세입·세출·적자, 순이자비용 | USD, 월(8영업일) | 재정적자·이자비용 추세 = 기간프리미엄·발행 압력 논리의 근거 | `TLT`, `GLD` | `…/v1/accounting/mts/mts_table_1?sort=-record_date` (월별 행은 `classification_desc` = 월 이름, `record_type_cd`=MTH), 이자비용은 `mts_table_5`(U) | 없음 | 공공영역 | **A** | **F** record_date 2026-08-31 응답 확인(표본 행: March 세입 $384.9B·세출 $549.0B·적자 $164.1B) |
| `avg_interest_rates_debt` | 국가채무 평균 이자율(빌·노트·본드·TIPS별) | %, 월말 | 차환으로 평균 조달금리가 오르는 속도 | `TLT`, `SHY` | `…/v2/accounting/od/avg_interest_rates?sort=-record_date` | 없음 | 공공영역 | **A** | **F** 2026-08-31: 빌 3.788% · 노트 3.345% |
| `tic_major_holders` | TIC — 외국인 미 국채 보유(국가별) | 십억 USD, 월(6주 지연) | 일본·중국 매도/매수. "탈달러" 서사의 사실 확인 | `TLT`, `IEF`, `GLD` | `https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt` (탭 구분, 6행 헤더, 최근 13개월 가로) → 월 1회 적립해 히스토리 구축 | 없음 | 공공영역 | **A−** | **F** 2026-07: 일본 1,103.9 · 영국 998.3 · 중국 618.0 · 벨기에 470.7 |
| `real_yield_breakeven` | 실질금리·브레이크이븐·5y5y 선도 | %, 일간 | 금·성장주 할인율. 재무부 원천 실질 곡선(5~30년) 포함 | `TIP`, `GLD`, `QQQ`, `TLT` | FRED `DFII10`, `T10YIE`, `T5YIFR`. 원천: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026&page&_format=csv` | 없음 | 공공 | **A** | **F** `T10YIE` 09-16 = 2.33 · `T5YIFR` 2.31 · `DFII10` 09-15 = 2.62; 재무부 CSV 09-16 10Y 실질 2.68 |
| `gsw_yield_curve` | 연준 GSW 제로쿠폰·선도금리 곡선 파라미터 | %, 일간, 1961~ | 선도금리(SVENF)로 "시장이 보는 장기 중립금리" 추적 | `TLT`, `IEF` | `https://www.federalreserve.gov/data/yield-curve-tables/feds200628.csv` (**16.6MB**, 9행 머리말 → 꼬리 N행만 저장) | 없음 | 연준 공공(비공식 통계 주의문 포함) | **B** | **F** 마지막 행 2026-09-11 |

### B-8. 은행·신용 (종목 직결)

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `fdic_bank_financials` | FDIC BankFind — **은행별** 분기 NIM·부실채권비율·순상각률·ROA·예금·자산 | %, 천 USD, 분기(분기말+~50일), 1984~ | 10-Q 보다 표준화된 은행 비교표. 종목 분석의 '은행 전용 패널' | `JPM`(CERT 628), `BAC`, `WFC`, `C`, `USB`, `PNC`, `TFC`, `RF`, `KEY`, `FITB`, `HBAN`, `CFG`, `MTB`, `ZION`, `WAL`, `FLG` | `https://api.fdic.gov/banks/financials?filters=CERT:628&fields=REPDTE,ASSET,DEP,NIMY,NCLNLSR,NTLNLSR,ROA&sort_by=REPDTE&sort_order=DESC&limit=8&format=json`. CERT 찾기: `https://api.fdic.gov/banks/institutions?search=NAME:"Zions"&fields=NAME,CERT,ASSET` (U). 지주사는 자회사 은행 CERT 여러 개일 수 있음 → 티커↔CERT 매핑 테이블 수작업 1회 | 없음 | 공공영역 | **A** | **F** CERT 628 2026-06-30: 자산 $4.091T · NIM 2.88% · 부실 0.78% · 순상각 0.61% · ROA 1.59%. 옛 호스트 `banks.data.fdic.gov/api` 는 301 |
| `fdic_qbp_aggregate` | FDIC 분기 은행업 프로파일(업계 합계) | 백만 USD, 분기 | 업계 순이자이익·미실현손실 | `KRE`, `KBE`, `XLF` | FRED `QBPQYNTIY`(순이자이익), `QBPBSTASSCUSTRSC`(보유 국채). `USNIM` 은 **2020-Q3 에서 중단** | 없음 | 공공 | **A** | **F** 2026-Q2: 197,391 / 1,662,360 |
| `card_master_trust_10d` | 신용카드 마스터트러스트 월간 10-D — 연체(30+/60+/90+)·순상각률·결제율·포트폴리오 수익률 | %, **월간(매월 15일경)** | 은행 분기 실적보다 2개월 빠른 카드 신용 실측 | `COF`, `SYF`, `AXP`, `JPM`, `C`, `BAC` | EDGAR `https://data.sec.gov/submissions/CIK{10자리}.json` 에서 form=`10-D` 최신 → `https://www.sec.gov/Archives/edgar/data/{cik}/{accession-no-dash}/` 의 EX-99 HTML 표 파싱. **CIK(전부 확인)**: Capital One Multi-Asset Execution Trust 1163321 · Synchrony Card Funding 1724786 · American Express Credit Account Master Trust 1003509 · Discover Card Execution Note Trust 1407200 · Chase Issuance Trust 1174821 · Citibank Credit Card Issuance Trust 1108348 · BA Credit Card Trust 1128250 | 없음(UA 필수) | 공공(EDGAR) | **B** (트러스트마다 표 양식 다름 → 파서 7개) | **F** 7개 모두 **2026-09-15 제출** 10-D 확인(예: COMET `0001163321-26-000027` `form10-daugust2026.htm`). EX-99 수치 파싱은 미시험. 트러스트 풀 ≠ 회사 전체 장부(우량 편향) 표기. EDGAR FTS(`efts.sec.gov`)는 403 |
| `philly_y14_cards` | 필라델피아연준 대형은행 카드·모기지(Y-14M 집계) — 잔고, 연체 30/60/90+, 최소결제 비중, 신용점수 분포 | %, 분기(~4개월 지연), 2012-Q3~ | **'최소결제만 하는 계좌 비중'** 은 여기에만 있음 | `COF`, `SYF`, `AXP`, `JPM`, `C` | 페이지 `https://www.philadelphiafed.org/surveys-and-data/large-bank-credit-card-and-mortgage-data` 에서 CSV 링크 추출: `/-/media/FRBP/Assets/Surveys-And-Data/Y14/{yyyy}/Q{n}/{yy}Q{n}-CreditCardBalances.csv` (+`CreditCardOriginations`, `First-LienBalances`). 값이 `"$571.03"`, `"9.25 %"` 문자열 + 꼬리에 주석행 → 정제 필요 | 없음 | 연준 공공 | **B** | **F** `26Q1-CreditCardBalances.csv` 200·36컬럼 |
| `kc_lmci` | KC연준 노동시장 여건지수(수준·모멘텀) | 지수, 월 | 24개 노동지표 합성 | `SPY`, `XLY` | FRED `FRBKCLMCILA`, `FRBKCLMCIM` | 없음 | 연준 공공 | **A** | **F** 2026-08: 0.306 / 0.252 |
| `sifma_issuance` | SIFMA 발행 통계(회사채·ABS·지방채) xls | USD, 월 | IG/HY 발행 창구 개폐 | `GS`, `MS`, `JPM`, `MCO`, `SPGI` | `https://www.sifma.org/resources/research/statistics/us-corporate-bonds-statistics/` (페이지 200, 정적 HTML 에 xls 링크 없음 — JS 렌더) | 없음 | © SIFMA, 출처 표기·재배포 제한 | B/X | **S** 직접 파일 경로 미확보 |
| `us_courts_bankruptcy` | 미 법원 파산 통계(챕터 7/11/13, 사업/비사업) | 건, 분기 | 챕터 11 증가 = 신용사이클 후행 확인 | `HYG`, `JNK` | `https://www.uscourts.gov/data-news/reports/statistical-reports/bankruptcy-filings-statistics` → 분기 페이지 → Table F-2 xlsx | 없음 | 공공영역 | B | **S** 인덱스 200, 최신 분기 xlsx 경로 미확인. (월간은 Epiq 보도자료뿐 — 인용) |

### B-9. 고빈도 실물

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목/ETF | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `census_bfs_weekly` | Census 사업체 설립 신청(BFS) — 전체·고성향(HBA)·임금계획(WBA)·법인(CBA) | 건, **주간**(목) + 월간 SA·업종·주별, 2006~ | 창업 붐/냉각. SMB 소프트웨어·결제 수요 | `SHOP`, `XYZ`, `INTU`, `PAYX`, `ADP` | `https://www.census.gov/econ/bfs/csv/bfs_us_apps_weekly_nsa.csv` (Year,Week,BA_NSA,HBA_NSA,…,YY_*), 월간 `https://www.census.gov/econ/bfs/csv/bfs_monthly.csv`(2.8MB, sa/naics_sector/series/geo). FRED `BUSAPPWNSAUS`, `BABATOTALSAUS` | 없음 | 공공영역 | **A** | **F** 2026-W34: BA 129,820(YoY +51.1%) · HBA 34,240; 월 SA 2026-08 = 531,728 |
| `chicagofed_carts` | 시카고연준 CARTS — 자동차 제외 소매판매 주간 나우캐스트 | 백만 USD, 주간/격주 | Census 소매판매 발표 전 월간 추정 | `WMT`, `TGT`, `COST`, `AMZN`, `XLY` | FRED `CARTS` (제목 확인: "Chicago Fed Advance Retail Trade Summary: Retail and Food Services Sales Excluding Autos"). 원천 페이지 `chicagofed.org/research/data/carts/current-data` 는 curl 400 | 없음 | 연준 공공 | **A** | **F** 2026-08-28 = 629,178.7 |
| `mfg_construction` | 제조업 건설지출(CHIPS·리쇼어링) | 백만 USD SAAR, 월 | 반도체 팹·배터리 공장 착공 사이클 | `CAT`, `PWR`, `EME`, `ETN` | FRED `TLMFGCONS`, `PRMFGCONS` | 없음 | 공공 | **A** | **F** 2026-07: 169,795 / 167,805 |
| `gasoline_retail_weekly` | EIA 주간 휘발유 소매가(전국 레귤러) | USD/gal, 주간 월 | 소비심리·헤드라인 CPI 나우캐스트 입력 | `XOM`, `CVX`, `VLO`, `MPC`, `PSX`, `WMT`, `XLY` | FRED `GASREGW` (EIA v2 `petroleum/pri/gnd` 와 동일 원천) | 없음 | 공공 | **A** | **F** 2026-09-14 = **$4.319** |
| `stl_econ_news_index` | 세인트루이스연준 Economic News Index | %(실질 GDP 연율), 주간 | GDPNow·NY Nowcast 옆 세 번째 나우캐스트 | `SPY` | FRED `STLENI` | 없음 | 연준 공공 | **A** | **F** 2026-07-01 분기 = 2.41 |
| 중단·유료 | Dallas Fed Mobility & Engagement Index(2021 **중단**), Opportunity Insights Tracker(업데이트 **중단**), NY Fed WEI(설계서 기수록), `TEDRATE`(**2022-01-21 종료**, LIBOR 폐지), `USNIM`(2020 중단), Homebase·Lightcast·Womply(유료/**D**), BEA 주간 통계(없음) | | | | | | | D/— | TEDRATE·USNIM 은 **F**(마지막 날짜 확인), 나머지 S |

### B-10. 자체 계산 시장 내부지표 (외부 소스 아님 — 레포의 7,130개 `data/details/*.json` `chartSeries` 1,260봉 OHLCV 로 계산)

| 지표 ID | 정의 | 선례(같은 것을 보여주는 서비스) | 연관 | 구현 메모 |
| :-- | :-- | :-- | :-- | :-- |
| `breadth_ad_line` | 일별 (상승 종목수 − 하락 종목수) 누적. 유니버스는 보통주만(ETF·우선주 제외, `fundamentals.sector` 로 필터) | StockCharts `$NYAD`, MarketInOut, Barchart | `SPY`, `RSP`, `IWM` | 지수 신고가 + A/D 라인 미갱신 = 다이버전스 배지. 상장폐지 생존편향이 있으므로 "현재 상장 종목 기준" 명기 |
| `pct_above_ma` | 종가 > 200일(·50일·20일) SMA 종목 비율. 전체 / S&P500 / 섹터별 | StockCharts `$SPXA200R`, Barchart `$MMTH`/`$MMFI`, Finviz 스크리너 | 섹터 ETF `XLK`…`XLRE` | 200봉 미만 종목은 분모 제외. 15% 이하 = 과매도, 85% 이상 = 과열 밴드 |
| `new_high_low` | 252봉 신고가 종목수 − 신저가 종목수, 그리고 (신고가)/(신고가+신저가) 10일 평균(High-Low Index) | StockCharts `$NYHL`, WSJ Markets Diary, Barchart New Highs/Lows | `SPY`, `IWM` | 메모리의 "52주 필드 5년→252봉 수정" 교훈 그대로: **반드시 252봉 창**. 힌덴부르크 오멘(신고가·신저가 동시 2.2%↑)도 파생 가능 |
| `mcclellan` | 비율조정 순상승 RANA = (상승−하락)/(상승+하락)×1000; 오실레이터 = EMA19(RANA) − EMA39(RANA); 서메이션 = 누적합 | McClellan Financial Publications, StockCharts `$NYMO`/`$NYSI` | `SPY`, `QQQ` | 비율조정판을 써야 유니버스 크기 변화에 둔감 |
| `sector_dispersion` | 11개 섹터 ETF 20일 수익률의 횡단면 표준편차 + 종목 간 평균 쌍상관(60일, 시총 상위 100) | Cboe 내재상관지수(COR3M — 유료), S&P Dispersion(DSPX) | `SPHB`, `SPLV`, `RSP` | 상관↓·분산↑ = 종목장세, 상관↑ = 매크로장세. 계산량은 100×100 이라 가벼움 |
| `equal_vs_cap` | `RSP`/`SPY` 비율, `IWM`/`SPY` 비율의 50일 추세 | 모든 전략 리포트의 "breadth" 차트 | `RSP`, `SPY`, `IWM` | 기존 시세만으로 즉시 |
| `insider_buy_sell_ratio` | 기존 `data/insider_trades.json`(Form 4) 에서 월별 공개시장 **매수(P) 건수 ÷ 매도(S) 건수**, 매수 기업 수/매도 기업 수. 10b5-1 계획 매도·옵션 행사 동반 매도는 분리 | OpenInsider 'Insider Buy/Sell Ratio', Vickers Weekly Insider, InsiderSentiment.com (Seyhun) | `SPY`, `IWM` | 역사적으로 비율 급등(2020-03, 2022-06)이 바닥권. 분모 작을 때 노이즈 → 4주 이동 |
| `buyback_aggregate` | XBRL `PaymentsForRepurchaseOfCommonStock` 합계(전 상장사, 분기) + 상위 20개사 | S&P DJI 분기 바이백 보도자료, Yardeni 'Buybacks' 차트북 | `SPY`, `AAPL` 등 | §11 의 YTD 함정 때문에 **Frames 가 아니라 companyconcept/companyfacts 로 분기 차분** 필요 |

### B-11. SEC XBRL Frames API — 바텀업 매크로 (실호출 결과)

`GET https://data.sec.gov/api/xbrl/frames/us-gaap/{Tag}/USD/CY2026Q2I.json` (UA `Mir_US_Stocks research dydtjsdn@gmail.com`, 키 없음, 공공영역, **등급 A**, 10 req/s 제한)

| 지표 ID | 태그 / 기간 | 실측 (F) | 판정 |
| :-- | :-- | :-- | :-- |
| `xbrl_inventory_sum` | `InventoryNet` / `CY2026Q2I` (시점) | 2,057개사, 합계 **$1,682B**. 상위: Walmart 61.6 · Amazon 38.2 · NVIDIA 31.6 · Home Depot 26.8. `end` 분포: 06-30 1,603개 · 06-27 80 · 07-31 63 · 05-31 57 (회계분기 ±30일을 한 프레임에 묶어줌) | **가능.** 섹터 합산 재고/매출 비율 → 재고 사이클 |
| `xbrl_receivables_sum` | `AccountsReceivableNetCurrent` / `CY2026Q2I` | 2,544개사, $1,943B | 가능 |
| `xbrl_cash_sum` | `CashAndCashEquivalentsAtCarryingValue` / `CY2026Q2I` | 4,174개사, $2,875B (GS 187 · MS 160 — **금융주 제외 필터 필요**) | 가능(금융 제외) |
| `xbrl_revenue_sum` | `Revenues` / `CY2026Q2` (3개월 구간) | 1,639개사, $3,457B — 단 많은 회사가 `RevenueFromContractWithCustomerExcludingAssessedTax` 를 씀(Amazon·Apple 등 누락) → **두 태그 합집합, CIK 중복 제거** | 조건부 |
| `xbrl_interest_expense_sum` | `InterestExpense` / `CY2026Q2` | 770개사, $34.7B (태그 분산: `InterestExpenseNonoperating`, `InterestExpenseDebt` 등) | 조건부(태그 3~4개 합집합) |
| `xbrl_capex_sum` | `PaymentsToAcquirePropertyPlantAndEquipment` / `CY2026Q1` vs `CY2026Q2` | **Q1 2,440개사 $261B**(Alphabet 35.7 · MSFT 30.9 · Meta 19.0) vs **Q2 196개사 $12B** | **Frames 로는 Q1·연간(CY)만 가능.** 10-Q 현금흐름표가 YTD 누적이라 Q2·Q3 의 3개월 프레임이 생성되지 않음. Amazon 은 `PaymentsToAcquireProductiveAssets` 사용. → Q2~Q4 는 `https://data.sec.gov/api/xbrl/companyconcept/CIK##########/us-gaap/{Tag}.json` 에서 YTD 값을 받아 **직접 차분**(설계서의 `bigtech_capex_sum` 이 이미 이 방식) |
| `xbrl_buyback_sum` | `PaymentsForRepurchaseOfCommonStock` / `CY2026Q1` vs `Q2` | Q1 1,483개사 $324B vs Q2 134개사 $21B | 위와 동일 함정 |

구현 메모: ① CIK→티커→섹터는 레포의 `fundamentals.sector` + `https://www.sec.gov/files/company_tickers.json`. ② 분기 프레임은 분기말 +45일쯤 80% 가 참, 90일에 완결 → "n개사 반영" 표기와 **동일 표본(YoY 양쪽 다 있는 CIK) 비교**. ③ 결측·달러 아닌 통화(`uom`) 제외. ④ 회계연도 어긋난 회사(WMT·NVDA·HD)는 `end` 로 식별됨.

---

### B-실패·차단·미확인 목록

| 대상 | 결과 | 처리 |
| :-- | :-- | :-- |
| S&P DJI `sp-500-eps-est.xlsx` | **403** + 독점 라이선스 | X. XBRL 합산·Shiller 이익으로 대체 |
| OCC 거래량 통계 (theocc.com / marketdata.theocc.com) | 403 / 400 | Cboe 일일 JSON 의 거래량으로 대체 |
| FINRA `fixedIncomeMarket` 그룹(회사채 breadth·sentiment, TRACE 집계) | **401** (무료 API 자격증명 필요 — FINRA Gateway 계정) | P2. `otcMarket` 그룹만 무인증 |
| FINRA API 약관 본문 | 미열람 | 재배포 문구 확인 후 등록 |
| EDGAR 전문검색 `efts.sec.gov/LatestSearch/rest/search-index` | 403 | submissions API + 고정 CIK 목록으로 대체(7개 확인) |
| 카드 트러스트 10-D 의 EX-99 수치 파싱 | 미시험 | 트러스트별 파서 필요, 1개(COMET)부터 |
| Shiller Yale URL | 200 이지만 **2023-09 정지** | shillerdata.com 링크 추출 |
| FRED `WILL5000PR`, `WILL5000INDFC` | 삭제(HTML 오류) | `NCBEILQ027S` 로 버핏 지표 |
| Yahoo `^FTW5000` | 200 이지만 시세 시각 2026-03 정지 | 쓰지 않음 |
| FRED 데이터센터 건설 ID (`TLDTCONS` 등 추정 5개) | 전부 없음 | Census `privsatime.xlsx` 직접 |
| FRED `NOCDFNA066MSFRBPHI`, `NORDSAMFRBDAL`, `CARTSMOM` (추정 ID) | 없음 | 표의 확인된 ID 만 사용 |
| 애틀랜타연준 BIE 의 FRED ID | U (`ATLSBUSRGEP` 는 다른 조사) | 제외 |
| 미시간 `data.sca.isr.umich.edu/get-table.php` | "Not Found" | `sca.isr.umich.edu/files/tb*.csv` 사용 |
| 시카고연준 CARTS 원천 페이지 | 404/400 | FRED `CARTS` |
| KC연준 xlsx 고정 URL | 없음(날짜 파일명) | 페이지 링크 추출 |
| 뉴욕연준 `/api/pd/latest.json`, `/api/pd/latest/SBN2024/timeseries.json` | 400 | `/api/pd/get/{keyid}.json` |
| OFR `REPO-TYLD_AR_OO-P`(추정 니모닉) | 400 Invalid mnemonic | `metadata/mnemonics` 로 목록부터 |
| SIFMA xls, US Courts F-2 xlsx, Damodaran 나머지 파일(`vebitda`·`margin`·`betas`·`wacc`), GPR 월간 `data_gpr_export.xls`, FCI-G `_1yr`, MTS table 5, DTS 법인세 카테고리명, FDIC `institutions` 검색 | 직접 경로 **U** | 구현 시 1회 확인 |
| AQR Daily xlsx | 200 이지만 31.8MB | Monthly(2.3MB) 사용, 약관 확인 |
| Atlanta MPT LICENSE 시트 | 파서로 본문 못 읽음 | 엑셀에서 수동 확인 |
| Truflation | 무료 시계열 없음 | D |
| Dallas Fed Mobility, Opportunity Insights, TEDRATE, USNIM | 중단 | 넣지 않음 |
| 로컬 DNS (philadelphiafed·richmondfed·data.financialresearch.gov·pages.stern.nyu.edu) | 간헐 해석 실패 → `--resolve` 로 우회해 모두 200 확인 | Actions 에서 재확인 |

### B-바로 구현 가능한 상위 10개 (전부 F · 키 없음 · 파서 단순)

1. **`vix_term_structure` + `vvix_skew` + `cboe_putcall_daily`** — Cboe CDN CSV 5개 + 일일 JSON 1개. 기존 `build_sentiment_gauges.py` 옆에 붙이면 "변동성 체제" 카드 완성(09-16: VIX/VIX3M 0.90, 주식 풋콜 0.69, SKEW 146).
2. **`ofr_fsi`** — CSV 한 개에 일별 스트레스지수 + 5개 기여도. 스택 영역 차트가 그대로 나옴(09-14 −2.226).
3. **`regional_fed_composite_pmi`** — Philly CSV · Empire CSV · Dallas xlsx(+FRED 3종) · Richmond xlsx · KC xlsx. 설계서가 D 로 뺀 `ism_pmi_mfg` 의 무료 대체. 가격지불 평균은 별도 "인플레 선행" 시리즈.
4. **`dts_tga_daily` + `dts_tax_receipts`** — 레포가 이미 쓰는 FiscalData. 순유동성을 일별화하고 원천징수세 YoY 추가(필드 함정: 마감잔고가 `open_today_bal`).
5. **`finra_short_interest`** — 무인증 POST 한 번에 결제일 전 종목 잔고·DTC. 기존 일일 공매도량과 합쳐 숏스퀴즈 스캐너.
6. **`atl_market_prob_tracker`** — FedWatch 의 공식 무료 대체. 다음 3개 FOMC 의 평균금리·인하확률만 뽑아 저장(라이선스 시트 수동 확인 후).
7. **`census_datacenter_construction`** — xlsx 한 컬럼. AI 인프라 섹터(⑧) 헤드라인 지표(Jul-26p $75.2B SAAR, 일반 오피스의 1.7배).
8. **`fdic_bank_financials`** — 티커↔CERT 매핑 20여 개만 만들면 은행 종목 분석에 NIM·부실·상각 패널.
9. **FRED 묶음 추가**(빌더 수정 없이 ID 만): `NFCIRISK/CREDIT/LEVERAGE`, `STLFSI4`, `TOTLL`, `DPSACBW027SBOG`, `WLCFLPCL`, `SOFR99`, `BAMLH0A3HYC`, `THREEFYTP10`, `EXPINF10YR`, `CORESTICKM159SFRBATL`, `FRBATLWGT3MMAUMHWGO`, `USEPUINDXD`, `CARTS`, `BUSAPPWNSAUS`, `GASREGW`, `RECPROUSM156N`, `T10Y3M`, `NCBEILQ027S`(버핏 지표).
10. **§10 breadth 4종**(`pct_above_ma`, `new_high_low`, `breadth_ad_line`, `mcclellan`) — 외부 의존 0, 기존 `chartSeries` 만으로 계산. + `shiller_cape`·`damodaran_implied_erp`·`gz_ebp`·`fed_fci_g` 를 "밸류·신용 체제" 월간 카드로 묶으면 월 1회 크론이면 충분.

### B-주의점 요약
- FRED 는 **UA 에 따라 연결 리셋**(브라우저 UA 금지, 레포 UA 사용). ICE BofA·Cboe·미시간·Moody's 시리즈는 제3자 저작 → 소량 스냅샷 + 출처.
- 학술 데이터(EPU·GPR·French·Shiller·Damodaran·GZ EBP·ACM)는 **인용 문구를 신뢰도 센터 출처 칸에 고정**.
- 큰 파일(ACM 10MB·GSW 16.6MB·MPT 6.9MB·AQR Daily 31.8MB)은 Actions 에서 받아 **꼬리만** 커밋.
- 확장자 거짓말: GSCPI `.xlsx` = 실제 xls(xlrd), Dallas `.xls` = 실제 xlsx(openpyxl) → **매직바이트(`PK`)로 분기**.
- XBRL Frames 의 현금흐름 항목은 Q1·연간만 — CAPEX·바이백 분기 합산은 companyconcept 차분으로.
- 검증 값에 나온 수치(예: Philly 47.4, 휘발유 $4.32, OVX 61.7)는 응답 그대로 옮긴 것이며 해석·교차검증은 하지 않았음.


---

## C. 글로벌 매크로·아시아 공급망·원자재·기상


- 조사일: 2026-09-17 (KST). 모든 **F** 표기는 이 세션에서 `curl` 로 실제 응답을 받아 최신 날짜·값을 본 것이다.
- 중복 제외: `INDUSTRY_INDICATORS_DESIGN.md` 에 이미 있는 TSMC·MediaTek·Hon Hai(TWSE), OECD CLI, IMF PortWatch, GIE AGSI+, FRED 경유 IMF 구리·철광석·니켈, NASS 작황, WASDE PDF, BoJ API(M2 언급), ECB M2, Harpex, Cameco 우라늄, Drewry WCI 는 다시 적지 않았다. 다만 **같은 엔드포인트에서 새 지표가 나오는 경우**(TWSE 의 AI 서버 ODM, BoJ API 의 반도체 물가지수)는 새 행으로 적었다.
- 등급: A=공식 무료 API(JSON/CSV/SDMX) · B=공식 HTML·xls 파서 필요 · C=프록시·제3자 · D=유료 · X=재배포 금지.
- 검증: **F**=직접 응답 확인 · **S**=공식 문서·검색 스니펫만 · **U**=미확인.
- 연관 종목은 `data/details/<TICKER>.json`, `data/korea/details/<코드>.json` 존재를 확인한 것만 적었다(없어서 뺀 것: X, ARCH, CEIX, PCH, PPLT, KRBN, VNM, WEAT, CORN, SOYB, PLL, UMC, EWS, CTRA, ET, CQP, UAN, UUP, FXE, FXY, EMB).
- 레포 파일은 수정하지 않았다.

---

### C-1. 대만 공급망 (최우선 — 기존 `t187ap05_L` 수집기에 코드 목록만 늘리면 된다)

TWSE·TPEx 두 엔드포인트의 **필드명은 완전히 같다**(중문 키, 14개):
`出表日期, 資料年月, 公司代號, 公司名稱, 產業別, 營業收入-當月營收, 營業收入-上月營收, 營業收入-去年當月營收, 營業收入-上月比較增減(%), 營業收入-去年同月增減(%), 累計營業收入-當月累計營收, 累計營業收入-去年累計營收, 累計營業收入-前期比較增減(%), 備註`
금액 단위 천 TWD, `資料年月` 은 민국연(`11508`=2026-08). 응답은 UTF-8 BOM 이 붙을 수 있어 `utf-8-sig` 로 읽는다. 둘 다 **최신월 스냅샷만** 주므로 기존 적립 규약(`data/industry_archive/`)을 그대로 쓴다.

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `tw_ai_server_odm_rev` | AI 서버 ODM 월매출 합산 (Quanta 2382·Wistron 3231·Wiwynn 6669·Inventec 2356·Gigabyte 2376) | 천 TWD, 월(매월 10일 전후), 히스토리 없음→적립 | 엔비디아 랙 출하의 가장 빠른 공식 실측. 분기 실적보다 1~2개월 선행 | `NVDA`, `AMD`, `AVGO`, `SMCI`, `DELL`, `HPE`, `VRT`; SK하이닉스(000660), 삼성전자(005930) | `GET https://openapi.twse.com.tw/v1/opendata/t187ap05_L` → `公司代號` 필터 | 없음 | 대만 정부자료 개방 라이선스 1.0 (출처 표기 시 재이용 가능, **S**) | A | **F** 1,086행. 11508: 2382 廣達 423,970,932(YoY +177.5%), 3231 緯創 460,065,063(+166.5%), 6669 緯穎 144,311,808(+50.4%), 2356 英業達 83,267,681(+35.8%), 2376 技嘉 47,400,848(+98.4%) |
| `tw_dc_network_power_rev` | 데이터센터 네트워크·전력·냉각 (Accton 2345·Delta 2308·AVC 奇鋐 3017) | 동일 | 스위치(화이트박스)·전원·액침/수랭 수요 | `ANET`, `AVGO`, `MRVL`, `CRDO`, `VRT`, `ETN`; LS ELECTRIC(010120), HD현대일렉트릭(267260) | 동일, 코드 2345·2308·3017 | 없음 | 동일 | A | **F** 2345 智邦 40,872,511(+59.4%), 2308 台達電 64,586,049(+34.9%), 3017 奇鋐 19,481,068(+54.3%) |
| `tw_osat_substrate_ccl_rev` | 후공정·기판·CCL (ASE 3711·Unimicron 3037·EMC 台光電 2383·Alchip 3661·GUC 3443) | 동일 | CoWoS 외주·ABF 기판·고다층 CCL·ASIC 설계 사이클 | `ASX`, `AMKR`, `AVGO`, `MRVL`; 이수페타시스(007660), 삼성전기(009150), 대덕전자(353200), 해성디에스(195870) | 동일 | 없음 | 동일 | A | **F** 3711 日月光投控 82,247,374(+45.7%), 3037 欣興 17,745,519(+56.3%), 2383 台光電 20,145,589(+129.8%), 3661 世芯-KY 8,776,286(+273.6%), 3443 創意 5,840,094(+111.0%) |
| `tw_memory_rev` | 대만 메모리 (Nanya 2408·Winbond 2344) + TPEx Phison 8299·ADATA 3260 | 동일 | DRAM·NAND 현물가를 못 쓰는 상황에서 **가격×물량의 공식 월간 프록시** | `MU`, `SNDK`, `WDC`, `STX`; 삼성전자(005930), SK하이닉스(000660) | TWSE(2408·2344) + TPEx(8299·3260) | 없음 | 동일 | A | **F** 2408 南亞科 44,690,268(YoY **+560.9%**), 2344 華邦電 27,308,717(+289.4%), 8299 群聯 28,275,661(+376.5%), 3260 威剛 18,925,261(+279.8%) |
| `tw_handset_optics_rev` | 스마트폰 광학·조립 (Largan 3008·Pegatron 4938) | 동일 | 아이폰 빌드 사이클 | `AAPL`, `QCOM`, `SWKS`, `QRVO`; LG이노텍(011070) | TWSE 3008·4938 | 없음 | 동일 | A | **F** 3008 大立光 5,011,942(−16.2%), 4938 和碩 88,304,931(+34.1%) |
| `tw_container_liner_rev` | 대만 컨테이너 3사 월매출 (Evergreen 2603·Yang Ming 2609·Wan Hai 2615) | 동일 | 운임×물동량의 **실제 매출** — SCFI 헤드라인의 재배포 가능한 대체 | `ZIM`, `MATX`, `DAC`, `GSL`, `CMRE`; HMM(011200) | TWSE 2603·2609·2615 | 없음 | 동일 | A | **F** 2603 長榮 48,985,697(+48.6%), 2609 陽明 21,611,483(+56.2%), 2615 萬海 19,200,015(+65.6%) |
| `tpex_monthly_rev` | **TPEx(장외) 월매출** — Aspeed 5274(BMC), GlobalWafers 6488, Vanguard 5347, WIN Semi 3105, eMemory 3529, Auras 3324, MPI 6223 | 천 TWD, 월, 적립 | Aspeed BMC 는 서버 **출하 1~2분기 선행**(보드 1장=BMC 1개). 6488=웨이퍼 사이클 | `NVDA`, `SMCI`, `DELL`, `HPE`, `AMD`, `INTC`, `FORM`; ISC(095340), 한미반도체(042700) | `GET https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O` (스웨거: `https://www.tpex.org.tw/openapi/swagger.json`). 업종 합계는 `mopsfin_t187ap05_OA`, 신고가 매출 목록 `mopsfin_t187ap05_OB`, 흥궤(興櫃) `t187ap05_R` | 없음 | 동일 | A | **F** 892행·필드 동일. 5274 信驊 1,625,937(+118.4%), 6488 環球晶 4,764,363(+7.6%), 5347 世界 5,092,599(+40.5%), 3105 穩懋 1,937,397(+30.6%), 3324 雙鴻 3,141,249(+67.2%), 6223 旺矽 2,048,171(+69.9%). **주의: 5274·6488 은 TWSE 피드에 없다(None 확인)** |
| `taiwan_export_orders_detail` | 대만 수출주문 품목별(전자·정보통신) | USD, 월(20~23일) | 기존 `taiwan_export_orders` 의 기계 접근 경로 | — | `moea.gov.tw/Mns/dos/...` | — | — | B | **차단** curl·WebFetch 모두 403. data.gov.tw 는 JS 렌더링, 검색 API 미확인 → 실패 목록 참조 |

---

### C-2. 집계 허브·국제기구

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `imf_pcps_battery_metals` | IMF PCPS **리튬(PLITH)·코발트(PCOBA)·희토류(PREODOM)·실리콘(PSILLUMP)·망간·바나듐·몰리브덴·에너지전환금속지수(PENTM)** | USD, 월, 1990년대~ (리튬 등은 2010년대~) | 문서가 "D 등급이라 P0 제외"로 둔 탄산리튬·코발트의 **공식 무료 월간 대체** | `ALB`, `SQM`, `LAC`, `SGML`, `MP`, `TSLA`; LG에너지솔루션(373220), 삼성SDI(006400), 포스코퓨처엠(003670), 에코프로비엠(247540) | `GET https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.PLITH+PCOBA+PREODOM+PSILLUMP.USD.M?startPeriod=2020-01` 헤더 `Accept: application/vnd.sdmx.data+csv;version=1.0.0` (키 순서 `COUNTRY.INDICATOR.DATA_TRANSFORMATION.FREQUENCY`, 세계=`G001`) | 없음 | 응답 메타 `LICENSE`="© IMF. All Rights Reserved. imf.org/external/terms.htm" — 출처 표기 비상업 이용은 허용, **원표 통째 재호스팅은 피하고 지표값+출처만** | A | **F** 2026-M08: PCOBA 55,853.75 / PLITH 148,620 / PREODOM 8,757.24 / PSILLUMP 1,884.29. **PLITH 는 값 크기로 보아 CNY/톤일 가능성 — 단위 메타 재확인 필요**. 갱신 2026-09-08 |
| `imf_pcps_uranium_fert_lng` | IMF PCPS **우라늄(PURAN)·요소(PUREA)·DAP(PDAP)·칼륨(PPOTASH)·일본 LNG(PNGASJP)·유럽 가스(PNGASEU)·호주 석탄(PCOALAU)·고무(PRUBB)·침엽수 제재목(PSAWORE)** | USD, 월 | 우라늄 월평균의 공식 무료 경로(Cameco 적립의 백필·교차검증) | `CCJ`, `UEC`, `UUUU`, `LEU`, `CF`, `MOS`, `NTR`, `LNG`, `BTU`, `AMR`; 두산에너빌리티(034020), 한전기술(052690), 한국가스공사(036460), 남해화학(025860) | 위와 같은 URL, `G001.PURAN+PUREA+PDAP+PPOTASH+PNGASJP+PNGASEU+PCOALAU+PRUBB+PSAWORE.USD.M`. FRED 미러(`PURANUSDM`, `PNGASJPUSDM`, `PCOALAUUSDM`, `PRUBBUSDM` — `fred.stlouisfed.org/graph/fredgraph.csv?id=` 키 없이)도 있으나 **한 달 늦다** | 없음 | 동일 | A | **F** IMF 직접 2026-M08: PURAN 71.09, PDAP 871.93, PPOTASH 398.20, PNGASJP 22.04, PNGASEU 20.92, PCOALAU 140.51. FRED 미러는 2026-07 까지(PURANUSDM 69.23). `PLITHUSDM` 은 FRED 에 **없음** |
| `wb_pink_sheet` | World Bank **Pink Sheet** 월간 71개 품목 (요소·DAP·TSP·인광석·염화칼륨, 일본 LNG, 호주·남아공 석탄, 고무 TSR20/RSS3, 원목·제재목·합판, 팜유, 곡물, 금속) | USD, 월, **1960-01~** | 비료·목재·고무·LNG 를 한 파일로. 히스토리 66년이라 백필 불필요 | `CF`, `MOS`, `NTR`, `ICL`, `IPI`, `SMG`, `FMC`, `CTVA`, `WY`, `WFG`, `LPX`, `GT`, `ADM`, `BG`, `DAR`; 남해화학(025860), 금호석유화학(011780), CJ제일제당(097950), 대상(001680) | 파일: `https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx` (시트 `Monthly Prices`, 헤더 5행·단위 6행, 날짜 `2026M08`). **해시 경로가 해마다 바뀐다**(2025 파일은 `18675f1d…-0050012025`, 2025M12 에서 멈춤) → 매번 `https://www.worldbank.org/en/research/commodity-markets` 에서 `CMO-Historical-Data-Monthly.xlsx` 링크를 긁는다. UA 헤더 필요 | 없음 | CC BY 4.0 | B | **F** 최신행 2026M08: Urea 390, DAP 793.5, KCl 386.9, LNG Japan 13.94, Coal AUS 135.2, Rubber TSR20 2.24, Iron ore 96.3, Copper 14,326, Palm oil 1,117, NatGas Europe 21.11. (IMF PUREA 232 와 기준 품목이 달라 값이 다르다 — **비료는 Pink Sheet 우선**) |
| `wb_gem_em_trade_ip` | World Bank **Global Economic Monitor** — 중국·베트남·인도 등 월간 수출입(USD)·산업생산·소매판매·REER | USD 백만/지수, 월, 1990년대~ | NBS 직접 접근이 막힌 중국·베트남의 **무키 월간 경로** | `FXI`, `MCHI`, `KWEB`, `INDA`, `NKE`, `AAPL`; 포스코인터내셔널(047050), LX인터내셔널(001120) | `GET https://api.worldbank.org/v2/country/CHN;VNM;IND/indicator/DXGSRMRCHNSCD?source=15&format=json&frequency=M&mrv=24` (수출). 산업생산 `IPTOTSAKD`, 수입 `DMGSRMRCHNSCD`, 소매 `RETSALESSA`, REER `REER`. 지표 36개 목록 `…/v2/sources/15/indicators?format=json` | 없음 | CC BY 4.0 | A | **F** lastupdated 2026-09-08. 수출 2026M07: CHN 397,852 / VNM 53,095.5 / IND 4,239.45(**인도 값은 단위 이상 — 사용 전 확인**). CHN 산업생산 2026M07 확인 |
| `bis_credit_gap` | BIS 신용갭(Credit-to-GDP gap) | %p, 분기, 1960s~ | 은행위기 조기경보 1순위 지표. 한·중·미 비교 | `JPM`, `GS`, `MS`, `C`, `KB`, `SHG`, `FXI`, `EWY` | `GET https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CREDIT_GAP/1.0/Q.US+KR+CN.P.A.C?lastNObservations=8` + `Accept: application/vnd.sdmx.data+csv;version=1.0.0` | 없음 | BIS 약관: 출처 표기 시 재이용 가능(**S**) | A | **F** 2026-Q1: CN −5.14, US −11.32, KR −15.13 |
| `bis_dsr` | BIS 민간 비금융 DSR(원리금상환비율) | %, 분기 | 가계·기업 이자 부담의 국제 비교. 한국이 상단 | `KB`, `SHG`, `EWY` | `…/BIS/WS_DSR/1.0/Q.KR+US.P?lastNObservations=8` | 없음 | 동일 | A | **F** 2026-Q1: US 13.8, KR 19.3 |
| `bis_property_prices` | BIS 실질 주택가격지수 | 2010=100, 분기 | 중국 부동산 하강·한국 주택 사이클 | `FXI`, `MCHI`, `BABA`, `LEN`, `DHI` | `…/BIS/WS_SPP/1.0/Q.KR+US+CN.R.628?lastNObservations=8` | 없음 | 동일 | A | **F** 2026-Q1: CN 85.13, US 156.43, KR 105.65 |
| `bis_policy_rates` | BIS 중앙은행 정책금리(일별, 40여 개국 통일 포맷) | %, 일 | 글로벌 금리 사이클 한 장. 국가별 개별 API 불필요 | `TLT`, `IEF`, `EEM`, `EWJ`, `EZU` | `…/BIS/WS_CBPOL/1.0/D.US+KR+JP+XM+GB+CN?lastNObservations=1` | 없음 | 동일 | A | **F** 2026-09-08: US 3.625, XM 2.25, JP 1.00 / KR 3.00(2026-08-28) |
| `bis_reer` | BIS 실질실효환율(Broad 64개국) | 2020=100, 월 | 원화·엔화 고/저평가 → 수출주 가격경쟁력 | `EWY`, `EWJ`, `TM`, `HMC`, `SONY`; 현대차(005380), 기아(000270) | `…/BIS/WS_EER/1.0/M.R.B.KR+US+JP+CN?lastNObservations=24` | 없음 | 동일 | A | **F** 2026-07: US 108.25, KR 85.5, JP 65.04, CN 92.72 |
| `imf_cofer_usd_share` | IMF COFER 외환보유액 통화구성(달러 비중) | %, 분기(3개월 지연) | 탈달러 서사의 **유일한 공식 수치** | `GLD`, `GDX`, `NEM`, `GOLD` | `GET https://api.imf.org/external/sdmx/2.1/data/IMF.STA,COFER/all?startPeriod=2015` → `FXR_CURRENCY=CI_USD`, `TYPE_OF_TRANSFORMATION=SHRO_PT` | 없음 | IMF 약관(위와 동일) | A | **F** 2026-Q1: USD 57.13%, EUR 20.03%, JPY 5.44%, GBP 4.40%, CNY 1.99% |
| `imf_cb_gold_holdings` | 중앙은행 금 보유량(국가별) | 백만 트로이온스(FTO), 월 | WGC(문서에 있음)의 원자료. 중국·폴란드·튀르키예 매입 추적 | `GLD`, `NEM`, `GOLD`, `AEM`, `GDX`, `WPM`, `FNV`, `RGLD` | `GET https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IL/CHN+POL+TUR+IND+KOR?startPeriod=2020-01` → `INDICATOR=RGV_REVS`, `UNIT=FTO`, `FREQUENCY=M` | 없음 | 동일 | A | **F** CHN 75.44M oz(2026-M06), POL 20.83M(M08), TUR 25.44M(M08), IND 28.31M(M07), KOR 3.358M(M07) |
| `imf_weo_growth` | IMF WEO 성장률 전망 | %, 연 2회(4·10월)+수정 | 컨센서스 기준선 | `EEM`, `VWO`, `EWY`, `FXI` | `GET https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO/USA+KOR+CHN.NGDP_RPCH.A?startPeriod=2025` | 없음 | 동일 | A | **F** 2026: USA 2.32, KOR 1.86, CHN 4.41 / 2027: 2.10, 2.12, 4.03 |
| `dbnomics_fallback` | DBnomics(93개 제공자 단일 API) | — | **폴백 전용**. 1차 소스로 쓰면 안 된다 | — | `GET https://api.db.nomics.world/v22/series/{provider}/{dataset}/{series}?observations=1`, 제공자 목록 `…/v22/providers` | 없음 | DBnomics 자체는 재배포자 — 원 제공자 라이선스를 따른다(ISM 등은 원천이 재배포 제한) | C | **F** 제공자 93개(ACOSS…WTO, BIS·BOJ·ECB·Eurostat·IMF·NBS·METI·ISM·FAO·EIA 포함). **갱신 편차 큼**: IMF/PCPS 인덱싱 2025-07-16 에서 멈춤(값 2025-06), NBS 2026-03(값 2026-02), METI 2022-04, BOJ 2024-06, UNCTAD 2023-07, STATJP·WTO 2026-07-26. 응답도 느려 12개 연속 호출이 120초 타임아웃 |
| `un_comtrade_preview` | UN Comtrade **무키 preview** (HS 품목×국가 월간) | USD, 월, 2~3개월 지연 | 일본 반도체 제조장비(HS 8486) 국가별 수출 = 한국·대만·중국 팹 증설 추적 | `AMAT`, `LRCX`, `KLAC`, `ASML`, `TER`, `ONTO`, `ACLS`; 원익IPS(240810), 주성엔지니어링(036930), 이오테크닉스(039030) | `GET https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=392&period=202607&cmdCode=8486&flowCode=X&partnerCode=0,156,410,490,842` (392=일본, 490=대만("Other Asia nes"), 410=한국). 호출당 500행 | 없음(무료 키 등록 시 500콜/일) | 집계값 인용은 출처 표기로 가능, 원자료 대량 재배포는 약관상 제한(**S**) | A | **F** 일본 8486 총수출 2026-07 = $3,037.6M, 대 한국 2026-06 = $536.7M. **중국(156)은 최근월 0건** — 중국 리포터는 preview 에 최근치 없음 |

---

### C-3. 유럽

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `de_truck_toll_index` | 독일 **트럭 통행료 주행지수** (Destatis/BALM) | 2015=100, **일별**(5~9일 지연), 2008-01~ | 독일 산업생산을 3~4주 앞서는 일별 경기 프록시 | `EWG`, `EZU`, `SAP`, `DB`, `STLA` | `https://www.destatis.de/DE/Themen/Branchen-Unternehmen/Industrie-Verarbeitendes-Gewerbe/Publikationen/Downloads-Konjunktur/statistischer-bericht-lkw-maut-fahrleistungsindex-5421901.xlsx?__blob=publicationFile` (시트 `csv-42191-b01` 이 long 포맷, 시트 `42191-b01` 이 wide: Datum·unbereinigt·KSB·7일 이동평균). UA 헤더 필요 | 없음 | Datenlizenz Deutschland – Namensnennung 2.0 (출처 표기 시 재배포 가능) | B | **F** 947KB, 최신 2026-09-05. 2026-09-04: 원계열 106.8 / 계절·달력조정 94.4 |
| `ecb_ciss` | ECB 시스템 스트레스 종합지수(CISS) | 0~1, **일별**, 1980~ | 유럽판 NFCI. 은행·국채 스트레스 | `DB`, `UBS`, `ING`, `SAN`, `HSBC`, `EZU`, `FEZ` | `GET https://data-api.ecb.europa.eu/service/data/CISS/D.U2.Z0Z.4F.EC.SS_CIN.IDX?lastNObservations=500&format=csvdata` | 없음 | ECB: 출처 표기 시 자유 재이용 | A | **F** 2026-09-15 = 0.0339 |
| `ecb_eurusd_ref` | ECB 기준환율(EUR/USD 외 30여 통화) | 일 | 야후 대체 공식 환율 | `EZU`, `VGK` | `…/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=csvdata` | 없음 | 동일 | A | **F** 2026-09-16 = 1.1537 |
| `eu_industrial_production` | 유로존·독일 산업생산 | 2021=100, 월(45일 지연) | 유럽 제조 사이클 | `EWG`, `EZU`, `ASML`, `STM`, `MT` | `GET https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/sts_inpr_m/M.PRD.B-D.SCA.I21.EA20+DE?lastNObservations=24&format=SDMX-CSV` | 없음 | Eurostat: 출처 표기 시 상업적 재이용 포함 허용(CC BY 4.0 상당, **S**) | A | **F** 2026-07: DE 90.5, EA20 98.4 (갱신 2026-09-16) |
| `eu_esi_sentiment` | EU 집행위 경기체감지수(ESI)·산업신뢰 | 지수/밸런스, 월말 | Ifo·PMI(재배포 제한)의 **무료 대체 헤드라인** | `EZU`, `FEZ`, `VGK`, `EWG` | `…/data/ei_bssi_m_r2/M.BS-ESI-I+BS-ICI-BAL.SA.EU27_2020+EA21+DE?lastNObservations=24&format=SDMX-CSV` | 없음 | 동일 | A | **F** 2026-08: ESI DE 94.1 / EA21 98.4 / EU27 98.2, 산업신뢰 DE −11.0 / EA21 −5.3. **함정: 2026-01 불가리아 가입으로 `EA20` 은 2025-12 에서 끊긴다 → `EA21` 또는 `EU27_2020` 사용** |
| `zew_expectations` | ZEW 독일 경기기대·현황 | 밸런스, 월(둘째·셋째 화요일), 1991-12~ | 독일 애널리스트 심리. 전 히스토리 xls 공개 | `EWG`, `EZU`, `DB`, `SAP` | `https://ftp.zew.de/pub/zew-docs/div/konjunktur.xls` (시트 `data`: Date(엑셀 일련번호)·Indicator·Situation, 마지막 행 `Mean:` 제외). `.xls` → `xlrd` | 없음 | 출처 표기(명문 라이선스 없음) → 헤드라인 2계열만 | B | **F** 420행. 2026-09-15(일련 46280): 기대 34.7 / 현황 −47.1 |
| `eua_auction_price` | **EU ETS 탄소배출권(EUA) 경매 낙찰가** (EEX 1차 시장) | EUR/tCO2, 거의 매영업일, 연도별 파일 | 유럽 유틸·철강·시멘트 원가. ICE 선물은 유료 → 이게 공식 무료 일별 | `MT`, `TTE`, `SHEL`, `BP`, `CEG`, `LIN`, `APD`; POSCO홀딩스(005490), 현대제철(004020) | `https://public.eex-group.com/eex/eua-auction-report/emission-spot-primary-market-auction-report-2026-data.xlsx` (연도만 바꿈; 시트 `Primary Market Auction`, 헤더 5행: Date·Time·Auction Name·Contract·Status·Auction Price €/tCO2·Min/Max Bid·…). 링크 목록 페이지 `eex.com/en/market-data/market-data-hub/environmentals/eex-eua-primary-auction-spot-download` | 없음 | 파일에 "Public" 표기. 재배포 조항은 EEX 약관 확인 필요 → 일별 낙찰가 1계열+출처 | B | **F** 2026-09-16 = 83.69, 09-15 = 85.52, 09-14 = 86.44 (162행). 야후 `ECF=F` 는 2025-12-15 에서 **죽어 있음**, `CO2.L`(80.53 EUR, 09-16)은 살아 있음(C) |
| `de_power_price_dayahead` | 독일·유럽 전력 도매가(Day-ahead) | EUR/MWh, 시간별 | ENTSO-E 토큰 없이 받는 공식 재가공(SMARD 원천). 유럽 에너지 위기 게이지 | `TTE`, `SHEL`, `CEG`, `VST`; 한국전력(015760) | `GET https://api.energy-charts.info/price?bzn=DE-LU&start=2026-09-15&end=2026-09-16` (`bzn` = FR, NL, IT-North 등) | 없음 | 응답 `license_info`: **CC BY 4.0**, Bundesnetzagentur SMARD.de | A | **F** 192포인트(15분), 마지막 168.21 EUR/MWh |
| `entsoe_transparency` | ENTSO-E 발전·부하·국경간 흐름 | MW, 시간 | 위의 상위 호환 | — | `https://web-api.tp.entsoe.eu/api?securityToken=…&documentType=A44…` | **무료 토큰(이메일 신청, 수일)** | 출처 표기 재이용 | A | **S** 미호출. energy-charts 로 충분 |
| `uk_ons_timeseries` | 영국 ONS 월간 GDP 등 | 지수, 월 | 우선순위 낮음 | `EWU`, `HSBC`, `BP`, `SHEL` | `GET https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ecy2/mgdp/data` (JSON, `months[]`) · 데이터셋 API `https://api.beta.ons.gov.uk/v1/datasets` | 없음 | Open Government Licence v3.0 | A | **F** 두 엔드포인트 모두 200·JSON(최신월 값은 미확인) |
| — | ECB 신차등록(`STS/M.I9.Y.CREG.PC0000.3.ABS`) | — | — | — | — | — | — | — | **F·부적합** 2025-05 에서 멈춤(독일 계열은 2022-12). 쓰지 말 것 |

---

### C-4. 일본

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `boj_memory_ic_price_index` | BoJ 기업물가지수 — **MOS 메모리 IC 수출·수입 물가**(계약통화 기준) | 2020=100, 월(익월 10일경), 2010-01~ | **DRAM·NAND 계약가의 공식 무료 프록시.** 문서가 D 로 포기한 `dram_spot` 자리에 들어갈 수 있다 | `MU`, `SNDK`, `WDC`, `STX`; 삼성전자(005930), SK하이닉스(000660) | `GET https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=PR01&startDate=201001&endDate=202612&code=PRCG20_2300550006,PRCG20_2500850005` (`…2300550006`=수출·계약통화, `…2400550006`=수출·엔화, `…2500850005`=수입·계약통화, `…2600850005`=수입·엔화). **응답이 gzip — `curl --compressed` 필수**(없으면 400처럼 보임). 메타 `…/getMetadata?format=json&lang=en&db=PR01`(14MB, 32,086계열) | 없음 | BoJ: 출처 표기 시 이용 가능("API 이용 시 유의점" PDF, **S**) | A | **F** 수출·계약통화 MOS 메모리: 2026-05 247.6 → 06 279.5 → 07 286.6 → **08 293.4** (LAST_UPDATE 2026-09-11) |
| `boj_semi_equipment_price_index` | BoJ 반도체 제조장비 수출 물가 / 집적회로 PPI | 2020=100, 월, 2000-01~ | 장비 ASP 추세 | `AMAT`, `LRCX`, `KLAC`, `TER`; 원익IPS(240810) | 같은 API, `code=PRCG20_2300450024`(장비 수출·계약통화), `PRCG20_2201550005`(IC 국내 PPI), `PRCG20_2300550005`(MOS 로직 수출) | 없음 | 동일 | A | **F** 장비 수출: 2026-05 115.1, 06 113.9, 07 114.0, 08 114.4 |
| `jp_semi_equipment_exports` | 일본 반도체 제조장비(HS 8486) 국가별 수출 | JPY/USD, 월 | 위 §2 `un_comtrade_preview` 로 **무키 검증 완료**. 원천은 재무성 무역통계 | 위와 동일 | 원천: `customs.go.jp/toukei/info/tsdl_e.htm` → e-Stat 파일 목록(`toukei=00350300`) → `file-download?statInfId=…`. 또는 e-Stat API `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=…&statsDataId=…` | e-Stat **appId(무료 가입)** | 정부표준이용약관 2.0(CC BY 호환) | B | **S** customs 다운로드 페이지 200·e-Stat 목록 200 까지만 확인, statInfId 는 월마다 달라 미확정 → P0 는 Comtrade preview |
| `meti_iip` | METI 광공업생산(전자부품·디바이스) | 2020=100, 월 | 일본 전자부품 재고순환 | `SONY`, `TM` | `https://www.meti.go.jp/statistics/tyo/iip/` xlsx | 없음 | 동일 | B | **U** `b2020_result-2.html` 연결 실패(000), index 만 200. DBnomics METI 는 2022-04 에서 멈춤 |

---

### C-5. 중국

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `cn_exports_oecd_fred` | 중국 수출액(OECD 경유) | USD, 월(2~3개월 지연) | 폴백 | `FXI`, `MCHI` | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=XTEXVA01CNM667S` (키 없이 CSV) | 없음 | OECD 출처 표기 | A | **F** 2026-06 = 395,186,400,000. WB GEM(§2)이 한 달 빠르다(2026M07) |
| `cn_oecd_cli` | 중국 OECD CLI | 지수, 월 | 기존 `oecd_cli` URL 에 `CHN` 만 추가하면 된다 | `FXI`, `KWEB`, `BABA`, `PDD`, `YUMC`, `LVS` | FRED 미러 `CHNLOLITOAASTSAM` (또는 기존 OECD SDMX URL 의 `USA+KOR` → `USA+KOR+CHN+JPN+DEU`) | 없음 | 동일 | A | **F** 2026-08 = 98.10 |
| `ccfi_composite` | 중국 수출 컨테이너 운임지수 **CCFI** 종합+13개 항로 (+ SCFI 종합) | 1998-01-01=1000, 주(금) | 계약운임 포함이라 SCFI 보다 선사 실적과 더 가깝다 | `ZIM`, `MATX`, `DAC`, `GSL`, `CMRE`; HMM(011200), 팬오션(028670) | `GET https://en.sse.net.cn/currentIndex?indexName=ccfi` (JSON: `data.currentDate`, `lineDataList[].dataItemTypeName/currentContent/lastContent`). `indexName=scfi` 도 같은 형식(종합만 값, 항로별은 null) | 없음(UA 필요) | 상하이항운교역소 저작권 — **재배포 허락 조항 없음**. 기존 SCFI 와 같은 취급: 주 1회 헤드라인 1점 적립+출처, 항로 표 통째 게시는 금지 | B (약관상 X 에 가까움) | **F** 2026-09-11: CCFI 1,862.18(전주 1,837.01), 미서안 1,642.39, 유럽 2,139.54, 한국 659.46 / SCFI 종합 3,662.18(전주 3,590.05). 비공식 엔드포인트라 변경 가능 |
| — | 국가통계국 `data.stats.gov.cn/easyquery.htm` | — | — | — | — | — | — | — | **F·차단** HTTP 403 (WAF `UrlACL`). DBnomics NBS 미러도 2026-02 에서 멈춤(제조업 PMI 49.0, IC 생산 누계 815.2) → 공식 PMI·사회융자총량은 **무료 기계 경로 없음** |

---

### C-6. 에너지·금속

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `jodi_oil_world` | JODI 석유 DB — 국가별 원유 생산·수출·재고·정제 투입 | kb/d·천 배럴, 월(2개월 지연), 2002~ | 사우디·러시아 등 **OPEC+ 실제 생산·수출**의 공식 자기신고치 | `XOM`, `CVX`, `COP`, `OXY`, `SLB`, `HAL`, `FRO`, `DHT`, `STNG`; S-Oil(010950), SK이노베이션(096770) | 연도별 CSV: `https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/primaryyear2026.csv` (과거 연도는 `…/primary/2025.csv`; 2차 제품은 `secondary/`). 전체 zip `…/oil-data/world_ext.zip`. 컬럼 `REF_AREA,TIME_PERIOD,ENERGY_PRODUCT,FLOW_BREAKDOWN,UNIT_MEASURE,OBS_VALUE,ASSESSMENT_CODE` | 없음 | JODI 약관: 출처 표기 시 이용 가능(**S**) | A | **F** 4.7MB·115,200행·최신 2026-06. 사우디 원유 생산(INDPROD, KBD) 7,122 / 수출(TOTEXPSB) 3,993 |
| `yahoo_commodity_futures_ext` | 야후 선물 티커 확장 — **목재 `LBR=F`, 열연 `HRC=F`, 알루미늄 `ALI=F`, 백금 `PL=F`, 팔라듐 `PA=F`, 우라늄 `UX=F`, TTF `TTF=F`** | 일 | 문서의 C 등급 표에 없는 티커들의 생존 확인 | `WY`, `WFG`, `LPX`, `BLDR`, `NUE`, `STLD`, `CLF`, `AA`, `CENX`, `SBSW`, `CCJ`; POSCO홀딩스(005490), 현대제철(004020), 동국홀딩스(001230) | `https://query1.finance.yahoo.com/v8/finance/chart/{티커}?range=5d&interval=1d` | 없음 | 비공식(C) | C | **F** 2026-09-16/17: LBR=F 550.0, HRC=F 1,280, ALI=F 3,426.5, PL=F 1,790.1, PA=F 1,306.5, TTF=F 77.58 EUR, UX=F 89.75(09-08, 거래 드묾). **죽은 티커**: `TIO=F`(철광석, 2021-08), `MTF=F`(석탄 API2, 2025-02), `ECF=F`(EUA, 2025-12), `JKM=F`(없음) |
| `yahoo_softs_livestock` | 농산물 선물 — 밀 `ZW=F`/`KE=F`, 대두 `ZS=F`·박 `ZM=F`·유 `ZL=F`, 생우 `LE=F`, 돈육 `HE=F`, 면화 `CT=F`, 설탕 `SB=F`, 커피 `KC=F`, 코코아 `CC=F`, 오렌지주스 `OJ=F`, 쌀 `ZR=F` | 일 | 식품주 원가 | `ADM`, `BG`, `TSN`, `PPC`, `HRL`, `CALM`, `HSY`, `MDLZ`, `SBUX`, `SJM`, `KO`; CJ제일제당(097950), 농심(004370), 오리온(271560), 삼양식품(003230) | 동일 | 없음 | 비공식(C) | C | **F** 09-16/17: ZW 730.5, KE 802.75, ZS 1,328.25, ZL 69.28, LE 220.325, HE 69.9, CT 84.51, SB 18.92, KC 279.75, CC 5,951, OJ 145.75 |
| `eia_international` | EIA 국제 석유·가스 생산 | 월/연 | JODI 와 교차검증용 | — | `https://api.eia.gov/v2/international/data?api_key=KEY&…` | EIA 키(이미 보유) | 퍼블릭 도메인 | A | **S** 미호출(기존 EIA 키로 가능) |
| `usgs_mcs` | USGS Mineral Commodity Summaries·월간 MIS | 연/월 | 공급 집중도(중국 점유율) 표 | — | `usgs.gov/centers/national-minerals-information-center/…` | 없음 | 퍼블릭 도메인 | B | **F·차단** curl 403. ScienceBase 검색 API 도 비JSON 응답. 연 1회 수동 |
| — | LME 지연 시세 페이지 | — | — | — | lme.com | — | 약관상 자동수집·재배포 금지 | X | **S** 넣지 않음. IMF PCPS·Pink Sheet 월간으로 대체 |
| — | Silver Institute·WPIC 수급 | 연/분기 PDF | — | — | — | — | 보도자료 인용만 | B | **U** 기계 경로 없음. 우선순위 낮음 |

---

### C-7. 농산물·기상

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `fao_food_price_index` | FAO 식량가격지수(종합·육류·유제품·곡물·유지·설탕) | 2014-16=100, 월(첫 금요일), 1990~ | 글로벌 식품 인플레 헤드라인 | `ADM`, `BG`, `TSN`, `GIS`, `KHC`, `MDLZ`, `DAR`; CJ제일제당(097950), 대상(001680), 오뚜기(007310) | `https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data.csv` (앞 3행 제목·4행 공백, `Date,Food Price Index,Meat,Dairy,Cereals,Oils,Sugar`, 뒤쪽 빈 컬럼 다수). UA 필요 | 없음 | FAO 통계 DB: CC BY 4.0(**S**) | A | **F** 2026-08: 종합 133.3, 육류 127.9, 유제품 119.2, 곡물 116.3, 유지 196.9, 설탕 106.4 |
| `usda_fas_export_sales` | USDA FAS **주간 수출판매(ESR)** — 품목×국가 | 톤, 주(목 08:30 ET) | 중국의 미국산 대두·옥수수 구매 = 무역협상 실측치 | `ADM`, `BG`, `DE`, `AGCO`, `CF`, `MOS`, `NTR`, `CTVA`, `ANDE` | `GET https://api.fas.usda.gov/api/esr/exports/commodityCode/801/countryCode/5700/marketYear/2026` 헤더 `X-Api-Key: <키>` (801=대두, 401=옥수수, 107=밀 / 5700=중국). 코드표 `/api/esr/commodities`, `/api/esr/countries` | **api.data.gov 무료 키**(`DEMO_KEY` 로도 동작, 시간당 한도 작음) | 퍼블릭 도메인 | A | **F** `DEMO_KEY` 로 200. 대두→중국 MY2026: 2025-10-30 주 outstandingSales 232,000, 11-06 주 464,000 … 필드 `weeklyExports, accumulatedExports, outstandingSales, grossNewSales, currentMYNetSales, weekEndingDate` |
| `usda_fas_psd` | USDA PSD(세계 수급 — **WASDE 의 기계판**) | 천 톤, 월 | 문서의 `usda_wasde`(PDF, B)를 A 로 올릴 수 있다 | 위와 동일 | `GET https://api.fas.usda.gov/api/psd/commodity/0440000/world/year/2026` (0440000=옥수수, 2222000=대두, 0410000=밀) 같은 키 | 동일 | 퍼블릭 도메인 | A | **F** 200. 2026 옥수수 세계: month 09, attributeId 28(생산) = 1,290,952 천 톤 |
| `usda_barge_rates` | **미시시피 하행 곡물 바지선 운임**(USDA GTR 원자료) | 톤당 USD·관세율 %, 주 | 저수위 → 바지 운임 급등 → 곡물 수출 마진·비료 상행 물류 | `ADM`, `BG`, `ANDE`, `KEX`, `CF`, `MOS` | Socrata: `GET https://agtransport.usda.gov/resource/7spn-fbua.json?$order=date DESC&$limit=50` (톤당 USD, 구간별) · `deqi-uken`(관세율 %, 지점별). 카탈로그 `https://agtransport.usda.gov/api/views.json` | 없음(앱 토큰 선택) | 퍼블릭 도메인 | A | **F** 2026-09-08: Letsworth–Greenville $21.90/t, Twin Cities 839%, Mid-Mississippi 850% |
| `usda_fertilizer_prices_region` | 미국 지역별 비료 소매가(요소·DAP·칼륨·무수암모니아) + 비료 바지 물동·수출입 | USD/톤, 월 | 비료주 실현가격 | `CF`, `MOS`, `NTR`, `LXU`, `IPI`, `SMG` | `https://agtransport.usda.gov/resource/8bgf-5mdv.json` (가격) · `4pdq-r8e8`(월간 비료 바지 물동) · `tpd5-muue`(비료 수출입-성분) · `qize-x4xc`(생산·재고) | 없음 | 퍼블릭 도메인 | A | **F** 2026-06: Urea Northeast 594.4, Southeast 568.8 (갱신 2026-09-03 계열 다수) |
| `usda_grain_rail_export` | 곡물 철도 적재·미선적 수출잔고·컨테이너 곡물·에탄올 철도 | 주/월 | `UNP`·`CSX` 농산물 물량 | `UNP`, `CSX`, `NSC`, `ADM`, `GPRE` | `27k8-utc2`(Grain Rail Cars Loaded and Billed, 09-10 갱신), `s869-hxy4`(Outstanding Export Sales, 09-14), `c353-2zjn`(Containerized Grain, 09-14), `kuz7-syee`(Ethanol Rail) | 없음 | 퍼블릭 도메인 | A | **F** 카탈로그에서 id·갱신일 확인(개별 행은 미조회) |
| `usgs_mississippi_stage` | 미시시피강 세인트루이스 수위 | ft, 15분 | 바지 운임의 원인 변수. 0ft 근처면 적재 제한 | 위 바지 운임과 동일 | `GET https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07010000&parameterCd=00065` (멤피스는 USGS 07032000) | 없음 | 퍼블릭 도메인 | A | **F** 2026-09-17 01:00 CDT = **1.38 ft** (저수위) |
| `noaa_degree_days` | NOAA CPC **가스난방 가중 HDD / 인구 가중 CDD** (일별, 센서스 9개 지역+CONUS) | 도일, 일(1~2일 지연), 연도별 파일 | 천연가스·전력 수요의 기온 요인 분리 | `EQT`, `AR`, `RRC`, `LNG`, `KMI`, `WMB`, `VST`, `CEG`, `NEE`, `UNG` | `https://ftp.cpc.ncep.noaa.gov/htdocs/degree_days/weighted/daily_data/2026/Population.Cooling.txt` · `…/2026/UtilityGas.Heating.txt` (최신 연도는 `…/daily_data/latest/`). 파이프 구분, 헤더 `Region|20260101|…`, 마지막 행 `CONUS`. 그 외 `Electricity.Heating.txt`, `StatesCONUS.*.txt` | 없음 | 퍼블릭 도메인 | A | **F** CDD 파일 258열, 최신 **2026-09-14**, CONUS = 8 |
| `enso_oni` | ENSO **ONI**(3개월 이동 해수면온도 편차) | °C, 월 | 엘니뇨(+0.5 이상)·라니냐 → 곡물·팜유·남미 작황·미국 겨울 가스 수요 | `ADM`, `BG`, `DE`, `CTVA`, `MOS`, `EQT` | `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` (공백 구분 `SEAS YR TOTAL ANOM`) | 없음 | 퍼블릭 도메인 | A | **F** MJJ 2026 +1.39, **JJA 2026 +1.80**(강한 엘니뇨) |
| `us_drought_monitor` | US Drought Monitor 가뭄 면적 비율(D0~D4) | %, 주(목) | 옥수수·대두 벨트 가뭄 → 작황 등급 선행 | `DE`, `AGCO`, `CF`, `NTR`, `CTVA`, `ADM` | `GET https://usdmdataservices.unl.edu/api/USStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=us&startdate=9/1/2026&enddate=9/17/2026&statisticsType=1` 헤더 `Accept: application/json` (주별은 `StateStatistics/…?aoi=IA`) | 없음 | 출처 표기(NDMC·USDA·NOAA) 시 자유 이용 | A | **F** 2026-09-08 CONUS: None 18.95%, D1+ 58.59%, D2+ 33.25%, D3+ 12.02%, D4 1.84% |
| `usda_ams_mars` | USDA AMS Market News(MARS) — 가축·육류·계란 현물 | 일/주 | `TSN`·`CALM` 실현가격 | `TSN`, `PPC`, `HRL`, `CALM` | `https://marsapi.ams.usda.gov/services/v1.2/reports/{slug}` (Basic Auth, 사용자명=키) | **무료 키(계정 가입)** | 퍼블릭 도메인 | A | **F(키 없이 403 확인)** 키 발급 후 재검증 필요 |

---

### C-8. 해운·글로벌 교역 (한국 외)

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `rwi_isl_container_index` | **RWI/ISL 컨테이너 처리량 지수** (세계 90개 항만 + 북유럽 Nordrange + 중국 별도 파일) | 2015=100, 월(월말, 속보치 포함), 2007~ | 세계 교역량의 가장 빠른 무료 월간 실측 | `ZIM`, `MATX`, `DAC`, `GSL`, `FDX`, `UPS`, `EXPD`; HMM(011200), 현대글로비스(086280) | xlsx 경로에 **발표일이 박힌다**: `https://www.rwi-essen.de/fileadmin/user_upload/RWI/Presse/containerumschlag-Index_260731.xlsx` (중국: `containerumschlag-index_china_260731.xlsx`). 발견: `https://www.rwi-essen.de/en/press/science-communication/press-releases` 에서 `container` 가 든 최신 링크 → 그 페이지에서 `fileadmin/…\.xlsx` 정규식. 컬럼: 날짜·Total(원/계절조정/추세)·Nordrange(동일) | 없음 | 출처 표기("RWI/ISL") — 명문 라이선스 없음 | B | **F** `_260731.xlsx`: 2026-06 Total 계절조정 143.11(속보), 2026-05 142.03 / Nordrange 121.47. **가장 최근 보도자료(7월 지수) 페이지에는 xlsx 링크가 없었다** → 링크 없으면 직전 파일 유지 |
| `sg_container_throughput` | 싱가포르 항만 컨테이너 처리량(MPA) | 천 TEU, 월(익월 중순), 1995-01~ | 세계 2위 환적항 = 아시아 역내 교역 | `ZIM`, `MATX`, `GSL`; HMM(011200) | `GET https://data.gov.sg/api/action/datastore_search?resource_id=d_da030f7028200d19ffcbe4a2d71af39c&limit=24&sort=month desc` (화물 톤수는 collection 390) | 없음 | Singapore Open Data Licence v1.0 (출처 표기, 재배포 가능) | A | **F** 2026-08 = 3,953.64, 2026-07 = 3,988.26 (380행) |
| `kiel_red_sea_transits` | Kiel 무역지표 갤러리 — 홍해·희망봉 일별 컨테이너선 통과 수, 중국→북유럽 운임 | 척/일, 일 | PortWatch(이미 있음)와 겹침 → **보조** | `ZIM`, `DAC`, `FRO` | `https://trade.kielinstitut.de/KTI/plot_ships_red_sea.csv`(`timestamp,n`), `plot_ships_cape_good_hope.csv`, `plot_freight_rates_china_northern_europe_global.csv`, `plot_nwe_ports.csv` | 없음 | 명문 라이선스 없음, 출처 표기 | B | **F** 홍해 2026-09-16 = 63척, 희망봉 2026-09-15 = 28척. **나머지 CSV 는 죽어 있음**: 파나마·말라카·정박선·중국 입항·선복량은 2025-01 에서 멈춤, 운임 CSV 도 2025-01-27, `plot_nwe_ports` 는 2026-06-29. Kiel Trade Indicator 본 지수(국가별 수출입 예측)의 CSV 직접 경로는 **못 찾음(U)** |
| — | 닝보 NCFI (`nbse.net.cn`) | — | — | — | — | — | — | — | **U** 연결 실패(000) |
| — | 수에즈운하청 통계 | 월 | PortWatch 와 중복 | — | `suezcanal.gov.eg/English/Navigation/Pages/NavigationStatistics.aspx` | — | — | B | **F(200)** 이나 ASP.NET 폼 방식, 다운로드 링크 없음 → 제외 |
| — | UNCTAD | 분기/연 | 후행 | — | unctadstat | — | — | — | **U** DBnomics 미러는 2023-07 에서 멈춤. 우선순위 낮음 |

---

### C-9. 인도·동남아 (우선순위 낮음)

- 베트남·인도 월간 수출은 **§2 `wb_gem_em_trade_ip` 한 줄로 충분**하다(베트남 2026M07 수출 53,095.5 백만 USD 확인). 베트남 GSO·인도 RBI DBIE 는 별도 파서를 만들 가치가 낮다(연관 상장 종목이 레포에 거의 없음: `INDA` 만 있고 `VNM` 은 없음).
- 인도 RBI DBIE, 베트남 GSO: **U**, 미조사.

---

### C-실패·차단·미확인 목록

| 소스 | 결과 | 비고 |
| :-- | :-- | :-- |
| 중국 국가통계국 `data.stats.gov.cn/english/easyquery.htm` | **403** (WAF `reason:UrlACL`) | 한국 IP·curl. Actions(미국 IP)에서도 같을 가능성 높음. 공식 PMI·사회융자총량·해관총서는 무료 기계 경로 없음 |
| DBnomics `NBS` | 2026-02 에서 멈춤(인덱싱 2026-03) | 같은 차단의 영향으로 보임 |
| DBnomics `IMF/PCPS` | 2025-06 에서 멈춤 | IMF 가 구 API 를 닫고 `api.imf.org` 로 옮긴 뒤 미갱신 → **IMF 직접 호출** |
| DBnomics 전반 | 느림(12콜에 120초 초과), 제공자별 편차 | 폴백 전용 |
| 대만 경제부 수출주문 `moea.gov.tw` | **403** (curl·WebFetch) | data.gov.tw 검색은 JS 렌더링, REST 는 POST 전용(스키마 미확인). NCHC 미러 페이지는 500 |
| 대만 재정부 수출통계 | **U** | `nstatdb.dgbas.gov.tw` 조회 URL 은 200 이나 결과가 JS 로 그려짐 |
| 일본 METI IIP | 연결 실패(000) / index 200 | 파일 경로 미확정 |
| 일본 재무성 무역통계 CSV | e-Stat 파일 ID 가 월마다 달라 미확정 | Comtrade preview 로 대체 검증 |
| Ifo 시계열 `ifo.de/en/ifo-time-series` | 1차 000, 2차 3KB(봇 챌린지) | EU ESI·ZEW 로 대체 |
| Sentix | 미조사(U) | 회원제 |
| ECB 신차등록 `STS…CREG` | 2025-05 에서 멈춤 | ACEA 는 PDF 만 |
| USGS NMIC 페이지 | **403** | 연 1회 수동 |
| AMS MARS | 키 없이 403 | 무료 키 발급 후 재검증 |
| ENTSO-E, e-Stat API, EIA international | 미호출(S) | 각각 토큰·appId·기존 키 필요 |
| 닝보 NCFI `nbse.net.cn` | 연결 실패 | |
| 야후 `TIO=F`, `MTF=F`, `ECF=F`, `JKM=F` | 죽은 티커 | 철광석·석탄·EUA·JKM 은 야후로 못 받는다 |
| Kiel CSV 다수 | 2025-01 에서 멈춤 | 홍해·희망봉만 살아 있음 |
| LME, SHFE·DCE, 홍콩 공항, 마카오 DICJ | 약관(X) 또는 다른 조사자 담당 | 제외 |
| IMF `PLITH` 단위 | 값 148,620 — CNY/톤 가능성 | 구현 전 codelist 에서 단위 확인 |
| WB GEM 인도 수출 값 4,239 | 단위 이상 | 중국·베트남만 우선 사용 |

---

### C-바로 구현 가능한 상위 10개

선정 기준: 키 없음 · 이 세션에서 최신값 확인 · 기존 빌더 규약(atomic write, prev-merge, 적립)으로 1파일에 끝남 · 레포에 연관 종목 다수.

| 순위 | 지표 ID | 한 줄 이유 | 구현 메모 |
| :-- | :-- | :-- | :-- |
| 1 | `tw_ai_server_odm_rev` + `tw_*` 5종 | 기존 TSMC 수집기와 **같은 응답**. 코드 목록만 늘리면 AI 서버·메모리·기판·해운 6개 바스켓이 생긴다 | `utf-8-sig`, 민국연 변환, `資料年月` 바뀔 때만 1행 적립 |
| 2 | `tpex_monthly_rev` | Aspeed(5274)·GlobalWafers(6488)는 TWSE 에 없다. 필드 동일이라 함수 재사용 | `https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O` |
| 3 | `boj_memory_ic_price_index` | DRAM 현물(D 등급)의 **공식 무료 대체**. 2010년부터 히스토리, 08월 293.4 | `--compressed`(gzip) 필수. requests 는 자동 |
| 4 | `imf_pcps_battery_metals` + `imf_pcps_uranium_fert_lng` | 리튬·코발트·우라늄·희토류·LNG 를 한 URL 로. FRED 미러보다 한 달 빠름 | SDMX-CSV, 세계=`G001`. 원표 재호스팅 금지, 값+출처만 |
| 5 | `wb_pink_sheet` | 비료·목재·고무·석탄 1960~. CC BY 4.0 | 연 1회 바뀌는 해시 경로 → 랜딩 페이지에서 링크 추출 |
| 6 | `eua_auction_price` | EU 탄소가격의 유일한 공식 무료 일별 | 연도별 xlsx, 헤더 5행 |
| 7 | `de_truck_toll_index` | 일별 독일 경기. 라이선스 명확(DL-DE BY 2.0) | 시트 `csv-42191-b01` long 포맷 |
| 8 | `bis_credit_gap`·`bis_dsr`·`bis_reer`·`bis_policy_rates`·`bis_property_prices` | 같은 SDMX 함수 하나로 5지표. 한국 비교가 바로 된다 | `Accept: application/vnd.sdmx.data+csv;version=1.0.0` |
| 9 | `usda_barge_rates` + `usgs_mississippi_stage` + `us_drought_monitor` + `enso_oni` + `noaa_degree_days` | 전부 미 정부 퍼블릭 도메인·무키. "기상→물류→곡물·가스" 인과 한 묶음 | Socrata `$order`·`$limit`, CPC 는 파이프 구분 텍스트 |
| 10 | `rwi_isl_container_index` + `sg_container_throughput` + `nyfed_gscpi` | 세계 교역량 월간 3종. SCFI 류의 재배포 문제 없음 | RWI 는 날짜 박힌 파일명 → 보도자료 목록에서 발견, GSCPI 는 `xlrd` |

차점: `fao_food_price_index`(CSV 한 줄), `imf_cb_gold_holdings`·`imf_cofer_usd_share`(금 서사), `usda_fas_export_sales`(키 1개 필요), `ccfi_composite`(약관 주의), `jodi_oil_world`(4.7MB/년 — 필요한 국가·플로우만 추려 저장).

### C-구현 시 공통 주의

1. **배포 트리거·신뢰도 센터·feature-data 등록**은 설계서 규약대로(이 문서는 소스만 다룸).
2. 적립형(TWSE·TPEx·CCFI·EUA 는 연 파일이라 예외)은 `data/industry_archive/{id}.json` 규약, 같은 날짜 skip, 파싱 실패 시 기존 파일 유지.
3. UA 헤더가 없으면 막히는 곳: World Bank thedocs, Destatis, FAO, RWI, SSE, EEX.
4. Windows 로컬에서 중문 출력은 `PYTHONIOENCODING=utf-8` 또는 `sys.stdout.reconfigure` 필요(cp949 에서 `UnicodeEncodeError` 재현됨).
5. 유로존 집계 코드는 `EA20` → **`EA21`** (2026-01~). 고정 코드 대신 `EU27_2020` 을 같이 받아 둘 것.
6. IMF·SSE·EEX·RWI·Kiel·ZEW 는 CC 류 명문 라이선스가 없다 → **지표값과 출처 표기만**, 원표·파일 재호스팅 금지.


---

## D. 기업 공시형 월간 KPI·산업협회·규제기관


- 조사일: 2026-09-17 (KST). 조사 PC(한국 KT 회선)에서 `curl` 실호출 + WebFetch/WebSearch.
- 중복 제외 기준: `mir_design/INDUSTRY_INDICATORS_DESIGN.md` 56~400행, 742~860행에 이미 있는 지표는 싣지 않았다(TSMC 월매출, Tesla 분기 인도, CPCA, TSA, Cass, AAR 합계, Baker Hughes, 만하임, Cox, ACEA, STR, OpenTable, 닐슨, NAHB, MBA, Redfin, Zillow, CMS MA, ClinicalTrials, FluView, EIA 석유·가스·EIA-930, PJM 용량경매, Steam 등).
- 검증 표기: **F** = 이번 조사에서 응답을 직접 받아 값까지 확인, **S** = 공식 문서·검색 스니펫으로만 확인, **U** = 미확인.
- 등급: A = 공식 무료 API(JSON/CSV/TSV/xlsx 고정 경로), B = 공식 HTML·xls·PDF·보도자료 파서 필요, C = 프록시·제3자, D = 유료, X = 재배포·스크래핑 금지.
- 연관 종목은 모두 `data/details/<TICKER>.json` · `data/korea/details/<코드>.json` 존재를 확인한 것만 적었다. (없어서 뺀 것: `EA`, `SPR`, `EADSY`, `BYDDY`, `TCEHY`, `AB`, `JHG`, `U`)
- IR 보도자료 재게시 판단: 보도자료에 실린 **사실 수치(숫자 자체)는 저작물이 아니므로** "수치 + 출처 링크" 형태의 적립·표시는 가능하다고 본다. 본문·표를 통째로 복제하거나 PDF 를 재호스팅하지 않는다. 아래 "라이선스" 칸의 `인용` 은 이 뜻이다.

### D-0. 먼저 알아둘 공통 접근 경로 3가지 (이번 조사의 핵심 발견)

#### 0-1. Q4 IR 사이트 공통 JSON 피드 (키 없음) — F
미국 상장사 IR 사이트의 상당수가 Q4 플랫폼이고, 아래 엔드포인트가 **호스트만 바꾸면 그대로** 동작한다. 월간 KPI 보도자료를 "헤드라인 정규식"으로 자동 탐지할 수 있다.
```
GET {IR_HOST}/feed/PressRelease.svc/GetPressReleaseList?LanguageId=1&bodyType=2&pressReleaseDateFilter=3&categoryId=1cb807d2-208f-4bc3-9133-6a9ad45ac3b0&pageSize=30&pageNumber=0&tagList=&includeTags=true&year=2026&excludeSelection=1
```
- 응답: `GetPressReleaseListResult[]` → `PressReleaseDate`, `Headline`, `LinkToDetailPage`, `Body`(bodyType=2 이면 HTML 본문 포함, 0 이면 생략).
- 브라우저 UA 필요. `Body` 앞부분에 `.q4default{...}` CSS 텍스트가 붙어 나오므로 `<style>` 제거 후 파싱.
- 이번에 **동작 확인**: `ir.theice.com`, `ir.cboe.com`, `investor.marketaxess.com`, `pressroom.aboutschwab.com`, `investor.costco.com`, `investors.boeing.com`, `investors.caterpillar.com`, `ir.allegiantair.com`.
- **403/불가**: `investor.unionpacific.com`, `ir.nio.com`, `ir.xiaopeng.com`, `ir.lixiang.com`, `ir.tesla.com`, `ir.lucidmotors.com`, `investors.wynnresorts.com`, `ir.copaair.com`(Akamai), `investors.rivian.com`(Q4 아님), `investor.cmegroup.com`(Q4 아님·403).

#### 0-2. SEC EDGAR (키 없음, UA 필수) — F
- UA 는 `Mir_US_Stocks research dydtjsdn@gmail.com` 로 전부 200. (레포 `sec_client.py` 규약과 동일하게 쓰면 된다.)
- **제출 목록**: `https://data.sec.gov/submissions/CIK{10자리}.json` → `filings.recent.form/filingDate/items/accessionNumber/primaryDocument`. 8-K 의 `items` 에 `7.01`·`8.01` 만 있고 `2.02` 가 없는 제출이 "월간 KPI 후보"다.
- **첨부 목록**: `https://www.sec.gov/Archives/edgar/data/{cik}/{accession에서 - 제거}/index.json` → `directory.item[].name`. EX-99 파일명이 회사마다 다르다(SYF 는 `creditstatsfinancialtables.htm`, PGR 은 `pgr202607ex99earningsrelea.htm`) → `ex|99` 정규식 + 크기 큰 `.htm` 폴백.
- **전문검색(FTS)**: `https://efts.sec.gov/LATEST/search-index?q=%22검색어%22&forms=8-K&ciks=0000316709&dateRange=custom&startdt=2026-07-01&enddt=2026-09-17` → `hits.hits[]._source.{file_date,display_names,items,file_description}`, `_id` = `accession:파일명`. **0.3초 간격 연속 호출 시 비JSON 응답이 섞여 나왔다**(3회 실패). 1~2초 간격 + 재시도 필수. 색인에 1~수일 지연이 있어 "오늘 나온 8-K 탐지"에는 submissions JSON 이 더 확실하다.
- 티커→CIK: `https://www.sec.gov/files/company_tickers.json` (F).
- **중요한 실측**: 아래 회사들은 월간 지표를 **더 이상 8-K 로 내지 않는다**(2026-07-01 이후 submissions 확인) → IR 피드·통신사 경로가 필요: `IBKR`(8-K 없음), `SCHW`(분기 실적 8-K 에만), `HOOD`, `CME`, `ICE`, `CBOE`, `NDAQ`, `TW`, `MKTX`, `COST`(7-08 의 6월분은 배당 겸용이라 8-K, 7·8월분은 8-K 없음), `BA`.
- 반대로 **8-K(7.01) 월간 제출이 살아 있는 곳**: `PGR`, `SYF`, `AXP`, `COF`, `IVZ`, `ODFL`, `XPO`, `SAIA`(8.01), 중국 EV 3사(6-K).

#### 0-3. PR Newswire 기업별 목록 (키 없음) — F
IR 사이트가 봇을 막는 회사(CME, 현대차 미국법인 등)의 대체 경로.
```
https://www.prnewswire.com/news/{org-slug}/      # 예: cme-group, hyundai-motor-america
→ href="/news-releases/{slug}-{9자리id}.html" 추출 → 본문 HTML
```
- 브라우저 UA 로 200. 본문에서 헤드라인 수치 정규식 추출. PR Newswire 약관은 자동 수집을 명시적으로 허용하지 않는다 → **하루 1회·회사 몇 곳 한정**, 수치+링크만.
- GlobeNewswire(`www.globenewswire.com`)는 이번 조사에서 **curl 타임아웃(HTTP 000)** — HOOD·COST 는 통신사 대신 Q4 피드/검색 스니펫으로 확인.

---

### D-1. 브로커 · 거래소 · 자산운용 · 카드 (월간 공시)

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ibkr_monthly_metrics` | IBKR 월간 브로커리지 지표 (DARTs·고객자산·마진론·계좌수) | 건/USD, 매월 1영업일, 2008~ (PDF 는 연도별 목록) | 리테일·헤지펀드 거래 활동의 가장 빠른 월간 실측. 마진론은 레버리지 온도계 | `IBKR`, `HOOD`, `SCHW`; `키움증권`(039490), `미래에셋증권`(006800) | 목록 `https://investors.interactivebrokers.com/en/general/about/monthly-metrics.php` → `https://www.interactivebrokers.com/mkt/getFileNew.php?file=202608MetricsPressRelease.pdf` (`YYYYMM` 규칙, 최신은 `file=latestMetricPR`). **응답 앞 147바이트가 Java SerialBlob 헤더라 `%PDF` 위치부터 잘라야 PDF 로 열린다** | 없음 | 인용 | B | **F** — 2026-08: DARTs 4.276M(+23% y/y), 고객자산 $962.8B, 마진론 $101.5B, 계좌 5.460M |
| `schw_monthly_activity` | Schwab Monthly Activity Highlights (순신규자산·고객자산·신규계좌·마진) | USD/건, 매월 ~14일 (분기말 달은 실적에 흡수) | 미국 리테일 자금 유입의 최대 표본($13조) | `SCHW`, `IBKR`, `HOOD`, `LPLA` | Q4 피드 `https://pressroom.aboutschwab.com/feed/PressRelease.svc/GetPressReleaseList?...` 헤드라인 `Monthly Activity Highlights`. (`www.aboutschwab.com/monthly-activity-report` 는 curl·WebFetch 모두 **403**) | 없음 | 인용 | B | **F**(피드: 2026-09-15·08-14·06-12·05-14 게시 확인) / 값은 S — 8월 core NNA $64.8B, 고객자산 $13.41T, 신규계좌 42.4만, 마진 $177.6B |
| `hood_monthly_operating` | Robinhood 월간 운영지표 (Funded Customers·Net Deposits·플랫폼 자산·주식/옵션/크립토 거래대금) | 명/USD, 매월 ~10~15일, 2023~ | 리테일 위험선호·크립토 거래의 월간 실측 | `HOOD`, `COIN`, `IBKR` | IR `investors.robinhood.com/news-releases` **403(Akamai)**, 8-K 미제출. GlobeNewswire 본문 `https://www.globenewswire.com/news-release/2026/09/10/3359962/0/en/...` (curl 타임아웃) | 없음 | 인용 | B− | **S** — 2026-08: Funded 28.6M, Net Deposits $4.0B, 플랫폼 자산 $384B, 주식 거래대금 $335B |
| `cboe_monthly_volume` | Cboe 월간 거래량 보도자료 (옵션 ADV·지수옵션·주식·선물·FX) | 계약/USD, 매월 3~5영업일 | 옵션 거래 붐(0DTE)의 월간 확인. 분기 RPC 와 결합하면 매출 추정 | `CBOE`, `CME`, `ICE`, `NDAQ`, `HOOD` | Q4 피드 `https://ir.cboe.com/feed/PressRelease.svc/GetPressReleaseList?...` 헤드라인 `Reports Trading Volume for` | 없음 | 인용 | B | **F** — 2026-09-03 "…Trading Volume for August 2026" 게시(7월분 08-05, 6월분 07-06) |
| `cboe_us_equities_market_share` | Cboe 미국 주식 시장 거래소별 월간 거래량·점유율 CSV | 주/USD/건, 월간, 2009~ (연도별 파일) | 거래소별(NYSE·Nasdaq·Cboe·IEX·MEMX·24X)·테이프별 점유율. 오프익스체인지(TRF) 비중 = 리테일 활동 프록시 | `CBOE`, `NDAQ`, `ICE`, `HOOD`, `VIRT` | `https://cdn.cboe.com/resources/us/equities/market-statistics/historical-market-volume/market_history_monthly_2026.csv` (일별은 `market_history_2026.csv`). 컬럼 `Month,Market Participant,Tape A/B/C Shares,Total Shares,…Notional,…Trade Count` | 없음 | Cboe 웹 약관(개인·내부 이용) → 집계값+출처 | **A−** | **F** — 2026-01 행부터 수신(28.8KB) |
| `ice_monthly_statistics` | ICE 월간 통계 (에너지·금리·농산물 ADV/OI, NYSE 현물·옵션) | 계약, 매월 3~5영업일 | 브렌트·TTF·천연가스 선물 활동 = 에너지 변동성 수혜 | `ICE`, `CME`, `MKTX`(ICE 피인수 진행) | Q4 피드 `https://ir.theice.com/feed/PressRelease.svc/...` 헤드라인 `Reports .* Statistics`. 상세 xlsx("Monthly Statistics Tracking")는 `ir.theice.com/ir-resources/supplemental-information` 에서 JS 로 로드돼 **정적 링크 추출 실패(U)** | 없음 | 인용 | B | **F** — 2026-09-03: 8월 총 ADV +14% y/y, OI +19%, 에너지 ADV +13%, TTF ADV +29% |
| `cme_monthly_adv` | CME 월간 ADV (금리·주가지수·에너지·농산물·금속·FX·크립토) | 계약, 매월 2영업일 | 금리·주가지수 헤지 수요. 금속 ADV 급증은 원자재 변동성 신호 | `CME`, `ICE`, `CBOE` | **cmegroup.com 은 이 IP 를 "스크래핑 의심"으로 차단하며 약관상 봇 금지를 본문에 명시**, `investor.cmegroup.com`·`cmegroupinc.gcs-web.com/monthly-volume` 도 403 → PR Newswire `https://www.prnewswire.com/news/cme-group/` → 개별 릴리스 | 없음 | 인용(PRN). cmegroup.com 직접 수집은 **X** | B(PRN) / X(원천) | **F**(PRN 본문) — 2026-08 ADV 29.7M(+6%), 금리 16.7M, 주가지수 6.8M, 에너지 2.3M, 크립토 175K |
| `tw_monthly_adv` | Tradeweb 월간 ADV (금리·크레딧·주식·머니마켓, 자산군·상품별) | USD 백만, 매월 4~5영업일, **2017-01~ 월별 전체 히스토리 xlsx** | 채권 전자거래 침투율. 국채·스왑 거래량 = 금리 변동성 | `TW`, `MKTX`, `ICE`, `CME` | 목록 `https://www.tradeweb.com/newsroom/monthly-activity-reports/` → `…/globalassets/newsroom/monthly-activity-reports/2026/august/tw-historical-adv-and-day-count-through-august-2026.xlsx` (경로 앞 해시·월 이름이 매달 바뀜 → 목록에서 `.xlsx` 링크 추출). 시트 `ADV - M`, `Volume - M`, `Trade Days - M`, 분기 3종 | 없음 | 인용·출처 표기 | **A−** | **F** — 2026-08 Grand Total ADV 2,797,235($M), 7월 2,927,585; Rates 1,624,223 |
| `mktx_monthly_volume` | MarketAxess 월간 거래량 | USD, 월간 | 회사채 전자거래 | `MKTX`, `TW`, `ICE` | Q4 피드 `https://investor.marketaxess.com/feed/...`, xlsx `//s201.q4cdn.com/767283836/files/doc_news/2026/07/07/MKTX-Monthly-Volume-Release-Website-File-06-2026-New-View.xlsx` | 없음 | 인용 | B | **F** — **2026-07-07(6월분)이 마지막. 07-30 "ICE 가 MarketAxess 인수" 발표 이후 7·8월분 미게시** → 신규 구현 비권장, 중단 가능성 표기 |
| `pgr_monthly_results` | Progressive 월간 실적 (순보험료·합산비율·보유계약) | USD·%·천 건, 매월 ~15~20일, 8-K 7.01 | 미국 자동차보험 가격·손해율의 **월간** 실측. 상장 보험사 중 유일 | `PGR`, `ALL`; `삼성화재`(000810), `DB손해보험`(005830) | `data.sec.gov/submissions/CIK0000080661.json` → 8-K(7.01) → `index.json` 의 `pgr{YYYYMM}ex99earningsrelea.htm` | 없음 | 공공(SEC 제출물)·인용 | **A−** | **F** — 2026-07: NPW $7,441M(+5%), 합산비율 86.8(전년 85.3), 순이익 $961M(−12%) |
| `card_master_trust_monthly` | 카드사 월간 연체율·순상각률 (SYF·AXP·COF) | %, 매월 ~15일, 8-K 7.01, SYF 는 **13개월 표** | 미국 소비자 신용의 월간 체온계. 분기 실적의 대손비용을 한 달 먼저 본다 | `SYF`, `AXP`, `COF`, `BAC`, `C`, `JPM`; `삼성카드`(029780) | SYF `CIK0001601712` → EX-99.1 `creditstatsfinancialtables.htm`; AXP `CIK0000004962` → 본문 `axp-YYYYMMDD.htm`(첨부 없음, 본문 표); COF `CIK0000927628` | 없음 | 공공(SEC)·인용 | **A−** | **F**(SYF·AXP) — SYF 2026-08: 30+ 연체 4.2%, NCO 4.9%(7월 4.7%), 대출 $103.0B. AXP 8월: 미 소비자 카드 NWO 1.7%, 소기업 30일 연체 1.3%. COF 는 09-15 7.01 3건 중 월간분 미식별(**U**) |
| `ivz_monthly_aum` | Invesco 월말 AUM·순유입 | USD, 매월 ~10일, 8-K 7.01 | 자산운용 업황·ETF(QQQ) 자금 | `IVZ`, `BLK`, `TROW`, `BEN`, `APAM` | `CIK0000914208` → EX-99.1 `ivzaumexhibit991-MMYY.htm` | 없음 | 공공(SEC)·인용 | A− | **F** — 2026-08 말 AUM $2,562.1B(+4.7% m/m) |
| `edgar_ipo_filings` | IPO 시장 온도: S-1·F-1·424B4 월별 제출 건수 | 건, 일·월, 1993~ | 424B4(가격확정 투설)가 실제 상장 건수에 가장 가깝다. 위험선호 후행·동행 지표 | `GS`, `MS`, `JPM`, `NDAQ`, `ICE` | `https://www.sec.gov/Archives/edgar/full-index/2026/QTR3/form.idx` (고정폭 텍스트, 분기 41MB — 일별은 `…/edgar/daily-index/2026/QTR3/form.YYYYMMDD.idx`). 또는 FTS `forms=424B4&startdt&enddt` 의 `hits.total.value` | 없음 | 공공 | **A** | **F** — 2026-08: 424B4 46건, S-1 76건, F-1 26건 (7월 46/99/36). 주의: S-1 은 재판매 등록·SPAC 포함 → 424B4 를 주지표로 |
| `fed_h8_bank_credit` | 연준 H.8 주간 은행 대출·예금·카드대출 | USD 십억, 주간 금, 1973~ | 은행 대출 성장·예금 이탈의 주간 실측 (SLOOS 는 분기) | `JPM`, `BAC`, `C`, `COF`, `SYF`; 은행 전반 | FRED `fredgraph.csv?id=TOTBKCR` / `DPSACBW027SBOG`(예금) / `CCLACBW027SBOG`(카드·리볼빙). **`&cosd=YYYY-MM-DD` 없이 호출하면 이 PC 에서 타임아웃** — 시작일을 항상 붙일 것 | 없음 | 공공 | **A** | **F** — 2026-09-02: 은행신용 $19,835B, 예금 $19,566B, 카드 $1,083B |

### D-2. 항공우주 · 방산

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `boeing_orders_deliveries` | Boeing 상용기 주문·인도·수주잔고 (기종·고객·엔진별) | 대, 월간(둘째 화요일), **1958~ 전 주문 원장** | 분기 인도 발표보다 먼저 월별 수주·취소가 보인다. 엔진(GE/CFM/PW/RR) 컬럼으로 엔진사 매핑 가능 | `BA`, `GE`, `HWM`, `RTX`, `HXL`, `TDG`; `한국항공우주`(047810), `한화에어로스페이스`(012450) | **Tableau Public CSV 직접 내려받기**: `https://public.tableau.com/views/BoeingCommercialOrdersDeliveries_16788064876590/OrdersandDeliveries.csv?:showVizHome=no` (1.6MB, 19,720행; 컬럼 `Country,Customer Name,Delivery Year,Engine,Measure Names,Model Series,Order Month,Order Year,Region,Delivery Total,Order Total,Measure Values`). 수주잔고: `https://public.tableau.com/views/ASC606Table_16394973655940/ASC606.csv?:showVizHome=no`. 워크북 이름은 `boeing.com/commercial` HTML 의 `<param name='name'>` 에서 재확인 가능 | 없음 | Boeing 공개 자료(Tableau Public) — 집계+출처 | **A−** | **F** — 2026 총주문 1월 107·4월 136·6월 121·7월 38·8월 15대, 인도 2026 YTD 418대(2025년 600·2024년 348), 미인도 6,755대 / ASC606 백로그 6,156대. **인도는 연도만 있고 월이 없어** 월별은 YTD 차분으로 적립. `boeing.com/commercial/orders-deliveries` 는 404(해시 라우트) |
| `airbus_orders_deliveries` | Airbus 월간 주문·인도 | 대, 매월 ~5~8일, xlsx | Boeing 과 짝. 엔진·부품 공급망 | `GE`, `RTX`, `HWM`, `HXL`, `TDG`; `한국항공우주`(047810) | `https://www.airbus.com/en/products-services/commercial-aircraft/orders-and-deliveries` — **curl·WebFetch 모두 JS 챌린지(빈 본문)**. xlsx 직접 URL 미확인 | 없음 | 인용 | B(차단) | **S** — 2026-08: 인도 57대(YTD 475/목표 870), 총주문 67대(YTD 총 1,157·순 1,091) — Forecast International 2차 출처 |
| `dod_daily_contracts` | 미 국방부 일일 계약 공고 ($7.5M 이상) | 건·USD, 평일 17:00 ET | 방산주 수주 뉴스의 1차 원천. 회사명 매칭으로 종목 태그 | `LMT`, `RTX`, `NOC`, `GD`, `LHX`, `BA`, `HWM`, `BWXT` | **RSS 동작**: `https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=400&Site=945&max=10` (→ `www.war.gov` 로 301; 부처명이 "Department of War" 로 바뀜). **본문 기사 페이지는 403(Akamai, 브라우저 UA·연구 UA·WebFetch 모두)** → RSS 는 제목·링크·날짜만. 금액 본문은 레포 기존 USASpending 경로로 보완 | 없음 | 공공(미 연방) | B− (RSS 만) | **F**(RSS) — 최신 "Contracts for Sept. 11, 2026"(pubDate 09-11 21:00 GMT). 본문 **차단** |
| `dsca_fms_notifications` | DSCA 대외군사판매(FMS) 의회 통보 | 건·USD, 수시 | 국가별 무기 도입 = 미 방산 수출 파이프라인. 한국 방산과 경쟁·보완 구도 | `LMT`, `RTX`, `NOC`, `GD`, `BA`; `한화에어로스페이스`(012450), `LIG넥스원`(079550), `현대로템`(064350), `한국항공우주`(047810) | RSS `https://www.dsca.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=700&Site=1509&max=10` — **연구용 UA 로 200**(브라우저 UA 페이지는 403). 항목 `title`("국가 – 품목"), `link`, `pubDate` | 없음 | 공공 | B | **F** — 단, **최신 항목이 2026-02-06**("Ukraine – Class IX Spare Parts"). 피드가 멈췄거나 게시 경로가 바뀐 것 → 구현 전 재확인 필수. ContentType/Site 값은 시행착오로 찾은 것(문서 없음) |

### D-3. 카지노 · 여행 · 레저

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `macau_ggr_monthly` | 마카오 월간 카지노 총수입 (DICJ) | MOP 백만, 매월 1일, 2005~ (연도별 XML) | LVS·WYNN·MGM 마카오 법인 실적을 한 달 단위로 선행. 발표일 주가 반응이 큼 | `LVS`, `WYNN`, `MGM`, `MLCO`; `파라다이스`(034230), `GKL`(114090) | **XML 직접**: `https://www.dicj.gov.mo/web/en/information/DadosEstat_mensal/{YYYY}/report_en.xml` (키 없음, `<RECORD><DATA>` 월·당해·전년·증감·누계). HTML 은 이 XML 을 JS 로 그린다 | 없음 | 마카오 정부 공개 통계 — 출처 표기 | **A** | **F** — 2026-08: 21,891(−1.2% y/y), 7월 20,260(−8.4%), 6월 18,522(−12.1%), 1~8월 누계 169,053(+3.7%) |
| `nevada_gaming_win` | 네바다 월간 게이밍 수입 (Strip·다운타운·주 전체, 게임별) | USD, 매월 말(전월분), 2004~ PDF | 라스베이거스 스트립 win = MGM·CZR·WYNN 국내 실적 | `MGM`, `CZR`, `WYNN`, `LVS`, `PENN`, `BYD` | 목록 `https://www.gaming.nv.gov/about-us/gaming-revenue-information-gri/` → `/siteassets/content/about/gaming-revenue/monthly-revenue-report---july-2026.pdf` (**하이픈 개수가 달마다 다름**: `---`/`----`, 3월은 `/contentassets/…` → 목록에서 링크 추출 필수). 48쪽 PDF, 지역별 1·3·12개월 표 | 없음 | 네바다 주정부 공개 | B | **F**(목록·PDF 수신, 2026-07 보고서 48쪽). 수치 표 파싱은 미수행 |
| `lvcva_visitation` | 라스베이거스 방문객·컨벤션·객실점유율·ADR·RevPAR (LVCVA) | 명·%·USD, 월말(전월분), 연도별 xlsx 2020~ | 카지노 비게이밍 매출·호텔 가동. 주중/주말·스트립 분해 | `MGM`, `CZR`, `WYNN`, `LVS`, `HLT`, `MAR` | 목록 `https://www.lvcva.com/research/` → `https://assets.simpleviewcms.com/simpleview/raw/upload/v1/clients/lasvegas/Year_to_Date_Summary_for_2026_{uuid}.xlsx` (uuid 가 갱신 때마다 바뀜 → 목록에서 추출). 시트 `Las Vegas 2026`, 행 `Visitor Volume`, `Convention Attendance`, `Total Occupancy`, … | 없음 | LVCVA Research Center — 출처 표기 | B | **F** — "As of August 27 2026". 방문객 2026-01 3,269,100 / 03 3,452,500 / 05 3,486,400; 점유율 1월 79.5%·3월 84.8% |
| `hkia_monthly_traffic` | 홍콩국제공항 월간 여객·화물·운항 | 명·톤·회, 매월 중순(전월분) PDF | 세계 1위 화물공항 = 아시아 전자제품 항공물류. 마카오·중화권 여행 회복 | `FDX`, `UPS`, `LVS`, `WYNN`; `대한항공`(003490), `아시아나항공`(020560) | `https://www.hongkongairport.com/iwov-resources/file/the-airport/hkia-at-a-glance/facts-figures/Jul2026_statistics_e.pdf` (`{Mon}{YYYY}_statistics_e.pdf` 규칙, 목록 `…/hkia-at-a-glance/fact-figures.page`) | 없음 | AAHK 공개 — 인용 | B | **F** — 2026-07: 여객 5,624,000(+8.4%), 화물 422,000톤(−1.9%), 운항 34,230회(+1.7%); 12개월 여객 64.8M(+12.6%) |
| (없음 확인) | 미국 항공사 월간 수송실적 | — | — | — | Allegiant 가 마지막이었으나 Q4 피드상 **2026-01-22 "December 2025 Traffic" 이 마지막**. `DAL`·`UAL`·`AAL`·`LUV`·`ALK`·`JBLU` 모두 월간 미공시 → TSA(기존)·BTS T-100(기존) 사용 | — | — | — | **F**(ALGT 피드) |
| (없음 확인) | 크루즈 무료 월간 지표 | — | — | `RCL`, `CCL`, `NCLH`, `VIK` | CLIA `cruising.org` **403**, 회사 월간 공시 없음. 무료 실측 없음 → 넣지 않음 | — | — | D/없음 | F(차단) |

### D-4. EV · 자동차

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `china_ev_startups_monthly` | NIO · XPeng · Li Auto 월간 인도량 | 대, 매월 1일(중국시간), 6-K | 기존 `china_cpca_nev_sales`(업계 합계)와 달리 **종목별** 수치. IR 사이트는 전부 403 이지만 SEC 6-K 로 같은 날 들어온다 | `NIO`, `XPEV`, `LI`, `TSLA`; `LG에너지솔루션`(373220), `삼성SDI`(006400) | FTS `https://efts.sec.gov/LATEST/search-index?q=deliveries&forms=6-K&ciks=0001736541`(NIO) / `0001810997`(XPEV) / `0001791706`(LI) → `_id` 의 `ex99-1.htm`. 또는 submissions JSON 의 6-K. 본문 정규식 `delivered ([\d,]+) vehicles in (\w+ \d{4})` | 없음 | 공공(SEC)·인용 | **A−** | **F** — NIO 2026-08: 35,836대(+14.5% y/y; NIO 21,174·ONVO 8,810). LI 2026-08: 37,679대(누적 1,801,834). XPEV 는 08-03 6-K(7월분)까지 확인, 09-01 분은 FTS 색인 미확인(**U**) |
| `afdc_ev_charging_ports` | 미국 공개 EV 충전 포트·스테이션 수 (네트워크·DC급속별) | 개, 일간 갱신(스냅샷 → 자체 적립) | 충전 인프라 성장률. Tesla 슈퍼차저 점유율, ChargePoint·EVgo 네트워크 규모 | `TSLA`, `CHPT`, `EVGO`, `BLNK` | `https://developer.nlr.gov/api/alt-fuel-stations/v1.json?api_key=KEY&fuel_type=ELEC&country=US&status=E&access=public&limit=1` → `station_counts.fuels.ELEC.{total(포트), stations.total}`. 필터 `ev_charging_level=dc_fast`, `ev_network=Tesla` / `ChargePoint%20Network`. **NREL 이 NLR 로 개명돼 `developer.nrel.gov` 는 타임아웃, `developer.nlr.gov` 가 동작** | 무료 키(`DEMO_KEY` 는 몇 회 후 한도) | 공공(DOE) | **A** | **F** — 2026-09-17: 공개 포트 257,206 / 스테이션 81,939; DC급속 76,041포트; Tesla DC급속 38,307포트(3,110곳); ChargePoint 83,873포트 |
| `argonne_us_ev_sales` | Argonne 월간 미국 EV(BEV·PHEV·HEV) 판매 | 대·점유율, 월간(~3주 지연), 2010~ | 미국 EV 침투율의 공식(DOE) 월간 | `TSLA`, `GM`, `F`, `RIVN`, `LCID`; `현대차`(005380), `기아`(000270) | `https://www.anl.gov/esia/light-duty-electric-drive-vehicles-monthly-sales-updates` — **curl 403(Cloudflare "Just a moment"), WebFetch 403** | 없음 | 공공(DOE) | B(차단) | **S** — 검색 스니펫상 2026-07 누계까지 게시. Actions 러너에서 재시도 필요(차단 가능성 높음) |
| `hyundai_kia_us_sales` | 현대차·기아 미국법인 월간 판매 | 대, 매월 1~3일 | **KR 모드 핵심**: 현대차·기아 분기 실적의 미국 물량을 월 단위로 선행. 하이브리드·전동화 비중 포함 | `현대차`(005380), `기아`(000270), `현대글로비스`(086280); `GM`, `F`, `TM`, `HMC` | `hyundainews.com/releases/{id}` 는 JS 셸(1.4KB) → PR Newswire `https://www.prnewswire.com/news/hyundai-motor-america/` → `…/hyundai-motor-america-reports-august-2026-sales-302865933.html`. 정규식 `total sales of ([\d,]+)` | 없음 | 인용 | B | **F**(PRN 본문) — 2026-08 HMA 86,977대(−2% y/y), 하이브리드 +33%·비중 29%, 전동화 34%. 기아는 같은 경로 **U** |
| `norway_ofv_registrations` | 노르웨이 신차 등록·무공해차 비중 (OFV) | 대·%, 매월 1일 | EV 침투 100% 근접 시장의 월간. Tesla 유럽 물량의 최속 신호 | `TSLA`; `현대차`(005380), `기아`(000270) | `https://ofv.no/statistikk` HTML(노르웨이어). 브랜드별 상세는 유료 | 없음 | ©OFV — 헤드라인 인용 | B/C | **F** — 2026-08: 신규 승용 13,451대(−3.3%), 1~8월 96,463대, **무공해 비중 97.8%**(+3.3pp) |
| (보류) | 독일 KBA 월간 등록 | 대, 월 ~5일 | — | `TSLA` | `kba.de` 보도자료 목록 `…/Pressemitteilungen/pressemitteilungen_node.html` 200(독일어). 개별 릴리스·xlsx 경로 **U** — 기존 `acea_eu_registrations` 로 대체 가능 | 없음 | dl-de/by-2-0(출처 표기) | B | U |
| (분기) | Rivian·Lucid 분기 생산·인도 | 대, 분기 초 | — | `RIVN`, `LCID` | IR 403/비Q4 → 8-K 2.02/7.01 (submissions JSON) 경로로만. 기존 `tesla_quarterly_deliveries` 와 같은 "분기 초 8-K" 수집기로 묶을 것 | 없음 | 공공(SEC) | B | U |

### D-5. 철도 · 트럭 · 물류 (개별사)

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `stb_rail_service_weekly` | **STB EP 724 Class I 철도 주간 서비스·물동량 (철도사별)** | 속도(mph)·체류(h)·온라인 화차·**22개 품목 주간 카로드**·곡물·석탄, 주간 수, **2017-03-29~ 한 파일** | 기존 `aar_weekly_rail`(합계·헤드라인·재배포 불명)의 **공공·철도사별·품목별 대체**. UNP·CSX·NSC·BNSF·CN·CPKC 를 같은 포맷으로 | `UNP`, `CSX`, `NSC`, `CP`, `CNI`; 석탄·곡물·화학 화주 | 목록 `https://www.stb.gov/reports-data/rail-service-data/` → `https://www.stb.gov/wp-content/uploads/files/rsir/All%20Class%201%20Railroads/EP724%20Consolidated%20Data%20through%202026-09-16.xlsx` (**파일명에 날짜 → 목록에서 링크 추출**, 7.7MB, 시트 1개, 3,839행×501열; 컬럼 `Railroad/Region, Category No., Sub-Category, Measure, Variable, Sub-Variable, 주차별 날짜…`). 철도사별 파일도 같은 폴더 | 없음 | **공공(미 연방 STB)** | **A** | **F** — 2026-09-16 주차까지. 예: BNSF 인터모달 평균속도 30.8mph(전주 30.3). 카테고리 11 = "Weekly Carloads By 22 Commodity Categories" |
| `cn_weekly_carloads` | CN 주간 카로드(AAR 품목군)·RTM | 량·백만 RTM, 주간 | 캐나다 곡물·포타시·원유 철도 물동 | `CNI`, `CP`, `NTR`, `MOS` | `https://www.cn.ca/-/media/files/investors/investor-performance-measures/weekly-volume-summary.xlsx` (고정 URL; 시트 `AAR 2026`…`AAR 2022`, `Summary`). 서비스 지표 `…/perf_measures_en.xlsx` | 없음 | 인용·출처 표기 | **A−** | **F** — 2026 36주차 RTM 4,434M(1주차 4,670M) |
| `csx_weekly_service` | CSX 주간 서비스 지표 (TPC·체류·온라인 화차·속도) | %, h, 주간, 2016~ | 정시성 악화 = 비용 증가·물량 이탈 선행 | `CSX`, `NSC`, `UNP` | 목록 `https://investors.csx.com/metrics/default.aspx` → `//s2.q4cdn.com/859568992/files/doc_downloads/metrics/2026/09/Historical_Data_Week_37_2026.xlsx`, `…/Combined-Intermodal-and-Carload-TPC-Week-1-2022-Week-37-2026.xlsx` (주차가 파일명에 → 목록에서 추출) | 없음 | 인용 | B | **F** — 2026 W37 TPC 77.9%(W36 79.2%). NS: `norfolksouthern.investorroom.com/weekly-performance-reports`(xlsx·월간 AAR PDF 링크 확인, F). **UNP IR 은 403** → STB 파일로 대체 |
| `ltl_monthly_updates` | LTL 3사 월중 업데이트 (ODFL·XPO·SAIA: LTL 톤/일·출하/일·톤당 운임 y/y) | %, 분기 중 2회(2·3번째 달 초), 8-K 7.01/8.01 | 미국 산업·소매 화물의 가장 빠른 상장사 실측. 세 회사가 **같은 날(2026-09-03)** 제출 | `ODFL`, `XPO`, `SAIA`, `FDX`, `KNX`, `JBHT` | submissions: `CIK0000878927`(ODFL) `CIK0001166003`(XPO) `CIK0001177702`(SAIA) → EX-99.1 (`odfl-ex99_1.htm`) | 없음 | 공공(SEC)·인용 | **A−** | **F**(ODFL 09-03) — QTD LTL 출하/일 −2.4%, 중량/출하 +1.7%, cwt당 매출 +11.3%(유류할증 제외 +4.8%). XPO·SAIA 는 제출 사실만 확인 |
| `eia_diesel_retail` | 미국 주간 경유 소매가 (= UPS·FDX 유류할증료의 입력값) | USD/gal, 주간 월 | UPS·FedEx 지상 유류할증료 표는 **EIA 전국 경유가의 구간 함수**. 두 회사 표 페이지는 JS 셸(UPS 251B, FedEx 886B)이라 직접 수집 불가 → 입력값을 쓰는 편이 정확 | `UPS`, `FDX`, `ODFL`, `KNX`, `JBHT` | FRED `fredgraph.csv?id=GASDESW&cosd=2026-01-01` 또는 EIA v2 `petroleum/pri/gnd` (`EMD_EPD2D_PTE_NUS_DPG`) | FRED 없음 / EIA 키 | 공공 | **A** | **F** — 2026-09-14: $6.285/gal |
| (헤드라인) | ACT Research · FTR Class 8 주문 | 대, 월 초 | `PCAR`, `CMI` 선행 | `PCAR`, `CMI` | `actresearch.net/resources/press-releases` **404**(경로 변경), `ftrintel.com/news` 200 이나 수치는 개별 글. 데이터 본체 유료 | — | 인용 | C/D | S. DAT `dat.com/trendlines` 는 200 이나 본문이 "March 2026" 에서 멈춰 보임 → 비권장. FreightWaves SONAR 는 유료(D) |

### D-6. 건설 · 산업재 · 철강

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `census_datacenter_construction` | **미국 데이터센터 건설지출 (Census C30, 민간 SAAR)** | USD 백만(연율), 월 1영업일, 2014~ | AI 설비투자의 **공식 월간 실측**. FRED 에는 없고 Census xlsx 에만 있는 열 | `VRT`, `ETN`, `PWR`, `EME`, `FIX`, `STRL`, `MTZ`, `DLR`, `EQIX`, `GEV`, `ANET`; `LS ELECTRIC`(010120), `HD현대일렉트릭`(267260), `효성중공업`(298040) | `https://www.census.gov/construction/c30/xlsx/privsatime.xlsx` (고정 URL, 196KB, 시트 `Private SA`, 헤더 4행째, **열 인덱스 9 = `Data center`**, 행은 최신월부터 `Jul-26p`) | 없음 | 공공(Census) | **A** | **F** — 2026-07p $75,166M, 6월r $70,755M, 5월r $65,688M, 4월 $61,859M (3개월에 +21%) |
| `census_construction_by_type` | 건설지출: 제조업·전력·상업·오피스 | USD 백만(연율), 월간, 2002~ | 리쇼어링(제조)·전력망 투자 추적 | `CAT`, `URI`, `VMC`, `MLM`, `PWR`, `FLR`, `J`, `ACM` | FRED `TLMFGCONS`(제조, 실재 확인) · `PRMFGCONS`(민간 제조) · `TLPWRCONS`(전력) · `TLCOMCONS`(상업) · `TLOFCONS`(오피스) — `fredgraph.csv?id=…&cosd=…` | 없음 | 공공 | **A** | **F** — 2026-07: 제조 $169,795M(2025-01 $237,485M 에서 **−28%**), 전력 $181,532M, 상업 $122,510M, 오피스 $140,064M |
| `dodge_momentum_index` | Dodge Momentum Index (비주거 계획 단계, 데이터센터 언급) | 지수(2000=100), 매월 ~5영업일 | 건설지출을 12개월 선행. 데이터센터 계획 둔화 여부가 본문에 나온다 | `CAT`, `URI`, `VMC`, `MLM`, `EME`, `FIX` | 목록 `https://www.construction.com/category/dodge-momentum-index/` → `https://www.construction.com/dodge-momentum-index-flat-in-august/` 본문 정규식 `to ([\d.]+) \(2000=100\)` | 없음 | ©Dodge — 헤드라인 인용 | B | **F** — 2026-08: 282.0(−0.4% m/m, 7월 283.0 하향수정), 상업 −3.0%, 기관 +4.9%, y/y +4.2% |
| `abc_backlog_indicator` | ABC 건설 수주잔고 지표 | 개월, 매월 중순 | 시공사 일감. "회원 6곳 중 1곳이 데이터센터 시공 중"(역대 최고) 같은 문구 | `EME`, `FIX`, `PWR`, `MTZ`, `STRL`, `FLR` | `abc.org/News-Media/Construction-Economics/Construction-Backlog-Indicator` **403** → GlobeNewswire 릴리스(타임아웃) | 없음 | 인용 | B(차단) | **S** — 2026-08: 8.5개월(7월 저점에서 반등) |
| `aia_abi` | AIA/Deltek Architecture Billings Index | 지수(50 기준), 매월 ~4주차 | 비주거 건설을 9~12개월 선행 | `CAT`, `URI`, `VMC`, `MLM`, `J`, `ACM` | `aia.org/resource-center/abi` **403** | 없음 | ©AIA — 인용 | B(차단) | **S/U** — 2026-07분 "modest decline"(archpaper 08월 기사). 검색 요약이 준 47.2 는 연도 불명이라 **채택하지 않음** |
| `aisi_weekly_raw_steel` | AISI 주간 조강 생산·가동률 | 천 net ton·%, 주간 월 | 미국 철강 수요·가격의 주간 실측. 철강 PPI(월)보다 빠름 | `NUE`, `STLD`, `CLF`; `POSCO홀딩스`(005490), `현대제철`(004020) | `https://www.steel.org/industry-data/` HTML 본문 (정규식 `week ending on (.+?), domestic raw steel production was ([\d,]+) net tons while the capability utilization rate was ([\d.]+) percent`) | 없음 | ©AISI — 헤드라인 인용·적립 | B | **F** — 2026-09-12 주: 1,900,000 net ton, 가동률 82.3%(전주 1,808,000·78.3%, 전년 78.4%), YTD 66,537,000(+5.5%) |
| (분기) | Caterpillar 딜러 소매판매 통계 | %, 분기(실적과 함께 8-K) | — | `CAT` | Q4 피드 `investors.caterpillar.com` 동작(F) 하나 2026년 목록에 월간·3개월 롤링 소매통계 릴리스 **없음** → 분기 전환으로 판단 | — | — | B | F(목록) |

### D-7. 전력 · 원전 · 유틸리티

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `nrc_reactor_status_daily` | **NRC 일일 원자로 출력 현황 (호기별 %)** | %, 매일, 최근 365일 파일(그 이전은 연도별) | 호기 단위 계획·불시 정지. 원전 보유사(CEG·VST·TLN)의 분기 발전량을 일 단위로 추정 | `CEG`, `VST`, `TLN`, `NRG`, `PEG`, `D`, `DUK`, `SO`, `NEE`, `XEL`, `BWXT`; `두산에너빌리티`(034020), `한전KPS`(051600), `한전기술`(052690) | `https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactorstatusforlast365days.txt` (→ `…/documents-reports/…/PowerReactorStatusForLast365Days.txt` 로 301). 파이프 구분 `ReportDt|Unit|Power`, 34,770행. **브라우저 UA 는 403, `Mir_US_Stocks research …` 같은 식별 UA 는 200** | 없음 | 공공(NRC) | **A** | **F** — 2026-09-16: Arkansas Nuclear 1·2, Beaver Valley 1·2, Braidwood 1·2 100% 등 |
| `eia_nuclear_outages` | EIA 일일 원전 정지 용량 (전국·**발전소별**) | MW·%, 매일, 2007~ | NRC % 를 MW 로 환산한 공식 집계. 가을·봄 재장전 시즌의 가스 수요 영향 | 위와 같음 + `EQT`, `EXE` | `https://api.eia.gov/v2/nuclear-outages/us-nuclear-outages/data/?api_key=KEY&frequency=daily&data[0]=outage&data[1]=percentOutage&data[2]=capacity&sort[0][column]=period&sort[0][direction]=desc&length=30` (발전소별: `/facility-nuclear-outages/`, `/generator-nuclear-outages/`). **curl 은 `-g` 필요(대괄호)** | EIA 키(레포 보유) | 공공 | **A** | **F** — 2026-09-15: 정지 7,572.6MW(7.76%), 용량 97,620.5MW; Browns Ferry 1,227.4MW 정지 |
| `caiso_oasis_load` | CAISO 시간별 실제 부하·예측 (OASIS) | MW, 시간별, 수년 | 캘리포니아 전력수요·태양광 덕커브. EIA-930 보다 세분 | `VST`, `NRG`, `CEG`; 유틸 전반 | `https://oasis.caiso.com/oasisapi/SingleZip?queryname=SLD_FCST&market_run_id=ACTUAL&startdatetime=20260915T07:00-0000&enddatetime=20260916T07:00-0000&version=1&resultformat=6` → zip 안 CSV (`TAC_AREA_NAME, MW`). `http://` 는 타임아웃, **`https://` 만 동작**. 요청 간 5초 이상 간격 권장(문서) | 없음 | 공개(CAISO) | **A** | **F** — 2026-09-15 파일 수신(7.4KB) |
| `pjm_dataminer2` | PJM Data Miner 2 (부하예측·LMP·발전믹스) | MW·$/MWh, 5분~일 | 데이터센터 밀집 지역(도미니언 존) 부하·가격 | `CEG`, `VST`, `TLN`, `NRG`, `PEG`, `D`, `ETN`, `GEV` | `https://api.pjm.com/api/v1/load_frcstd_7_day?rowCount=…` — **키 없이는 403**. 무료 계정 가입 후 `Ocp-Apim-Subscription-Key` 헤더(비회원 분당 6회 제한 — 문서 기준) | **무료 키 필요** | PJM 약관(재배포 조항 확인 필요) | A(키) | **F(403 확인)** / 키 발급 후 동작은 **S** |
| `ercot_large_load_queue` | ERCOT 대형부하(데이터센터) 연계 대기열 | GW, 월간(TAC 보고·ERCOT Monthly PDF) | 텍사스 데이터센터 전력 수요 파이프라인 | `VST`, `NRG`, `TLN`, `GEV`, `ETN`, `PWR` | `ercot.com` 전체가 **Incapsula 403**(대시보드 JSON·`/files/docs/…pdf` 모두). 공식 공개 API(`apiexplorer.ercot.com`)는 가입+키 | 키(가입) | 공개 | B(차단) | **S** — 2026-04 월간보고: 대형부하 신청 445.8GW(2033년까지), 그중 321GW 는 스터디 미제출, 승인 ~9.0GW, 실측 피크 ~3.9GW |
| (연간) | LBNL "Queued Up" 계통연계 대기열 | GW, 연 1회 | 발전·저장 파이프라인 | `GEV`, `PWR`, `FSLR`, `NEE` | `emp.lbl.gov/queues` **403** | — | 공개 | B(차단) | F(차단). 연간이라 우선순위 낮음 |

### D-8. 헬스케어

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fda_novel_approvals` | FDA 신약(NME·신규 생물의약품) 승인 목록 | 건, 수시(주 단위), 연도별 페이지 2015~ | 연간 승인 페이스(바이오 센티먼트) + 개별 승인 이벤트를 종목에 태그 | `LLY`, `PFE`, `MRK`, `ABBV`, `VRTX`, `REGN`, `AMGN`, `GILD`, `BMY`, `BIIB`; `삼성바이오로직스`(207940), `셀트리온`(068270) | `https://www.fda.gov/drugs/novel-drug-approvals-fda/novel-drug-approvals-2026` HTML 표(`No., Drug Name, Active Ingredient, Approval Date, FDA-approved use`). **브라우저 UA 는 `abuse-detection-apology` 로 튕기고(404), 식별 UA 는 200** | 없음 | 공공(FDA) | **B+** | **F** — 2026 누계 40건; #40 Pixclara(09-11), #39 Isembyld(apitegromab, 09-11), #38 Etcamah(camizestrant, 09-04) |
| `openfda_drugsfda` | openFDA Drugs@FDA (신청번호·스폰서·제출 이력) | 건, 주간 갱신 | 스폰서(회사)별 승인·보충 이력. 위 목록의 기계가독 보완 | 위와 같음 | `https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_type:ORIG+AND+submissions.submission_status:AP+AND+submissions.submission_status_date:[20260801+TO+20260917]&limit=100` (curl `-g`). **중첩 배열이라 조건이 서로 다른 submission 에 걸려도 매치된다**(이번 조회 total 430 은 과대) → 받아서 클라이언트에서 `ORIG & AP & 날짜` 재필터. 기존 설계 문서가 지적한 "supplement 부풀림"과 같은 함정 | 없음(키 있으면 한도↑) | 공공(CC0) | **A** | **F** — `meta.last_updated` 2026-09-16; 예: NDA220934 ELI LILLY "FOUNDAYO" |
| `cdc_nhsn_hospital_capacity` | CDC NHSN 주간 병원 병상·ICU 점유 (전국·주별) | 병상 수, 주간, 2024-11~ (의무보고 재개분) | 병원 이용률 = 병원주 물량·보험사 의료비(MLR) 압력의 주간 프록시. HHS Protect(`healthdata.gov g62h-syeh`)는 **2024-04-27 에서 종료**된 것을 확인 | `HCA`, `THC`, `UHS`, `CYH`, `UNH`, `HUM`, `ELV`, `CNC`, `CI` | Socrata `https://data.cdc.gov/resource/ua7e-t2fy.json?$limit=1&$order=weekendingdate DESC&jurisdiction=USA` (필드 `numinptbeds`, `numinptbedsocc`, `numicubeds`, `numicubedsocc`, `totalconfc19hosppats`…) | 없음(앱토큰 선택) | 공공(CDC) | **A** | **F** — 2026-09-05 주: 입원병상 662,427 중 492,625 점유(**74.4%**), ICU 99,759 중 69,941(70.1%), 코로나 입원 2,730 |
| (연간) | CMS Part D 약품별 지출 대시보드 | USD, 연 1회 | — | `LLY`, `NVO`, `ABBV` | `data.cms.gov/…/medicare-part-d-spending-by-drug` 200(SPA 셸 827B, 데이터는 API). 연간이라 "선행" 목적에 부적합 → 넣지 않음 | — | 공공 | A(연간) | F(셸) |
| (없음 확인) | 메드테크 수술 건수 무료 프록시 | — | — | `ISRG`, `SYK` | 무료 1차 출처 없음(Strata·Definitive 유료). 위 병상 점유율이 유일한 무료 근사 | — | — | D | S |

### D-9. 미디어 · 테크 소비

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `netflix_top10_weekly` | Netflix 공식 Top 10 (글로벌 시청시간·조회수, 국가별 순위) | 시간·views, 주간 화, 2021-06~ | 흥행작 집중도·한국 콘텐츠 순위 → 제작사 주가 이벤트 | `NFLX`, `DIS`, `WBD`; `스튜디오드래곤`(253450), `CJ ENM`(035760) | `https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv` (0.9MB; `top10.netflix.com/data/…` 도 동일 응답). 컬럼 `week, category, weekly_rank, show_title, season_title, weekly_hours_viewed, runtime, weekly_views, cumulative_weeks_in_top_10`. 국가별 `…/all-weeks-countries.tsv` 는 **32MB** → 한국(`KR`)만 필터해 저장. 누적 `…/most-popular.tsv` | 없음 | Netflix 공개 다운로드(명문 라이선스 없음) — 출처 표기·집계 | **A−** | **F** — 2026-09-13 주: 영어 영화 1위 "Why Did I Get Married Again?" 35.7M시간·19.3M views |
| `apple_appstore_top_charts` | Apple 앱스토어 무료·유료 톱차트 (국가별) | 순위, 하루 수회 갱신(스냅샷 → 적립) | 앱 순위 = 다운로드 모멘텀. ChatGPT·Temu·Threads 류의 급등 포착. KR 스토어도 같은 API | `AAPL`, `META`, `GOOGL`, `MSFT`, `RBLX`, `DUOL`, `SPOT`, `UBER`, `DASH`, `RDDT`; `NAVER`(035420), `카카오`(035720) | `https://rss.marketingtools.apple.com/api/v2/us/apps/top-free/50/apps.json` (요청한 `rss.applemarketingtools.com` 은 여기로 301). `top-paid`, 국가 `kr`, 개수 10/25/50/100 | 없음 | ©Apple RSS — 순위·앱명 표시, 아이콘 재호스팅 금지 | **A** | **F** — 2026-09-17 06:15 UTC 갱신, US 무료 1위 ChatGPT(OpenAI). `top-paid/10`, `kr/top-free/10` 도 200. (top-grossing 은 v2 에 없음) |
| `roblox_ccu` | Roblox 동시접속 (게임별 + 상위 95개 합) | 명, 실시간(스냅샷 적립) | RBLX 예약(bookings)의 일 단위 프록시. 히트작 의존도 | `RBLX`, `TTWO`, `APP` | 게임별 `https://games.roblox.com/v1/games?universeIds=383310974,994732206,7436755782` → `playing`, `visits`. 상위 목록 `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=1&sortId=top-playing-now` → `games[].playerCount` | 없음 | Roblox 공개 API(비문서·약관상 자동 수집 조항 확인 필요) | B/C | **F** — 2026-09-17: Blox Fruits 195,015 / Adopt Me! 91,935 / Grow a Garden 17,776; 상위 95개 합 3,821,640. (RoMonitor `/api` 는 HTML 셸 → 불가) |
| `spotify_charts_weekly` | Spotify 주간 톱송 (글로벌·국가) | 순위(스트림 수는 로그인 필요), 주간 | K-pop 글로벌 순위 → 엔터주 이벤트 | `SPOT`, `WBD`; `하이브`(352820), `에스엠`(041510) | `https://charts-spotify-com-service.spotify.com/public/v0/charts` — **로그인 없이 200**(순위·곡·아티스트). 스트림 수·CSV 는 로그인 필요. 비문서 내부 엔드포인트 | 없음 | Spotify 약관상 스크래핑 제한 → 표시 최소화 | C/X | **F** — 2026-09-10 `REGIONAL_GLOBAL_WEEKLY` 수신(12KB) |
| `twitch_viewership` | Twitch 동시 시청자 (제3자) | 명, 실시간 | 게임 라이브 시청 = 신작 흥행 프록시 | `AMZN`, `TTWO`, `RBLX`; `크래프톤`(259960) | `https://twitchtracker.com/statistics` HTML (SullyGnome 은 403) | 없음 | 제3자·불명 | C | **F** — 2026-09-17: 현재 1,063,016명, 7일 평균 2,089,578명, 라이브 채널 59,748 |

### D-10. 소매 · 외식 · 소비

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `costco_monthly_sales` | Costco 월간 매출·동일점포(미국·캐나다·해외·디지털) | USD·%, 매월 첫 수요일경(4·5주 소매월), 장기 | **월간 동일점포를 아직 내는 유일한 대형 소매**. 유가·환율 제외 수치도 함께 | `COST`, `WMT`, `TGT`, `TJX`, `AMZN` | Q4 피드 `https://investor.costco.com/feed/PressRelease.svc/GetPressReleaseList?...&bodyType=2` 헤드라인 `Reports \w+ Sales Results` → `Body` 표 | 없음 | 인용 | **B+** | **F** — 2026-08(4주, ~08-30): 순매출 $23.70B(+9.9%); comps 미국 9.0%·캐나다 4.0%·해외 9.5%·전사 8.4%·디지털 17.9%. FY26 순매출 $297.3B(+10.2%) |
| (없음 확인) | 기타 월간 동일점포 공시 회사 | — | — | — | `BKE`(Buckle): 2026-06 이후 8-K 에 월간 매출 없음(09-15 8.01 1건뿐), `CATO`: 분기만. EDGAR FTS `"comparable sales"` 8-K 2026-09 21건은 **전부 분기 실적(2.02)**. → 월간 comps 는 사실상 COST 뿐 | — | — | — | **F** |
| `nrf_port_tracker` | NRF Global Port Tracker (미국 수입 TEU 실적+6개월 전망) | 백만 TEU, 매월 ~8~10일 | 소매 재고 선적의 **전망치** — 기존 `descartes_us_import_teu`(실적)와 짝 | `WMT`, `TGT`, `COST`, `HD`, `AMZN`, `UPS`, `FDX`; `HMM`(011200) | 목록 `https://nrf.com/media-center/press-releases` (200, 69KB — 다만 정적 HTML 에서 Port Tracker 문구 추출 실패, JS 렌더 추정) → 개별 `…/press-releases/import-cargo-s-peak-season-not-over-yet`. 요청에 있던 `nrf.com/research-insights/global-port-tracker` 는 **404** | 없음 | ©NRF/Hackett — 헤드라인 인용 | B | **S** — 2026-09 전망 2.31M TEU(+9.6% y/y, 연중 최대; 전월 전망 2.16M 에서 상향) |
| (헤드라인) | Adobe Digital Economy Index · Mastercard SpendingPulse | %, 월간·이벤트(블프·사이버먼데이) | 온라인 소비·이벤트 데이터 | `AMZN`, `SHOP`, `ADBE`, `MA`, `V` | `mastercardservices.com/…/spendingpulse` **403**. 둘 다 보도자료 헤드라인만 무료, 시계열 유료 | — | 인용 | C/D | F(403)/U. 기존 `bofa_consumer_checkpoint` 와 중복 성격 → 이벤트 시즌(11월)에만 수동 카드로 |

---

### D-실패 · 차단 · 미확인 목록 (실측)

| 대상 | 응답 | 메모 |
| :--- | :--- | :--- |
| `cmegroup.com` (보도자료·거래량) | **403 + JSON 본문으로 "스크래핑 의심 IP 차단, 약관상 봇 금지" 명시** | 우회 시도하지 않음. PR Newswire 경로만 사용. 기존 `comex_warehouse_stocks`(P2)도 같은 이유로 **X 로 내리는 것을 권고** |
| `investor.cmegroup.com`, `cmegroupinc.gcs-web.com/monthly-volume` | 403 | Akamai |
| `www.aboutschwab.com/monthly-activity-report` | 403 (curl·WebFetch) | `pressroom.aboutschwab.com` Q4 피드는 정상 |
| `investors.robinhood.com` | 403 / WebFetch DNS 실패 | 8-K 도 없음 → 통신사 경로뿐 |
| `www.globenewswire.com` | curl HTTP 000(타임아웃) 2회 | Actions 러너에서 재시험 필요 |
| `ir.nasdaq.com/financials/volume-statistics` | 403; `investor.nasdaq.com` DNS 실패 | Nasdaq 월간 거래량은 **U** (Cboe CSV 가 Nasdaq 거래소 점유율을 대신 준다) |
| `www.interactivebrokers.com/en/general/about/monthly-metrics.php` | 404 | `investors.` 호스트의 같은 경로는 200 |
| `boeing.com/commercial/orders-deliveries` | 404 | `#/orders-deliveries` 해시 라우트라 서버에는 없음 → Tableau CSV 로 해결 |
| `airbus.com …/orders-and-deliveries` | 200 이나 JS 챌린지(본문 955B) | xlsx URL 미확인 |
| `www.war.gov/News/Contracts/…/Article/…` | 403 (모든 UA) | RSS 만 가능 |
| `www.dsca.mil/Press-Media/Major-Arms-Sales` | 403 (브라우저 UA) | RSS 는 식별 UA 로 200, 단 최신 항목 2026-02-06 |
| `ir.nio.com`, `ir.xiaopeng.com`, `ir.lixiang.com`, `ir.tesla.com`, `ir.lucidmotors.com` | 403 | SEC 6-K/8-K 로 대체 |
| `www.anl.gov` (Argonne EV 판매) | 403 Cloudflare | |
| `developer.nrel.gov` | 타임아웃 | `developer.nlr.gov` 로 이전됨 |
| `investor.unionpacific.com`, `www.up.com/investor/aar-stb_reports` | 403 | STB EP724 로 대체 |
| `investor.cpkcr.com/key-metrics` | 타임아웃 | STB 파일에 CPKC 포함 |
| UPS·FedEx 유류할증료 페이지 | 200 이나 JS 셸(251B / 886B) | EIA 경유가로 대체 |
| `actresearch.net/resources/press-releases` | 404 | |
| `api.pjm.com` | 403 (키 없음) | 무료 키 발급 필요 |
| `www.ercot.com` (대시보드 JSON·PDF) | 403 Incapsula | |
| `oasis.caiso.com` `http://` | 타임아웃 | `https://` 는 정상 |
| `emp.lbl.gov/queues` | 403 | |
| `fda.gov` 브라우저 UA | `abuse-detection-apology` 404 | 식별 UA 로 200 |
| `nrc.gov` 브라우저 UA | 403 | 식별 UA 로 200 |
| `healthdata.gov g62h-syeh` | 200 이나 **데이터가 2024-04-27 에서 종료** | CDC NHSN `ua7e-t2fy` 로 대체 |
| `aia.org`, `abc.org`, `cruising.org`, `gaming.ny.gov/revenue-reports`, `mastercardservices.com`, `sullygnome.com` | 403 | NY 주 모바일 스포츠베팅 주간 보고(`DKNG` 용)는 그래서 **U** |
| `njoag.gov …monthly-press-releases…` | 404 (경로 추정 실패) | NJ DGE 월간은 **U** |
| `romonitorstats.com/api/…` | HTML 셸 | Roblox 공식 API 로 대체 |
| `hyundainews.com/releases/{id}` | JS 셸 1.4KB | PR Newswire 로 대체 |
| `fred.stlouisfed.org/graph/fredgraph.csv?id=X` (`cosd` 없음) | 타임아웃 2회 | `&cosd=` 를 붙이면 즉시 200 |
| EDGAR FTS 연속 호출(0.3초 간격) | 비JSON 응답 4회 | 1~2초 간격 + 재시도 |
| DNS 간헐 실패 | `investors.sands.com`, `ir.buckle.com` 등 `getaddrinfo failed` | 이 PC 회선(KT DNS) 문제일 수 있음 — LVS·WYNN 은 어차피 월간 공시 없음 |
| Coinbase 월간 지표 | 없음(회사가 공시하지 않음) | 요청서의 "없음 확인"과 일치 — 8-K 목록에도 없음은 별도 확인하지 않음(**S**) |

### D-바로 구현 가능한 상위 10개 (키 없음·고정 경로·값 확인 완료 순)

| 순위 | 지표 ID | 이유 | 구현 메모 |
| :--- | :--- | :--- | :--- |
| 1 | `census_datacenter_construction` | AI 설비투자의 공식 월간 실측, 고정 URL xlsx 1개, 공공 | `privsatime.xlsx` 열 9. `openpyxl` 없으면 zip+xml. FRED 5종(`TLMFGCONS` 등)을 같은 빌더에 |
| 2 | `nrc_reactor_status_daily` + `eia_nuclear_outages` | 파이프 텍스트 1개 + EIA 키 재사용. 호기→모회사 매핑표만 만들면 CEG·VST·TLN 종목 패널에 바로 | **식별 UA 필수**(브라우저 UA 는 403). 호기별 소유주 매핑은 EIA-860 또는 수작업 94행 |
| 3 | `macau_ggr_monthly` | XML 한 줄, 2005~ 연도별, 매월 1일 발표일 이벤트성이 큼 | `report_en.xml` 의 `-` 는 미발표월 → skip |
| 4 | `boeing_orders_deliveries` | Tableau CSV 2개. 엔진 컬럼으로 GE·RTX 태그 | 인도는 연 단위 누계라 **매일 받아 YTD 차분을 적립**. 워크북명 변경 대비해 `boeing.com/commercial` 의 `<param name='name'>` 재탐색 폴백 |
| 5 | `stb_rail_service_weekly` | 공공·철도사별·품목별·2017~ 한 파일. AAR 재배포 문제 해소 | 7.7MB xlsx 를 매주 받아 필요한 행(카테고리 1·2·3·11)만 JSON 으로. 파일명 날짜는 목록 페이지에서 추출 |
| 6 | `card_master_trust_monthly` + `pgr_monthly_results` + `ivz_monthly_aum` + `ltl_monthly_updates` | 전부 **EDGAR submissions → index.json → EX-99** 한 패턴. `sec_client.py` 재사용 | 회사별 정규식 5~6개. 7.01 인데 컨퍼런스 참가 안내인 경우(COF 사례)를 본문 키워드로 걸러야 함 |
| 7 | `china_ev_startups_monthly` | 6-K 본문 정규식 1개로 3사. IR 사이트 403 을 완전히 우회 | 매월 1~3일에만 submissions 폴링 |
| 8 | `q4_monthly_kpi_feed` (= `cboe_monthly_volume`·`ice_monthly_statistics`·`schw_monthly_activity`·`costco_monthly_sales`) | Q4 피드 1개 함수 + 호스트·헤드라인 정규식 테이블 | `Body` 에서 CSS 제거 후 수치 정규식. 실패 시 기존 값 유지. `tw_monthly_adv` xlsx, `cboe_us_equities_market_share` CSV 를 같은 빌더에 |
| 9 | `cdc_nhsn_hospital_capacity` + `fda_novel_approvals` + `openfda_drugsfda` | 헬스케어 카테고리를 키 없이 3개로 채움 | openFDA 는 클라이언트 재필터 필수. FDA 페이지는 식별 UA |
| 10 | `netflix_top10_weekly` + `apple_appstore_top_charts` + `afdc_ev_charging_ports` + `aisi_weekly_raw_steel` | 전부 고정 URL. 스냅샷 적립형(`data/industry_archive/{id}.json` 규약 그대로) | Netflix 국가별 32MB 는 KR 만 필터. AFDC 는 무료 키 발급(`DEMO_KEY` 는 5회 안쪽에서 한도) |

#### 구현 시 공통 주의
1. **UA 가 사이트마다 반대로 작동한다.** 미 연방 Akamai 계열(NRC·FDA·DSCA)은 브라우저 UA 를 막고 식별 UA(`Mir_US_Stocks research <email>`)를 통과시킨다. 반대로 Q4·Cboe·Tradeweb·PR Newswire 는 브라우저 UA 가 필요하다. 빌더에 `ua_mode: "ident" | "browser"` 를 소스별로 둘 것.
2. **파일명에 날짜·해시가 들어가는 소스**(STB, CSX, Tradeweb, LVCVA, 네바다 GCB, HKIA)는 반드시 목록 페이지에서 링크를 추출한다. URL 을 조립하지 말 것.
3. 이 조사는 **한국 회선**에서 했다. GitHub Actions(미국 Azure IP)에서는 차단 양상이 다를 수 있다(과거 Polymarket 451 사례의 반대 방향도 가능). 1차 구현은 `continue-on-error` + "실패 시 기존 파일 유지".
4. 월간 공시가 **사라지는 추세**다(MKTX 2026-07 중단, ALGT 2026-01 중단, BKE·CAT 월간 종료, HOOD·COST·SCHW 의 8-K 미제출). 각 지표에 `lastSeen` 을 기록해 45일 이상 갱신이 없으면 신뢰도 센터에 "공시 중단 의심"으로 띄우는 것을 권한다.
5. 보도자료 수치는 **헤드라인 1~5개 값 + 출처 링크**만 적립한다. 표 전체·PDF 재호스팅 금지. 회사가 정정 공시를 내는 경우(LVCVA `r` 표시, Census `r`/`p`)를 위해 같은 기간 값은 최신 파일로 덮어쓴다(적립형의 "같은 날짜 skip" 규약의 예외).
6. 검색 스니펫으로만 확인한 값(S)은 **대시보드 초기값으로 쓰지 말 것** — AIA ABI 47.2 처럼 연도가 불명확한 값이 섞여 있었다.


---

## E. 테크·AI·인터넷·크립토 대체 데이터


- 조사일: 2026-09-17 (KST), 조사 PC(한국 가정용 IP)에서 `curl`/WebFetch 로 실호출.
- 검증 표기: **F** = 응답을 직접 받아 값 확인, **S** = 공식 문서·검색 스니펫만, **U** = 미확인.
- 등급: A=공식 무료 API(JSON/CSV) · B=공식 HTML·파일 파서 필요 · C=프록시·제3자 · D=유료 · X=재배포 금지/약관 위반.
- 중복 제외: `INDUSTRY_INDICATORS_DESIGN.md` 에 이미 있는 Cloudflare Radar AI 봇, Steam 설문·동접, GPU 임대가, DefiLlama 스테이블코인, Farside, 코인베이스 프리미엄, CoinGecko 시총, Indeed 구인 / 레포에 구현된 위키 페이지뷰·WSB·CNN F&G·USASpending 은 적지 않았다. Google Trends·openFDA·특허·로비는 새 근거가 없어 제외.
- 연관 종목은 모두 `data/details/<TICKER>.json`(US)·`data/korea/details/<코드>.json`(KR) 존재를 확인한 것만 적었다. **없어서 뺀 티커**: `CFLT`, `PSTG`, `ARKK`, `ARKW`, `HCP`, `SQ`(→`XYZ` 있음), `FI`, `U`.
- 이 PC 의 DNS 가 일부 호스트(pypistats.org 1차, tranco-list.eu, beaconcha.in, accounts.profunds.com, www.proshares.com)를 간헐적으로 못 풀었다. 그런 곳은 WebFetch(서버측 페치)로 대신 확인했고 표에 적었다 — 소스 장애가 아니라 조사 환경 문제다.
- "러너 위험" = GitHub Actions(미국·Azure 데이터센터 IP)에서 막힐 가능성. 이번 조사는 한국 IP 라서 **미국 지역차단(451/403)은 직접 재현하지 못했다.** 해당 항목은 구현 시 첫 실행 로그로 확인해야 한다.

---

### E-1. 개발자 채택 → 소프트웨어·AI 인프라 주식

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pypi_downloads_clickpy` | PyPI 패키지 일별 다운로드 (ClickPy 공개 ClickHouse) | 건/일, 일간, 2016~ | AI SDK·DB 드라이버 채택 속도. `openai`·`anthropic`·`torch`·`transformers`·`pymongo`·`snowflake-connector-python`·`datadog`·`elasticsearch`·`confluent-kafka` 를 한 SQL 로 | `MDB`, `SNOW`, `DDOG`, `ESTC`, `NVDA`, `AMD`, `MSFT`, `GOOGL` | `POST https://sql-clickhouse.clickhouse.com/?user=demo` 본문 `SELECT date, sum(count) c FROM pypi.pypi_downloads_per_day WHERE project='anthropic' AND date >= today()-10 GROUP BY date ORDER BY date FORMAT JSONCompactEachRow` | 없음(`user=demo`) | 원천은 PyPI 공개 BigQuery 데이터셋(공개). ClickHouse 데모 서버는 SLA·명문 재배포 조항 없음 → 집계값+출처 표기("PyPI via ClickPy") | A− | **F** `anthropic` 2026-09-16 = 5,560,004건/일, 09-13(일) 2,835,027 |
| `pypi_downloads_pypistats` | PyPI 최근 다운로드 (pypistats) | 건, 일간, 최근 180일만 | 위의 공식 폴백. 미러 제외 옵션 | 위와 같음 | `https://pypistats.org/api/packages/<pkg>/recent` , `/overall?mirrors=false` | 없음 | 서비스 etiquette: 캐시 필수, IP 당 과호출 시 429 | A | **F(429)** 첫 호출부터 `429 RATE LIMIT EXCEEDED`(DNS 도 1회 실패). 하루 1회·패키지 10개 이하로만. ClickPy 를 1순위로 |
| `npm_downloads` | npm 패키지 다운로드 | 건, 일간, 최대 18개월/요청(2015~) | JS 생태계 AI SDK·클라우드 SDK 채택. `openai`, `@anthropic-ai/sdk`, `@aws-sdk/*`, `mongodb`, `wrangler`(Cloudflare), `@datadog/browser-rum`, `next`(Vercel) | `MDB`, `NET`, `DDOG`, `AMZN`, `MSFT`, `GOOGL` | `https://api.npmjs.org/downloads/point/last-month/<pkg>` , `https://api.npmjs.org/downloads/range/last-week/<pkg>` (스코프 패키지는 `@scope/name` 그대로), 기간 `range/2026-01-01:2026-09-01/<pkg>` | 없음 | npm 공개 API(문서 github.com/npm/registry). 재배포 제한 조항 없음 | **A** | **F** `openai` 2026-08-13~09-11 = 135,719,824건. `@anthropic-ai/sdk` 09-10 = 7,276,476. **주의: 09-07·09-08 이 0 으로 옴(npm 측 집계 결손)** → 0 은 결측으로 처리 |
| `dockerhub_pulls` | Docker Hub 이미지 누적 pull 수 | 누적 건, 점값 → 일 1회 적립해 차분 | 인프라 소프트웨어의 실제 배포량. 누적치라 **직접 적립** 필요 | `MDB`(library/mongo), `DDOG`(datadog/agent), `ESTC`(elastic/elasticsearch), `GTLB`(gitlab/gitlab-ce), `NET`(cloudflare/cloudflared), `NVDA`(nvidia/cuda), `IBM`(hashicorp/terraform) | `https://hub.docker.com/v2/repositories/<ns>/<repo>/` → `pull_count`, `star_count`, `last_updated` (공식 이미지는 `library/<name>`) | 없음 | Docker Hub API 공개. 무인증 rate limit 있음(일 1회면 무관). 재배포 조항 없음 | A(점값) | **F** mongo 4,858,529,278 · datadog/agent 11,278,086,039 · elasticsearch 26,804,009 · gitlab-ce 387,797,070 · cloudflared 219,771,187 · terraform 493,904,479 · nvidia/cuda 123,238,822 · ollama 175,896,595 · vllm-openai 35,574,469 |
| `github_repo_momentum` | GitHub 스타·포크·릴리스 | 개, 점값 → 적립 | 오픈소스 AI 스택(vLLM·ollama·llama.cpp·pytorch·langchain) 관심도. 릴리스 주기 | `NVDA`, `AMD`, `META`, `GTLB`, `MSFT` | `https://api.github.com/repos/<owner>/<repo>` (`stargazers_count`,`forks_count`), `/releases/latest` | 무인증 60회/시(IP 공유). **Actions 에서는 `GITHUB_TOKEN` 으로 1,000회/시** | GitHub API 약관: 공개 메타데이터 집계 허용 | **A** | **F** 첫 호출 200, 이후 `API rate limit exceeded`(같은 IP 60회 소진) → 토큰 필수 |
| `hf_model_downloads` | Hugging Face 모델 다운로드 (30일·누적) | 건, 점값(30일 롤링) → 적립 | 오픈 모델 채택(메타 Llama·DeepSeek·Qwen·Mistral). 중국 모델 점유율은 NVDA 수출규제 논리의 보조 | `META`, `NVDA`, `AMD`, `GOOGL`, `MSFT`; `NAVER`(035420) | 상위: `https://huggingface.co/api/models?sort=downloads&direction=-1&limit=100` · 개별: `https://huggingface.co/api/models/<org>/<model>?expand[]=downloads&expand[]=downloadsAllTime` · 조직별 `?author=meta-llama` | 없음 | HF Hub API 공개. 메타데이터 집계 재게시 관행적 허용(명문 조항은 ToS 일반) | **A** | **F** 1위 `sentence-transformers/all-MiniLM-L6-v2` 256,481,161(30일). `deepseek-ai/DeepSeek-R1` 30일 708,642 / 누적 48,690,767 |
| `vscode_ext_installs` | VS Code 마켓플레이스 확장 설치 수 | 누적 건, 점값 → 적립 | 개발자 도구 채택: GitHub Copilot(`MSFT`), GitLab Workflow, MongoDB, Snowflake, Datadog, HashiCorp Terraform 확장 | `MSFT`, `GTLB`, `MDB`, `SNOW`, `DDOG` | `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` 헤더 `Accept: application/json;api-version=7.2-preview.1`, 본문 `{"filters":[{"criteria":[{"filterType":7,"value":"GitHub.copilot"}]}],"flags":256}` → `statistics[].install` | 없음 | **비문서(undocumented) API.** 마켓플레이스 ToS 는 MS 제품 내 사용 전제 → 집계 수치만·저빈도 | B/C | **F** GitHub Copilot install 74,585,661 · updateCount 579,375,312 |
| `crates_downloads` | crates.io 다운로드 | 건, 일간(90일) | Rust 생태계. 종목 매핑이 약함(보조) | `AMZN`, `MSFT`, `NET` | `https://crates.io/api/v1/crates/<name>` , `/downloads` (UA 필수, 1req/s) | 없음 | crates.io 정책: UA 에 연락처 명시 | A | **F** `tokio` 200 응답 |
| `stackoverflow_tag_volume` | Stack Overflow 태그별 질문 수 | 건/월 | **신호 소멸 확인**: 사이트 전체 2026-08 질문 수가 1,133건. AI 로 대체돼 추이 지표로 무의미. "SO 붕괴" 자체를 보여주는 1회성 차트로만 | `MSFT`, `GOOGL` | `https://api.stackexchange.com/2.3/questions?site=stackoverflow&fromdate=<epoch>&todate=<epoch>&filter=total` (`&tagged=pytorch`) · 태그 누계 `/2.3/tags/<tag>/info?site=stackoverflow` | 없음(일 300회) | CC BY-SA 4.0 | A | **F** 전체 2026-08 total=1,133 · `pytorch` 누계 23,817 |
| `homebrew_installs` | Homebrew formula 설치 수 (30/90/365일) | 건, 롤링 | 맥 개발자 CLI 채택(ollama, terraform, awscli, gh). 보조 | `MSFT`, `AMZN`, `IBM` | `https://formulae.brew.sh/api/formula/<name>.json` → `analytics.install.30d` | 없음 | BSD-2 (formulae.brew.sh 공개 JSON) | A | **F** `ollama` 200, stable 0.34.0 |

### E-2. AI 사용량·가격·연산

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `epoch_ai_chip_sales` | **Epoch AI — AI 칩 판매 추정 (칩·설계사별, 분기)** | 개·H100 환산·MW, 분기, 2022Q1~ (신뢰구간 5/95% 포함) | NVDA·AMD·구글 TPU·아마존 Trainium·화웨이 Ascend 의 **분기별 출하 추정**을 무료로. 전력(MW) 환산까지 있어 전력주 논리와 연결 | `NVDA`, `AMD`, `GOOGL`, `AMZN`, `AVGO`, `TSM`, `MU`, `VRT`; `SK하이닉스`(000660), `삼성전자`(005930) | `https://epoch.ai/data/ai_chip_sales.zip` → `timelines_by_chip.csv`, `cumulative_timelines_by_designer.csv`, `chip_types.csv` | 없음 | **CC BY 4.0** (zip 내 README 원문 확인). 표기 "Epoch AI, 'Data on AI Chip Sales'. epoch.ai" | **A** | **F** 2026-08-27 생성본. `Q3 2026 - B300` 408,897개(불완전 표기 포함), AMD 누계 2024Q1~2026Q2 1,159,316개 / 1,027MW |
| `epoch_ai_companies` | Epoch AI — AI 기업 매출(ARR)·사용자·직원·연산지출 | USD·명, 이벤트형(보도 기준) | OpenAI·Anthropic·Mistral 등 비상장 AI 매출 궤적 = 하이퍼스케일러 AI 매출·NVDA 수요의 하류 확인 | `MSFT`, `GOOGL`, `AMZN`, `NVDA`, `ORCL`, `CRWV` | `https://epoch.ai/data/ai_companies.zip` → `ai_companies_revenue_reports.csv`(68행), `ai_companies_usage_reports.csv`(49행), `ai_companies_compute_spend.csv` | 없음 | CC BY 4.0 | **A** | **F** 최신행 Mistral AI ARR $1.0B (2026-09-08), Z.ai $1.6B (08-31). 사용량 최신 ChatGPT WAU 9.2억(2026-02-28) |
| `epoch_data_centers` | Epoch AI — 프런티어 AI 데이터센터(위성·인허가 기반 전력·칩 수량) | MW·개, 수시(2026-09-16 갱신) | 개별 캠퍼스(Stargate·Colossus 등) 가동 타임라인 → 전력·냉각·네트워크 장비주 | `VRT`, `ANET`, `NVDA`, `ORCL`, `CRWV`, `NBIS`, `DELL`, `SMCI` | `https://epoch.ai/data/data_centers/data_centers.zip` → `data_center_timelines.csv`, `data_center_chip_quantities.csv` | 없음 | CC BY 4.0 | **A** | **F** zip 104KB, 7개 CSV 확인 |
| `epoch_models_compute` | Epoch AI — 주목할 AI 모델·학습 연산량 | FLOP·모델 수, 매일 갱신, 1950~ | 프런티어 학습 연산 증가율(연 ~4~5배)·조직별 모델 출시 수. 월별 "신규 대형모델 수" 집계 | `NVDA`, `GOOGL`, `META`, `MSFT` | `https://epoch.ai/data/all_ai_models.csv`(6.8MB), `notable_ai_models.csv`, `large_scale_ai_models.csv`, `ml_hardware.csv`, `gpu_clusters.csv` | 없음 | CC BY 4.0 | **A** | **F** 3,617개 모델, 최신 발표일 2026-09-15. (`ai_chip_sales.csv`·`data_centers.csv` 단일 CSV 경로는 404 — zip 만 있음) |
| `openrouter_token_price` | OpenRouter 모델별 토큰 단가 (가격 디플레이션 지수) | USD/토큰, 점값 → 적립 | 프런티어 모델 가중평균 단가 추이 = AI 추론 원가 하락 속도. **랭킹(토큰 사용량) 이 아니라 가격만** | `MSFT`, `GOOGL`, `AMZN`, `NVDA` | `https://openrouter.ai/api/v1/models` → `data[].pricing.prompt/completion`, `context_length`, `created` | 없음 | 공식 문서화된 API. ToS 의 스크래핑 금지는 "Site" 대상 — API 응답 재게시 조항은 불명 → 파생 지수만 게시 | A− | **F** 200, 모델 목록·가격 필드 확인 |
| `openrouter_rankings` | OpenRouter 모델별 토큰 사용량 랭킹 | 토큰/주 | 모델 점유율의 유일한 공개 실사용 지표이나 **API 없음**(`/rankings` 는 Next.js HTML, `/api/frontend/...` 는 HTML 반환) | — | `https://openrouter.ai/rankings` | — | **ToS §7: "scrapers, crawlers… to scrape or copy any information on the Site" 금지** (원문 확인) | **X** | **F** (약관 확인, JSON 엔드포인트 없음) |
| `lmarena_leaderboard` | **LMArena 리더보드 (공식 HF 데이터셋)** | Elo·투표수·순위, 일 단위 갱신, `latest`/`full` 스플릿 | 조직별 최고 모델 순위(구글 vs OpenAI vs Anthropic vs xAI vs 중국) — "누가 프런티어인가"의 시계열 | `GOOGL`, `MSFT`, `META`, `AMZN`; `NAVER`(035420) | `https://datasets-server.huggingface.co/first-rows?dataset=lmarena-ai/leaderboard-dataset&config=text&split=latest` · 전체는 parquet `https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset/parquet/text/latest` · 필드 `model_name, organization, rating, vote_count, rank, category` | 없음 | **CC BY 4.0** (데이터셋 태그 `license:cc-by-4.0`) | **A** | **F** lastModified 2026-09-16T03:02Z, config `text`·`agent` 등 확인. (`lmarena.ai/leaderboard` HTML 은 Next.js, 스크래핑 불필요) |
| `artificial_analysis_llm` | Artificial Analysis — 모델 지능지수·가격·속도 | 점수·USD·tok/s | 가격 대비 성능 프런티어. OpenRouter 가격의 교차검증 | 위와 같음 | `GET https://artificialanalysis.ai/api/v2/data/llms/models` 헤더 `x-api-key` | **무료 키 필요**(일 1,000회) | **출처 표기 의무**("Attribution is required for all use of our free API"), 키를 클라이언트에 넣지 말 것 → Actions 빌더에서만 | A(키) | **F** 무키 401 `API key is required`; 문서로 조건 확인 |
| `census_btos_ai_use` | **미 센서스 BTOS — 기업 AI 사용률 (격주)** | %, 격주, 2023-09~ (전국·섹터·주·고용규모) | 미국 기업의 **공식** AI 도입률. "AI 수요가 실재하는가"에 대한 정부 통계. 섹터 파일로 산업별 도입 격차 | `MSFT`, `CRM`, `NOW`, `ADBE`, `PLTR`, `AI`, `PATH`, `ACN`, `IBM` | `https://www.census.gov/hfp/btos/downloads/National.xlsx` (시트 `Response Estimates`, Question ID 7 = 최근 2주 AI 사용, 열 = `YYYYNN` 회차) · `https://www.census.gov/hfp/btos/downloads/Sector.xlsx` · AI 부록 `.../AI_Supplement_Table.xlsx` | 없음 | 미 연방 공공(퍼블릭 도메인). "실험적 데이터" 표기 | **A** | **F** 회차 202618 = **23.2%** (직전 22.4%). Sector.xlsx 200. 다운로드 페이지는 JS 앱이라 파일 URL 은 직접 추정·확인함 |
| `anthropic_economic_index` | Anthropic Economic Index (직무·과업별 Claude 사용) | 비중, 수개월 주기 | 어떤 직무가 AI 로 대체·증강되는지 → IT 서비스·BPO 주 | `ACN`, `INFY`, `CTSH`, `WIT`, `EPAM`, `GLOB` | `https://huggingface.co/api/datasets/Anthropic/EconomicIndex` (파일은 `.../resolve/main/...`) | 없음 | **MIT** (태그 `license:mit`) | A(저빈도) | **F** lastModified 2026-06-26 |
| `ai_index_mlperf_top500` | Stanford AI Index(연 1회)·MLPerf(연 2~4회)·TOP500(6·11월) | 다양, 저빈도 | 카드 1장짜리 "이벤트형". 시계열 지표로는 빈도 부족 | `NVDA`, `AMD`, `INTC`, `DELL`, `SMCI` | AI Index 공개 데이터(구글 드라이브 링크, 보고서 페이지 경유) · `mlcommons.org/benchmarks/` + GitHub `mlcommons/*_results_*` · `top500.org/lists/top500/` (xlsx 는 로그인) | — | AI Index CC BY-ND 4.0(보고서) · MLPerf 결과는 MLCommons 상표·인용 규정 · TOP500 © | B | **S** (top500.org 200 확인만) |
| `semianalysis` 외 | SemiAnalysis·Similarweb·Sensor Tower·data.ai·Ramp AI Index 원자료 | — | 유료 | — | — | — | 유료/구독 | **D** | S |

### E-3. 인터넷 점유율·트래픽

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `statcounter_ai_chatbot_share` | **StatCounter AI 챗봇 점유율** (리퍼럴 기준) | %, 월간(일간도 가능), 시작 시점 미확인(2026-01~09 수신 확인) | ChatGPT vs Gemini vs Copilot vs Perplexity vs Claude. 구글의 AI 방어 성공 여부 | `GOOGL`, `MSFT`, `META` | `https://gs.statcounter.com/chart.php?device=Desktop%20%26%20Mobile%20%26%20Tablet%20%26%20Console&device_hidden=desktop%2Bmobile%2Btablet%2Bconsole&statType_hidden=ai_chatbot&region_hidden=ww&granularity=monthly&statType=AI%20Chatbot&region=Worldwide&fromInt=202601&toInt=202609&fromMonthYear=2026-01&toMonthYear=2026-09&csv=1` | 없음 | **CC BY-SA 3.0** + 링크 표기 의무(FAQ 원문). SA 조항: 파생 데이터도 같은 라이선스로 공개 | **A** | **F** 2026-08: ChatGPT 79.40 / Gemini 10.93 / Perplexity 4.34 / Copilot 2.77 / Claude 2.53. (09월은 월중 잠정) |
| `statcounter_search_share` | StatCounter 검색엔진 점유율 | %, 월간, 2009~ | 구글 검색 독점 균열 감시(90% 선). 빙 점유율 = MSFT AI 검색 효과 | `GOOGL`, `MSFT`; `NAVER`(035420) — `region_hidden=KR` 로 국내 네이버 vs 구글 | 위 URL 에서 `statType_hidden=search_engine&statType=Search%20Engine` (국내: `region_hidden=KR&region=South%20Korea`) | 없음 | CC BY-SA 3.0 | **A** | **F** 2026-08 Google 91.02 / bing 4.55 / Naver 0.24(세계) |
| `statcounter_browser_os_share` | 브라우저·OS·모바일 벤더 점유율 | %, 월간 | 크롬 독점(반독점 소송 맥락), iOS vs 안드로이드, 삼성 vs 애플 단말 | `GOOGL`, `AAPL`, `MSFT`; `삼성전자`(005930) | 같은 규칙: `statType_hidden=browser` / `os_combined` / `vendor`(device=mobile) | 없음 | CC BY-SA 3.0 | A | **S** (같은 엔드포인트 규칙, 개별 호출은 안 함) |
| `tranco_domain_rank` | Tranco 도메인 순위 (chatgpt.com 등 AI·핀테크 서비스) | 순위, 일간, 최근 30일/요청(전체 리스트는 2018~) | AI 서비스 도메인 순위 추이: chatgpt.com, gemini.google.com, claude.ai, perplexity.ai, robinhood.com, coinbase.com | `GOOGL`, `MSFT`, `COIN`, `HOOD`, `RDDT` | `https://tranco-list.eu/api/ranks/domain/<domain>` · 일별 전체 리스트 `https://tranco-list.eu/api/lists/date/latest` → `download` URL(top-1M csv.zip) | 없음(1 req/s) | 학술 프로젝트, 무료·출처 인용 요청(논문 인용). 명문 라이선스는 사이트에 "free to use" 수준 | A | **F**(WebFetch) chatgpt.com 2026-09-16 rank 75 (09-12 74). 조사 PC 에서는 DNS 실패 |
| `cf_radar_domain_rank` | Cloudflare Radar 도메인·인터넷서비스 순위 (Generative AI 카테고리) | 순위·버킷, 일간 | 기존 `cloudflare_ai_bots` 와 같은 토큰으로 **사람 쪽** AI 서비스 인기 순위까지. Tranco 와 교차 | `NET`, `GOOGL`, `MSFT`, `META` | `GET https://api.cloudflare.com/client/v4/radar/ranking/internet_services/top?serviceCategory=Generative%20AI` · `/radar/ranking/internet_services/timeseries_groups` · `/radar/ranking/domain/{domain}` · `/radar/ranking/timeseries_groups?domains=chatgpt.com` | 무료 계정 Bearer 토큰 | **CC BY-NC 4.0** (기존 항목과 동일 조건 — 비상업) | A(조건부) | **S/F** 무토큰 400 `Missing … Authorization headers` 확인, 경로는 공식 API 문서로 확인 |
| `ookla_open_data` | Ookla 오픈데이터 (분기 타일별 속도) | Mbps, 분기 | 종목 연결이 약함(통신사 품질). 용량 큼(parquet, S3) | — | `s3://ookla-open-data/parquet/performance/type=mobile/year=2026/quarter=2/` | 없음 | CC BY-NC-SA 4.0 | A(저우선) | S |
| `crux_bigquery` | Chrome UX Report | origin 별 성능 | 트래픽 점유 지표가 아님(성능). BigQuery 과금 계정 필요 | — | BigQuery `chrome-ux-report` | GCP | CC BY 4.0 | B(제외 권고) | S |

### E-4. 여론·관심·공시 키워드

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `hn_keyword_mentions` | Hacker News 키워드 스토리·댓글 수 | 건, 일·주 집계, 2007~ | 개발자 커뮤니티 관심: "Claude Code"·"Cursor"·"Snowflake"·"Cloudflare"·"CUDA"·"ROCm". 제품 출시 반응 | `NET`, `SNOW`, `MDB`, `DDOG`, `GTLB`, `NVDA`, `AMD`, `PLTR` | `https://hn.algolia.com/api/v1/search_by_date?query=%22Claude%20Code%22&tags=story&numericFilters=created_at_i>1789000000&hitsPerPage=0` → `nbHits` (기간은 `created_at_i>A,created_at_i<B`) | 없음(시간당 1만) | Algolia 제공 공개 API, HN 콘텐츠 집계 수치 게시 무방 | **A** | **F** "Claude Code" 스토리 nbHits=75 (created_at_i>1789000000 ≈ 최근 7일) |
| `sec_fts_keyword_filers` | **SEC EDGAR 전문검색 — 키워드 언급 공시 수** | 건, 임의 기간, 2001~ | "artificial intelligence"·"tariff"·"data center"·"GLP-1"·"stablecoin" 을 10-K/10-Q/8-K 에서 언급한 공시 수의 분기 추이 = 테마 확산도 | 테마별(`NVDA`, `VRT`, `CRCL`, `COIN` 등) | `https://efts.sec.gov/LATEST/search-index?q=%22artificial%20intelligence%22&forms=10-K&dateRange=custom&startdt=2026-01-01&enddt=2026-06-30` → `hits.total.value`, `aggregations.entity_filter/sic_filter.buckets` | 없음. UA `Mir_US_Stocks research <email>` 필수, 10 req/s 이하 | 미 연방 공공 | **A** | **F** 10-K "artificial intelligence" 2026-01-01~06-30 = **3,639건**; 8-K "tariff" 2026-08 = 402건. 주의: total 은 **문서 수**(회사 수 아님) — 회사 수는 `entity_filter` 버킷이 상위만 주므로 페이지네이션(`from=`)으로 CIK 중복 제거 필요 |
| `stocktwits_stream` | Stocktwits 심볼 스트림·트렌딩·워치리스트 수 | 건·명, 실시간 → 적립 | 리테일 관심. `watchlist_count` 증분 + 메시지의 `entities.sentiment`(Bullish/Bearish) 비율. WSB 와 교차 | `NVDA`, `TSLA`, `PLTR`, `MSTR`, `COIN`, `HOOD`, `SNAP` | `https://api.stocktwits.com/api/2/streams/symbol/NVDA.json` (최근 30건) · `https://api.stocktwits.com/api/2/trending/symbols.json` | 없음(무인증 ~200회/시) | **API 신규 등록은 중단 상태**, 무인증 엔드포인트만 개방. ToS 는 콘텐츠 재게시 제한 → **집계 수치만**, 메시지 원문 금지. 러너 위험: Cloudflare 앞단 | B/C | **F** NVDA watchlist_count 666,979 · 트렌딩 1위 SNAP |
| `gdelt_doc_volume` | GDELT DOC 2.0 뉴스량·톤 타임라인 | %·건, 15분~일, 2017~ | 테마 뉴스량("AI bubble"·"tariff"·"chip export")과 톤. 레포의 민감도 모니터가 이미 GDELT 를 쓰므로 캐시 재사용 | 테마별 | `https://api.gdeltproject.org/api/v2/doc/doc?query=%22artificial%20intelligence%22%20sourcecountry:US&mode=timelinevolraw&timespan=1m&format=json` (`mode=timelinetone`) | 없음 | 무료·출처 표기. **5초당 1회** 명시 | A(불안정) | **F(429)** 2회 연속 429 "limit requests to one every 5 seconds". 공유 IP 에서 상시 429 가능 → 실패 허용형, 쿼리 5개 이하·sleep 6s |
| `bluesky_search` | Bluesky 게시물 검색량 | — | 무인증 검색 차단 | — | `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%24NVDA` | 계정 앱 비밀번호 필요 | — | B(제외 권고) | **F(403)** |
| `dol_h1b_lca` | 미 노동부 H-1B LCA 공개 데이터 (기업별 신청·직무·임금) | 건, 분기 xlsx(수십 MB), FY2008~ | 빅테크·AI 기업의 실제 채용 의도(직무·연봉). 분기 1회 "기업별 신청 수 Top" 집계 | `MSFT`, `GOOGL`, `META`, `AMZN`, `NVDA`, `TSLA`, `INFY`, `CTSH`, `WIT` | 인덱스 `https://www.dol.gov/agencies/eta/foreign-labor/performance` → `https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2026_Q2.xlsx` (파일명 규칙, 분기마다 확인) | 없음 | 미 연방 공공 | B | **F(403)** 인덱스·xlsx 모두 Akamai 403(브라우저 UA 로도). **러너에서도 막힐 가능성 높음** → 수동 다운로드 후 1회성 집계로만 |

### E-5. 반도체·하드웨어 무료 프록시

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `backblaze_drive_stats` | Backblaze 드라이브 통계 (제조사·모델별 대수·고장률) | 대·AFR%, 분기(일별 원자료), 2013~ | 하이퍼스케일급 스토리지 사업자의 HDD 구매 믹스(Seagate vs WDC vs Toshiba, 용량 전환 속도) | `STX`, `WDC` | `https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2026.zip` (규칙 `data_Q{n}_{yyyy}.zip`, 수백 MB — 분기 1회만, 집계는 블로그 표가 더 가벼움) | 없음 | 자체 약관: **출처 표기, 데이터 자체 판매 금지, 파생물 허용** | A(무거움)/B | **F** `data_Q2_2026.zip` HEAD 200 (공식 페이지 목록은 Q1 2026 까지만 표기 — 페이지 갱신 지연) |
| `jpr_gpu_shipments` | Jon Peddie Research PC GPU·AIB 출하·점유율 | 대·%, 분기 | NVDA/AMD/INTC 디스크리트 점유율의 업계 표준 헤드라인. Steam 설문(기존)의 출하 기준 교차 | `NVDA`, `AMD`, `INTC` | `https://www.jonpeddie.com/news/` 보도자료(헤드라인 인용만) | — | © 보고서 유료. **헤드라인 1개+링크**만 | B(헤드라인) | **S** Q2'26: PC GPU 75.5M(+10.4% QoQ), AIB 12.5M, AIB 점유율 NVDA ~90%/AMD ~8%/INTC ~2% |
| `idc_smartphone_shipments` | IDC 분기 스마트폰 출하 | 대·%, 분기(1·4·7·10월 중순) | 애플·삼성 출하, 메모리 가격 급등의 저가폰 타격(2026 핵심 서사) | `AAPL`, `QCOM`, `ARM`, `MU`; `삼성전자`(005930), `SK하이닉스`(000660) | `https://www.idc.com/resource-center/press-releases/` · Counterpoint `counterpointresearch.com/insights` | — | © 헤드라인 인용만 | B(헤드라인) | **S** Q2'26 276.3M(−7.4% YoY), 삼성 62M, 애플 55M(+15%) |
| `mercury_cpu_share` | Mercury Research x86 CPU 점유율 | %, 분기 | AMD vs INTC 서버·클라이언트 점유율. 1차 출처는 보도자료 메일 → 2차 매체 경유 | `AMD`, `INTC` | 2차 매체(Tom's Hardware 등) | — | 인용만 | C | S |
| `pcpartpicker_trends` | PCPartPicker 가격 추이 (DRAM·SSD·GPU 소매가) | USD | DRAM 소매가 프록시로 가장 좋지만 **약관 페이지가 403**, 사이트는 자동수집 금지로 알려짐. 가격 차트는 이미지 | — | `pcpartpicker.com/trends/price/memory/` | — | 스크래핑 금지(약관 직접 열람은 403 으로 실패) | **X** | **F(403)** |
| DRAM 소매가 기타 | Camelcamelcamel·Keepa·Newegg·Amazon | — | 모두 약관상 자동수집 금지. **합법적 무료 DRAM 소매가 시계열은 찾지 못했다** → 기존 문서의 관세청 수출단가(`hbm_export_unit`)·`kr_exports_10day` 가 여전히 최선 | — | — | — | X | X | S |

### E-6. 크립토 온체인·파생

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `cm_btc_onchain` | **Coin Metrics Community — BTC 활성주소·해시레이트·MVRV·거래소 유출입** | 개·EH/s·배·USD, 일간, 2009~ | MVRV(시가/실현가) = 사이클 과열·바닥 지표의 표준. 거래소 순유입 = 매도 압력 | `MSTR`, `COIN`, `IBIT`, `MARA`, `RIOT`, `CLSK` | `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=AdrActCnt,HashRate,CapMVRVCur,TxCnt,FlowInExUSD,FlowOutExUSD,FeeTotNtv&frequency=1d&start_time=2026-01-01&page_size=1000` · 무료 지표 목록 `…/v4/catalog-v2/asset-metrics?assets=btc` | 없음(10 req/6s/IP) | **CC BY-NC 4.0** (문서 원문 확인) — 비상업 사이트만. 광고·유료화 시 제외 | A(조건부) | **F** 2026-09-14: AdrActCnt 643,814 · MVRV 1.4709 · HashRate 9.50e8 TH/s. BTC 무료 지표 31개. **ETH `TxTfrValAdjUSD` 는 403**(커뮤니티 범위 밖) |
| `blockchain_com_charts` | blockchain.com 차트 API (해시레이트·채굴수익·mempool·거래수) | 다양, 일간, 2009~ | Coin Metrics 의 NC 조건을 피하는 대체. `miners-revenue` = 채굴주 매출 프록시 | `MARA`, `RIOT`, `CLSK`, `IREN`, `CORZ`, `WULF`, `HUT` | `https://api.blockchain.info/charts/hash-rate?timespan=1year&format=json` (`miners-revenue`, `n-transactions`, `difficulty`, `mempool-size`, `transaction-fees-usd`) | 없음 | blockchain.com API 약관: 출처 표기, 과호출 금지. 명문 CC 아님 | A− | **F** 해시레이트 최근값 ~9.5e8~1.03e9 TH/s |
| `mempool_space` | mempool.space 수수료·해시레이트·난이도 조정 | sat/vB·H/s, 실시간 | 네트워크 혼잡(수수료 급등=투기 과열), 난이도 조정 예상치 → 채굴주 마진 | 채굴주 위와 같음 | `https://mempool.space/api/v1/fees/recommended` · `/api/v1/mining/hashrate/1m` · `/api/v1/difficulty-adjustment` | 없음 | 오픈소스(AGPL) 프로젝트. 공개 API 는 저빈도 허용, 고빈도는 자가 호스팅 요구 | **A** | **F** fastestFee 3 sat/vB · avgHashrate ~1.0e21 H/s |
| `deribit_dvol` | **Deribit DVOL (BTC·ETH 내재변동성 지수)** | %, 1분~1일 캔들, 2021-03~ | 크립토판 VIX. MSTR·COIN 옵션 가격과 직결. 레포의 VIX·공포탐욕 옆에 자연스럽다 | `MSTR`, `COIN`, `IBIT`, `HOOD`, `BITX`, `MSTU`, `CONL` | `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=<ms>&end_timestamp=<ms>&resolution=1D` (`currency=ETH`) → `[ts, open, high, low, close]` | 없음 | 공개 시세 API. 약관상 표시 허용(재판매 금지). 러너: 거래는 미국 차단이나 **공개 API 는 통상 개방** — 첫 실행 확인 | **A** | **F** 2026-09-16 DVOL 종가 35.46 (09-13 고점 41.17) |
| `deribit_basis_pcr` | Deribit 선물 베이시스·옵션 풋/콜 OI | %·계약, 점값 → 적립 | 만기별 선물 프리미엄 연율(레버리지 수요), 풋/콜 미결제 비율 | 위와 같음 | `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=future` (→ `mark_price` vs `estimated_delivery_price`, `open_interest`) · `kind=option` | 없음 | 위와 같음 | A(계산) | **F** `BTC-20SEP26` mark 76,396 vs index 76,343, OI 122,300 |
| `cme_btc_basis` | CME 비트코인 선물 베이시스 (기관 캐리) | %, 일간 | CME 근월물 − 현물 = 기관 베이시스 트레이드 수요(ETF 유입의 질) | `CME`, `IBIT`, `MSTR` | 야후 `https://query1.finance.yahoo.com/v8/finance/chart/BTC=F?range=1y&interval=1d` − 코인베이스 `https://api.exchange.coinbase.com/products/BTC-USD/ticker` (레포 yahoo-cache 재사용) | 없음 | 야후 비공식(C), 자체 계산 | C | **F** `BTC=F` CME 메타 200 · Coinbase 76,280.07 |
| `perp_funding_oi` | 무기한 선물 펀딩비·미결제약정 (Binance·Bybit·OKX) | %/8h·USD, 8시간·일간 | 레버리지 롱 과열 신호. 거래소 3곳 평균 | `COIN`, `HOOD`, `MSTR`, `BITX` | Binance `https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=100` , `https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=30` · Bybit `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT` · OKX `https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP` , `…/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1D` | 없음 | 거래소 공개 API(표시 허용). **러너 위험 높음: Binance 는 미국 IP 451, Bybit 은 미국 IP 403 으로 알려짐**(한국 IP 에서는 셋 다 200). OKX·Hyperliquid 를 1순위로 | A(한국)/C(러너) | **F** Binance 펀딩 0.00009351(09-16 16:00Z)·OI $8.22B / Bybit 0.00005959 / OKX 0.0000866·OI $2.84B |
| `hyperliquid_stats` | Hyperliquid 펀딩·OI·수수료 수익 | %·USD, 시간·일간 | 온체인 최대 무기한 거래소. 미국 IP 차단 없는 펀딩비 원천. 수수료 수익은 DefiLlama | `COIN`, `HOOD`, `GLXY` | `POST https://api.hyperliquid.xyz/info` 본문 `{"type":"metaAndAssetCtxs"}`(OI·funding·mark) / `{"type":"fundingHistory","coin":"BTC","startTime":<ms>}` · 수익 `https://api.llama.fi/summary/fees/hyperliquid?dataType=dailyRevenue` | 없음 | 공개 API(문서화). 재배포 조항 없음 | **A** | **F** BTC 시간당 펀딩 0.0000053916 등 이력 수신 |
| `crypto_fear_greed` | alternative.me 크립토 공포탐욕 지수 | 0~100, 일간, 2018-02~ | 레포의 CNN F&G 옆에 크립토판. 전체 이력 한 번에(`limit=0`) | `COIN`, `MSTR`, `IBIT`, `HOOD` | `https://api.alternative.me/fng/?limit=0&format=json` | 없음 | 약관 원문 확인: **데이터 표시 바로 옆에 출처 표기** 시 상업 이용 허용, 사칭·혼동 서비스 금지 | **A** | **F** 2026-09-16 = 50 (Neutral), 09-14 = 69 (Greed) |
| `btc_corp_treasuries` | 상장사 BTC·ETH 보유량 (CoinGecko 공개 트레저리) | BTC·USD, 수시 | MSTR 보유량·평단, 상장사 합계 = "기업 매수" 서사. ETH 는 BMNR·SBET | `MSTR`, `MARA`, `RIOT`, `COIN`, `TSLA`, `XYZ`, `GLXY`, `BMNR`, `SBET` | `https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin` · `/ethereum` | 없음(무키 공개 한도) / 기존 Demo 키 | CoinGecko **출처 표기 의무**(기존 문서와 동일) | A− | **F** 합계 1,294,037 BTC · Strategy(MSTR) **845,050 BTC**(취득가 $64.27B) · ETH 합계 7,969,732, BitMine 5,956,378. (bitcointreasuries.net 은 HTML 만, API 유료) |
| `dex_volume` | DEX 일별 거래량 (전체·체인별·프로토콜별) | USD, 일간, 2014~ | CEX(COIN) 대비 DEX 점유율. 온체인 투기 열기 | `COIN`, `HOOD`, `GLXY`, `CRCL` | `https://api.llama.fi/overview/dexs?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume` → `totalDataChart`, `total24h`, `change_7d` | 없음 | DefiLlama(기존 항목과 동일 관행: 출처 표기) | **A** | **F** 200, `totalDataChart` 수신. **`/overview/derivatives` 는 402(유료 전환)** |
| `l2_tvs_activity` | 이더리움 L2 예치자산(TVS)·활동량 (L2BEAT) | USD·tx/일, 일간 | Base(=COIN 수수료 매출)·Robinhood Chain 포함 L2 성장 | `COIN`, `HOOD`, `ETHA` | `https://l2beat.com/api/scaling/tvs` · `https://l2beat.com/api/scaling/activity` (프로젝트별 `?projectId=base` 는 U) | 없음 | L2BEAT 사이트 API — **공식 문서화 안 됨**(오픈소스 MIT 코드, 데이터 약관 불명) → 출처 표기·저빈도 | B | **F** TVS $40.21B (ETH 16.48M), activity 일 1.5~2.8억 tx |
| `eth_supply_staking` | ETH 공급량·소각 (ultrasound.money) / 스테이킹 | ETH, 분·일 | ETH 순발행(디플레 여부). 스테이킹 APR 은 Lido 풀 `yields.llama.fi/chart/747c1d2a-c668-4682-b9f9-296708a3dd90` | `ETHA`, `BMNR`, `SBET`, `COIN` | `https://ultrasound.money/api/v2/fees/supply-over-time` · Lido APY 위 URL | 없음 | 비문서 API(오픈소스). DefiLlama yields 는 공개 | B/C | **F** supply 122,046,822 ETH (2026-09-16), Lido 차트 200. beaconcha.in 은 DNS 실패로 U |
| `glassnode_free` | Glassnode | — | **API 는 유료 플랜 전용**, 무료는 웹 차트(T1 지표·1일 해상도) 열람만 | — | — | 유료 | — | D | S |

### E-7. 핀테크·결제·리테일 브로커

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fednow_participants` | FedNow 참여 금융기관 수 | 개, 수시 갱신 xlsx → 주 1회 적립 | 실시간 결제 보급 속도(카드 네트워크·코어뱅킹 벤더에 대한 장기 위협/기회) | `V`, `MA`, `PYPL`, `FIS`, `JPM`, `XYZ` | `https://www.frbservices.org/binaries/content/assets/crsocms/financial-services/fednow/fednow-live-participants.xlsx` (행 수 − 헤더 3) · 분기 거래량 `https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats/quarterly-stats.html` | 없음 | 연준 공공 | **B** | **F** "as of Sep 14, 2026", 1,903행(≈1,900개 기관) |
| `bnpl_cards_monthly` | BNPL·카드 월간 지표 | — | **무료 월간 없음.** Visa/Mastercard 는 분기 실적과 간헐 8-K 뿐, Affirm·Klarna 도 분기. 대체: FRED `REVOLSL`(G.19 리볼빙 신용, 월), `DRCCLACBS`(기존) | `V`, `MA`, `AXP`, `COF`, `AFRM`, `SOFI` | FRED `REVOLSL`, `TOTALSL` | FRED 키(기존) | 공공 | A(대체) | S |

### E-8. ETF 보유·발행주식수 (자금흐름 자체 계산)

자금흐름 공식: `flow_t = (SO_t − SO_{t−1}) × NAV_t`. 발행주식수(SO)만 매일 적립하면 Farside(봇 403) 없이도 계산된다.

| 지표 ID | 지표 | 단위·주기·히스토리 | 분석 가치 | 연관 종목 | 접근 URL·파라미터 | 키 | 라이선스·재배포 | 등급 | 검증 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `proshares_lev_shares` | **ProShares 레버리지 ETF 발행주식수·AUM 일별 이력** | 천 주·USD, 일간, 2022-05~ (파일 내) | TQQQ/SQQQ 발행주식수 = 리테일 레버리지 심리. **이력이 파일 하나에 다 들어 있어 적립 불필요** | `TQQQ`, `SQQQ`, `UPRO`, `SSO`, `QLD`, `BITO` | `https://accounts.profunds.com/etfdata/ByFund/TQQQ-historical_nav.csv` (티커만 교체) — 열: `Date, NAV, Prior NAV, NAV Change (%), Shares Outstanding (000), Assets Under Management` | 없음 | © ProShares. 사실 수치의 파생 계산(자금흐름) 게시는 통상 허용, 원파일 재호스팅 금지 | **A−** | **F**(WebFetch) 2026-09-16 TQQQ SO 509,300천 주 · AUM $34.58B (09-15 502,200 → +7.1M 주 ≈ +$482M 유입). 조사 PC 는 DNS 실패 |
| `direxion_lev_shares` | Direxion 레버리지 ETF 발행주식수 + 보유 | 주, 일간 점값 → 적립 | SOXL/SOXS(반도체 3배), TECL, NVDL·TSLL 계열은 별도 발행사(GraniteShares) | `SOXL`, `SOXS`, `TECL`, `SPXL` | `https://www.direxion.com/holdings/SOXL.csv` → 3행 `Shares Outstanding:<n>` + 보유 표 | 없음 | © Direxion, 위와 같음 | **A−** | **F** 2026-09-16 SOXL SO **175,600,060** · 최대 보유 AMD 6.35%. (제품 HTML 은 WebFetch 403 — CSV 는 정상) |
| `spdr_navhist` | SPDR ETF NAV·발행주식수·순자산 일별 이력 | USD·주, 일간, 상장 이후 전체 | 섹터 SPDR(XLK·XLF·XLE…) 11개의 일별 자금흐름 = 섹터 로테이션. 이력 포함 xlsx | `SPY`, `XLK`, `XLF`, `XLE` | `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/navhist-us-en-<ticker 소문자>.xlsx` (보유는 `holdings-daily-us-en-<ticker>.xlsx`) | 없음 | © SSGA, 위와 같음. 러너 위험: Akamai(브라우저 UA 권장) | **A−** | **F** XLK 2026-09-16 NAV 183.97 · SO 648,961,794 · 순자산 $119.39B (09-15 648,811,794 → +150,000주) |
| `ark_daily_holdings` | ARK ETF 일일 보유 (매매 역산) | 주·%, 일간 점값 → 적립 | 캐시 우드 일별 매매(전일 대비 주식수 차분). 리테일 관심 높음. ARKB 의 BTC 수량 = ETF 흐름 | `TSLA`, `COIN`, `HOOD`, `PLTR`, `CRCL`, `TEM`, `RBLX`, `SHOP`, `ARKG`, `ARKB` | `https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv` (ARKW `ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS.csv` 규칙, U) · `…/ARK_21SHARES_BITCOIN_ETF_ARKB_HOLDINGS.csv` | 없음 | © ARK. 공개 다운로드, 파생 표기 허용 관행 | **A−** | **F** 2026-09-17 ARKK 1위 TSLA 9.66%(1,956,298주), 2위 SPCX 6.68% · ARKB 30,753 BTC ($2.33B). (ARKK·ARKW 자체는 레포 details 에 없음 — 보유 종목 쪽에 표시) |
| `ishares_shares_out` | iShares ETF 발행주식수 (IBIT·SOXX 등) | 주, 일간 점값 → 적립 | IBIT 발행주식수 차분 × NAV = **최대 현물 BTC ETF 의 일별 자금흐름**(Farside 403 대체) | `IBIT`, `ETHA`, `SOXX` | 제품 페이지 HTML `https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf` 내 임베드 JSON `"Shares Outstanding","formattedValue":"1,385,600,000"` 정규식. **구 CSV 엔드포인트(`…/1467271812596.ajax?fileType=csv…`)는 HTML 을 반환 — 더는 동작 안 함** | 없음 | © BlackRock. 페이지 1.5MB, 구조 변경 위험 | B | **F** IBIT SO 1,385,600,000 · NAV $42.89 · 순자산 $59.43B (2026-09-16) · SOXX SO 84,200,000 |
| `invesco_qqq_holdings` | Invesco QQQ 보유·발행주식수 | — | — | `QQQ` | `https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ` | 없음 | — | B/U | **F(503)** `backend read error` — 재시도 필요, 미확정 |

---

### E-실패·차단·미확인 목록

| 소스 | 결과 | 처리 제안 |
| :--- | :--- | :--- |
| pypistats.org | 첫 호출부터 **429**(+DNS 1회 실패) | ClickPy(ClickHouse 공개 SQL)를 1순위, pypistats 는 폴백 |
| OpenRouter 랭킹 | JSON API 없음 + **ToS §7 스크래핑 금지** | X. 가격(`/api/v1/models`)만 사용 |
| GitHub REST 무인증 | 60회/시 소진 → 403 | Actions `GITHUB_TOKEN` 사용 |
| GDELT DOC 2.0 | **429** 2회 연속 | 실패 허용형, 6초 간격·쿼리 5개 이하 (레포 민감도 모니터 캐시 재사용) |
| Bluesky `searchPosts` | **403** (무인증 검색 차단) | 제외 |
| DOL H-1B LCA | 인덱스·xlsx 모두 **Akamai 403** | 수동 다운로드 1회성. 자동화 부적합 |
| PCPartPicker | 약관 페이지 403, 스크래핑 금지 | X. 합법적 DRAM 소매가 무료 시계열은 못 찾음 |
| Binance·Bybit 선물 API | 한국 IP 200. **미국 러너 451/403 가능성 높음**(이번에 재현 못 함) | OKX·Hyperliquid·Deribit 우선, Binance/Bybit 은 실패 허용 |
| DefiLlama `/overview/derivatives` | **402** 유료 전환 | 개별 프로토콜 `summary/fees/<slug>` 로 대체 |
| Coin Metrics ETH `TxTfrValAdjUSD` | 403 (커뮤니티 범위 밖) | 카탈로그(`catalog-v2`)에 있는 지표만 |
| iShares 보유 CSV `.ajax?fileType=csv` | HTML 반환(구 규칙 폐기) | 제품 페이지 임베드 JSON 파싱 |
| Invesco QQQ 다운로드 | 503 backend read error | 미확정(U) |
| Artificial Analysis | 무키 401 | 무료 키 발급 후(출처 표기 의무) |
| Cloudflare Radar ranking | 무토큰 400 | 기존 AI 봇용 토큰 재사용, CC BY-NC |
| tranco-list.eu / beaconcha.in / profunds / proshares | 조사 PC DNS 실패 | Tranco·ProShares 는 WebFetch 로 F 확인, beaconcha.in 은 U |
| Direxion 제품 HTML | WebFetch 403 (CSV 는 200) | CSV 직접 |
| Glassnode API, SemiAnalysis, Similarweb, Sensor Tower, bitcointreasuries API, CryptoQuant | 유료 | D |
| TOP500 xlsx | 로그인 필요 | 헤드라인만 |
| Ookla, CrUX | 종목 연결 약함 / BigQuery 과금 | 보류 |
| Stack Overflow | API 는 정상이나 **신호 소멸**(전체 월 1,133건) | 추이 지표로 쓰지 않음 |
| ARKW CSV 파일명, StatCounter browser/os/vendor 파라미터, L2BEAT `projectId` | 규칙만 추정, 미호출 | U — 구현 시 확인 |

### E-바로 구현 가능한 상위 10개

무키(또는 기존 키)·실호출 확인·라이선스 명확·종목 매핑 선명 순.

1. **`epoch_ai_chip_sales` (+`epoch_ai_companies`, `epoch_data_centers`)** — CC BY 4.0, zip 3개. NVDA·AMD·TPU 분기 출하 추정과 AI 기업 ARR 을 무료로 주는 유일한 원천. 주 1회.
2. **`statcounter_ai_chatbot_share` + `statcounter_search_share`** — CSV URL 하나, CC BY-SA 3.0(링크 표기). GOOGL·MSFT 카드에 바로. KR 은 `region_hidden=KR` 로 NAVER.
3. **`census_btos_ai_use`** — 공공 xlsx, 격주. 기업 AI 사용률 23.2%(회차 202618). 소프트웨어·IT 서비스주 공통 배경 지표.
4. **`deribit_dvol`** — 무키 JSON, 이력 포함. 크립토 VIX 로 MSTR·COIN·IBIT 패널과 기존 심리 게이지에 추가.
5. **`proshares_lev_shares` + `direxion_lev_shares`** — TQQQ 이력 CSV·SOXL CSV. 발행주식수 → 일별 레버리지 자금흐름. 적립 부담 최소.
6. **`spdr_navhist`** — 섹터 SPDR 11개 xlsx(이력 포함)로 섹터 로테이션 자금흐름. 기존 ICI 주간(설계서)보다 빠른 일별.
7. **`npm_downloads` + `pypi_downloads_clickpy` + `dockerhub_pulls`** — "개발자 채택" 묶음. MDB·DDOG·SNOW·ESTC·GTLB·NET 종목 카드에 패키지별 YoY. (npm 0 값은 결측 처리, Docker 는 적립형)
8. **`sec_fts_keyword_filers`** — 레포의 `sec_client.py` UA 규약 그대로. 분기별 "AI/관세/데이터센터 언급 10-K 수" 테마 확산도.
9. **`crypto_fear_greed` + `btc_corp_treasuries` + `dex_volume`** — 무키 JSON 3종. 크립토 섹션(⑱)을 스테이블코인 1개에서 4개로.
10. **`lmarena_leaderboard` + `hf_model_downloads` + `appstore_ai_rank`** — "AI 경쟁 구도" 묶음(CC BY 4.0 / 공개 API / 애플 RSS). 조직별 최고 Elo·오픈모델 다운로드·앱 순위를 일 1회 적립.

차순위(조건부): `cm_btc_onchain`(CC BY-NC — 비상업 유지 시 MVRV 가치 큼), `hyperliquid_stats`·OKX 펀딩비(러너 차단 없는 파생 지표), `hn_keyword_mentions`, `fednow_participants`, `ishares_shares_out`(HTML 파싱이라 깨지기 쉬움), `ark_daily_holdings`.

### E-구현 시 주의

- **비상업 조건 3건**: Coin Metrics Community(CC BY-NC 4.0), Cloudflare Radar(CC BY-NC 4.0, 기존), Ookla(CC BY-NC-SA). 사이트에 광고·유료 기능을 붙이면 제거 대상 — `industry_indicators` 메타에 `license: "CC-BY-NC"` 플래그를 두고 한 번에 끌 수 있게.
- **StatCounter 는 SA(동일조건)**: 파생 JSON 에 `license: CC BY-SA 3.0` 과 링크를 같이 실어야 한다.
- **적립형(점값) 소스**: Docker pulls, GitHub 스타, VS Code installs, HF downloads, 앱스토어 순위, iShares/Direxion/ARK SO. 설계서 G-28 의 `data/industry_archive/{id}.json` 규약(같은 날짜 skip, 파싱 실패 시 기존 유지)을 그대로 쓴다.
- **0 ≠ 결측**: npm 이 2026-09-07·08 을 0 으로 돌려줬다. 0 을 그대로 그리면 급락 차트가 된다(데이터 정직성 규칙). 직전·직후가 수백만인데 0 이면 null 처리.
- **SEC FTS 의 total 은 문서 수**다. "언급 기업 수"로 표기하려면 CIK 중복 제거를 해야 하고, 못 하면 "언급 공시 수"로 표기.
- **미국 러너 지역차단은 이번에 재현하지 못했다**(조사 IP 가 한국). Binance/Bybit 은 continue-on-error 로 두고 첫 실행 로그의 HTTP 코드를 확인할 것. Akamai 계열(SSGA·iShares·DOL)은 브라우저 UA 가 필요하고 DOL 은 그래도 403.
- 호출 예절: GDELT 5초/1회, Coin Metrics 10req/6s, crates.io 1req/s+UA, SEC 10req/s+UA, pypistats 일 1회, Tranco 1req/s.

