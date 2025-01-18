// Type definitions
type VocabDict = { [key: string]: number };

// Helper functions
function splitNum(match: string): string {
    if (match.includes('.')) {
        return match;
    } else if (match.includes(':')) {
        const [h, m] = match.split(':').map(n => parseInt(n));
        if (m === 0) {
            return `${h} o'clock`;
        } else if (m < 10) {
            return `${h} oh ${m}`;
        }
        return `${h} ${m}`;
    }
    const year = parseInt(match.substring(0, 4));
    if (year < 1100 || year % 1000 < 10) {
        return match;
    }
    const left = match.substring(0, 2);
    const right = parseInt(match.substring(2, 4));
    const s = match.endsWith('s') ? 's' : '';
    if (100 <= year % 1000 && year % 1000 <= 999) {
        if (right === 0) {
            return `${left} hundred${s}`;
        } else if (right < 10) {
            return `${left} oh ${right}${s}`;
        }
    }
    return `${left} ${right}${s}`;
}

function flipMoney(match: string): string {
    const bill = match[0] === '$' ? 'dollar' : 'pound';
    if (match[match.length - 1].match(/[a-zA-Z]/)) {
        return `${match.substring(1)} ${bill}s`;
    } else if (!match.includes('.')) {
        const s = match.substring(1) === '1' ? '' : 's';
        return `${match.substring(1)} ${bill}${s}`;
    }
    const [b, c] = match.substring(1).split('.');
    const s = b === '1' ? '' : 's';
    const cents = parseInt(c.padEnd(2, '0'));
    const coins = match[0] === '$' 
        ? `cent${cents === 1 ? '' : 's'}`
        : (cents === 1 ? 'penny' : 'pence');
    return `${b} ${bill}${s} and ${cents} ${coins}`;
}

function pointNum(match: string): string {
    const [a, b] = match.split('.');
    return `${a} point ${b.split('').join(' ')}`;
}

// Get vocabulary dictionary
function getVocab(): VocabDict {
    const _pad = "$";
    const _punctuation = ';:,.!?¡¿—…"«»"" ';
    const _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";
    
    const symbols = [_pad, ..._punctuation, ..._letters, ..._letters_ipa];
    const dicts: VocabDict = {};
    
    symbols.forEach((symbol, index) => {
        dicts[symbol] = index;
    });
    
    return dicts;
}

// Main text normalization function
function normalizeText(text: string): string {
    // Replace special quotes and parentheses
    text = text.replace(/[\u2018]/g, "'").replace(/[\u2019]/g, "'");
    text = text.replace(/«/g, '"').replace(/»/g, '"');
    text = text.replace(/[\u201C]/g, '"').replace(/[\u201D]/g, '"');
    text = text.replace(/\(/g, '«').replace(/\)/g, '»');
    
    // Replace CJK punctuation
    const cjkPunct = '、。！，：；？';
    const latinPunct = ',.!,:;?';
    for (let i = 0; i < cjkPunct.length; i++) {
        text = text.replace(new RegExp(cjkPunct[i], 'g'), latinPunct[i] + ' ');
    }
    
    // Clean up whitespace
    text = text.replace(/[^\S \n]/g, ' ');
    text = text.replace(/  +/g, ' ');
    text = text.replace(/(?<=\n) +(?=\n)/g, '');
    
    // Replace honorifics
    text = text.replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor');
    text = text.replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister');
    text = text.replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss');
    text = text.replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs');
    text = text.replace(/\betc\.(?! [A-Z])/g, 'etc');
    
    // Handle "yeah" variations
    text = text.replace(/\b(y)eah?\b/gi, "$1e'a");
    
    // Handle numbers and money
    text = text.replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNum);
    text = text.replace(/(?<=\d),(?=\d)/g, '');
    text = text.replace(/[$£]\d+(?:\.\d+)?(?:\s*(?:hundred|thousand|(?:[bm]|tr)illion))*\b|[$£]\d+\.\d\d?\b/gi, flipMoney);
    text = text.replace(/\d*\.\d+/g, pointNum);
    
    // Other replacements
    text = text.replace(/(?<=\d)-(?=\d)/g, ' to ');
    text = text.replace(/(?<=\d)S/g, ' S');
    text = text.replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S");
    text = text.replace(/(?<=X')S\b/g, 's');
    text = text.replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, '-'));
    text = text.replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-');
    
    return text.trim();
}

// Simplified phonemizer implementation
interface PhonemizerOptions {
    preservePunctuation: boolean;
    withStress: boolean;
}

class EspeakBackend {
    private language: string;
    private preservePunctuation: boolean;
    private withStress: boolean;

