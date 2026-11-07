const MAX_BIG_EMOJI = 3;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

// true for messages like "😂" or "❤️👍" (1-3 emoji, nothing else): shown large, like most chat apps
const isEmojiOnly = (text) => {
    const trimmed = String(text || '').replace(/\s+/g, '');
    if (!trimmed || !segmenter || LETTER_OR_DIGIT.test(trimmed)) return false;
    const graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
    return graphemes.length <= MAX_BIG_EMOJI && graphemes.every((g) => EMOJI.test(g));
};

export default isEmojiOnly;
