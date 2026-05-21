// UI State Variables
let ws = null;
let currentPatientId = "pat_1";
let activeDoctorId = "doc_1";
let isListening = false;
let isSpeaking = false;
let speechRecognition = null;
let activeUtterance = null;
let waveAnimationId = null;
let serverPort = window.location.port || "8000";
let serverHost = window.location.hostname || "127.0.0.1";

// Waveform Canvas Setup
const canvas = document.getElementById("waveform-canvas");
const ctx = canvas.getContext("2d");

// Elements
const micBtn = document.getElementById("mic-btn");
const micConsole = document.getElementById("mic-console");
const voiceStatus = document.getElementById("voice-status");
const transcriptBox = document.getElementById("transcript-box");
const textQueryInput = document.getElementById("text-query-input");
const sendQueryBtn = document.getElementById("send-query-btn");
const patientSelect = document.getElementById("patient-select");
const doctorTabsContainer = document.getElementById("doctor-tabs");
const scheduleGridContainer = document.getElementById("schedule-grid");
const appointmentsList = document.getElementById("appointments-list");
const activeBookingCount = document.getElementById("active-booking-count");
const campaignBanner = document.getElementById("campaign-banner");
const interruptBtn = document.getElementById("interrupt-btn");
const geminiKeyInput = document.getElementById("gemini-key-input");
const saveKeyBtn = document.getElementById("save-key-btn");

// Latency DOM Elements
const barStt = document.getElementById("bar-stt");
const barLang = document.getElementById("bar-lang");
const barLlm = document.getElementById("bar-llm");
const barTts = document.getElementById("bar-tts");
const valStt = document.getElementById("val-stt");
const valLang = document.getElementById("val-lang");
const valLlm = document.getElementById("val-llm");
const valTts = document.getElementById("val-tts");
const totalLatencyVal = document.getElementById("total-latency-val");
const slaBadge = document.getElementById("sla-badge");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    initWebSocket();
    setupEventListeners();
    loadDashboardData();
    setupSpeechRecognition();
    drawWaveform();
});

// Setup WebSocket Connection
function initWebSocket() {
    const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${wsScheme}//${serverHost}:${serverPort}/ws`);
    
    ws.onopen = () => {
        document.getElementById("server-status-dot").style.backgroundColor = "var(--success)";
        document.getElementById("server-status-dot").style.boxShadow = "0 0 8px var(--success)";
        document.getElementById("server-status-text").innerText = "WebSocket: Connected";
        console.log("WebSocket connected.");
    };
    
    ws.onclose = () => {
        document.getElementById("server-status-dot").style.backgroundColor = "var(--error)";
        document.getElementById("server-status-dot").style.boxShadow = "0 0 8px var(--error)";
        document.getElementById("server-status-text").innerText = "WebSocket: Disconnected";
        console.log("WebSocket disconnected. Retrying in 3 seconds...");
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        handleServerMessage(payload);
    };
}

// Setup Event Listeners
function setupEventListeners() {
    // Patient Select change listener
    patientSelect.addEventListener("change", (e) => {
        currentPatientId = e.target.value;
        loadPatientProfile(currentPatientId);
    });

    // Voice query click trigger
    micBtn.addEventListener("click", toggleVoiceListening);

    // Text query keypress/click triggers
    sendQueryBtn.addEventListener("click", sendTextMessage);
    textQueryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendTextMessage();
    });

    // Interrupt button click
    interruptBtn.addEventListener("click", triggerManualInterruption);

    // Save API key
    saveKeyBtn.addEventListener("click", saveGeminiKey);
}

// Load patient profile data in debugger panel
async function loadPatientProfile(patientId) {
    try {
        const response = await fetch(`/api/patient/${patientId}`);
        const profile = await response.json();
        
        document.getElementById("dbg-pat-name").innerText = profile.name;
        document.getElementById("dbg-pat-lang").innerText = profile.preferred_language;
        
        // Match preferred doctor details
        const docNames = {
            "doc_1": "Dr. Aarav Patel",
            "doc_2": "Dr. Priya Sharma",
            "doc_3": "Dr. Ananya Nair",
            "doc_4": "Dr. Vikram Sen"
        };
        document.getElementById("dbg-pat-doc").innerText = docNames[profile.preferred_doctor] || "-";
        document.getElementById("dbg-pat-hosp").innerText = profile.preferred_hospital || "-";
    } catch (e) {
        console.error("Error loading patient profile: ", e);
    }
}

