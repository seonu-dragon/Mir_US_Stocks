/**
 * Single source of truth for cache-busting.
 * When bumping MIR_BUILD_ID, also update:
 *   index.html, analysis.html — ?v= query strings
 *   sw.js — CACHE_NAME suffix
 */
window.MIR_BUILD_ID = "20260701a";