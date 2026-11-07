// Shared code for all three Xmas lists. Each page sets <html data-list="…" data-base="…">.
(function () {
"use strict";

// The Google Sheet's web app address (Apps Script → Deploy → Web app URL).
const API_URL = "https://script.google.com/macros/s/AKfycbzIhjO7XYnGNjbpQwdfxta2YGPt3nA9Y0JSVfSfFqVlj2e69SfVovFb2PeJXUAF47bFTg/exec";

const LISTS = {
  mini: {
    path: "", tab: "Mini Greens", title: "Mini Greens Xmas List",
    people: ["Tim", "Sue", "Lucy", "James", "Albie"],
    lede: "Tick a gift once you've bought it. It vanishes from the list for everyone, so nobody wraps the same thing twice.",
    garland: "lights", corner: "holly", particles: "snow",
  },
  aged: {
    path: "aged-greens/", tab: "Aged Greens", title: "Aged Greens Xmas List",
    people: ["Nanny Liz", "Grandpa Brian"],
    lede: "Gift ideas for Nanny and Grandpa Green. Tick one once you've bought it and it's hidden from everyone else.",
    garland: "baubles", corner: "mistletoe", particles: "sparkle",
  },
  elliott: {
    path: "elliott-aunties/", tab: "Elliott Aunties", title: "Elliott Aunties Xmas List",
    people: ["Auntie Ruth", "Auntie Pat"],
    lede: "Gift ideas for Auntie Ruth and Auntie Pat. Tick one once you've bought it and it's hidden from everyone else.",
    garland: "icicles", corner: "snowflake", particles: "flakes",
  },
};

const root = document.documentElement;
const LIST_KEY = LISTS[root.dataset.list] ? root.dataset.list : "mini";
const BASE = root.dataset.base || "";
const L = LISTS[LIST_KEY];
const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PEOPLE = L.people.map((name, i) => ({ key: slug(name), name, color: `var(--p${i + 1})` }));
const store = (k) => `xmas-${LIST_KEY}-${k}`;

const S = {
  items: [], loaded: false, error: null, updated: null,
  view: "left", who: "all", busy: new Set(),
  adding: null, editing: null, confirmDel: null,
};
let pendingRender = false;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "link"; } };
const nameOf = (key) => (PEOPLE.find(p => p.key === key) || {}).name || key;
const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const GIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="10" width="18" height="11" rx="1.5" fill="var(--berry)"/><rect x="2" y="7" width="20" height="4" rx="1" fill="var(--berry)" opacity=".85"/><rect x="11" y="7" width="2.4" height="14" fill="var(--gold)"/><path d="M12 7c-2-4-6-4-6-1.5S10 7 12 7zm0 0c2-4 6-4 6-1.5S14 7 12 7z" fill="none" stroke="var(--gold)" stroke-width="1.6"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.5 6.2 19.8l1.5-6.4L2.8 9.1l6.5-.6z" fill="var(--gold)"/></svg>';

