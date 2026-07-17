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

## Actions 주의

- 데이터 워크플로우는 전부 `concurrency: group: mir-data-publish` 를 공유한다.
  연속으로 dispatch 하면 대기 중인 run 이 조용히 cancelled 된다 — **하나씩 watch 하며**
  실행할 것.
- 커밋 메시지에 `[skip ci]` 를 넣지 말 것. Pages 배포가 워크플로우(`deploy-pages.yml`)
  방식이라 `[skip ci]` 가 배포까지 막는다. 이것 때문에 12일간 자동 데이터가 사이트에
  반영되지 않은 적이 있다 — "데이터가 안 바뀐다" 는 증상이면 **레포와 라이브 사이트를
  따로** 확인할 것.
- `data/market_snapshot.json` 이 pretty ↔ compact 로 재포맷되면서 수십만 줄 diff 가
  뜰 수 있다. 데이터 손실이 아니라 포맷 변화이므로 키 단위로 비교해 확인할 것.

## 데이터 정직성

지어낸 수치를 발행하지 않는다. 국내 공매도 빌더가 `random.Random(ticker)` 로 잔고를
만들어내면서 docstring 으로는 "사실적인 통계" 라고 주장하고 있었고, 삭제했다. KR 은
`market_config.js` 에서 `shortInterest: false` 로 막혀 있다 — KRX 실연동 전엔 켜지 말 것.

## 알려진 부채

- `.git` 이 2.2GB 를 넘었다(데이터 커밋 하루 ~22개). 계속 커진다.
- `app.js` 800KB / `styles.css` 318KB / `index.html` 120KB 단일 파일.
- `sitemap.xml` 에 URL 2개뿐. 종목 상세 데이터 7,000개에 대한 딥링크 페이지가 없다.
