// Multilingual profanity word lists for client-side matching
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

const LEET_MAP = {
  a: '[a@4*]', e: '[e3*]', i: '[i1!*]', o: '[o0*]', u: '[u*]',
  s: '[s$5]', t: '[t7]', l: '[l1]', g: '[g9]',
};

function buildRegex(word) {
  const pattern = word
    .split('')
    .map(ch => LEET_MAP[ch] || ch)
    .join('[\\s._-]*');
  return new RegExp(`\\b${pattern}\\b`, 'i');
}

// Compile regex caches for each language
const REGEX_CACHE = {};

Object.keys(BLOCKED_WORDS_BY_LANG).forEach(lang => {
  const words = lang === 'en'
    ? BLOCKED_WORDS_BY_LANG.en
    : [...BLOCKED_WORDS_BY_LANG.en, ...BLOCKED_WORDS_BY_LANG[lang]];
  REGEX_CACHE[lang] = words.map(buildRegex);
});

// Compile 'auto' (all combined)
const allWords = Array.from(new Set(Object.values(BLOCKED_WORDS_BY_LANG).flat()));
REGEX_CACHE['auto'] = allWords.map(buildRegex);

export function containsProfanity(text, language = 'en') {
  if (!text) return false;
  const lang = (language || 'en').toLowerCase();
  const regexes = REGEX_CACHE[lang] || REGEX_CACHE['en'];
  return regexes.some(regex => regex.test(text));
}