const CORNERS = {
  holly: `<svg class="corner" viewBox="0 0 92 70" aria-hidden="true">
    <path d="M46 40 C30 22 12 30 4 18 C10 34 2 40 10 50 C18 44 30 52 34 46 C28 40 40 42 46 40Z" fill="#2c7a4f"/>
    <path d="M46 40 C30 22 12 30 4 18" fill="none" stroke="#1d5638" stroke-width="1.5"/>
    <path d="M50 40 C62 18 80 24 90 10 C86 28 92 34 86 46 C78 40 66 50 62 44 C68 38 56 42 50 40Z" fill="#358a5c"/>
    <path d="M50 40 C62 18 80 24 90 10" fill="none" stroke="#1d5638" stroke-width="1.5"/>
    <circle cx="44" cy="46" r="7" fill="#c8202f"/><circle cx="54" cy="48" r="6.5" fill="#d62c3a"/><circle cx="48" cy="56" r="6.5" fill="#b81b29"/>
    <circle cx="42" cy="44" r="2" fill="#fff" opacity=".55"/><circle cx="52" cy="46" r="1.8" fill="#fff" opacity=".55"/></svg>`,
  mistletoe: `<svg class="corner" viewBox="0 0 92 70" aria-hidden="true">
    <path d="M46 6 C46 20 44 30 46 40" fill="none" stroke="#7d8a4a" stroke-width="2"/>
    <path d="M46 26 C34 16 18 18 10 26 C20 34 36 34 46 26Z" fill="#8fb36b"/>
    <path d="M46 26 C58 14 74 16 84 22 C74 32 58 34 46 26Z" fill="#7aa45a"/>
    <path d="M46 38 C36 34 24 40 20 50 C32 52 42 46 46 38Z" fill="#6e9a4f"/>
    <path d="M46 38 C56 32 70 36 76 46 C64 50 52 46 46 38Z" fill="#8fb36b"/>
    <path d="M46 26 C34 16 18 18 10 26 M46 26 C58 14 74 16 84 22 M46 38 C36 34 24 40 20 50 M46 38 C56 32 70 36 76 46" fill="none" stroke="#56783c" stroke-width="1"/>
    <circle cx="42" cy="44" r="5" fill="#f6f1e3"/><circle cx="50" cy="45" r="4.6" fill="#efe8d4"/><circle cx="46" cy="51" r="4.6" fill="#f6f1e3"/>
    <circle cx="41" cy="42.5" r="1.4" fill="#fff"/><circle cx="49" cy="43.5" r="1.3" fill="#fff"/>
    <path d="M46 8 C38 0 32 6 40 10 Z M46 8 C54 0 60 6 52 10 Z" fill="#c22a3a"/><circle cx="46" cy="8" r="3" fill="#a3192c"/>
    <path d="M44 10 L38 20 M48 10 L54 20" stroke="#c22a3a" stroke-width="3" stroke-linecap="round"/></svg>`,
  snowflake: `<svg class="corner spin" viewBox="-36 -36 72 72" aria-hidden="true"><g stroke="#dfe8f6" stroke-width="2.4" stroke-linecap="round" fill="none">
    ${[0, 60, 120, 180, 240, 300].map(a => `<g transform="rotate(${a})"><path d="M0 0 V-30"/><path d="M0 -12 L-7 -19 M0 -12 L7 -19"/><path d="M0 -21 L-5 -26 M0 -21 L5 -26"/></g>`).join("")}
    </g><circle r="4" fill="#ffffff"/></svg>`,
};

// ---------- Page skeleton ----------
function buildPage() {
  const tabs = Object.entries(LISTS).map(([k, v]) => {
    const href = (BASE + v.path) || "./";
    return `<a href="${href}"${k === LIST_KEY ? ' aria-current="page"' : ""}>${esc(v.tab)}</a>`;
  }).join("");
  document.body.innerHTML = `
  <div class="band">
    <canvas id="particles" aria-hidden="true"></canvas>
    <svg id="garland" aria-hidden="true"></svg>
    <div class="gutter"><div class="wrap">
      <nav class="lists" aria-label="Family lists">${tabs}</nav>
      <header>
        <div class="sleeps" id="countdown">Christmas</div>
        <h1>${esc(L.title)}</h1>
        <p class="lede">${esc(L.lede)}</p>
      </header>
    </div></div>
    ${CORNERS[L.corner] || ""}
  </div>
  <div class="bar gutter"><div class="wrap">
    <div class="seg" role="group" aria-label="Which gifts to show">
      <button id="view-left" aria-pressed="true">Still to buy</button>
      <button id="view-all" aria-pressed="false">Full list</button>
    </div>
    <div class="chips" id="chips" role="group" aria-label="Whose list"></div>
  </div></div>
  <div class="gutter"><div class="wrap">
    <div id="notices"></div>
    <main id="main"><div class="status">Loading the list…</div></main>
    <footer id="footer"></footer>
  </div></div>
  <div id="toast" class="toast" role="status" hidden></div>`;
}

