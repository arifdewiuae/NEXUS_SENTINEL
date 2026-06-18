/**
 * Pure Unicode sanitizer. Strips invisible / direction-control / tag characters
 * and folds a curated set of homoglyphs to ASCII, so the downstream screeners
 * see the *real* text an attacker tried to disguise (e.g. `ignore previous
 * instructions` smuggled past a regex with zero-width characters between
 * letters). No I/O — it lives beside the aggregator and is unit-tested directly.
 *
 * Flag-only by design: obfuscation never blocks on its own, because legitimate
 * Unicode exists (emoji ZWJ sequences, combining marks). It raises evidence and,
 * in `aws` mode, drives LLM escalation. The homoglyph map covers the common
 * attack alphabet (Cyrillic / Greek look-alikes), not all of Unicode.
 *
 * The control-character ranges are written as `\u` escapes on purpose: the
 * characters they match are invisible, so spelling them out keeps the source
 * reviewable.
 */

export interface SanitizationResult {
  /** The cleaned text the screeners should see. */
  normalized: string;
  /** True when anything was stripped or folded. */
  obfuscated: boolean;
  /** Distinct techniques observed, e.g. `zero_width`, `bidi_control`, `homoglyph`. */
  indicators: string[];
  /** Count of invisible / control characters removed (not counting folds). */
  removed: number;
}

// Invisible & formatting characters with no legitimate place in a screened
// prompt: ZWSP, ZWNJ, ZWJ, word joiner, BOM, soft hyphen, Mongolian separator.
// We intentionally match ZWJ/ZWNJ as standalone characters to strip them \u2014 the
// "misleading character class" rule assumes they're forming an emoji sequence,
// which is exactly the obfuscation we want to remove.
// eslint-disable-next-line no-misleading-character-class
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u180E]/gu;
// Bidirectional overrides / embeddings / isolates and directional marks.
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069\u061C\u200E\u200F]/gu;
// The Unicode "tag" block — invisible, historically abused to smuggle text.
const TAG_CHARS = /[\u{E0000}-\u{E007F}]/gu;

/** A curated map of common confusables → their ASCII look-alike. */
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic → Latin (lowercase)
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  ѕ: 's',
  і: 'i',
  ј: 'j',
  к: 'k',
  м: 'm',
  // Cyrillic → Latin (uppercase)
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  // Greek → Latin
  ο: 'o',
  Ο: 'O',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
  Ζ: 'Z',
};

export function sanitize(input: string): SanitizationResult {
  const indicators: string[] = [];
  let removed = 0;
  let text = input;

  const strip = (re: RegExp, label: string): void => {
    let count = 0;
    text = text.replace(re, () => {
      count++;
      return '';
    });
    if (count > 0) {
      indicators.push(label);
      removed += count;
    }
  };

  strip(TAG_CHARS, 'tag_chars');
  strip(BIDI_CONTROL, 'bidi_control');
  strip(ZERO_WIDTH, 'zero_width');

  // Compatibility-fold (fullwidth forms, ligatures, …) before homoglyph mapping.
  text = text.normalize('NFKC');

  let folded = false;
  text = Array.from(text, (ch) => {
    const ascii = HOMOGLYPHS[ch];
    if (ascii !== undefined) {
      folded = true;
      return ascii;
    }
    return ch;
  }).join('');
  if (folded) indicators.push('homoglyph');

  return { normalized: text, obfuscated: indicators.length > 0, indicators, removed };
}
