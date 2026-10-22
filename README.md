# Picture Window

A free, hand-reviewed 4K photo feed for TVs: Google TV–style ambient photography without Google, servers or running costs. Photos come from [Wikimedia Commons Featured Pictures](https://commons.wikimedia.org/wiki/Commons:Featured_pictures), and about 350 new ones are added each month.

TVs read one small file, `https://corinnekunze.github.io/picture-window/index.json`, and download photos from this repo's GitHub Releases. The TV app (a companion APK with a photo screensaver, plus a CleanYourTV home wallpaper) lives in a separate repo.

## The monthly loop

1. **1st of the month, automatic.** `Stage batch` lists the Featured Pictures not seen before, filters them on metadata (4K after a 16:9 crop, landscape shape, redistributable license, no restrictions, TV-friendly subject), drops anything the free [nsfwjs](https://github.com/infinitered/nsfwjs) model rates as nude or sexual, and stages about 450 for review. It opens a "Review batch" issue, which emails you.
2. **You, about five minutes.** Open the review page linked in the issue. Every photo starts approved; click or press <kbd>Space</kbd> to reject the misfits. Press **Approve batch** and submit the GitHub issue it opens.
3. **Automatic.** `Publish batch` crops and encodes each approved photo to 3840×2160 WebP, uploads them (plus a CleanYourTV theme of 100) to a `batch-YYYY-MM` release, then updates `docs/index.json`, the batch manifest and the credits page. Batches older than six months are removed.

Nothing reaches TVs until you approve. If any step fails, nothing is published and TVs keep the current collection. Only issues opened by the repo owner are acted on.

**Revoking a photo:** run the `Revoke photos` workflow with its ID (e.g. `wmc-123456`). TVs delete it on their next daily check, and the file is removed from its release.

## Feed format

`docs/index.json` (polled daily; small):

```json
{ "schema": 1, "published": "…", "revoked": ["wmc-…"],
  "batches": [{ "id": "2026-11", "manifest": "batches/2026-11.json", "sha256": "…", "count": 350,
                "theme": "https://github.com/…/theme-2026-11.zip" }] }
```

`docs/batches/YYYY-MM.json` (never changes once published): one entry per photo with `id`, `url`, `width`, `height`, `bytes`, `sha256`, `category`, `title`, `author`, `license`, `licenseUrl` and `sourceUrl`. The schemas are in [`src/schema.ts`](src/schema.ts).

## Photo licenses

The code is MIT licensed. Every photo keeps its own license: public domain, CC0, CC BY or CC BY-SA. Attribution for every published photo is on the [credits page](https://corinnekunze.github.io/picture-window/credits.html), and each manifest entry carries its author, license and source. Share-alike photos are redistributed under their original license.

## Setup (once)

1. **Settings → Pages:** deploy from branch `main`, folder `/docs`.
2. Run **Actions → Stage batch** manually with a count of about 900 for the starter batch, then review it.

## Local commands

Node 22 or newer.

| Command | What it does |
|---|---|
| `npm test` / `npm run typecheck` | Unit tests and types |
| `npm run stage -- --count 20 --max-scan 300` | Stage a small batch locally |
| `npm run publish:batch -- --title "Approve batch 2026-11" --body-file issue.md` | Publish the staged batch, rejecting IDs listed in `issue.md` |
| `npm run revoke -- wmc-123 --reason "text on sign"` | Revoke photos |

Tuning (batch size, category share, filters, thresholds) lives in [`src/config.ts`](src/config.ts). `state/seen.jsonl` records every file ever evaluated and the decision; delete a line to let that file be considered again.
