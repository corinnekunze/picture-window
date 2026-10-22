# Picture Window feed

Plan and decisions: Linear project "TV Photo Feed" (P-MTD-8). This repo is ticket MTD-44; the TV side (MTD-47) and the MTD etc. release (MTD-50) are separate. Read README.md for the monthly loop.

## Constraints

- $0 to run: GitHub Actions, Pages and Releases only. No LLMs, paid APIs, servers or databases.
- Nothing publishes without the owner's approval through the review page. Fail closed: if anything is unclear or errors, leave the photo or the batch out.
- 4K only: every published photo is exactly 3840×2160 WebP, plus an optional one-frame 3840×2160 HEVC MP4 (`video`) because TVs draw apps at 1080p but play video at 4K. Non-4K TVs aren't a target.
- Images live in GitHub Releases, never in git. `docs/` is the Pages site and holds only manifests and pages.
- Upload the release before committing manifests that point at it, so TVs never see a manifest whose images are missing.
- The feed format (`src/schema.ts`, `schema: 1`) is a contract with TVs already in the field. Add optional fields freely; a breaking change needs `schema: 2`.
- Content policy: family-friendly; distant crowds are fine, close-up portraits are not. Licenses limited to PD, CC0, CC BY and CC BY-SA, and attribution is always kept.
- Wikimedia etiquette: descriptive User-Agent, `maxlag`, backoff on 429/503, standard thumbnail widths (500, 1280, 3840).
- OpenStreetMap Nominatim etiquette (places): at most one request a second, descriptive User-Agent, every answer cached in `state/places.json`, attribution on the credits page. Places stay vague: town or region and country, never coordinates.
- On-screen credits (`credit.ts`) show only cleaned names; when cleaning fails, TVs show no credit, never the raw author. Real names the profanity check trips on go in `CREDIT_ALLOW` after the owner checks them.

## Code

- TypeScript run by `tsx` on Node 22+; `zod` validates everything that crosses a file or network boundary.
- `src/cli/` holds the entry points (stage, publish, revoke, and add-videos / add-details for batches published before videos and credits), each a `main()` made of small named steps. Everything else in `src/` is a library module: `config.ts` (tunables), `paths.ts`, `io.ts`, `ledger.ts`, `commons.ts`, `filters.ts`, `safety.ts`, `photo.ts`, `video.ts` (ffmpeg), `credit.ts` (on-screen names), `places.ts` (Nominatim), `theme.ts`, `manifest.ts`, `approval.ts`, `site.ts`.
- HTML comes from Eta templates in `templates/` (auto-escaped). Never build markup in TypeScript or browser JS strings. `docs/assets/` (CSS and the review page script) is hand-written; everything else in `docs/` is generated.
- Style: descriptive names (no single-letter variables or parameters, including in callbacks), early returns instead of nested if/else, one job per function.
- Run `npm run typecheck && npm test` after changing code.
