// The photos page's category filter. Every photo is in the HTML; this only hides and shows them.
const chips = [...document.querySelectorAll(".chip")];
const tiles = [...document.querySelectorAll(".tile")];
const batches = [...document.querySelectorAll(".batch")];

function showCategory(category) {
  for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.category === category));
  for (const tile of tiles) tile.hidden = category !== "all" && tile.dataset.category !== category;
  for (const batch of batches) batch.hidden = !batch.querySelector(".tile:not([hidden])");
}

for (const chip of chips) chip.addEventListener("click", () => showCategory(chip.dataset.category));
