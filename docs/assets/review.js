// Review grid: the tiles are rendered by the build (templates/review.eta); this
// script only toggles rejects, filters, zooms, and builds the approval link.

const { batch, repo } = document.body.dataset;
const storageKey = `picture-window-rejects-${batch}`;

const grid = document.getElementById("grid");
const tiles = [...grid.querySelectorAll(".tile")];
const chips = document.getElementById("chips");
const lightbox = document.getElementById("lightbox");
const rejectedIds = loadRejectedIds();

function loadRejectedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveRejectedIds() {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...rejectedIds]));
  } catch {
    // Private windows can refuse storage; the page still works without it.
  }
}

function showRejected(tile) {
  const rejected = rejectedIds.has(tile.dataset.id);
  tile.classList.toggle("rejected", rejected);
  tile.setAttribute("aria-pressed", String(rejected));
}

function approvalUrl() {
  const ids = tiles.map((tile) => tile.dataset.id).filter((id) => rejectedIds.has(id));
  const rejectList = ids.length ? `reject:\n${ids.join("\n")}` : "No rejects.";
  const params = new URLSearchParams({
    title: `Approve batch ${batch}`,
    body: `${rejectList}\n\nApproved from the review page.`,
  });
  return `https://github.com/${repo}/issues/new?${params}`;
}

function updateSummary() {
  document.getElementById("approved-count").textContent = String(tiles.length - rejectedIds.size);
  document.getElementById("rejected-count").textContent = String(rejectedIds.size);
  document.getElementById("approve").href = approvalUrl();
}

function toggleRejected(tile) {
  const photoId = tile.dataset.id;
  const wasRejected = rejectedIds.delete(photoId);
  if (!wasRejected) rejectedIds.add(photoId);
  showRejected(tile);
  saveRejectedIds();
  updateSummary();
}

function filterByCategory(category) {
  for (const tile of tiles) tile.hidden = category !== "all" && tile.dataset.category !== category;
  for (const chip of chips.querySelectorAll(".chip")) {
    chip.setAttribute("aria-pressed", String(chip.dataset.category === category));
  }
}

function openLightbox(tile) {
  const { zoom, title, author, license, source } = tile.dataset;
  document.getElementById("lightbox-image").src = zoom;
  document.getElementById("lightbox-title").textContent = title;
  document.getElementById("lightbox-credit").textContent = `${author} · ${license}`;
  document.getElementById("lightbox-source").href = source;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
}

function visibleTiles() {
  return tiles.filter((tile) => !tile.hidden);
}

function moveFocus(fromTile, key) {
  const visible = visibleTiles();
  if (!fromTile) {
    visible[0]?.focus();
    return;
  }
  const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[key];
  const target = Math.max(0, Math.min(visible.length - 1, visible.indexOf(fromTile) + step));
  visible[target].focus();
}

function focusedTile() {
  return document.activeElement?.closest?.(".tile") ?? null;
}

function handleKey(event) {
  const key = event.key;

  if (!lightbox.hidden) {
    if (key !== "Escape" && key.toLowerCase() !== "z") return;
    event.preventDefault();
    closeLightbox();
    return;
  }

  if (key.startsWith("Arrow")) {
    event.preventDefault();
    moveFocus(focusedTile(), key);
    return;
  }

  const tile = focusedTile();
  if (!tile) return;

  if (key === " ") {
    event.preventDefault();
    toggleRejected(tile);
    return;
  }
  if (key.toLowerCase() === "z") openLightbox(tile);
}

grid.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");
  if (tile) toggleRejected(tile);
});
chips.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) filterByCategory(chip.dataset.category);
});
lightbox.addEventListener("click", closeLightbox);
document.addEventListener("keydown", handleKey);

tiles.forEach(showRejected);
updateSummary();
