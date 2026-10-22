// Turns a Commons description into the one line a TV shows about a photo ("Great Grey Shrike in
// Bhigwan, Maharashtra, India"). Descriptions are free text written by photographers: sometimes one
// line, sometimes a paragraph of history. This keeps the first sentence, trims it to fit, and
// withholds anything that trips the content checks, so the reviewer sees it instead of a TV.
import { fetchDepictedLabels, fetchEnglishDescriptions, type Description } from "./commons.ts";
import { stripHtml } from "./filters.ts";
import { hasWholeWordProfanity } from "./profanity.ts";

/** Longest about line shown on screen. Longer descriptions are cut at a natural break. */
export const MAX_ABOUT_LENGTH = 90;
/** A cut that leaves less than this says too little to be worth showing. */
const MIN_CUT_LENGTH = 25;

export type AboutResult = { about: string; problem: null } | { about: null; problem: string };

/**
 * Words that shouldn't greet a family on the living-room TV, even when the photo itself passed review
 * (a predator photo is fine; "feeding on its prey" written underneath it is not the point of it).
 */
const ABOUT_BLOCK = /\b(?:dead|death|died|dying|kill(?:s|ed|ing)?|blood|bloody|corpse|carcass|prey|hunt(?:s|ed|ing)?|slaughter\w*|war|wars|weapons?|guns?|nude|naked|sex\w*)\b/i;

/** Openings that add nothing on a TV: "This image shows…", "English: …", catalogue IDs ("Art002e009287 – "). */
const OPENINGS = /^(?:English:\s*|(?:This|The) (?:image|photo|photograph|picture) (?:shows|depicts)\s+|(?:Image|Photo) of\s+|[A-Za-z]*\d[\w.-]*(?:\s*\([^)]*\))?\s+[–-]\s+)/i;
/** Credit lines filed as descriptions: "Crédito: …", "Photo Credit: …". */
const CREDIT_LINE = /^(?:(?:Photo\s+)?Cr[ée]dit(?:o|s)?|Author|Autor|Source|Fonte|Photo|Foto)\s*:/i;
/** Labels in front of the description itself. */
const LABEL = /^(?:Title|Description|Caption)\s*:\s*/i;
/**
 * Sentences templates add rather than the photographer: monument and protected-area notices
 * ("This is a photo of a monument in Armenia identified by the ID …") and the panorama notice.
 */
const TEMPLATE_SENTENCE = /^(?:NOTE:|This (?:file|media|is a (?:photo|picture))\b.*\b(?:ID|number|listed)\b)/i;
/** Common words of other languages, for descriptions Commons didn't tag as English. */
const OTHER_LANGUAGE = /\b(?:desde|las|los|fotos|tomaron|entre|pela|através|arquivo|liberado|und|mit|der|die|das|est|sont|avec|une|dans)\b/i;
/** A cut can leave a dangling last word: "…the Tokyo skyline captured", "…Sweden, passing". */
const DANGLING_END = /(?:,\s*\p{L}+(?:ing|ed)|,\s+the\s+\p{L}+|\s+located\s+far\s+enough|\s+(?:captured|located|situated|taken|seen|shown|pictured|photographed|made|filled|built|that|which|the|a|an|and|of))$/u;
/** Dates and camera file names that end some descriptions: "…, 2025-07-14", "in 2026", "_WLB_IMG 4446". */
const TRAILING_JUNK = [
  /[\s.]+$/,
  /,?\s*\d{4}-\d{2}-\d{2}.*$/,
  /,?\s+(?:in\s+)?(?:19|20)\d{2}(?:\s+\p{L}+)?$/u,
  /_\S*(?:\s+\d+)?/g,
  /\s*\bIMG[ _-]?\d+\b/g,
];
/** Asides after the subject: who took it, and when. */
const ASIDES = [
  /\s*\([^)]*\)/g,
  /,?\s*(?:photo(?:graph)?(?:ed)?|taken|shot) (?:by|on|in)\b.*$/i,
  /,?\s+(?:on|in) (?:\d{1,2} )?(?:January|February|March|April|May|June|July|August|September|October|November|December)\b.*$/i,
];
/** Where a long description can be cut and still read as a phrase: "The Frick Fine Arts Building | is a …". */
const BREAKS = [
  ", ", "; ", ": ", " – ", " - ", " is ", " are ", " was ", " were ", " made ", " using ", " with ", " seen ",
  " from ", " at ", " in ", " on ", " over ", " near ", " during ", " towards ", " under ", " behind ",
  " above ", " against ", " located ", " designed by ", " built ", " owned by ", " running ", " caused by ",
  " highlighting ",
];

/**
 * Animals whose English names a profanity list mistakes for swearing ("Great tit", "shag", "booby").
 * Removed before the check only; the line itself keeps them.
 */
const ANIMAL_NAMES = /\b(?:[\p{L}-]+[ -]tits?|titmi(?:ce|ouse)|bushtits?|shags?|boob(?:y|ies)|woodcocks?|peacocks?|moorcocks?|blackcocks?|cock-of-the-rock)\b/giu;
/** Sentences about the photographer or the viewer ("I centered myself…", "you can see…"). */
const FIRST_PERSON = /^(?:I|We)\b|\b(?:my|our|me|you)\b/;
/** Notices some photographers' templates put in the description field too. */
const NOTICES = /NOTE:\s*This image is a panorama.*?parallax distortions\.?/gis;

