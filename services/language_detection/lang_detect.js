// Heuristics-based high-performance Language Detection Service (<2ms)
// Handles native script (Unicode) and transliterated Hinglish/Tamilish input

const HINDI_EXCLUSIVE_KEYWORDS = new Set([
    "namaste", "karna", "karana", "dikhana", "hai", "mujhe", "mera", "meri", "ki",
    "ko", "se", "kab", "baje", "samay", "tarikh", "kardo", "badal", "badalna", 
    "bhai", "ji", "aaj", "kal", "parso", "cancle", "chahiye", "doctor-se", "mila-do"
]);

const TAMIL_EXCLUSIVE_KEYWORDS = new Set([
    "vanakkam", "enaku", "oru", "vendum", "panna", "pannanum", "nalla", "eppo",
    "enna", "neram", "naal", "thethi", "pannunga", "maatha", "maathanum", "netru", "naalai"
]);

function detectLanguage(text) {
    if (!text) return "English";
    
    // 1. Script Unicode Checks (High-fidelity direct match)
    // Devanagari script: U+0900 to U+097F
    if (/[\u0900-\u097F]+/.test(text)) {
        return "Hindi";
    }
    
    // Tamil script: U+0B80 to U+0BFF
    if (/[\u0B80-\u0BFF]+/.test(text)) {
        return "Tamil";
    }
    
    // 2. Token keyword matching for Transliterated Scripts (Hinglish / Tanglish)
    const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
    let hindiScore = 0;
    let tamilScore = 0;
    
    words.forEach(word => {
        if (HINDI_EXCLUSIVE_KEYWORDS.has(word)) {
            hindiScore++;
        }
        if (TAMIL_EXCLUSIVE_KEYWORDS.has(word)) {
            tamilScore++;
        }
    });
    
    if (hindiScore > tamilScore && hindiScore > 0) {
        return "Hindi";
    }
    if (tamilScore > hindiScore && tamilScore > 0) {
        return "Tamil";
    }
    
    return "English";
}

module.exports = {
    detectLanguage
};
