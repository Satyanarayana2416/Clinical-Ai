// Speech-to-Text Service pipeline wrapper

function getSttLatency(isMock = true) {
    // Calibrated Whisper API latency is ~120ms, browser-local STT is ~10ms
    return isMock ? 120.0 : 10.0;
}

function processAudioToText(audioBuffer, languageHint = "en-US") {
    // If you are integrating real Whisper API endpoints:
    // Make call to Whisper endpoint, else return mock transcription.
    return "Book an appointment";
}

module.exports = {
    getSttLatency,
    processAudioToText
};
