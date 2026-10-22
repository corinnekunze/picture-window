# Picture Window

Picture Window is a free collection of beautiful 4K photographs for TV screens, refreshed every month. It works like the ambient photo slideshow on Google TV, without Google, accounts, ads or tracking.

Every photo comes from [Wikimedia Commons Featured Pictures](https://commons.wikimedia.org/wiki/Commons:Featured_pictures), the photographs the Commons community has voted the best of its collection. Each one is checked by software and then by a person before it reaches any TV, so the feed stays family-friendly: landscapes, wildlife, architecture, cities and space.

This repository is the feed itself: the pipeline that picks the photos, and the published files TVs download. The TV app that displays them lives in a separate repository.

## Why it exists

Google TV's ambient mode is one of the nicest things about it. Leave the TV idle and it fills the room with photography. But it only works inside Google's launcher, and tools that strip that launcher out to make a TV faster and quieter, like [CleanYourTV](https://github.com/Gathin23/cleanyourtv), take the photos away with it. Google Photos no longer lets other apps read your albums either, so there's no easy substitute.

Picture Window brings the photos back on these terms:

- **Free to run, forever.** No servers, databases or paid services. Everything runs on GitHub's free hosting and automation.
- **No tracking.** TVs download plain public files. Nothing identifies a TV or reports what it shows.
- **Family-friendly by review, not by hope.** Automated filters do the bulk of the work, and a person approves every batch before it publishes.
- **Properly licensed.** Only photos whose licenses allow redistribution are used, and every photographer is credited.
- **Actually 4K.** Every photo is delivered at exactly 3840×2160, and also as a one-frame 4K video: most TVs draw apps at 1080p but play video at full 4K.
- **Fresh.** About 350 new photos a month, keeping the latest six months: roughly 2,100 photos once the collection is full, so the same picture rarely comes back.

## How it works

```
 1st of each month                     Within a few days                 Every day
 ─────────────────                     ─────────────────                 ─────────
 GitHub Action finds new          →    A person reviews them       →     TVs check for
 Featured Pictures, filters            on one web page and               new photos and
 them, and stages ~450                 rejects the misfits;              download them
 candidates for review                 the rest publish automatically
```

### 1. Finding candidates (automatic)

Once a month, a GitHub Action looks through the 22,000+ Featured Pictures on Commons, skipping any it has seen before, and runs each through a series of checks. The first one a photo fails rules it out:

| Check | Why |
|---|---|
| Landscape shape, roughly 16:9 | TVs are wide; tall photos and long panoramas would be mostly cropped away |
| At least 3840×2160 after cropping to 16:9 | Every photo must fill a 4K screen |
| A real photograph (JPEG) | Drops most diagrams, maps and scans |
| Public domain, CC0, CC BY or CC BY-SA license | These allow the photo to be shared again, with credit |
| No legal restrictions noted on Commons | Skips trademarks, insignia and identifiable people's rights |
| No blocked subjects | Words like war, weapons, portraits, insects, museums and memorials in the title or categories rule a photo out |
| A TV-friendly subject | Nature, wildlife, architecture, cities or space |
| Not nude or suggestive | A small open-source image model ([nsfwjs](https://github.com/infinitered/nsfwjs)) rejects clear cases and flags borderline ones for a closer look |

The first checks only read each photo's description, so nothing is downloaded until a photo has passed them. Every decision is written to a log (`state/seen.jsonl`), so no photo is ever evaluated twice. About 450 photos that pass are staged for review, with no subject making up more than 30% of the batch, because Featured Pictures has a lot of birds.

### 2. Review (a person, about five minutes)

The Action publishes a review page showing every candidate in one grid, and opens a GitHub issue to say it's ready. The reviewer scrolls through and clicks anything that doesn't belong. Every photo starts approved, so only the misfits need a click. Approving the batch opens a GitHub issue listing the rejects.

Software alone isn't enough here. Keyword filters miss context: a war memorial filed under "nature", a security guard filed under "cities", text on a sign. A short human pass catches what they miss.

### 3. Publishing (automatic)

When the repository owner opens that approval issue, a second Action:

1. downloads each approved photo at full size and crops it to 16:9 around its most interesting area;
2. saves it as a 3840×2160 WebP image, about 1.5 MB on average, and as a one-frame 4K HEVC video, about 3 MB;
3. uploads the photos to a GitHub Release for that month, along with a ready-made CleanYourTV theme of 100 of them, and the videos to a second Release (GitHub allows 1,000 files per Release);
4. updates the public list of photos and the credits page, and drops batches older than six months.

The photos go up before the list that points to them, so a TV never sees a photo it can't download. If any step fails, nothing changes and TVs keep the collection they have.

### 4. On the TV (daily)

TVs check one small file once a day, [`index.json`](https://corinnekunze.github.io/picture-window/index.json), and download any new photos a few at a time, verifying each against its checksum. If a published photo ever needs to come down, it's added to that file's `revoked` list and TVs delete it on their next check.

## Using the photos

- **On Android TV:** the companion app (a photo screensaver and home-screen wallpaper) is in progress.
- **With CleanYourTV:** each monthly release on the [Releases page](https://github.com/corinnekunze/picture-window/releases) includes a `theme-YYYY-MM.zip`. Unzip it and push it with CleanYourTV's `tools/theme.sh` for 100 rotating 4K wallpapers.
- **Anything else:** the feed is plain JSON plus image files, so any app can read it. The format is described below.

## Credits and licenses

Every photo keeps its own license and credit. The [credits page](https://corinnekunze.github.io/picture-window/credits.html) lists the photographer, license and source page for every photo currently in the feed, and each entry in the feed carries the same information. Photos under share-alike licenses (CC BY-SA) are redistributed under that same license.

The code in this repository is MIT licensed.

## Cost

$0 a month. GitHub Actions, Pages and Releases are free for public repositories, the Wikimedia Commons API is free, and the safety model runs inside the Action. Rendering a month's photos and videos takes about an hour of GitHub's free compute.

---

## For developers

### Feed format

`index.json` is the small file TVs check daily:

```json
{
  "schema": 1,
  "published": "2026-10-22T15:40:00.000Z",
  "revoked": ["wmc-123456"],
  "batches": [
    { "id": "2026-10", "manifest": "batches/2026-10.json", "sha256": "…", "count": 880,
      "theme": "https://github.com/corinnekunze/picture-window/releases/download/batch-2026-10/theme-2026-10.zip" }
  ]
}
```

Each `batches/YYYY-MM.json` lists every photo with `id`, `url`, `width`, `height`, `bytes`, `sha256`, `category`, `title`, `author`, `license`, `licenseUrl`, `sourceUrl` and, optionally:

- `video`: `url`, `bytes` and `sha256` of a one-frame 3840×2160 HEVC MP4;
- `credit`: the short name a TV shows as "Photo by …", cleaned from the Commons author field (no emails, links, licenses, notices or derivative-work editors; at most 80 characters, checked against a profanity list). Absent when no clean name could be found, in which case TVs show no credit rather than the raw `author`;
- `place`: roughly where the photo was taken, town or region and country ("Zug, Switzerland"), from the file's camera coordinates via [OpenStreetMap Nominatim](https://nominatim.org/). Place data © OpenStreetMap contributors.
 A published photo's image never changes; a batch file only changes to add optional fields, as when videos were added to 2026-10. The schemas are in [`src/schema.ts`](src/schema.ts). New fields may be added; a breaking change would bump `schema`.

### Repository layout

| Path | What it holds |
|---|---|
| `src/cli/` | The entry points: `stage.ts`, `publish.ts`, `revoke.ts`, and `add-videos.ts` / `add-details.ts` for batches published before videos and credits |
| `src/` | Library modules: filters, the Commons API client, the safety model, photo rendering, manifests, the site |
| `src/config.ts` | Everything worth tuning: batch size, category share, filters, thresholds |
| `templates/` | Page markup ([Eta](https://eta.js.org) templates) |
| `docs/` | The GitHub Pages site. `docs/assets/` is hand-written; everything else is generated |
| `state/` | The decision log, the revoked list, and cached place names |
| `staging/` | The batch waiting for review, if there is one |
| `.github/workflows/` | Stage (monthly), Publish (on approval), Revoke (manual), Add videos (manual), Test |

### Running locally

Node 22 or newer, and ffmpeg with libx265 for the videos. `npm install`, then:

| Command | What it does |
|---|---|
| `npm test` / `npm run typecheck` | Unit tests and type checks |
| `npm run stage -- --count 20 --max-scan 300` | Stage a small batch |
| `npm run publish:batch -- --title "Approve batch 2026-11" --body-file issue.md` | Publish the staged batch, leaving out the IDs listed in `issue.md` |
| `npm run revoke -- wmc-123456 --reason "text on sign"` | Revoke photos |
| `npm run add-videos -- --batch 2026-10` | Add 4K videos to a batch published without them |
| `npm run add-details -- --batch 2026-10 --report out/details.tsv` | Add on-screen credits and places to a batch published without them, writing one line per photo to check |

### Maintaining

- **Revoking a photo:** run the **Revoke photos** workflow with its ID (shown on the credits page). It's removed from the feed and its release.
- **Reconsidering a photo:** delete its line in `state/seen.jsonl` and it will be evaluated again next month.
- **Only the repository owner's approval publishes anything.** Issues opened by anyone else are ignored.
- **Setting up a copy:** fork the repo, turn on GitHub Pages (branch `main`, folder `/docs`), and run **Stage batch** by hand. Swap the filters in `src/config.ts` for your own taste.

Made by [Corinne Kunze](https://github.com/corinnekunze) for MTD etc.
