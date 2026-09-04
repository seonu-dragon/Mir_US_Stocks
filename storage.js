/**
 * safeStorage — localStorage 를 try/catch 로 감싼 최소 래퍼.
 *
 * 브라우저가 저장소를 막으면(사파리 프라이빗·서드파티 iframe·쿠키 차단) localStorage
 * 접근 자체가 SecurityError 를 던진다. 최상위에서 직접 getItem 을 부르는 파일은
 * 그 한 줄 때문에 파일 전체가 평가되지 않아 부팅이 죽었다(community.js 사례).
 * 모든 파일은 이 객체만 쓰고, 실패는 fallback 값으로 조용히 흡수한다.
 *
 * index.html·analysis.html 의 **첫 외부 스크립트**로 로드한다(2026-09-04). 예전엔 각 파일이
 * 같은 API 의 인라인 폴백을 복사해 갖고 있었는데 중복이라 제거했다. 아래 한 줄 가드만 남긴다.
 */
(function () {
  if (window.safeStorage) return;
  window.safeStorage = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null || v === undefined ? fallback : v;
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, String(value)); return true; } catch (_) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); return true; } catch (_) { return false; }
    },
    getJSON(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (_) { return fallback; }
    },
    setJSON(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
    },
  };
})();