function countdown() {
  const now = new Date(); const xmas = new Date(now.getFullYear(), 11, 25);
  const days = Math.round((xmas - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const el = $("countdown");
  if (days > 1) el.innerHTML = `<b>${days}</b> sleeps to Christmas`;
  else if (days === 1) el.textContent = "One more sleep!";
  else if (days === 0) el.textContent = "Happy Christmas!";
  else el.textContent = `Christmas ${now.getFullYear()}`;
}

// ---------- Garlands ----------
function swagPoints(w, swags, sag, top) {
  const seg = w / swags;
  let d = `M0 ${top}`;
  for (let i = 0; i < swags; i++) d += ` Q${seg * i + seg / 2} ${top + sag * 2} ${seg * (i + 1)} ${top}`;
  const at = (i, t) => ({ x: seg * i + seg * t, y: (1 - t) * (1 - t) * top + 2 * (1 - t) * t * (top + sag * 2) + t * t * top });
  return { d, at };
}
function drawGarland() {
  const svg = $("garland"); const w = svg.clientWidth || window.innerWidth;
  let h = 46, out = "";
  if (L.garland === "lights") {
    const swags = Math.max(3, Math.round(w / 180)), { d, at } = swagPoints(w, swags, 16, 4);
    const colours = ["#e8323f", "#f2c14e", "#3fb36a", "#4f8de0", "#f07fb0"];
    out = `<path class="wire" d="${d}"/>`; let n = 0;
    for (let i = 0; i < swags; i++) for (let k = 1; k <= 5; k++) {
      const { x, y } = at(i, k / 6), c = colours[n % colours.length];
      out += `<rect class="cap" x="${x - 2.5}" y="${y}" width="5" height="4" rx="1"/>`
           + `<ellipse class="bulb" cx="${x}" cy="${y + 10}" rx="4.2" ry="6.5" fill="${c}" style="filter:drop-shadow(0 0 5px ${c});animation-delay:${((n * 0.37) % 2.6).toFixed(2)}s"/>`;
      n++;
    }
  } else if (L.garland === "baubles") {
    h = 64;
    const swags = Math.max(2, Math.round(w / 220)), { d, at } = swagPoints(w, swags, 10, 6);
    const colours = [["#a3192c", "#d84a5c"], ["#c9a24a", "#f2d68a"], ["#1f6b4a", "#4fa57a"], ["#efe2c4", "#ffffff"]];
    const lengths = [10, 22, 14, 28, 16];
    out = `<path class="tinsel" d="${d}"/><path class="tinsel-core" d="${d}"/>`; let n = 0;
    for (let i = 0; i < swags; i++) for (let k = 1; k <= 4; k++) {
      const { x, y } = at(i, k / 5), [c, hi] = colours[n % colours.length], len = lengths[n % lengths.length], r = 7 + (n % 3);
      out += `<g class="bauble" style="transform-origin:${x}px ${y}px;animation-delay:${((n * 0.53) % 4.5).toFixed(2)}s">`
           + `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + len}" stroke="#d9b867" stroke-width="1"/>`
           + `<rect x="${x - 2.5}" y="${y + len - 1}" width="5" height="4" rx="1" fill="#d9b867"/>`
           + `<circle cx="${x}" cy="${y + len + 3 + r}" r="${r}" fill="${c}"/>`
           + `<ellipse cx="${x - r * 0.35}" cy="${y + len + 3 + r * 0.6}" rx="${r * 0.32}" ry="${r * 0.22}" fill="${hi}" opacity=".75"/></g>`;
      n++;
    }
  } else if (L.garland === "icicles") {
    h = 40;
    out = `<defs><linearGradient id="ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#bcd6f5" stop-opacity=".35"/></linearGradient></defs>`
        + `<rect x="0" y="0" width="${w}" height="5" fill="#eaf2fc" opacity=".9"/>`;
    const lens = [14, 26, 9, 33, 18, 12, 29, 8, 21, 15];
    let n = 0;
    for (let x = 4; x < w; x += 13) {
      const len = lens[n % lens.length], hw = 4 + (n % 3);
      out += `<path d="M${x - hw} 4 L${x + hw} 4 L${x} ${4 + len} Z" fill="url(#ice)"/>`;
      if (n % 4 === 0) out += `<circle class="icicle-shine" cx="${x}" cy="${4 + len - 2}" r="1.6" fill="#ffffff" style="animation-delay:${((n * 0.41) % 3.4).toFixed(2)}s"/>`;
      n++;
    }
  }
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.style.height = h + "px";
  svg.innerHTML = out;
}

// ---------- Particles ----------
function particles() {
  const cv = $("particles"); const ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
  let W = 0, H = 0, P = [], t = 0;
  const kind = L.particles;
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(kind === "sparkle" ? 50 : 90, W * H / (kind === "sparkle" ? 8000 : 6000)));
    P = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, s: 0.3 + Math.random() * 0.8,
      d: Math.random() * Math.PI * 2, big: kind === "flakes" && i % 6 === 0, a: Math.random() * Math.PI,
    }));
    if (kind === "flakes") P.forEach(p => { if (p.big) { p.r = 4 + Math.random() * 3; p.s = 0.2 + Math.random() * 0.3; } });
  };
  const flake = (p) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.strokeStyle = "rgba(235,243,255,.85)"; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.moveTo(0, 0); ctx.lineTo(0, -p.r); ctx.moveTo(0, -p.r * 0.55); ctx.lineTo(-p.r * 0.3, -p.r * 0.8); ctx.moveTo(0, -p.r * 0.55); ctx.lineTo(p.r * 0.3, -p.r * 0.8); }
    ctx.stroke(); ctx.restore();
  };
  const glint = (p) => {
    const a = (Math.sin(t * 0.03 * p.s + p.d) + 1) / 2; if (a < 0.05) return;
    const r = p.r * 1.6 * (0.5 + a * 0.5);
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = "#f6d98a"; ctx.beginPath();
    ctx.moveTo(p.x, p.y - r * 2); ctx.lineTo(p.x + r * 0.35, p.y - r * 0.35); ctx.lineTo(p.x + r * 2, p.y); ctx.lineTo(p.x + r * 0.35, p.y + r * 0.35);
    ctx.lineTo(p.x, p.y + r * 2); ctx.lineTo(p.x - r * 0.35, p.y + r * 0.35); ctx.lineTo(p.x - r * 2, p.y); ctx.lineTo(p.x - r * 0.35, p.y - r * 0.35);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      if (kind === "sparkle") glint(p);
      else if (p.big) flake(p);
      else { ctx.globalAlpha = 0.35 + p.r / 4; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
  };
  const step = () => {
    t++;
    for (const p of P) {
      if (kind === "sparkle") { p.y -= p.s * 0.08; if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; } continue; }
      p.y += p.s; p.d += 0.01; p.x += Math.sin(p.d) * 0.3; p.a += 0.004;
      if (p.y > H + 8) { p.y = -8; p.x = Math.random() * W; }
    }
    draw(); if (!document.hidden) requestAnimationFrame(step);
  };
  size(); t = 40; draw();
  window.addEventListener("resize", () => { size(); draw(); });
  if (!reduceMotion) { requestAnimationFrame(step); document.addEventListener("visibilitychange", () => { if (!document.hidden) requestAnimationFrame(step); }); }
}

