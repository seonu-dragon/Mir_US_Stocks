// 회사 로고 원형 아이콘 — companyLogoHtml(ticker, market, name, size).
//
// 로고가 있는 종목(window.COMPANY_LOGOS 인덱스, scripts/build_company_logos.py)은 레포에 저장한 64px WebP 를
// lazy 로 그린다. 외부 로고 CDN 을 브라우저가 직접 부르지 않는다(방문자 IP 노출·가용성).
// 인덱스가 아직 안 왔거나 로고가 없으면 이름 첫 글자 모노그램. 이미지가 실패하면 조용히 모노그램으로 바꾼다.
// 인덱스가 늦게 도착하면 refreshFeatureViews 가 화면을 다시 그리므로 그때 로고로 바뀐다.
// 전역 이름: window.companyLogoHtml 하나(나머지는 IIFE 안).
(function () {
  "use strict";

  function core() { return window.MirLogoCore; }

  function nameFor(ticker, name) {
    if (name) return name;
    try {
      const row = typeof stockByTicker === "function" ? stockByTicker(ticker) : null;
      if (row) return row.name || row.company || "";
    } catch (e) { /* 무시 */ }
    return "";
  }

  // 인덱스가 아직 없어서 그린 모노그램은 data-logo-t 를 달아 두고, 인덱스가 도착하면 upgradeCompanyLogos 가 바꾼다.
  function monoHtml(C, ticker, name, px, pending, market) {
    const ch = C.monogramChar(name, ticker);
    const idx = C.monoIndex(`${C.cleanName(name) || ticker}`);
    const tag = pending ? ` data-logo-t="${escapeHtml(ticker)}"${market ? ` data-logo-m="${escapeHtml(market)}"` : ""}` : "";
    return `<span class="co-logo co-logo--mono co-logo--m${idx}" style="--co-logo:${px}px"${tag} aria-hidden="true">${escapeHtml(ch)}</span>`;
  }

  // size: 표시 크기(px, 기본 24). market: "us" | "kr" | 생략(티커 모양으로 판정).
  window.companyLogoHtml = function companyLogoHtml(ticker, market, name, size) {
    const C = core();
    const t = String(ticker || "").trim();
    if (!C || !t) return "";
    const px = Math.max(12, Math.min(64, Number(size) || 24));
    const nm = nameFor(t, name);
    const src = C.logoPath(window.COMPANY_LOGOS, t, market);
    if (!src) return monoHtml(C, t, nm, px, !window.COMPANY_LOGOS, market === "us" || market === "kr" ? market : "");
    const ch = C.monogramChar(nm, t);
    const idx = C.monoIndex(`${C.cleanName(nm) || t}`);
    return `<span class="co-logo" style="--co-logo:${px}px" data-mono="${escapeHtml(ch)}" data-mono-i="${idx}" aria-hidden="true">`
      + `<img class="co-logo-img" src="${src}" alt="" width="${px}" height="${px}" loading="lazy" decoding="async"></span>`;
  };

  // 인덱스(COMPANY_LOGOS)가 화면보다 늦게 도착한 경우: 대기 중 모노그램만 찾아 로고로 바꾼다(refreshFeatureViews 가 부른다).
  window.upgradeCompanyLogos = function upgradeCompanyLogos() {
    const C = core();
    if (!C || !window.COMPANY_LOGOS) return;
    document.querySelectorAll(".co-logo--mono[data-logo-t]").forEach((box) => {
      const t = box.dataset.logoT;
      box.removeAttribute("data-logo-t");
      const src = C.logoPath(window.COMPANY_LOGOS, t, box.dataset.logoM || null);
      if (!src) return;
      const i = Array.from(box.classList).find((c) => /^co-logo--m\d$/.test(c));
      box.dataset.mono = box.textContent;
      box.dataset.monoI = i ? i.slice(-1) : "0";
      box.classList.remove("co-logo--mono", i);
      const px = parseInt(box.style.getPropertyValue("--co-logo"), 10) || 24;
      box.innerHTML = `<img class="co-logo-img" src="${src}" alt="" width="${px}" height="${px}" loading="lazy" decoding="async">`;
    });
  };

  // 로고 이미지 실패(파일 누락·네트워크) → 모노그램으로 교체. error 는 버블링하지 않아 캡처 단계에서 받는다.
  document.addEventListener("error", (ev) => {
    const img = ev.target;
    if (!img || img.tagName !== "IMG" || !img.classList || !img.classList.contains("co-logo-img")) return;
    const box = img.parentNode;
    if (!box || !box.classList) return;
    box.classList.add("co-logo--mono", `co-logo--m${Number(box.dataset.monoI) || 0}`);
    box.textContent = box.dataset.mono || "·";
  }, true);
})();