// Fetch and load dashboard schedules, appointments, and doctors
async function loadDashboardData() {
    try {
        // Load patient details first
        loadPatientProfile(currentPatientId);

        // Fetch doctors
        const resDocs = await fetch("/api/doctors");
        const doctors = await resDocs.json();
        
        // Render doctor filter tabs
        doctorTabsContainer.innerHTML = "";
        doctors.forEach((doc, idx) => {
            const tab = document.createElement("button");
            tab.className = `filter-tab ${doc.doctor_id === activeDoctorId ? 'active' : ''}`;
            tab.innerText = doc.doctor_name;
            tab.onclick = () => {
                document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                activeDoctorId = doc.doctor_id;
                renderScheduleGrid();
            };
            doctorTabsContainer.appendChild(tab);
        });

        renderScheduleGrid();
        loadAppointmentsList();
    } catch (e) {
        console.error("Error fetching initial dashboard data: ", e);
    }
}

// Render schedule grids for active doctor
async function renderScheduleGrid() {
    try {
        const resSched = await fetch("/api/schedules");
        const schedules = await resSched.json();
        
        // Filter schedules for the selected doctor
        const docSchedules = schedules.filter(s => s.doctor_id === activeDoctorId);
        
        scheduleGridContainer.innerHTML = "";
        
        if (docSchedules.length === 0) {
            scheduleGridContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px 0; font-size: 13px;">No available schedules found.</p>`;
            return;
        }

        // Group slots by dates
        docSchedules.forEach(sched => {
            const row = document.createElement("div");
            row.className = "grid-day-row";
            
            // Format nice human date, e.g. "Friday, May 22"
            const dateObj = new Date(sched.date);
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            const dateString = dateObj.toLocaleDateString('en-US', options);

            row.innerHTML = `
                <div class="day-label">${dateString} (${sched.date})</div>
                <div class="slots-flex" id="slots-for-${sched.date}"></div>
            `;
            scheduleGridContainer.appendChild(row);
            
            const slotsFlex = document.getElementById(`slots-for-${sched.date}`);
            
            // Generate list of all possible slots to display bookings
            const allPossibleSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];
            
            allPossibleSlots.forEach(slot => {
                const bubble = document.createElement("div");
                const isAvailable = sched.available_slots.includes(slot);
                
                bubble.className = `slot-bubble ${isAvailable ? '' : 'booked'}`;
                bubble.innerText = slot;
                
                if (isAvailable) {
                    bubble.onclick = () => {
                        // Pre-populate input box for easy click-to-book
                        textQueryInput.value = `Book appointment with selected doctor on ${sched.date} at ${slot}`;
                        textQueryInput.focus();
                    };
                } else {
                    bubble.title = "This slot is booked";
                }
                slotsFlex.appendChild(bubble);
            });
        });
    } catch (e) {
        console.error("Error rendering schedule grids: ", e);
    }
}

// Render active clinical appointments list
async function loadAppointmentsList() {
    try {
        const res = await fetch("/api/appointments");
        const appointments = await res.json();
        
        // Filter appointments that belong to active patient or show all
        const activeApps = appointments.filter(a => a.patient_id === currentPatientId);
        
        activeBookingCount.innerText = `${activeApps.length} Appointment${activeApps.length === 1 ? '' : 's'}`;
        appointmentsList.innerHTML = "";
        
        if (activeApps.length === 0) {
            appointmentsList.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 13px; padding: 20px 0;">No active booked appointments for this patient.</p>`;
            return;
        }

        activeApps.forEach(app => {
            const item = document.createElement("div");
            item.className = "appointment-item";
            
            const isBooked = app.status === "booked";
            
            item.innerHTML = `
                <div class="app-meta-left">
                    <h4>${app.doctor_name}</h4>
                    <p>Date: ${app.date} | Time: ${app.time}</p>
                </div>
                <div class="app-meta-right">
                    <span class="app-status ${app.status}">${app.status}</span>
                    ${isBooked ? `<button class="cancel-app-btn" onclick="cancelAppointment('${app.id}')">Cancel</button>` : ''}
                </div>
            `;
            appointmentsList.appendChild(item);
        });
    } catch (e) {
        console.error("Error loading appointments list: ", e);
    }
}