    constructor(options: { 
        language: 'en-us' | 'en-gb',
        preservePunctuation?: boolean,
        withStress?: boolean 
    }) {
        this.language = options.language;
        this.preservePunctuation = options.preservePunctuation ?? true;
        this.withStress = options.withStress ?? true;
    }

    // Basic phoneme mappings
    private static readonly phonemeMap: { [key: string]: string } = {
        // Vowels
        'a': 'ə',
        'e': 'ɛ',
        'i': 'ɪ',
        'o': 'oʊ',
        'u': 'ʌ',
        'aa': 'ɑ',
        'ae': 'æ',
        'ah': 'ʌ',
        'ao': 'ɔ',
        'aw': 'aʊ',
        'ay': 'aɪ',
        'eh': 'ɛ',
        'er': 'ɝ',
        'ey': 'eɪ',
        'ih': 'ɪ',
        'iy': 'i',
        'ow': 'oʊ',
        'oy': 'ɔɪ',
        'uh': 'ʊ',
        'uw': 'u',
        // Consonants
        'b': 'b',
        'd': 'd',
        'f': 'f',
        'g': 'ɡ',
        'h': 'h',
        'k': 'k',
        'l': 'l',
        'm': 'm',
        'n': 'n',
        'ng': 'ŋ',
        'p': 'p',
        'r': 'ɹ',
        's': 's',
        'sh': 'ʃ',
        't': 't',
        'th': 'θ',
        'dh': 'ð',
        'v': 'v',
        'w': 'w',
        'y': 'j',
        'z': 'z',
        'zh': 'ʒ',
        'ch': 'tʃ',
        'jh': 'dʒ',
    };

    private wordToPhonemes(word: string): string {
        // Simple rule-based phonemization
        let phonemes = '';
        let i = 0;
        
        while (i < word.length) {
            let matched = false;
            // Try to match two-character phonemes first
            if (i < word.length - 1) {
                const twoChars = word.substr(i, 2).toLowerCase();
                if (EspeakBackend.phonemeMap[twoChars]) {
                    phonemes += EspeakBackend.phonemeMap[twoChars];
                    i += 2;
                    matched = true;
                    continue;
                }
            }
            // Try single character if no two-character match
            const oneChar = word[i].toLowerCase();
            if (EspeakBackend.phonemeMap[oneChar]) {
                phonemes += EspeakBackend.phonemeMap[oneChar];
            } else {
                // Keep punctuation if enabled
                if (this.preservePunctuation && /[.,:;!?\-"']/g.test(word[i])) {
                    phonemes += word[i];
                } else if (/\s/.test(word[i])) {
                    phonemes += ' ';
                }
            }
            i++;
        }
        return phonemes;
    }

    phonemize(texts: string[]): string[] {
        return texts.map(text => {
            const words = text.split(/\s+/);
            const phonemizedWords = words.map(word => this.wordToPhonemes(word));
            let result = phonemizedWords.join(' ');
            
            // Apply specific replacements from the Python code
            result = result
                .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
                .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
                .replace(/ʲ/g, 'j')
                .replace(/r/g, 'ɹ')
                .replace(/x/g, 'k')
                .replace(/ɬ/g, 'l');

            // Apply additional rules
            result = result
                .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
                .replace(/ z(?=[;:,.!?¡¿—…"«»"" ]|$)/g, 'z');

            if (this.language === 'en-us') {
                result = result.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
            }

            return result;
        });
    }
}

// Phonemizer instance cache
const phonemizers: { [key: string]: EspeakBackend } = {
    'a': new EspeakBackend({ language: 'en-us', preservePunctuation: true, withStress: true }),
    'b': new EspeakBackend({ language: 'en-gb', preservePunctuation: true, withStress: true }),
};

function phonemize(text: string, lang: 'a' | 'b', norm: boolean = true): string {
    if (norm) {
        text = normalizeText(text);
    }
    
    const ps = phonemizers[lang].phonemize([text]);
    let result = ps[0] || '';

    // Filter out characters not in vocabulary
    const vocab = getVocab();
    result = Array.from(result)
        .filter(char => char in vocab)
        .join('');

    return result.trim();
}

// Tokenization function
function tokenize(text: string): number[] {
    const vocab = getVocab();
    return Array.from(text)
        .map(char => vocab[char])
        .filter(token => token !== undefined);
}

function encode(text: string, lang: 'a' | 'b', norm: boolean = true): number[] {
    const phonemes = phonemize(text, lang, norm);
    return tokenize(phonemes);
}

// Main export
export {
    normalizeText,
    tokenize,
    getVocab,
    phonemize,
    encode,
    type VocabDict,
    type PhonemizerOptions,
};
