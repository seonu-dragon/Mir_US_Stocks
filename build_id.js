/**
 * Single source of truth for cache-busting. 손으로 고치지 말 것 —
 *   py scripts/stamp_build_id.py
 * 가 자산 내용 해시로 이 값과 index/analysis.html 의 ?v=, sw.js 의
 * BUILD_ID_FALLBACK 을 함께 스탬프한다.
 *   sw.js — install 시 build_id.js를 읽어 CACHE_NAME 자동 동기화
 */
window.MIR_BUILD_ID = "dea137ba07";