// Cancel Appointment Helper
async function cancelAppointment(appId) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
        const res = await fetch(`/api/cancel/${appId}`, { method: "POST" });
        const result = await res.json();
        if (result.success) {
            addChatBubble("assistant", `I have successfully cancelled your appointment (ID: ${appId}).`);
            loadDashboardData();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Server communication error.");
    }
}

// Setup browser local STT listener
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false;
        speechRecognition.interimResults = false;
        
        speechRecognition.onstart = () => {
            isListening = true;
            micConsole.classList.add("active");
            voiceStatus.innerText = "Listening to your voice...";
            window.speechSynthesis.cancel(); // Stop talking on user start speak
        };
        
        speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Local STT result: ", transcript);
            
            // Add user bubble
            addChatBubble("user", transcript);
            
            // Send to WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "text", // Send text transcribed locally for ultra-high speed loop
                    text: transcript,
                    patient_id: currentPatientId
                }));
            }
        };
        
        speechRecognition.onerror = (e) => {
            console.error("Speech Recognition Error: ", e);
            isListening = false;
            micConsole.classList.remove("active");
            voiceStatus.innerText = "Error capturing audio. Try again.";
        };
        
        speechRecognition.onend = () => {
            isListening = false;
            micConsole.classList.remove("active");
            voiceStatus.innerText = "Processing response...";
        };
    } else {
        console.warn("Speech Recognition not supported in this browser.");
    }
}

// Toggle voice recording
function toggleVoiceListening() {
    if (isListening) {
        if (speechRecognition) speechRecognition.stop();
    } else {
        // Cancel active voice playback
        window.speechSynthesis.cancel();
        isSpeaking = false;
        
        if (speechRecognition) {
            // Pick language hint based on selected patient profile
            const currentProfileLang = document.getElementById("dbg-pat-lang").innerText;
            if (currentProfileLang === "Hindi") {
                speechRecognition.lang = "hi-IN";
            } else if (currentProfileLang === "Tamil") {
                speechRecognition.lang = "ta-IN";
            } else {
                speechRecognition.lang = "en-US";
            }
            speechRecognition.start();
        } else {
            // Browser doesn't support mic recording fallback
            const typedText = prompt("Speech recognition is not supported in this browser. Enter query text manually:");
            if (typedText) {
                addChatBubble("user", typedText);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: "text",
                        text: typedText,
                        patient_id: currentPatientId
                    }));
                }
            }
        }
    }
}

// Send typed text query
function sendTextMessage() {
    const text = textQueryInput.value.trim();
    if (!text) return;
    
    // Add user bubble
    addChatBubble("user", text);
    
    // Reset text input box
    textQueryInput.value = "";
    
    // Cancel agent voice if speaking
    window.speechSynthesis.cancel();
    isSpeaking = false;
    voiceStatus.innerText = "Processing...";
    
    // Send to server
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "text",
            text: text,
            patient_id: currentPatientId
        }));
    }
}

