// One profanity check for everything a TV shows that came from free text (credits, about lines).
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const ENDINGS = ["", "s", "es", "ed", "er", "ers", "ing", "y"];

/**
 * Whole words only: names and places hide rude letter runs ("Rabich", "Fanal"), and the word list
 * reports such matches as if they spanned the whole word, so each word is compared with the
 * dictionary word it matched (plus a plain ending). Text here comes from moderated Commons pages,
 * where deliberately disguised spellings are unlikely.
 */
export function hasWholeWordProfanity(text: string): boolean {
  return (text.match(/[\p{L}'’-]+/gu) ?? []).some((word) => {
    const lowerWord = word.toLowerCase();
    return matcher.getAllMatches(word).some((match) => {
      const dictionaryWord = englishDataset.getPayloadWithPhraseMetadata(match).phraseMetadata?.originalWord;
      return dictionaryWord !== undefined && ENDINGS.some((ending) => lowerWord === dictionaryWord + ending);
    });
  });
}
