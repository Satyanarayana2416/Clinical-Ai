import re

# Simple scripts
HINDI_SCRIPT_RANGE = re.compile(r"[\u0900-\u097F]+")
TAMIL_SCRIPT_RANGE = re.compile(r"[\u0B80-\u0BFF]+")

# Transliterated vocabularies containing language-exclusive terms
HINDI_EXCLUSIVE_KEYWORDS = {
    "namaste", "karna", "karana", "dikhana", "hai", "mujhe", "mera", "meri", "ki",
    "ko", "se", "kab", "baje", "samay", "tarikh", "kardo", "badal", "badalna", 
    "bhai", "ji", "aaj", "kal", "parso", "cancle"
}

TAMIL_EXCLUSIVE_KEYWORDS = {
    "vanakkam", "enaku", "oru", "vendum", "panna", "pannanum", "nalla", "eppo",
    "enna", "neram", "naal", "thethi", "pannunga", "maatha", "maathanum", "netru", "naalai"
}

def detect_language(text):
    """
    Detects language out of English, Hindi, and Tamil.
    Highly optimized for latency (<2ms).
    """
    if not text:
        return "English" # Default fallback
        
    text_lower = text.lower().strip()
    
    # 1. Script checks (Devanagari/Tamil Script)
    if HINDI_SCRIPT_RANGE.search(text):
        return "Hindi"
    if TAMIL_SCRIPT_RANGE.search(text):
        return "Tamil"
        
    # 2. Token mapping for transliterated text (Hinglish / Tanglish)
    words = re.findall(r"\b[a-z']+\b", text_lower)
    if not words:
        return "English"
        
    hindi_score = sum(1 for w in words if w in HINDI_EXCLUSIVE_KEYWORDS)
    tamil_score = sum(1 for w in words if w in TAMIL_EXCLUSIVE_KEYWORDS)
    
    # Evaluate exclusive hits
    if hindi_score > tamil_score and hindi_score > 0:
        return "Hindi"
    elif tamil_score > hindi_score and tamil_score > 0:
        return "Tamil"
        
    # Fallback to English
    return "English"
