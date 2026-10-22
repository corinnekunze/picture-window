// Static pages published on GitHub Pages: the review grid, the credits list, and a landing page.
import { REPO } from "./config.ts";
import type { Item, Staging } from "./schema.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

/** Shared look: a dark screening room, so photos read the way they will on a TV. */
const BASE_CSS = `
:root { color-scheme: dark; --ground:#121314; --surface:#1b1d1f; --line:#2c2f33; --ink:#ece9e4; --muted:#8f9398; --safelight:#e8a33d; --reject:#ef5350;
  --sans:"Familjen Grotesk","Helvetica Neue",Arial,sans-serif; --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace; }
* { box-sizing: border-box; }
html, body { background: var(--ground); color: var(--ink); margin: 0; }
body { font: 15px/1.5 var(--sans); padding-inline: 16px; padding-block: 0 48px; }
.wrap { max-width: 1440px; margin-inline: auto; }
a { color: var(--safelight); }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--safelight); }
h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.05; font-weight: 700; letter-spacing: -.02em; margin: 10px 0 12px; text-wrap: balance; }
.lede { color: var(--muted); max-width: 64ch; margin: 0; }
kbd { font: 11px var(--mono); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 3px; padding: 0 5px; color: var(--ink); }
header.intro { padding-block: 36px 24px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

function page(title: string, body: string, css = "", script = ""): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>${FONTS}<style>${BASE_CSS}${css}</style></head>
<body><div class="wrap">${body}</div>${script ? `<script>${script}</script>` : ""}</body></html>
`;
}

const REVIEW_CSS = `
.toolbar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--ground) 92%, transparent); backdrop-filter: blur(6px); border-block: 1px solid var(--line); padding-block: 10px; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: 500 13px var(--sans); color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.chip[aria-pressed="true"] { color: var(--ground); background: var(--ink); border-color: var(--ink); }
.count { font: 13px var(--mono); font-variant-numeric: tabular-nums; color: var(--muted); }
.count b { color: var(--ink); font-weight: 500; } .count .r { color: var(--reject); }
.spacer { flex: 1; } .keys { color: var(--muted); font-size: 12.5px; }
.approve { font: 600 14px var(--sans); background: var(--safelight); color: #1a1206; border: 0; border-radius: 4px; padding: 8px 14px; cursor: pointer; text-decoration: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; padding-block: 16px; }
.tile { position: relative; margin: 0; border-radius: 4px; overflow: hidden; background: var(--surface); cursor: pointer; outline: none; box-shadow: 0 0 0 1px var(--line); }
.tile img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; transition: filter .15s, opacity .15s; }
.tile figcaption { padding: 7px 9px 8px; display: grid; gap: 1px; }
.tile .t { font-size: 13px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .m { font: 11px var(--mono); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { position: absolute; top: 6px; font: 500 10.5px var(--mono); background: rgba(0,0,0,.6); color: #fff; padding: 1px 6px; border-radius: 2px; text-transform: uppercase; letter-spacing: .06em; }
.badge.cat { right: 6px; } .badge.flag { left: 6px; background: var(--safelight); color: #1a1206; }
.tile:hover { box-shadow: 0 0 0 1px var(--muted); } .tile:focus-visible { box-shadow: 0 0 0 2px var(--safelight); }
.tile.rejected { box-shadow: 0 0 0 2px var(--reject); }
.tile.rejected img { filter: grayscale(1); opacity: .35; }
.tile.rejected::after { content: "Rejected"; position: absolute; left: 50%; top: 28%; transform: translate(-50%, -50%); font: 600 13px var(--sans); color: #fff; background: var(--reject); padding: 3px 10px; border-radius: 3px; }
.lightbox { position: fixed; inset: 0; z-index: 20; background: rgba(5,6,7,.94); display: grid; place-items: center; padding: 24px 16px; }
.lightbox figure { margin: 0; max-width: min(1280px, 100%); display: grid; gap: 10px; }
.lightbox img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 3px; }
.lightbox figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.lightbox .t { color: var(--ink); font-size: 15px; }
@media (max-width: 820px) { .keys { display: none; } }
@media (max-width: 480px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
`;

