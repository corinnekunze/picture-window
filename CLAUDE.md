# Picture Window feed

Plan and decisions: Linear project "TV Photo Feed" (P-MTD-8). This repo is ticket MTD-44; the TV side (MTD-47) and the MTD etc. release (MTD-50) are separate. Read README.md for the monthly loop.

## Constraints

- $0 to run: GitHub Actions, Pages and Releases only. No LLMs, paid APIs, servers or databases.
- Nothing publishes without the owner's approval through the review page. Fail closed: if anything is unclear or errors, leave the photo or the batch out.
- 4K only: every published photo is exactly 3840×2160 WebP. Non-4K TVs aren't a target.
- Images live in GitHub Releases, never in git. `docs/` is the Pages site and holds only manifests and pages.
- Upload the release before committing manifests that point at it, so TVs never see a manifest whose images are missing.
- The feed format (`src/schema.ts`, `schema: 1`) is a contract with TVs already in the field. Add optional fields freely; a breaking change needs `schema: 2`.
- Content policy: family-friendly; distant crowds are fine, close-up portraits are not. Licenses limited to PD, CC0, CC BY and CC BY-SA, and attribution is always kept.
- Wikimedia etiquette: descriptive User-Agent, `maxlag`, backoff on 429/503, standard thumbnail widths (500, 1280, 3840).

## Code

- TypeScript run by `tsx` on Node 22+; `zod` validates everything that crosses a file boundary.
- Tunables in `src/config.ts`; pure logic in `src/filters.ts` and `src/manifest.ts` (unit-tested); scripts in `stage.ts`, `publish.ts`, `revoke.ts`.
- Run `npm run typecheck && npm test` after changing code.
