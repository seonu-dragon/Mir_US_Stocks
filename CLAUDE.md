# Mir_US_Stocks

미국/국내 주식 정적 대시보드. GitHub Pages 로 서빙되고, 데이터는 GitHub Actions 가
하루 여러 번 커밋한다. 브라우저는 커밋된 스냅샷만 읽고 실시간 조회를 하지 않는다.

로컬 확인: `.\scripts\serve.ps1` (8080 → 8090 → 8888 중 빈 포트)

## 머지는 Claude 가 직접 한다

코드 변경은 브랜치 → PR 로 올리되 **머지까지 Claude 가 한다**(`gh pr merge`). 사람에게
머지를 맡기지 말 것.

리뷰어가 따로 없는 1인 레포라 PR 은 검토 장치로 기능하지 않는다. 2026-07-17 에 PR 을
11개 올리면서 매번 사람이 웹에서 머지 버튼을 누르게 만들었고, 검토 효과 없이 클릭만
늘었다. 브랜치·PR 자체는 이력이 남아 유지할 가치가 있으니 그대로 두고, 머지 단계만
Claude 가 닫는다. main 에 브랜치 보호 규칙은 없다.

머지 후에는 배포(`deploy-pages.yml`) 완료를 기다렸다가 **라이브에서 확인**할 것 —
로컬 PASS 는 증거가 못 된다(아래 '데이터 정직성' 및 피처 데이터 경합 참고).

## 배포 전 반드시

```powershell
py scripts/stamp_build_id.py     # ?v= 캐시버스터를 자산 내용 해시로 스탬프
```

`?v=` 를 손으로 올리지 말 것. 예전엔 수동이었고, 값이 5가지로 갈라진 채 2주간
방치됐다(app.js 는 바뀌었는데 URL 은 그대로 → 사용자가 옛 JS 를 계속 받음,
styles.css 는 index/analysis 가 서로 다른 캐시 키로 서빙). 이제 각 자산의 `?v=` 는
그 파일 내용의 md5 이고, `build_id.js` 의 `MIR_BUILD_ID`(= SW 캐시 세대)와 `sw.js` 의
`BUILD_ID_FALLBACK` 도 같은 스크립트가 맞춘다. `--check` 로 어긋남만 확인 가능(CI 용).

`sw.js` 는 `?v=` 가 붙은 요청을 **불변으로 보고 cacheFirst** 한다. 스탬프를 건너뛰고
자산을 바꾸면 사용자는 옛 파일을 계속 캐시에서 받는다.

