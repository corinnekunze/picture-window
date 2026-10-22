// Everything a maintainer might tune lives here.

export const REPO = process.env.GITHUB_REPOSITORY ?? "corinnekunze/picture-window";
export const [OWNER, REPO_NAME] = REPO.split("/") as [string, string];
export const PAGES_URL = `https://${OWNER}.github.io/${REPO_NAME}`;

/** Wikimedia asks every API client for a descriptive User-Agent with contact details. */
export const USER_AGENT = `PictureWindow/1.0 (https://github.com/${REPO}; hello@mtdetc.com)`;

export const SOURCE_CATEGORY = "Category:Featured_pictures_on_Wikimedia_Commons";

/** Output size: every published photo is exactly 4K UHD. */
export const OUT_WIDTH = 3840;
export const OUT_HEIGHT = 2160;
export const WEBP_QUALITY = 90;

/**
 * Each photo also ships as a one-frame 4K HEVC video. TVs draw apps at 1080p but play video at full
 * 4K, so the screensaver shows the video when the TV can. CRF 14 keeps it visually lossless (~3 MB).
 */
export const VIDEO_CRF = 14;
export const VIDEO_PRESET = "medium";

/** Widest and narrowest source aspect we accept; outside this the 16:9 crop loses too much. */
export const MIN_ASPECT = 1.4;
export const MAX_ASPECT = 2.4;

/** Candidates staged for review per month; about 20% are expected to be rejected. */
export const STAGE_COUNT = 450;
/** No category may take more than this share of a batch (Featured Pictures skews to birds). */
export const MAX_CATEGORY_SHARE = 0.3;

/** Batches kept in the published index: a rolling six months. */
export const KEEP_BATCHES = 6;

/** nsfwjs: combined Porn + Hentai + Sexy score. */
export const NSFW_REJECT = 0.5;
export const NSFW_FLAG = 0.1;

/** Monthly CleanYourTV theme: the launcher reads at most 100 images. */
export const THEME_SIZE = 100;
export const THEME_CONFIG = {
  wallpaper: true,
  wallpaper_rotation_minutes: 5,
  wallpaper_order: "shuffle",
  wallpaper_dim: 30,
  wallpaper_true_color: true,
  ambient_glow: false,
};

/**
 * On-screen credits the profanity check flagged but the owner has checked are real names.
 * "Abo" is a slur in Australian English and also part of an Arabic name.
 */
export const CREDIT_ALLOW = ["Mono Abo-Abda"];

/** Licenses that allow redistribution with attribution (and share-alike, which we honour by keeping the license). */
export const LICENSE_ALLOW = /^(CC0(\s1\.0)?|Public domain|PD.*|CC BY(-SA)? \d\.\d.*)$/i;

/** Any of these in the title or a category rejects the file before anyone sees it. */
export const SUBJECT_BLOCK =
  /nud|naked|erotic|\bwar\b|weapon|\bguns?\b|rifle|military|soldier|army|guard|police|corpse|dead|death|grave|cemeter|memorial|monumento|hunting|slaughter|blood|surgery|medical|hospital|protest|demonstrat|portrait|people|women|\bmen\b|children|girls|boys|insect|spider|arachnid|mating|macro|museum|objects|illustration|\bmaps?\b|painting|drawing|engraving|scan|historical|logo|sculpture|statue|food|religious|crucifix|politic|government|ministry|flag/i;

/** First match wins; a file matching none is not TV material. */
export const CATEGORIES = [
  ["space", /astronom|nebula|galax|milky way|night sky|star trails|aurora|\bmoon\b|eclipse|comet/i],
  ["wildlife", /\bbirds?\b|mammal|wildlife|animals? in|deer|\bfox|bears?\b|eleph|lion|whale|seal|owl|eagle|heron|fauna/i],
  ["architecture", /church|cathedral|basilica|castle|palace|bridge|architecture|interior|abbey|monaster|temple|mosque|tower|lighthouse/i],
  ["cities", /skyline|cityscape|\bcity\b|old town|streets|harbou?r|\bport of\b|night photograph/i],
  ["nature", /landscape|seascape|mountain|lake|river|waterfall|coast|beach|forest|desert|sunset|sunrise|glacier|volcan|island|clouds|valley|national park|canyon|fjord|meadow|snow|panorama/i],
] as const satisfies readonly (readonly [string, RegExp])[];

export type Category = (typeof CATEGORIES)[number][0];
