/**
 * Single source of truth for cache-busting.
 * When bumping MIR_BUILD_ID, also update:
 *   index.html, analysis.html — ?v= query strings
 *   sw.js — install 시 build_id.js를 읽어 CACHE_NAME 자동 동기화
 */
window.MIR_BUILD_ID = "20260701a";