단, **`/data/` 아래 URL 은 `?v=` 가 붙어 있어도 절대 cacheFirst 하면 안 된다.** 데이터
파일은 하루 수십 번 같은 경로로 내용만 바뀌고 빌드 스탬프와 무관하게 갱신되므로,
SW 가 한 번 캐시하면 사용자는 새 배포 뒤에도 옛 스냅샷을 계속 본다("배포는 됐는데
반영 안 됨"의 한 원인). `/data/` 는 network-first(실패 시에만 캐시 폴백)로 두고,
`sw.js` 의 캐시 전략을 고칠 때 이 규칙을 깨지 말 것.

UI 를 건드렸으면 브라우저에서 실제로 열어볼 것. 이 사이트의 사고는 단위 검증으로
안 잡히는 종류가 많다(피처 데이터가 패널 렌더보다 늦게 도착, 배포는 됐는데 반영 안 됨).

```powershell
py -m http.server 8099 --bind 127.0.0.1   # 별도 창, 레포 루트에서
py scripts/smoke_ui.py                     # 탭 딥링크·다이얼로그·신뢰도센터·모바일
py scripts/smoke_ui.py --base https://seonu-dragon.github.io/Mir_US_Stocks/index.html
```

머지 후 라이브에 대고 한 번 더 돌릴 것 — 로컬 PASS 는 증거가 못 된다.
(playwright 필요: `py -m pip install playwright && py -m playwright install chromium`)

## 데이터 파이프라인

- `scripts/build_*.py` 각각이 `data/<name>.json` 과 `data/<name>.js` 를 **둘 다** 쓴다.
  - `.js` = `window.GLOBAL = <json 내용>;` — **브라우저가 실제로 로드하는 쪽**
    (`app.js` 의 `FEATURE_DATA` 가 `<script>` 로 주입).
  - `.json` = 파이썬 빌더가 증분 갱신 상태로 읽는 쪽(예: `build_insider_trades.py` 가
    마지막 `file_date` 를 읽어 그 이후만 수집).
  - 내용이 같다고 한쪽을 지우면 브라우저나 증분 빌드 중 하나가 깨진다.
- 무거운 데이터셋(13F/congress/insider, 합계 ~11MB)은 부팅 시 받지 않고 해당 탭을
  처음 열 때 로드된다(`FEATURE_DATA` 의 `heavy: true`).
- `repository_publish_lock` (`scripts/briefing_store.py`): 스냅샷 writer 와 git
  commit/push 를 이 머신에서 직렬화한다. 락 소유권을 **환경변수로 자식에게 상속**시켜,
  락 안에서 띄운 subprocess 빌더가 자기 부모를 기다리다 죽지 않게 한다.
- `data/content/` (카드뉴스 이미지)는 **최근 3일치만** 남긴다
  (`build_today_content.py` 의 `KEEP_DAYS`, 매 실행 시 자동 정리). 사이트는
  `market_snapshot.cardNews` 로 **오늘 덱만** 참조하고 지난 카드뉴스를 보는 화면은
  없는데, 이 폴더는 발행일마다 ~13MB 씩 쌓이기만 해서 222MB(배포분의 40%)까지
  갔었다. 지난 덱이 필요하면 원본은 `AI/카드뉴스/daily/`(폴백 `AI/temp/카드뉴스/daily/`)
  에 있고, 더 오래된 건 git 이력에서 꺼낸다:
  `git checkout <commit> -- data/content/<날짜>`.

## Actions 주의

- 데이터 워크플로우의 concurrency 그룹은 **워크플로우별로 분리**되어 있다
  (`mir-publish-${{ github.workflow }}`, 2026-07-23). 서로 다른 워크플로우는 병렬로
  돌고 push 경합은 빌더의 rebase 재시도가 흡수하므로 연속 dispatch 해도 된다.
  과거처럼 `mir-data-publish` 단일 그룹으로 **되돌리지 말 것** — GitHub 은 그룹당
  대기 슬롯이 1개라 크론 밀집대(20:05~21:06 UTC 등)에서 뒤에 온 run 이 앞의 대기
  run 을 조용히 cancel 한다. 07-17~22 에 earnings calendar 6일 연속, US 마감 브리핑
  4일, KR 마감 브리핑(=KR 스냅샷) 2일이 이렇게 초록 화면 뒤에서 미발행됐다.
  같은 워크플로우의 중복 실행만 여전히 직렬(대기 1개)이다.
- 커밋 메시지에 `[skip ci]` 를 넣지 말 것. Pages 배포가 워크플로우(`deploy-pages.yml`)
  방식이라 `[skip ci]` 가 배포까지 막는다. 이것 때문에 12일간 자동 데이터가 사이트에
  반영되지 않은 적이 있다 — "데이터가 안 바뀐다" 는 증상이면 **레포와 라이브 사이트를
  따로** 확인할 것.
- Deploy Pages 가 `pending` 인데 job 이 하나도 없으면 **좀비 queued run** 이
  `concurrency: pages` 를 잡고 있는 것이다. 2026-08-08 에 그렇게 굳은 run 하나가
  25일간 모든 배포를 pending → cancelled 로 만들었고(라이브는 07-30 에 정지), 데이터
  워크플로우는 다 초록색이라 아무도 몰랐다. `gh run list --status queued` 로 찾아
  `gh run cancel <id>`. 안전망: `pages-queue-watchdog.yml`(매시간 2시간↑ queued 취소)과
  `scripts/verify_pages_deploy.py`(`publish_today.ps1` 끝에서 자동 — 좀비 정리·배포
  대기·라이브 `today_content.json` date 확인). 발행 뒤에는 레포가 아니라 이 출력으로
  라이브를 확인한다.
- `data/market_snapshot.json` 이 pretty ↔ compact 로 재포맷되면서 수십만 줄 diff 가
  뜰 수 있다. 데이터 손실이 아니라 포맷 변화이므로 키 단위로 비교해 확인할 것.
- 워크플로우의 `name:` 을 바꾸면 `deploy-pages.yml` 의 `workflow_run` 참조가 **조용히
  끊긴다**(문자열로 지목하기 때문). 실패가 아니라 '아무 일도 안 일어남'이라 Actions 가
  전부 초록색인 채로 데이터만 사이트에 안 나간다 — 2026-07-17 에 `KR DART disclosures`
  → `+ ownership` 리네임으로 실제로 끊겼다. 이름을 건드렸으면 반드시:

  ```powershell
  py scripts/check_deploy_triggers.py   # 실제 이름 vs 트리거 목록 vs app.js 안내
  ```

## 데이터 정직성

지어낸 수치를 발행하지 않는다. 국내 공매도 빌더가 `random.Random(ticker)` 로 잔고를
만들어내면서 docstring 으로는 "사실적인 통계" 라고 주장하고 있었고, 삭제했다. KR 은
`market_config.js` 에서 `shortInterest: false` 로 막혀 있다 — KRX 실연동 전엔 켜지 말 것.

**없는 데이터는 기능을 끈다.** 빈 화면을 띄우거나 없는 파일을 계속 요청하지 않는다.
`market_config.js` 의 `features` 로 시장별로 차단한다(키가 없으면 켜진 것으로 본다 —
판정은 `=== false` 로 할 것. `!features.x` 로 쓰면 키 없는 시장까지 꺼진다).
현재 KR 에서 꺼 둔 것: `shortInterest`(실데이터 없음), `earningsCalendar`(국내는 실적
예정일 소스가 없다 — 빌더는 지나간 분기 실적만 만들고 워커도 빈 배열을 준다),
`breakoutStats`(US 만 산출). 콘솔 404 를 방치하면 진짜 404 를 가린다.

## 알려진 부채

수치는 2026-09-03 실측.

- `.git` pack 이 2.5GB(`git count-objects -vH` size-pack 2.57GiB; 07-18 엔 878MB 였다).
  데이터 커밋이 하루 ~22개라 계속 커진다. 줄이려면 이력을 다시 써야 하므로
  (`git filter-repo` + 강제 푸시) 아직 손대지 않았다. 완화: Actions 는 `fetch-depth: 1`
  로 받아 run 마다 이 pack 을 내려받지 않고, 6MB 짜리 `data/market_snapshot.js` 는
  더 이상 커밋하지 않는다(file:// 폴백용으로 로컬 생성만). **배포 아티팩트와는
  별개다** — Pages 한도에 걸리는 쪽은 아래 서빙 파일 총량이다.
- 배포 아티팩트 ≈330MB. `deploy-pages.yml` 이 rsync 로 `_site/` 스테이징 사본을 만들어
  (빌드 전용 경로·브라우저가 안 읽는 .js/.json 짝 제외) 그것만 올린다 — 예전의
  `path: '.'` 전체 업로드가 아니다. 데이터 워크플로우가 각각 배포를 트리거하지만,
  마지막 성공 배포 이후 서빙 경로에 변경이 없으면 게이트 스텝이 건너뛴다.
  GitHub Pages 발행 사이트 권장 한도는 1GB.
- `app.js` 850KB / `styles.css` 340KB / `index.html` 122KB 단일 파일.
  분리 전에 `scripts/smoke_ui.py` 를 안전망으로 쓸 것.
- `sitemap.xml` 은 `scripts/build_sitemap.py` 가 생성한다(**직접 고치지 말 것**).
  홈·분석 + 시가총액 상위 300종목/시장의 `analysis.html?t=` 딥링크 = 602 URL.
  스냅샷이 크게 바뀌면 다시 돌린다: `py scripts/build_sitemap.py`
  (`--check` 로 최신 여부만 확인 가능). 전체 1만+ 를 넣지 않은 건 의도적이다 —
  클라이언트 렌더 페이지를 한꺼번에 올리면 thin content 로 취급되기 쉽다.
  딥링크가 색인되려면 `analysis.js` 의 `updateAnalysisMeta` 가 종목별 canonical 을
  써 줘야 한다. 둘 중 하나만 바꾸면 효과가 없다.
