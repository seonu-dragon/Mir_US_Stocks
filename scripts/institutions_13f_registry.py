"""대형 헤지펀드·자산운용사 13F 제출 기관 레지스트리 (CIK 기준).

**모든 CIK 은 2026-09-15 에 SEC EDGAR 로 실검증했다.** 검증 방법:
  1. EDGAR 전문검색(`https://efts.sec.gov/LATEST/search-index?q="<회사명>"&forms=13F-HR`)
     으로 그 이름으로 실제 13F-HR 을 낸 제출인의 CIK 을 찾고,
  2. `https://www.sec.gov/cgi-bin/browse-edgar?...&CIK=<cik>&type=13F-HR&output=atom`
     로 그 CIK 의 conformed-name 과 최근 13F-HR 제출일을 확인했다.

그 전(2026-09-15 감사 시점)에는 160개 중 29개가 다른 회사의 CIK 을 재사용하고
있었고(1517137 하나에 8개 기관), 그 밖에도 60개 가까이가 아예 무관한 법인
(예: '오메가'→DARDEN RESTAURANTS, '히말라야'→Anaplan)을 가리키고 있었다.
즉 화면에 뜨던 기관 이름과 실제 보유 내역이 서로 다른 회사였다. 검증되지 않은
CIK 을 추측으로 채우지 말 것 — 지어낸 수치를 발행하는 것과 같다.

확인되지 않아 **삭제한** 기관(현행 13F-HR 제출인을 찾지 못함):
  바클리스 · 싱가포르 GIC · KKR · 론 사이프러스 · 콘서트 —— 13F-HR 제출 이력 없음
  오메가(2019년 이후 미제출) · 하이필즈(2020년 폐업) —— 최근 공시 없음
"""

from __future__ import annotations

