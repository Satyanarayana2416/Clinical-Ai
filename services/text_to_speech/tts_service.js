// Text-to-Speech Service mappings and synthesis wrappers

const VOICE_MAPPING = {
    "Hindi": {
        voice: "hi-IN-MadhurNeural",
        langCode: "hi-IN",
        rate: "medium"
    },
    "Tamil": {
        voice: "ta-IN-ValluvarNeural",
        langCode: "ta-IN",
        rate: "medium"
    },
    "English": {
        voice: "en-US-AriaNeural",
        langCode: "en-US",
        rate: "medium"
    }
};

function getTtsLatency() {
    // Calibrated Edge-TTS neural synthesis latency is ~100ms
    return 100.0;
}

function getVoiceProfile(language) {
    return VOICE_MAPPING[language] || VOICE_MAPPING["English"];
}

module.exports = {
    getTtsLatency,
    getVoiceProfile
};
