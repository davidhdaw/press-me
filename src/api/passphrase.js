// Passphrases are compared ignoring case, punctuation and extra whitespace,
// and a guest may type either the whole phrase or just its last word.
export const normalizePassphrase = (phrase) =>
  (phrase || '').toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

export const passphraseLastWord = (phrase) => {
  const words = normalizePassphrase(phrase).split(' ').filter(Boolean);
  return words[words.length - 1] || '';
};

export function passphraseMatchesStored(storedRaw, enteredNormalized) {
  const stored = normalizePassphrase(storedRaw);
  if (!stored || !enteredNormalized) return false;
  return enteredNormalized === stored || enteredNormalized === passphraseLastWord(storedRaw);
}