// Handle WebSocket responses from server
function handleServerMessage(payload) {
    console.log("WebSocket Recv: ", payload);
    
    // 1. Handshake response
    if (payload.type === "handshake") {
        console.log("Handshake verified. Session ID: ", payload.session_id);
    }
    
    // 2. Core audio/text conversation response
    if (payload.type === "audio_response") {
        // Clear speech animation states
        voiceStatus.innerText = "Online";
        
        // Add chat bubbles
        addChatBubble("assistant", payload.agent_reply, payload.language);
        
        // Update latency graphics
        updateLatencyMeters(payload.latency);
        
        // Update short term session debugger
        updateSessionDebugger(payload.session_state);
        
        // Refresh grids and schedules
        loadDashboardData();
        
        // Render reasoning traces if provided
        if (payload.reasoning_trace) {
            renderReasoningTrace(payload.reasoning_trace);
        }
        
        // Speak response out loud
        speakText(payload.agent_reply, payload.language);
    }
    
    // 3. Campaign outbound call trigger
    if (payload.type === "campaign_speech") {
        campaignBanner.style.display = "flex";
        
        // Add campaign assistant bubble
        addChatBubble("assistant", `[Outbound Campaign] ${payload.text}`, payload.language);
        
        // Update state explorer
        updateSessionDebugger(payload.session_state);
        if (payload.patient_profile) {
            document.getElementById("dbg-pat-name").innerText = payload.patient_profile.name;
            document.getElementById("dbg-pat-lang").innerText = payload.patient_profile.preferred_language;
        }
        
        // Speak outbound speech out loud
        speakText(payload.text, payload.language, true);
    }
    
    // 4. Interrupted confirmation
    if (payload.type === "interrupted") {
        console.log("Server confirmed interruption.");
        window.speechSynthesis.cancel();
        isSpeaking = false;
        campaignBanner.style.display = "none";
        voiceStatus.innerText = "Interrupted agent. Ready for instructions.";
        
        addChatBubble("assistant", `[Interrupted] ${payload.message}`);
        updateSessionDebugger(payload.session_state);
    }
    
    // 5. Fallback alerts
    if (payload.type === "fallback_alert") {
        voiceStatus.innerText = "Error received.";
        addChatBubble("assistant", payload.text);
        updateLatencyMeters(payload.latency);
        speakText(payload.text, "English");
    }
}

// Speak response aloud utilizing browser's speech synthesis engine
function speakText(text, language = "English", isCampaign = false) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Stop active speaking
    
    activeUtterance = new SpeechSynthesisUtterance(text);
    isSpeaking = true;
    
    // Configure voice properties based on language
    if (language === "Hindi") {
        activeUtterance.lang = "hi-IN";
    } else if (language === "Tamil") {
        activeUtterance.lang = "ta-IN";
    } else {
        activeUtterance.lang = "en-US";
    }
    
    // Select premium neural voice if available in user browser
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (language === "Hindi") {
        selectedVoice = voices.find(v => v.lang.includes("hi") || v.name.includes("Madhur"));
    } else if (language === "Tamil") {
        selectedVoice = voices.find(v => v.lang.includes("ta") || v.name.includes("Valluvar"));
    } else {
        selectedVoice = voices.find(v => v.lang.includes("en") && v.name.includes("Aria"));
    }
    
    if (selectedVoice) activeUtterance.voice = selectedVoice;
    
    activeUtterance.onstart = () => {
        voiceStatus.innerText = "Agent is speaking...";
        micConsole.classList.remove("active");
    };
    
    activeUtterance.onend = () => {
        isSpeaking = false;
        voiceStatus.innerText = "Online | Ready";
        if (isCampaign) {
            campaignBanner.style.display = "none";
        }
    };
    
    activeUtterance.onerror = (e) => {
        console.error("Speech Synthesis Error: ", e);
        isSpeaking = false;
    };
    
    window.speechSynthesis.speak(activeUtterance);
}

// Trigger outbound campaigns
function triggerCampaign(campaignType) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "trigger_campaign",
            campaign: campaignType,
            patient_id: currentPatientId
        }));
    }
}

// Trigger manual outbound interruption pivot
function triggerManualInterruption() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "interruption"
        }));
    }
}