const REVIEW_SCRIPT = `
const S = window.STAGING, REPO = window.REPO_NAME, KEY = "pw-rejects-" + S.batch;
const photos = S.candidates;
let rejected = new Set();
try { rejected = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...rejected])); } catch {} };
let filter = "all";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const big = url => url.replace(/\\/\\d+px-([^/]+)$/, "/1280px-$1");

const cats = ["all", ...new Set(photos.map(p => p.category))];
const chips = document.getElementById("chips");
chips.innerHTML = cats.map(c => {
  const n = c === "all" ? photos.length : photos.filter(p => p.category === c).length;
  return '<button class="chip" type="button" data-cat="' + c + '" aria-pressed="' + (c === filter) + '">' + (c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)) + " " + n + "</button>";
}).join("");
chips.addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  filter = b.dataset.cat;
  chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});

const grid = document.getElementById("grid");
function render() {
  grid.innerHTML = photos.filter(p => filter === "all" || p.category === filter).map(p =>
    '<figure class="tile' + (rejected.has(p.id) ? " rejected" : "") + '" tabindex="0" data-id="' + p.id + '" aria-pressed="' + rejected.has(p.id) + '" aria-label="' + esc(p.title) + '">' +
    '<img src="' + p.thumbUrl + '" alt="" loading="lazy" decoding="async">' +
    (p.flags.length ? '<span class="badge flag">' + esc(p.flags[0]) + "</span>" : "") +
    '<span class="badge cat">' + p.category + "</span>" +
    '<figcaption><span class="t">' + esc(p.title) + '</span><span class="m">' + esc(p.license) + " · " + esc(p.author) + "</span></figcaption></figure>").join("");
  update();
}
function update() {
  const r = rejected.size;
  document.getElementById("count").innerHTML = "<b>" + (photos.length - r) + "</b> approved · <b class=\\"r\\">" + r + "</b> rejected";
  const ids = photos.filter(p => rejected.has(p.id)).map(p => p.id);
  const body = (ids.length ? "reject:\\n" + ids.join("\\n") : "No rejects.") + "\\n\\nApproved from the review page.";
  document.getElementById("approve").href = "https://github.com/" + REPO + "/issues/new?title=" + encodeURIComponent("Approve batch " + S.batch) + "&body=" + encodeURIComponent(body);
}
function toggle(tile) {
  const id = tile.dataset.id;
  rejected.has(id) ? rejected.delete(id) : rejected.add(id);
  tile.classList.toggle("rejected", rejected.has(id));
  tile.setAttribute("aria-pressed", rejected.has(id));
  save(); update();
}
grid.addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) toggle(t); });

const lb = document.getElementById("lightbox");
function zoom(tile) {
  const p = photos.find(x => x.id === tile.dataset.id);
  document.getElementById("lb-img").src = big(p.thumbUrl);
  document.getElementById("lb-title").textContent = p.title;
  document.getElementById("lb-meta").innerHTML = esc(p.author) + " · " + esc(p.license) + ' · <a href="' + p.sourceUrl + '" target="_blank" rel="noopener">Source</a>';
  lb.hidden = false;
}
lb.addEventListener("click", () => { lb.hidden = true; });
document.addEventListener("keydown", e => {
  if (!lb.hidden) { if (e.key === "Escape" || e.key.toLowerCase() === "z") { lb.hidden = true; e.preventDefault(); } return; }
  const tile = document.activeElement && document.activeElement.closest && document.activeElement.closest(".tile");
  const tiles = [...grid.querySelectorAll(".tile")];
  if (e.key === " " && tile) { e.preventDefault(); toggle(tile); }
  else if (e.key.toLowerCase() === "z" && tile) zoom(tile);
  else if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    if (!tile) { tiles[0] && tiles[0].focus(); return; }
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    tiles[Math.max(0, Math.min(tiles.length - 1, tiles.indexOf(tile) + step))].focus();
  }
});
render();
`;