// ---------- Talking to the sheet ----------
async function api(body) {
  const sep = API_URL.includes("?") ? "&" : "?";
  const url = body ? API_URL : `${API_URL}${sep}list=${LIST_KEY}&t=${Date.now()}`;
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...body, list: LIST_KEY }) }
    : { method: "GET" };
  const res = await fetch(url, { ...opts, redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error("network");
  const data = await res.json();
  if (data.error) { const e = new Error(data.error); e.server = true; throw e; }
  // An older sheet script doesn't know about separate lists, so only trust it for Mini Greens.
  if ((data.list || "mini") !== LIST_KEY) { const e = new Error("script"); e.script = true; throw e; }
  return data;
}
function accept(data) {
  S.items = (data.items || []).map(it => ({ ...it, key: slug(it.person) }));
  S.updated = new Date(); S.loaded = true; S.error = null;
  render();
}
let loading = false;
async function load(quiet) {
  if (!API_URL) { S.error = "setup"; render(); return; }
  if (loading) return; loading = true;
  try { accept(await api()); }
  catch (e) { if (e.script) { S.loaded = false; S.error = "script"; render(); } else if (!quiet || !S.loaded) { S.error = "load"; render(); } }
  finally { loading = false; }
}
async function send(body, okMsg, undo) {
  try {
    accept(await api(body));
    if (okMsg) toast(okMsg, undo);
    return true;
  } catch (e) {
    if (e.script) { S.loaded = false; S.error = "script"; }
    else if (e.server && e.message === "changed") { toast("Someone else just changed the list. It's been refreshed, so try again."); load(); }
    else if (e.server) toast(e.message);
    else toast("That didn't save. Check your connection and try again.");
    render();
    return false;
  }
}

// ---------- Rendering ----------
const itemsFor = (key) => S.items.filter(i => i.key === key);
const visible = (list) => S.view === "all" ? list : list.filter(i => !i.bought);

function renderChips() {
  const all = [{ key: "all", name: "Everyone" }, ...PEOPLE];
  $("chips").innerHTML = all.map(p => {
    const n = p.key === "all" ? S.items.filter(i => !i.bought).length : itemsFor(p.key).filter(i => !i.bought).length;
    const dot = p.key === "all" ? "" : `<span class="dot" style="--c:${p.color}"></span>`;
    return `<button class="chip" data-who="${p.key}" aria-pressed="${S.who === p.key}">${dot}${esc(p.name)}${S.loaded ? ` <span class="n">${n}</span>` : ""}</button>`;
  }).join("");
  $("view-left").setAttribute("aria-pressed", S.view === "left");
  $("view-all").setAttribute("aria-pressed", S.view === "all");
}
function renderNotices() {
  const out = [];
  if (S.view === "all") out.push(`<div class="notice"><strong>No peeking!</strong> The full list shows gifts that have already been bought, so it may spoil a surprise.</div>`);
  if (S.error === "setup") out.push(`<div class="notice"><strong>Not connected yet.</strong> This page still needs the Google Sheet's web address.</div>`);
  if (S.error === "script") out.push(`<div class="notice"><strong>Nearly ready.</strong> This list needs the updated Google Sheet script before it can load. <button data-act="retry">Try again</button></div>`);
  if (S.error === "load") out.push(`<div class="notice">Can't reach the list right now. Check your connection. <button data-act="retry">Try again</button></div>`);
  $("notices").innerHTML = out.join("");
}
function editorHtml(key, item) {
  const id = item ? "r" + item.row : "new-" + key;
  return `<form class="editor" data-key="${key}" ${item ? `data-row="${item.row}"` : ""}>
    <div class="field"><label for="t-${id}">Gift</label><input id="t-${id}" name="gift" maxlength="140" required value="${esc(item?.gift)}" placeholder="e.g. Fluffy slippers"></div>
    <div class="field"><label for="n-${id}">Details</label><textarea id="n-${id}" name="details" maxlength="500" rows="2" placeholder="Size, colour, price or shop">${esc(item?.details)}</textarea></div>
    <div class="field"><label for="l-${id}">Link</label><input id="l-${id}" name="link" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="800" value="${esc(item?.link)}" placeholder="https://"></div>
    <div class="row">
      <button class="btn primary" type="submit">${item ? "Save" : "Add to list"}</button>
      <button class="btn ghost" type="button" data-act="cancel">Cancel</button>
      ${item ? `<button class="btn danger" type="button" data-act="ask-del" data-row="${item.row}">Remove</button>` : ""}
    </div>
  </form>`;
}
function itemHtml(it) {
  if (S.editing === it.row) return `<li class="item">${editorHtml(it.key, it)}</li>`;
  const link = safeUrl(it.link);
  const meta = [];
  if (link) meta.push(`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(link))} ↗</a>`);
  if (it.bought) meta.push(`<span class="badge">Bought and hidden</span>`);
  const label = it.bought ? `Untick ${it.gift}` : `Mark ${it.gift} as bought`;
  return `<li class="item${it.bought ? " bought" : ""}${S.busy.has(it.row) ? " saving" : ""}">
    <button class="tick" data-act="tick" data-row="${it.row}" aria-label="${esc(label)}" aria-pressed="${!!it.bought}">${CHECK}</button>
    <div class="body">
      <div class="title">${esc(it.gift)}</div>
      ${it.details ? `<div class="note">${esc(it.details)}</div>` : ""}
      ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
    </div>
    <button class="more" data-act="edit" data-row="${it.row}" aria-label="Edit ${esc(it.gift)}">Edit</button>
    ${S.confirmDel === it.row ? `<div class="confirm">Remove “${esc(it.gift)}” from the list? <button class="btn danger" data-act="del" data-row="${it.row}">Remove</button><button class="btn ghost" data-act="cancel-del">Keep it</button></div>` : ""}
  </li>`;
}
function sectionHtml(p) {
  const list = itemsFor(p.key), left = list.filter(i => !i.bought).length, shown = visible(list);
  let count = "";
  if (S.loaded) count = list.length === 0 ? "No ideas yet" : left === 0 ? "All wrapped up" : `${left} left${S.view === "all" ? ` of ${list.length}` : ""}`;
  let body = "";
  if (S.loaded) {
    body = shown.length
      ? `<div class="parcel"><ul class="items">${shown.map(itemHtml).join("")}</ul></div>`
      : `<div class="parcel"><div class="empty">${list.length === 0 ? GIFT : STAR}<span>${esc(list.length === 0 ? `Nothing on ${p.name}'s list yet.` : `Everything on ${p.name}'s list has been bought.`)}</span></div></div>`;
  }
  const addUi = !S.loaded ? "" : S.adding === p.key ? editorHtml(p.key, null)
    : `<button class="add" data-act="add" data-key="${p.key}" style="--c:${p.color}"><span class="plus">+</span> Add to ${esc(p.name)}'s list</button>`;
  return `<section class="person" aria-labelledby="h-${p.key}">
    <div class="tag-head"><h2 class="tag" id="h-${p.key}"><span class="swatch" style="--c:${p.color}"></span>${esc(p.name)}</h2><span class="count">${esc(count)}</span></div>
    ${body}${addUi}
  </section>`;
}
function render() {
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest("form.editor") && /INPUT|TEXTAREA/.test(ae.tagName)) { pendingRender = true; renderChips(); return; }
  pendingRender = false;
  renderChips(); renderNotices();
  const people = S.who === "all" ? PEOPLE : PEOPLE.filter(p => p.key === S.who);
  $("main").innerHTML = S.loaded ? people.map(sectionHtml).join("")
    : S.error ? "" : `<div class="status">Loading the list…</div>`;
  $("footer").innerHTML = S.updated ? `${STAR}<span>Updated ${esc(S.updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))}. The list refreshes by itself.</span>` : "";
}

