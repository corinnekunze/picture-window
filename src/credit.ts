// Turns a Commons "Artist" field into the short credit a TV shows ("Photo by …"). The field is
// free-form HTML: user links, templates, panorama notices, contact details, licenses. The full
// text stays on the credits page; this only decides what fits on screen, or that nothing does.
import { CREDIT_ALLOW } from "./config.ts";
import { stripHtml } from "./filters.ts";
import { hasWholeWordProfanity } from "./profanity.ts";

/** Longest credit shown on screen; it wraps to two lines on the TV. */
export const MAX_CREDIT_LENGTH = 80;

export type CreditResult = { credit: string; problem: null } | { credit: null; problem: string };

/** Other Commons fields, for files whose Artist field names nobody. */
export interface CreditFallback {
  /** The Credit field; "Own work" means the uploader took the photo. */
  creditHtml: string;
  uploader: string;
}

/** Whole notices some photographers' templates add to the field. Removed before anything else. */
const BOILERPLATE = [
  /NOTE:\s*This image is a panorama.*?parallax distortions\.?/gis,
  /Camera location.*$/gis,
  /View this and other nearby images on:.*$/gis,
];

/** Labels in front of the names that matter, or the people a derivative credits after them. */
const LABELS = [
  /\(c\)|©/gi,
  /\bScience leads and image processing:\s*/gi,
  /\bImage processing:\s*/gi,
  /\bPhoto(?:graph)?(?:ed)? by\s*/gi,
  /\bAuthor:\s*/gi,
];

const LICENSE = /,?\s*\b(?:CC[- ]BY(?:-SA)?|CC0|Public domain)\b[^,;/]*/gi;
const EMAIL = /\S+@\S+\.\S+/g;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|be|de|fr|uk|nl|au|ch|it|es)\b\S*/gi;
/** "(User:dllu)", "(talk)", "(lucnix.be)", "(with special thanks to …)": never part of the name. */
const BRACKETED_ASIDE = /\s*\([^)]*\)/g;

export function displayCredit(artistHtml: string, fallback?: CreditFallback): CreditResult {
  const text = originalAuthor(flatten(artistHtml));
  const credit = tidy(takenBy(text) ?? withoutAsides(text));
  if (!credit && fallback && /own work/i.test(stripHtml(fallback.creditHtml))) return check(tidy(fallback.uploader));
  return check(credit);
}

/** HTML to plain text, keeping block boundaries as line breaks so notices and names stay apart. */
function flatten(html: string): string {
  const withBreaks = html.replace(/<\/(?:p|div|td|tr|li)>|<br\s*\/?>/gi, "\n");
  return withBreaks
    .split("\n")
    .map((line) => stripHtml(line))
    .filter(Boolean)
    .join("\n");
}

/** "Original: A … Derivative work: B" credits A; the editor stays on the credits page. */
function originalAuthor(text: string): string {
  const original = text.match(/Original:\s*([\s\S]+?)(?:\s*Derivative (?:work|file):|$)/i);
  return original ? original[1]!.trim() : text;
}

/** "This photo was taken by Timothy A. Gonsalves. Feel free to…" credits the name it states. */
function takenBy(text: string): string | null {
  const stated = text.match(/\b(?:taken|shot|photographed)\s+by\s+([^.\n]+?(?:\b[A-Z]\.\s*[^.\n]+?)*)(?:\.(?:\s|$)|\n|$)/);
  return stated ? stated[1]!.trim() : null;
}

function withoutAsides(text: string): string {
  let cleaned = text;
  for (const pattern of BOILERPLATE) cleaned = cleaned.replace(pattern, "\n");
  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? "";
}

/** "Ximonic (Simo Räsänen)": a one-word handle followed by the person's full name credits the name. */
function realNameAfterHandle(text: string): string | null {
  const named = text.match(/^\S+\s*\(((?:\p{Lu}[\p{L}'’-]*\s+){1,3}\p{Lu}[\p{L}'’-]*)\)\s*$/u);
  return named ? named[1]! : null;
}

function tidy(text: string): string {
  let cleaned = realNameAfterHandle(text.trim()) ?? text;
  for (const pattern of LABELS) cleaned = cleaned.replace(pattern, " ");
  cleaned = cleaned
    .replace(BRACKETED_ASIDE, "")
    .replace(EMAIL, " ")
    .replace(URL, " ")
    .replace(LICENSE, " ")
    // Montage and edit credits glued on after the photographer: "CernanPhotomontage by User:…"
    .replace(/\s*(?:Photomontage|edits?|Derivative)\b.*$/i, "")
    // Flickr adds where the uploader lives: "Felipe Valduga from Porto Alegre, Brazil"
    .replace(/\s+from\s+[A-Z][^/]*$/, "")
    .replace(/;.*$/, "")
    .replace(/^User:/i, "")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ");
  return keepInitial(cleaned.replace(/^[\s,.;:/–-]+|[\s,.;:/–-]+$/g, ""), cleaned);
}

/** Trimming a trailing full stop must not break an initial: "John D." and "Юрий Д.К." keep theirs. */
function keepInitial(trimmed: string, untrimmed: string): string {
  const endsWithInitial = /(?:^|[\s.])\p{Lu}$/u.test(trimmed);
  return endsWithInitial && untrimmed.trimEnd().startsWith(`${trimmed}.`) ? `${trimmed}.` : trimmed;
}

function check(credit: string): CreditResult {
  if (!credit) return { credit: null, problem: "no name found" };
  if (credit.length > MAX_CREDIT_LENGTH) return { credit: null, problem: `too long (${credit.length})` };
  if (/[.!?]\s+[A-Z][a-z]+\s+[a-z]+/.test(credit)) return { credit: null, problem: "reads like a sentence" };
  if (hasProfanity(credit)) return { credit: null, problem: "possible profanity" };
  return { credit, problem: null };
}

/**
 * Whole words only: names hide rude letter runs ("Rabich"), and a real name can still match a word
 * ("Dick"), so a hit only withholds the on-screen credit and flags it. Checked names go in CREDIT_ALLOW.
 */
function hasProfanity(credit: string): boolean {
  if (CREDIT_ALLOW.includes(credit)) return false;
  return hasWholeWordProfanity(credit);
}