# id, 한글명, 대표/설명, CIK (zero-padded 없이). CIK 은 위 docstring 의 방법으로 검증된 값만.
INSTITUTIONS_13F: list[dict[str, str]] = [
    {"id": "berkshire", "name": "버크셔 해서웨이", "manager": "워렌 버핏", "cik": "1067983"},
    {"id": "bridgewater", "name": "브릿지워터", "manager": "레이 달리오", "cik": "1350694"},
    {"id": "citadel", "name": "시타델", "manager": "켄 그리핀", "cik": "1423053"},
    {"id": "renaissance", "name": "르네상스", "manager": "짐 사이먼스", "cik": "1037389"},
    {"id": "pershing", "name": "퍼싱 스퀘어", "manager": "빌 애크먼", "cik": "1336528"},
    {"id": "tiger", "name": "타이거 글로벌", "manager": "체이스 콜먼", "cik": "1167483"},
    {"id": "baupost", "name": "바포스트", "manager": "세스 클라만", "cik": "1061768"},
    {"id": "appaloosa", "name": "아팔루사", "manager": "데이비드 테퍼", "cik": "1656456"},
    {"id": "duquesne", "name": "듀케인 패밀리", "manager": "스탠 드러켄밀러", "cik": "1536411"},
    {"id": "scion", "name": "사이언 에셋", "manager": "마이클 버리", "cik": "1649339"},
    {"id": "blackrock", "name": "블랙록", "manager": "래리 핑크", "cik": "2012383"},
    {"id": "vanguard", "name": "뱅가드", "manager": "", "cik": "102909"},
    {"id": "state_street", "name": "스테이트 스트리트", "manager": "", "cik": "93751"},
    {"id": "fidelity", "name": "피델리티(FMR)", "manager": "", "cik": "315066"},
    {"id": "millennium", "name": "밀레니엄", "manager": "이스라엘 잉글랜더", "cik": "1273087"},
    {"id": "point72", "name": "포인트72", "manager": "스티븐 코헨", "cik": "1603466"},
    {"id": "two_sigma", "name": "투 시그마", "manager": "", "cik": "1179392"},
    {"id": "deshaw", "name": "D.E. Shaw", "manager": "데이비드 쇼", "cik": "1009207"},
    {"id": "elliott", "name": "엘리엇", "manager": "폴 싱어", "cik": "1791786"},
    {"id": "third_point", "name": "서드 포인트", "manager": "댄 로브", "cik": "1040273"},
    {"id": "viking", "name": "바이킹 글로벌", "manager": "안드레아스 할보르센", "cik": "1103804"},
    {"id": "lone_pine", "name": "론 파인", "manager": "스티븐 맨델", "cik": "1061165"},
    {"id": "coatue", "name": "코투", "manager": "필리프 라퐁", "cik": "1135730"},
    {"id": "d1", "name": "D1 캐피털", "manager": "댄 선드하임", "cik": "1747057"},
    {"id": "soros", "name": "소로스 펀드", "manager": "조지 소로스", "cik": "1029160"},
    {"id": "trian", "name": "트리안", "manager": "넬슨 펠츠", "cik": "1345471"},
    {"id": "valueact", "name": "밸류액트", "manager": "메이슨 모피트", "cik": "1418814"},
    {"id": "greenlight", "name": "그린라이트", "manager": "데이비드 아인혼", "cik": "1079114"},
    {"id": "maverick", "name": "매버릭", "manager": "리 에인슬리", "cik": "934639"},
    {"id": "farallon", "name": "패럴런", "manager": "", "cik": "909661"},
    {"id": "glenview", "name": "글렌뷰", "manager": "래리 로빈스", "cik": "1138995"},
    {"id": "jana", "name": "자나 파트너스", "manager": "배리 로젠스타인", "cik": "1998597"},
    {"id": "starboard", "name": "스타보드", "manager": "제프 스미스", "cik": "1517137"},
    {"id": "ark", "name": "아크 인베스트", "manager": "캐시 우드", "cik": "1697748"},
    {"id": "whale_rock", "name": "웨일 록", "manager": "알렉스 사체라", "cik": "1387322"},
    {"id": "altimeter", "name": "알티미터", "manager": "브래드 거스트너", "cik": "1541617"},
    {"id": "element", "name": "엘리먼트", "manager": "제프리 탤핀스", "cik": "1535630"},
    {"id": "holocene", "name": "홀로신", "manager": "브랜던 해일리", "cik": "1700574"},
    {"id": "sculptor", "name": "스컬프터", "manager": "", "cik": "1054587"},
    {"id": "aqr", "name": "AQR", "manager": "클리프 애스니스", "cik": "1167557"},
    {"id": "paulson", "name": "폴슨", "manager": "존 폴슨", "cik": "1035674"},
    {"id": "icahn", "name": "아이칸", "manager": "칼 아이칸", "cik": "921669"},
    {"id": "wellington", "name": "웰링턴", "manager": "", "cik": "902219"},
    {"id": "capital_research", "name": "캐피털 리서치 글로벌", "manager": "", "cik": "1422848"},
    {"id": "trowe", "name": "티로우 프라이스", "manager": "", "cik": "80255"},
    {"id": "invesco", "name": "인베스코", "manager": "", "cik": "914208"},
    {"id": "franklin", "name": "프랭클린 리소시스", "manager": "", "cik": "38777"},
    {"id": "geode", "name": "지오드", "manager": "", "cik": "1214717"},
    {"id": "goldman", "name": "골드만삭스", "manager": "", "cik": "886982"},
    {"id": "morgan_stanley", "name": "모건스탠리", "manager": "", "cik": "895421"},
    {"id": "jpmorgan", "name": "JP모건", "manager": "", "cik": "19617"},
    {"id": "citi", "name": "씨티그룹", "manager": "", "cik": "831001"},
    {"id": "wells_fargo", "name": "웰스파고", "manager": "", "cik": "72971"},
    {"id": "northern_trust", "name": "노던 트러스트", "manager": "", "cik": "73124"},
    {"id": "bny", "name": "BNY 멜론", "manager": "", "cik": "1390777"},
    {"id": "nuveen", "name": "누빈", "manager": "", "cik": "1521019"},
    {"id": "prudential", "name": "프루덴셜", "manager": "", "cik": "1137774"},
    {"id": "alliancebernstein", "name": "얼라이언스번스틴", "manager": "", "cik": "1109448"},
    {"id": "dodge_cox", "name": "다지 앤 콕스", "manager": "", "cik": "200217"},
    {"id": "american_century", "name": "아메리칸 센추리", "manager": "", "cik": "748054"},
    {"id": "capital_world", "name": "캐피털 월드", "manager": "", "cik": "1422849"},
    {"id": "harris", "name": "해리스 어소시에이츠", "manager": "", "cik": "813917"},
    {"id": "lazard", "name": "라자드", "manager": "", "cik": "1207017"},
    {"id": "gmo", "name": "GMO", "manager": "제러미 그랜섬", "cik": "1352662"},
    {"id": "egerton", "name": "에거튼", "manager": "존 아미티지", "cik": "1581811"},
    {"id": "hound", "name": "하운드 파트너스", "manager": "조너선 아우어바흐", "cik": "1353316"},
    {"id": "redmile", "name": "레드마일", "manager": "제러미 그린", "cik": "1425738"},
    {"id": "samlyn", "name": "샘린", "manager": "로버트 폴라드", "cik": "1421097"},
    {"id": "eminence", "name": "에미넌스", "manager": "리키 샌들러", "cik": "1107310"},
    {"id": "laurion", "name": "라우리온", "manager": "", "cik": "1390202"},
    {"id": "woodline", "name": "우드라인", "manager": "", "cik": "1784547"},
    {"id": "gates", "name": "게이츠 재단", "manager": "빌 게이츠", "cik": "1166559"},
    {"id": "canyon", "name": "캐니언", "manager": "조시 프리드먼", "cik": "1074034"},
    {"id": "anchorage", "name": "앵커리지", "manager": "케빈 울리치", "cik": "1300714"},
    {"id": "king_street", "name": "킹 스트리트", "manager": "브라이언 히긴스", "cik": "1218199"},
    {"id": "balyasny", "name": "발리아스니", "manager": "드미트리 발리아스니", "cik": "1218710"},
    {"id": "exoduspoint", "name": "엑소더스포인트", "manager": "마이클 젤처", "cik": "1736225"},
    {"id": "surgo", "name": "서고캡", "manager": "만디프 만쿠", "cik": "1960830"},
    {"id": "dragoneer", "name": "드래고니어", "manager": "마크 스타드", "cik": "1602189"},
    {"id": "alkeon", "name": "알케온", "manager": "", "cik": "1230239"},
    {"id": "jericho", "name": "예리코", "manager": "조시 레서", "cik": "1525234"},
    {"id": "matrix", "name": "매트릭스 캐피털", "manager": "데이비드 고엘", "cik": "1410830"},
    {"id": "tudor", "name": "튜더", "manager": "폴 튜더 존스", "cik": "923093"},
    {"id": "moore", "name": "무어 캐피털", "manager": "루이스 베이컨", "cik": "1448574"},
    {"id": "caxton", "name": "캑스턴", "manager": "브루스 코브너", "cik": "2051323"},
    {"id": "senvest", "name": "센베스트", "manager": "리처드 마셜", "cik": "1328785"},
    {"id": "durable", "name": "듀러블 캐피털", "manager": "헨리 엘런보겐", "cik": "1798849"},
    {"id": "valinor", "name": "밸리노르", "manager": "데이비드 게일런", "cik": "1401388"},
    {"id": "capstone", "name": "캡스톤", "manager": "", "cik": "1426196"},
    {"id": "mantle_ridge", "name": "맨틀 릿지", "manager": "폴 힐랄", "cik": "1695459"},
    {"id": "engaged", "name": "인게이지드", "manager": "글렌 웰링", "cik": "1559771"},
    {"id": "sachem", "name": "사쳄 헤드", "manager": "스콧 퍼거슨", "cik": "1582090"},
    {"id": "land_buildings", "name": "랜드앤빌딩스", "manager": "조너선 리치먼", "cik": "1536520"},
    {"id": "ubs", "name": "UBS", "manager": "", "cik": "1610520"},
    {"id": "credit_suisse", "name": "크레딧 스위스", "manager": "", "cik": "824468"},
    {"id": "deutsche_bank", "name": "도이치뱅크", "manager": "", "cik": "948046"},
    {"id": "amundi", "name": "아문디", "manager": "", "cik": "1330387"},
    {"id": "legal_general", "name": "리걸앤제너럴", "manager": "", "cik": "764068"},
    {"id": "norges", "name": "노르웨이 국부펀드", "manager": "", "cik": "1374170"},
    {"id": "ontario_teachers", "name": "온타리오 교사연금", "manager": "", "cik": "937567"},
    {"id": "cppib", "name": "캐나다 연금투자위", "manager": "", "cik": "1283718"},
    {"id": "temasek", "name": "테마섹", "manager": "", "cik": "1021944"},
    {"id": "baillie", "name": "베일리 기포드", "manager": "", "cik": "1088875"},
    {"id": "orbis", "name": "오르비스(앨런 그레이)", "manager": "", "cik": "1663865"},
    {"id": "ruane", "name": "루안 커니프", "manager": "", "cik": "1720792"},
    {"id": "davis", "name": "데이비스", "manager": "크리스 데이비스", "cik": "1036325"},
    {"id": "primecap", "name": "프라임캡", "manager": "", "cik": "763212"},
    {"id": "artisan", "name": "아티산", "manager": "", "cik": "1466153"},
    {"id": "wcm", "name": "WCM", "manager": "", "cik": "1061186"},
    {"id": "ariel", "name": "아리엘", "manager": "존 로저스", "cik": "936753"},
    {"id": "southeastern", "name": "사우스이스턴", "manager": "메이슨 호킨스", "cik": "807985"},
    {"id": "third_avenue", "name": "서드 애비뉴", "manager": "", "cik": "1099281"},
    {"id": "fairfax", "name": "페어팩스", "manager": "프렘 왓사", "cik": "915191"},
    {"id": "oaktree", "name": "오크트리", "manager": "하워드 막스", "cik": "949509"},
    {"id": "ares", "name": "아레스", "manager": "", "cik": "1259313"},
    {"id": "apollo", "name": "아폴로", "manager": "", "cik": "1449434"},
    {"id": "carlyle", "name": "칼라일", "manager": "", "cik": "1527166"},
    {"id": "blackstone", "name": "블랙스톤", "manager": "스티븐 슈워츠먼", "cik": "1393818"},
    {"id": "brookfield", "name": "브룩필드", "manager": "", "cik": "1001085"},
    {"id": "tpg", "name": "TPG", "manager": "", "cik": "1903793"},
    {"id": "warburg", "name": "워버그 핀커스", "manager": "", "cik": "1162870"},
    {"id": "general_atlantic", "name": "제너럴 애틀랜틱", "manager": "", "cik": "1017645"},
    {"id": "thoma", "name": "토마 브라보", "manager": "", "cik": "1450701"},
    {"id": "vista", "name": "비스타", "manager": "로버트 스미스", "cik": "1569532"},
    {"id": "silver_lake", "name": "실버레이크", "manager": "", "cik": "1418226"},
    {"id": "adage", "name": "아다지", "manager": "", "cik": "1165408"},
    {"id": "palo_alto", "name": "팔로알토 인베스터스", "manager": "", "cik": "1306923"},
    {"id": "rtw", "name": "RTW", "manager": "로더릭 왕", "cik": "1493215"},
    {"id": "perceptive", "name": "퍼셉티브", "manager": "조지프 에델만", "cik": "1224962"},
    {"id": "orbimed", "name": "오비메드", "manager": "", "cik": "1055951"},
    {"id": "cormorant", "name": "코머런트", "manager": "비하 세시", "cik": "1583977"},
    {"id": "ra_capital", "name": "RA 캐피털", "manager": "피터 콜치스키", "cik": "1346824"},
    {"id": "cas", "name": "CAS 인베스트먼트", "manager": "클리프 소신", "cik": "1697591"},
    {"id": "venbio", "name": "벤바이오", "manager": "", "cik": "1776382"},
    {"id": "boxer", "name": "복서 캐피털", "manager": "", "cik": "1465837"},
    {"id": "paradigm", "name": "패러다임 바이오캐피털", "manager": "", "cik": "1855655"},
    {"id": "soroban", "name": "소로반", "manager": "에릭 맨델블랫", "cik": "1517857"},
    {"id": "sands_cap", "name": "샌즈 캐피털", "manager": "프랭크 샌즈", "cik": "1020066"},
    {"id": "fisher", "name": "피셔 투자", "manager": "켄 피셔", "cik": "850529"},
    {"id": "mfs", "name": "MFS", "manager": "", "cik": "912938"},
    {"id": "dimensional", "name": "디멘셔널", "manager": "데이비드 부스", "cik": "354204"},
    {"id": "janus_henderson", "name": "야누스 헨더슨", "manager": "", "cik": "1274173"},
    {"id": "macquarie", "name": "맥쿼리", "manager": "", "cik": "1418333"},
    {"id": "clearbridge", "name": "클리어브릿지", "manager": "", "cik": "1348883"},
    {"id": "harbor", "name": "하버 캐피털", "manager": "", "cik": "1039128"},
    {"id": "alyeska", "name": "알리에스카", "manager": "아누프 굽타", "cik": "1453072"},
    {"id": "schonfeld", "name": "숀펠드", "manager": "스티븐 숀펠드", "cik": "1665241"},
    {"id": "first_eagle", "name": "퍼스트 이글", "manager": "", "cik": "1325447"},
    {"id": "susquehanna", "name": "서스케해나", "manager": "제프 야스", "cik": "1446194"},
    {"id": "woodson", "name": "우드슨", "manager": "지미 엘리엇", "cik": "1697848"},
    {"id": "impala", "name": "임팔라", "manager": "로버트 비숍", "cik": "1317679"},
    {"id": "himalaya", "name": "히말라야", "manager": "리 루", "cik": "1709323"},
    {"id": "select_equity", "name": "셀렉트 이퀴티", "manager": "", "cik": "1592643"},
]