let toastTimer = null;
function toast(text, undo) {
  const t = $("toast");
  t.innerHTML = `${GIFT}<span>${esc(text)}</span>${undo ? `<button id="toast-undo">Undo</button>` : ""}`;
  t.hidden = false;
  if (undo) $("toast-undo").onclick = () => { t.hidden = true; undo(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}

// ---------- Actions ----------
async function setBought(row, bought) {
  const it = S.items.find(i => i.row === row); if (!it) return;
  const prev = it.bought; it.bought = bought; S.busy.add(row); render();
  const ok = await send({ action: "bought", row, gift: it.gift, bought },
    bought ? `Ticked off “${it.gift}”` : `“${it.gift}” is back on the list`,
    bought ? () => setBought(row, false) : null);
  S.busy.delete(row);
  if (!ok) { const again = S.items.find(i => i.row === row && i.gift === it.gift); if (again) again.bought = prev; }
  render();
}

function wire() {
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "view-left" || b.id === "view-all") {
      S.view = b.id === "view-all" ? "all" : "left";
      try { localStorage.setItem(store("view"), S.view); } catch {}
      render(); return;
    }
    if (b.dataset.who) {
      S.who = b.dataset.who;
      try { localStorage.setItem(store("who"), S.who); } catch {}
      render(); return;
    }
    const act = b.dataset.act; if (!act) return;
    const row = Number(b.dataset.row);
    if (act === "retry") { S.error = null; render(); load(); }
    else if (act === "tick") { if (!S.busy.has(row)) { const it = S.items.find(i => i.row === row); if (it) setBought(row, !it.bought); } }
    else if (act === "add") { S.adding = b.dataset.key; S.editing = S.confirmDel = null; render(); document.querySelector(`form[data-key="${b.dataset.key}"]:not([data-row]) input`)?.focus(); }
    else if (act === "edit") { S.editing = row; S.adding = S.confirmDel = null; render(); document.querySelector(`form[data-row="${row}"] input`)?.focus(); }
    else if (act === "cancel") { S.adding = S.editing = null; document.activeElement?.blur(); render(); }
    else if (act === "ask-del") { S.editing = null; S.confirmDel = row; document.activeElement?.blur(); render(); }
    else if (act === "cancel-del") { S.confirmDel = null; render(); }
    else if (act === "del") {
      const it = S.items.find(i => i.row === row); S.confirmDel = null; if (!it) return;
      S.busy.add(row); render();
      const copy = { action: "add", person: it.person, gift: it.gift, details: it.details, link: it.link, bought: it.bought };
      await send({ action: "remove", row, gift: it.gift }, `Removed “${it.gift}”`, () => send(copy, `“${it.gift}” is back`));
      S.busy.delete(row); render();
    }
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("form.editor"); if (!f) return;
    e.preventDefault();
    const gift = f.gift.value.trim(); if (!gift) { f.gift.focus(); return; }
    const details = f.details.value.trim();
    let link = f.link.value.trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    link = link ? safeUrl(link) : "";
    const key = f.dataset.key, row = Number(f.dataset.row);
    f.querySelectorAll("button").forEach(x => x.disabled = true);
    document.activeElement?.blur();
    if (row) {
      const it = S.items.find(i => i.row === row);
      if (await send({ action: "edit", row, original: it ? it.gift : "", gift, details, link }, "Saved")) S.editing = null;
    } else {
      if (await send({ action: "add", person: nameOf(key), gift, details, link }, `Added to ${nameOf(key)}'s list`)) S.adding = null;
    }
    render();
  });
  document.addEventListener("focusout", () => setTimeout(() => {
    const ae = document.activeElement;
    if (!(ae && ae.closest && ae.closest("form.editor")) && pendingRender) render();
  }, 0));

  setInterval(() => { if (!document.hidden && !S.adding && !S.editing && !S.busy.size) load(true); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(true); });
}

function start() {
  try { const v = localStorage.getItem(store("view")); if (v === "all" || v === "left") S.view = v; } catch {}
  try { const w = localStorage.getItem(store("who")); if (w && (w === "all" || PEOPLE.some(p => p.key === w))) S.who = w; } catch {}
  buildPage(); countdown(); drawGarland(); particles();
  window.addEventListener("resize", drawGarland);
  wire(); render(); load();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