// Add bubbles to chat console
function addChatBubble(role, text, lang = "English") {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;
    
    const metaText = role === "user" ? "Patient" : `AURA AI Receptionist (${lang})`;
    
    bubble.innerHTML = `
        <div class="bubble-meta">
            <span>${metaText}</span>
        </div>
        <div class="bubble-content">
            ${text}
        </div>
    `;
    
    transcriptBox.appendChild(bubble);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

// Update the SLA Latency timeline logs
function updateLatencyMeters(latencyObj) {
    if (!latencyObj) return;
    
    // Animate progress widths
    // Max widths based on budget: STT (150ms max), Lang (10ms max), LLM (300ms max), TTS (150ms max)
    const pctStt = Math.min((latencyObj.stt / 150) * 100, 100);
    const pctLang = Math.min((latencyObj.lang / 10) * 100, 100);
    const pctLlm = Math.min((latencyObj.llm / 300) * 100, 100);
    const pctTts = Math.min((latencyObj.tts / 150) * 100, 100);
    
    barStt.style.width = `${pctStt}%`;
    barLang.style.width = `${pctLang}%`;
    barLlm.style.width = `${pctLlm}%`;
    barTts.style.width = `${pctTts}%`;
    
    valStt.innerText = `${latencyObj.stt} ms`;
    valLang.innerText = `${latencyObj.lang} ms`;
    valLlm.innerText = `${latencyObj.llm} ms`;
    valTts.innerText = `${latencyObj.tts} ms`;
    
    totalLatencyVal.innerText = `${latencyObj.total}ms`;
    
    // Evaluate SLA constraint (< 450ms)
    if (latencyObj.total < 450) {
        slaBadge.className = "sla-compliant";
        slaBadge.innerText = "SLA COMPLIANT";
        totalLatencyVal.style.color = "var(--success)";
    } else {
        slaBadge.className = "sla-warning";
        slaBadge.innerText = "SLA BREACHED";
        totalLatencyVal.style.color = "var(--error)";
    }
}

// Update Short-term state explorer
function updateSessionDebugger(state) {
    if (!state) return;
    
    document.getElementById("dbg-sess-intent").innerText = state.intent || "idle";
    document.getElementById("dbg-sess-lang").innerText = state.current_language || "English";
    
    const slots = state.pending_slots || {};
    
    const docNames = {
        "doc_1": "Dr. Aarav Patel",
        "doc_2": "Dr. Priya Sharma",
        "doc_3": "Dr. Ananya Nair",
        "doc_4": "Dr. Vikram Sen"
    };
    
    document.getElementById("dbg-sess-doc").innerText = docNames[slots.doctor_id] || "-";
    document.getElementById("dbg-sess-date").innerText = slots.date || "-";
    document.getElementById("dbg-sess-time").innerText = slots.time || "-";
}

// Save Google Gemini API Key dynamically
async function saveGeminiKey() {
    const key = geminiKeyInput.value.trim();
    if (!key) {
        alert("Please enter a valid key!");
        return;
    }
    
    try {
        const response = await fetch("/api/config/api_key", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({api_key: key})
        });
        const result = await response.json();
        
        if (result.status === "success") {
            alert("Success: Gemini API key has been securely configured!");
            geminiKeyInput.value = "";
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Could not communicate with the backend to configure API key.");
    }
}

// Draw dynamic decorative waveform matching audio status
function drawWaveform() {
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    let frequency = 0.02;
    let amplitude = 2; // idle
    let speed = 0.05;
    
    if (isListening) {
        amplitude = 12;
        speed = 0.15;
    } else if (isSpeaking) {
        amplitude = 18;
        speed = 0.1;
    }
    
    const time = Date.now() * speed;
    
    ctx.beginPath();
    ctx.strokeStyle = isSpeaking ? "rgba(0, 242, 254, 0.6)" : (isListening ? "rgba(255, 0, 127, 0.6)" : "rgba(138, 43, 226, 0.3)");
    ctx.lineWidth = 2;
    
    for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * frequency + time) * amplitude * Math.sin(x / 100);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Wave 2
    ctx.beginPath();
    ctx.strokeStyle = isSpeaking ? "rgba(138, 43, 226, 0.4)" : (isListening ? "rgba(138, 43, 226, 0.4)" : "rgba(0, 242, 254, 0.15)");
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * (frequency * 1.5) - time) * (amplitude * 0.7) * Math.sin(x / 100);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    requestAnimationFrame(drawWaveform);
}

// Make voice voices refreshable as they take time to load in browser
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {};
}

// Render Agent Reasoning Trace on Dashboard console
function renderReasoningTrace(trace) {
    const card = document.getElementById("reasoning-trace-card");
    const container = document.getElementById("reasoning-trace-content");
    
    if (!trace || trace.length === 0) {
        card.style.display = "none";
        return;
    }
    
    card.style.display = "block";
    container.innerHTML = "";
    
    trace.forEach(step => {
        const row = document.createElement("div");
        row.className = "reasoning-step";
        row.innerHTML = `
            <div class="reasoning-step-title">${step.step}</div>
            <div class="reasoning-step-detail">${step.detail}</div>
        `;
        container.appendChild(row);
    });
    
    container.scrollTop = container.scrollHeight;
}