MAX_INSTITUTIONS = 160


def _assert_unique(rows: list[dict[str, str]]) -> None:
    """같은 CIK 이 두 번 나오면 즉시 실패한다.

    예전에는 여기서 조용히 dedupe 해 160개가 131개로 줄었고, '스컬프터' 항목이
    OrbiMed 의 보유 내역을 달고 화면에 떴다. 중복은 데이터가 아니라 등록 실수다 —
    묵인하지 말고 터뜨린다.
    """
    seen: dict[str, str] = {}
    dups = []
    ids = set()
    for row in rows:
        cik = str(row["cik"]).lstrip("0") or "0"
        if cik in seen:
            dups.append(f"{row['id']} == {seen[cik]} (CIK {cik})")
        seen[cik] = row["id"]
        if row["id"] in ids:
            dups.append(f"중복 id: {row['id']}")
        ids.add(row["id"])
    if dups:
        raise ValueError("institutions_13f_registry: CIK/id 중복 — " + "; ".join(dups))


_assert_unique(INSTITUTIONS_13F)

UNIQUE_INSTITUTIONS: list[dict[str, str]] = [
    {**row, "cik": (str(row["cik"]).lstrip("0") or "0").zfill(10)}
    for row in INSTITUTIONS_13F
][:MAX_INSTITUTIONS]
