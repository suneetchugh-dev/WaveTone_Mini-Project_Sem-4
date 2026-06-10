// Multilingual profanity word lists
const BLOCKED_WORDS_BY_LANG = {
  en: [
    'fuck', 'shit', 'bitch', 'ass', 'asshole', 'bastard', 'dick', 'pussy', 'cunt',
    'slut', 'whore', 'fag', 'nigger', 'nigga', 'retard', 'rape', 'molest', 'porn', 'sex'
  ],
  es: [
    'mierda', 'puta', 'puto', 'cabron', 'cabrona', 'pendejo', 'pendeja', 'joder',
    'maricon', 'hijo de puta', 'hija de puta', 'singao', 'singada'
  ],
  fr: [
    'merde', 'putain', 'connard', 'connarde', 'salope', 'cul', 'encule', 'batard'
  ],
  de: [
    'scheisse', 'arschloch', 'schlampe', 'hurensohn', 'wichser', 'fotze', 'miststuck'
  ],
  hi: [
    'bhenchod', 'bharchod', 'madarchod', 'chutiya', 'saala', 'saali', 'kamina',
    'harami', 'randi', 'bhadwa', 'gandu'
  ]
};

// Build regex: match whole words, case-insensitive
// Also catches leet-speak variants like f*ck, sh1t, a$$
function buildRegex(word) {
  const leetMap = {
    a: '[a@4]', e: '[e3]', i: '[i1!]', o: '[o0]', s: '[s$5]',
    t: '[t7]', l: '[l1]', g: '[g9]',
  };
  const pattern = word
    .split('')
    .map(ch => leetMap[ch] || ch)
    .join('[\\s._-]*'); // allow separators between chars like f-u-c-k
  return new RegExp(`\\b${pattern}\\b`, 'i');
}

// Compile regex caches for each language
const REGEX_CACHE = {};
const WORDS_CACHE = {};

Object.keys(BLOCKED_WORDS_BY_LANG).forEach(lang => {
  const words = lang === 'en'
    ? BLOCKED_WORDS_BY_LANG.en
    : [...BLOCKED_WORDS_BY_LANG.en, ...BLOCKED_WORDS_BY_LANG[lang]];
  WORDS_CACHE[lang] = words;
  REGEX_CACHE[lang] = words.map(buildRegex);
});

// Compile 'auto' (all languages combined)
const allWords = Array.from(new Set(Object.values(BLOCKED_WORDS_BY_LANG).flat()));
WORDS_CACHE['auto'] = allWords;
REGEX_CACHE['auto'] = allWords.map(buildRegex);

function getRegexes(language = 'en') {
  const lang = (language || 'en').toLowerCase();
  return REGEX_CACHE[lang] || REGEX_CACHE['en'];
}

function getWords(language = 'en') {
  const lang = (language || 'en').toLowerCase();
  return WORDS_CACHE[lang] || WORDS_CACHE['en'];
}

export function containsProfanity(text, language = 'en') {
  if (!text) return false;
  const regexes = getRegexes(language);
  return regexes.some(regex => regex.test(text));
}

export function filterProfanity(text, language = 'en') {
  if (!text) return text;
  let filtered = text;
  const regexes = getRegexes(language);
  for (const regex of regexes) {
    filtered = filtered.replace(regex, (match) => match[0] + '*'.repeat(match.length - 1));
  }
  return filtered;
}

// Extract profanity words found in text for hybrid moderation
export function extractProfanityWords(text, language = 'en') {
  if (!text) return [];
  const words = text.toLowerCase().split(/\s+/);
  const foundWords = [];
  const regexes = getRegexes(language);
  const wordList = getWords(language);
  
  words.forEach(word => {
    regexes.forEach((regex, index) => {
      if (regex.test(word) && !foundWords.includes(wordList[index])) {
        foundWords.push(wordList[index]);
      }
    });
  });
  
  return foundWords;
}

// Get the profanity words list for server moderation
export function getProfanityWords(language = 'en') {
  return getWords(language);
}