export function describePhoto(description: Description | null, depicted: string[] = []): AboutResult {
  const result = check(fromDescription(description));
  if (result.about !== null) return result;
  const tag = mostSpecificTag(depicted);
  return tag ? check(capitalize(tag)) : result;
}

/** Concepts too general to say anything about a photo on their own. */
const GENERAL_TAGS = new Set(["landscape", "architecture", "bridge", "sea", "hill", "lake", "sky", "cloud", "tree", "forest", "nature", "mountain", "river", "water", "building", "city"]);

/**
 * Wikidata writes named things with a capital ("Logne Castle", "Toujane") and concepts in lowercase
 * ("landscape"), so the first capitalised tag wins; a lowercase one only if it isn't too general.
 */
function mostSpecificTag(depicted: string[]): string | null {
  return depicted.find((tag) => /^\p{Lu}/u.test(tag)) ?? depicted.find((tag) => !GENERAL_TAGS.has(tag.toLowerCase())) ?? null;
}

function fromDescription(description: Description | null): string {
  if (!description) return "";
  const text = flatten(description.html);
  if (CREDIT_LINE.test(text)) return "";
  if (!description.taggedEnglish && OTHER_LANGUAGE.test(text)) return "";
  const sentence = sentences(text).find((candidate) => !TEMPLATE_SENTENCE.test(candidate) && !CREDIT_LINE.test(candidate));
  return sentence ? shorten(sentence) : "";
}

function flatten(html: string): string {
  return html
    .replace(/<\/(?:p|div|li)>|<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => stripHtml(line))
    .filter(Boolean)
    .join("\n")
    .replace(NOTICES, "");
}

/**
 * The text's sentences, ending at a full stop after a word (not "St. Peter's" or "U.S."), a
 * semicolon, or a line break.
 */
function sentences(text: string): string[] {
  // Paragraphs run together on Commons ("…Madeira, PortugalFanal is…"): a long word glued to a
  // capitalised one. Shorter joins are real names ("TransPennine", "DreamWorks").
  const unglued = text.replace(/(\p{Lu}\p{Ll}{5,})(\p{Lu}\p{Ll})/gu, "$1. $2");
  return unglued
    .split(/(?<=\p{L}{3}|\)|\d)[.!?](?=\s+\p{Lu}|\s*$)|;\s+|\n/u)
    .map((sentence) => sentence.replace(LABEL, "").replace(OPENINGS, "").trim())
    .filter(Boolean);
}

/** "(… (NGC 1499))" and stray brackets left by nested or unbalanced asides. */
function withoutBrackets(text: string): string {
  let cleaned = text;
  while (/\([^()]*\)/.test(cleaned)) cleaned = cleaned.replace(/\s*\([^()]*\)/g, "");
  return cleaned.replace(/[()]/g, "");
}

function shorten(sentence: string): string {
  let cleaned = withoutBrackets(sentence);
  for (const aside of ASIDES) cleaned = cleaned.replace(aside, "");
  for (const junk of TRAILING_JUNK) cleaned = cleaned.replace(junk, "");
  cleaned = capitalize(withoutDanglingEnd(cleaned.replace(/\s+/g, " ").replace(/[\s,.;:–-]+$/, "")).trim());
  if (cleaned.length <= MAX_ABOUT_LENGTH) return cleaned;
  return cutAtBreak(cleaned) ?? cleaned;
}

/** The longest stretch up to a natural break that still fits, without a dangling last word. */
function cutAtBreak(text: string): string | null {
  const head = text.slice(0, MAX_ABOUT_LENGTH + 1);
  const cut = Math.max(...BREAKS.map((separator) => head.lastIndexOf(separator)));
  if (cut < MIN_CUT_LENGTH) return null;
  const phrase = withoutDanglingEnd(text.slice(0, cut).replace(/[\s,;:–-]+$/, ""));
  return phrase.length >= MIN_CUT_LENGTH ? phrase : null;
}

/** Removing one dangling word can expose another ("…, the quarter located"), so repeat until none. */
function withoutDanglingEnd(text: string): string {
  const trimmed = text.replace(DANGLING_END, "");
  return trimmed === text ? text : withoutDanglingEnd(trimmed);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function check(about: string): AboutResult {
  if (!about) return { about: null, problem: "no description" };
  if (about.length > MAX_ABOUT_LENGTH) return { about: null, problem: `too long to cut (${about.length})` };
  if (ABOUT_BLOCK.test(about)) return { about: null, problem: "blocked word" };
  if (FIRST_PERSON.test(about)) return { about: null, problem: "about the photographer" };
  if (hasWholeWordProfanity(about.replace(ANIMAL_NAMES, ""))) return { about: null, problem: "possible profanity" };
  return { about, problem: null };
}

/**
 * About lines for many files at once, by page ID: descriptions first, then "depicts" tags for the
 * files whose description gave nothing.
 */
export async function describeFiles(pageIds: number[]): Promise<Map<number, AboutResult>> {
  const descriptions = await fetchEnglishDescriptions(pageIds);
  const results = new Map(pageIds.map((pageId) => [pageId, describePhoto(descriptions.get(pageId) ?? null)]));
  const withoutAbout = pageIds.filter((pageId) => results.get(pageId)!.about === null);
  const depicted = await fetchDepictedLabels(withoutAbout);
  for (const pageId of withoutAbout) {
    results.set(pageId, describePhoto(descriptions.get(pageId) ?? null, depicted.get(pageId) ?? []));
  }
  return results;
}
