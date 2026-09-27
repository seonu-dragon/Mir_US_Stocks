// inst-holders-core.js — 종목별 기관 보유 변화(13F)의 순수 계산(DOM 없음). 화면은 inst-holders.js.
// 데이터: data/institutional_holders/<첫 글자>.json 의 레코드(scripts/build_13f_holders.py 가 만든다)
//   h/s/v = 최신 분기 보고 기관 수·보유 주식 합·가치($) · ph/ps/pv = 직전 분기 · p = 발행주식 대비 %
//   c = [신규, 전량 청산, 증가, 감소, 유지, 비교 가능 기관 수] (두 분기 모두 13F 를 낸 기관끼리)
//   top = [[CIK, 주식 수, 직전 주식 수(null=직전 13F 없음), 가치], …] · o = [콜 기관, 콜 주식, 풋 기관, 풋 주식]
//   tr = 분기별 [기관 수, 주식 수, 가치] | null (인덱스 quarters 순서) · split = 분기 중 분할 추정 비율
// node 테스트: scripts/tests/test_inst_holders_core.mjs
(function (root) {
  "use strict";

  function num(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function shardKey(ticker) {
    const c = String(ticker || "_").charAt(0).toUpperCase();
    return c >= "A" && c <= "Z" ? c : "_";
  }

  // "2026-06-30" → "2026년 2분기" (short: "26.2Q")
  function quarterLabel(iso, short) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(iso || ""));
    if (!m) return "";
    const q = Math.ceil(Number(m[2]) / 3);
    return short ? `${m[1].slice(2)}.${q}Q` : `${m[1]}년 ${q}분기`;
  }

  function pctChange(cur, prev) {
    const a = num(cur), b = num(prev);
    if (a === null || b === null || !(b > 0)) return null;
    return ((a - b) / b) * 100;
  }

  // 요약 수치. 주식 수 변화는 분할이 추정되면 직전 값을 비율로 맞춘 뒤 계산한다.
  function summarize(rec) {
    if (!rec || !(num(rec.h) > 0)) return null;
    const split = num(rec.split);
    const adjPrevShares = num(rec.ps) !== null ? rec.ps * (split || 1) : null;
    const c = Array.isArray(rec.c) ? rec.c : [];
    const o = Array.isArray(rec.o) ? rec.o : null;
    return {
      holders: rec.h,
      prevHolders: num(rec.ph),
      holdersDelta: num(rec.ph) !== null ? rec.h - rec.ph : null,
      shares: num(rec.s),
      sharesDeltaPct: pctChange(rec.s, adjPrevShares),
      value: num(rec.v),
      valueDeltaPct: pctChange(rec.v, rec.pv),
      pctOut: num(rec.p),
      split: split || null,
      changes: {
        newPos: num(c[0]) || 0, closed: num(c[1]) || 0, inc: num(c[2]) || 0,
        dec: num(c[3]) || 0, same: num(c[4]) || 0, comparable: num(c[5]) || 0,
      },
      options: o && (o[0] > 0 || o[2] > 0)
        ? { callHolders: num(o[0]) || 0, callShares: num(o[1]) || 0, putHolders: num(o[2]) || 0, putShares: num(o[3]) || 0 }
        : null,
    };
  }

  // 신규·증가·감소·청산 막대 폭(%, 가장 큰 칸 = 100).
  function changeBars(changes) {
    const rows = [
      { key: "newPos", label: "신규 편입", n: changes.newPos, dir: "pos" },
      { key: "inc", label: "보유 증가", n: changes.inc, dir: "pos" },
      { key: "dec", label: "보유 감소", n: changes.dec, dir: "neg" },
      { key: "closed", label: "전량 청산", n: changes.closed, dir: "neg" },
    ];
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, width: Math.round((r.n / max) * 1000) / 10 }));
  }

  // SEC 제출인 이름의 주(州) 표기 꼬리(" /DE/", "\AZ")를 뗀다. 대소문자는 원문 그대로.
  function cleanFilerName(name) {
    return String(name || "")
      .replace(/\s*\/[A-Z]{2,3}\/?\s*$/g, "")
      .replace(/\\[A-Z]{2,3}\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 상위 보유 기관 표 행. links = {CIK: {id, name}} (이 사이트 13F 기관 포트폴리오에 있는 기관).
  function topRows(rec, names, links) {
    const total = num(rec && rec.s) || 0;
    const split = num(rec && rec.split) || 1;
    return ((rec && rec.top) || []).map((row) => {
      const [cik, shares, prev, value] = row;
      const key = String(cik);
      let status = "na";
      let delta = null;
      let deltaPct = null;
      if (prev !== null && prev !== undefined) {
        delta = shares - prev;
        if (!(prev > 0)) status = "new";
        else {
          deltaPct = (delta / prev) * 100;
          status = Math.abs(deltaPct) < 0.1 ? "same" : deltaPct > 0 ? "inc" : "dec";
        }
      }
      const link = links && links[key] ? links[key] : null;
      return {
        cik: key,
        name: cleanFilerName((names && names[key]) || "") || `CIK ${key}`,
        shares, prevShares: prev, value, status, delta, deltaPct,
        weightPct: total > 0 ? (shares / total) * 100 : null,
        link, split: split !== 1,
      };
    });
  }

  const STATUS_LABEL = { new: "신규", inc: "증가", dec: "감소", same: "유지", na: "비교 불가" };
  function statusLabel(s) { return STATUS_LABEL[s] || ""; }

  // 분기 추이 — quarters(오래된 → 최신)와 rec.tr 을 맞춘다. 빠진 분기는 null.
  function trendSeries(rec, quarters) {
    const tr = (rec && rec.tr) || [];
    return (quarters || []).map((q, i) => {
      const x = tr[i];
      return Array.isArray(x) ? { period: q, holders: num(x[0]), shares: num(x[1]), value: num(x[2]) } : { period: q, holders: null, shares: null, value: null };
    });
  }

  // 스파크라인 좌표. null 은 건너뛰고 선을 끊는다. {path, points:[{x,y,v,i}], min, max}
  function sparkline(values, w, h, pad) {
    const p = pad === undefined ? 3 : pad;
    const vals = (values || []).map(num);
    const ok = vals.filter((v) => v !== null);
    if (ok.length < 2) return null;
    let min = Math.min(...ok), max = Math.max(...ok);
    if (max === min) { max += 1; min -= 1; }
    const n = vals.length;
    const step = n > 1 ? (w - 2 * p) / (n - 1) : 0;
    const points = [];
    let path = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      const x = p + step * i;
      const y = p + (h - 2 * p) * (1 - (v - min) / (max - min));
      points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, v, i });
      path += `${pen ? "L" : "M"}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
      pen = true;
    });
    return { path, points, min: Math.min(...ok), max: Math.max(...ok) };
  }

  function fmtShares(n) {
    const v = num(n);
    if (v === null) return "—";
    const a = Math.abs(v);
    if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B주`;
    if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M주`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K주`;
    return `${Math.round(v).toLocaleString("en-US")}주`;
  }

  function fmtUsd(n) {
    const v = num(n);
    if (v === null) return "—";
    const a = Math.abs(v);
    if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${Math.round(v).toLocaleString("en-US")}`;
  }

  function fmtSignedPct(p, digits) {
    const v = num(p);
    if (v === null) return "—";
    const d = digits === undefined ? 1 : digits;
    return `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
  }

  function fmtSignedInt(n) {
    const v = num(n);
    if (v === null) return "—";
    return `${v > 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
  }

  const api = {
    shardKey, quarterLabel, pctChange, summarize, changeBars, cleanFilerName, topRows, statusLabel,
    trendSeries, sparkline, fmtShares, fmtUsd, fmtSignedPct, fmtSignedInt,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MirInstHoldersCore = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