export function renderReviewPage(staging: Staging): string {
  const flagged = staging.candidates.filter((c) => c.flags.length).length;
  const body = `
<header class="intro">
  <div class="eyebrow">Picture Window · batch ${esc(staging.batch)}</div>
  <h1>Review ${staging.candidates.length} photos</h1>
  <p class="lede">Every photo starts approved. Click one or press <kbd>Space</kbd> to reject it; <kbd>Z</kbd> shows it larger. ${flagged ? `${flagged} flagged as possibly suggestive are at the top. ` : ""}When you're done, press <strong>Approve batch</strong> and submit the GitHub issue it opens. The rest is published automatically. Your rejects are remembered in this browser until then.</p>
</header>
<div class="toolbar">
  <div class="chips" id="chips" role="group" aria-label="Filter by category"></div>
  <div class="count" id="count" aria-live="polite"></div>
  <div class="spacer"></div>
  <div class="keys"><kbd>←</kbd><kbd>→</kbd> move · <kbd>Space</kbd> reject · <kbd>Z</kbd> zoom</div>
  <a class="approve" id="approve" href="#" target="_blank" rel="noopener">Approve batch</a>
</div>
<main class="grid" id="grid"></main>
<div class="lightbox" id="lightbox" hidden><figure><img id="lb-img" alt=""><figcaption><span class="t" id="lb-title"></span><span id="lb-meta"></span></figcaption></figure></div>`;
  const script = `window.STAGING = ${json({ batch: staging.batch, candidates: staging.candidates })}; window.REPO_NAME = ${json(REPO)};\n${REVIEW_SCRIPT}`;
  return page(`Review ${staging.batch} · Picture Window`, body, REVIEW_CSS + "[hidden]{display:none!important}", script);
}

export function renderNothingToReview(): string {
  return page("Review · Picture Window", `<header class="intro"><div class="eyebrow">Picture Window</div><h1>Nothing to review</h1><p class="lede">The next batch is staged on the 1st of the month. GitHub opens an issue when it's ready.</p></header>`);
}

const CREDITS_CSS = `
table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font: 500 11.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
td.id { font: 12px var(--mono); color: var(--muted); white-space: nowrap; }
.scroll { overflow-x: auto; }
`;

export function renderCredits(items: Item[], published: string): string {
  const rows = items.map((i) => `<tr><td class="id">${i.id}</td><td><a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener">${esc(i.title)}</a></td><td>${esc(i.author)}</td><td>${i.licenseUrl ? `<a href="${esc(i.licenseUrl)}" target="_blank" rel="noopener">${esc(i.license)}</a>` : esc(i.license)}</td></tr>`).join("\n");
  const body = `
<header class="intro"><div class="eyebrow">Picture Window · photo credits</div><h1>${items.length} photographs, ${items.length === 1 ? "its" : "their"} authors and licenses</h1>
<p class="lede">Every photo comes from Wikimedia Commons Featured Pictures and is resized and cropped to 3840×2160 for TVs. Share-alike photos keep their original license. Updated ${published.slice(0, 10)}.</p></header>
<div class="scroll"><table><thead><tr><th>ID</th><th>Photo</th><th>Author</th><th>License</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return page("Credits · Picture Window", body, CREDITS_CSS);
}

export function renderLanding(): string {
  return page("Picture Window", `<header class="intro"><div class="eyebrow">Picture Window</div><h1>A free 4K photo feed for TVs</h1>
<p class="lede">Hand-reviewed photography from Wikimedia Commons Featured Pictures, refreshed monthly. TVs read <a href="index.json">index.json</a>. See the <a href="credits.html">photo credits</a> or the <a href="https://github.com/${esc(REPO)}">source</a>.</p></header>`);
}
