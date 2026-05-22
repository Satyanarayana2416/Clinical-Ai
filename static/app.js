// =====================================================================
//  AURA Voice - Clinical AI Agent Frontend Application
// =====================================================================

// ========== STATE ==========
let ws = null;
let currentPatientId = "pat_1";
let activeDoctorId = "doc_1";
let isListening = false;
let isSpeaking = false;
let speechRecognition = null;
let activeUtterance = null;
let registeredUser = null;
let serverPort = window.location.port || "8000";
let serverHost = window.location.hostname || "127.0.0.1";

// ========== DOM ELEMENTS ==========
const landingPage = document.getElementById("landing-page");
const registrationModal = document.getElementById("registration-modal");
const dashboardPage = document.getElementById("dashboard-page");
const getStartedBtn = document.getElementById("get-started-btn");
const registrationForm = document.getElementById("registration-form");
const particleCanvas = document.getElementById("particle-canvas");

// ========== INITIALIZATION ==========
document.addEventListener("DOMContentLoaded", () => {
    initParticleCanvas();
    checkExistingUser();
    setupLandingEvents();
});

// ========== PARTICLE CANVAS ANIMATION ==========
function initParticleCanvas() {
    if (!particleCanvas) return;
    const ctx = particleCanvas.getContext("2d");
    let particles = [];
    let mouseX = 0, mouseY = 0;
    let animId;

    function resize() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * particleCanvas.width;
            this.y = Math.random() * particleCanvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.hue = Math.random() > 0.5 ? 270 : 160; // violet or teal
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // Mouse attraction
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                this.x += dx * 0.002;
                this.y += dy * 0.002;
                this.opacity = Math.min(this.opacity + 0.01, 0.8);
            }

            if (this.x < 0 || this.x > particleCanvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > particleCanvas.height) this.speedY *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${this.opacity})`;
            ctx.fill();
        }
    }

    // Create particles
    const count = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 8000), 120);
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }

    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(124, 58, 237, ${0.08 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        drawConnections();
        animId = requestAnimationFrame(animate);
    }
    animate();

    // Cleanup when leaving landing
    window._stopParticles = () => {
        cancelAnimationFrame(animId);
    };
}

// ========== LANDING PAGE EVENTS ==========
function setupLandingEvents() {
    if (getStartedBtn) {
        getStartedBtn.addEventListener("click", () => {
            registrationModal.style.display = "flex";
        });
    }

    if (registrationForm) {
        registrationForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("reg-name").value.trim();
            const place = document.getElementById("reg-place").value.trim();
            const age = document.getElementById("reg-age").value.trim();

            if (!name || !place || !age) return;

            const submitBtn = document.getElementById("reg-submit-btn");
            submitBtn.innerHTML = '<span>Registering...</span>';
            submitBtn.disabled = true;

            try {
                const res = await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, place, age })
                });
                const result = await res.json();

                if (result.success) {
                    registeredUser = result.user;
                    localStorage.setItem("aura_user_id", result.user.user_id);
                    localStorage.setItem("aura_user_name", result.user.name);
                    transitionToDashboard();
                } else {
                    alert("Registration failed: " + result.message);
                    submitBtn.innerHTML = '<span>Continue to Dashboard</span>';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                alert("Server connection error. Please ensure the server is running.");
                submitBtn.innerHTML = '<span>Continue to Dashboard</span>';
                submitBtn.disabled = false;
            }
        });
    }
}

// ========== CHECK EXISTING USER ==========
async function checkExistingUser() {
    const userId = localStorage.getItem("aura_user_id");
    if (!userId) return; // Show landing page

    try {
        const res = await fetch(`/api/user/${userId}`);
        const data = await res.json();
        if (data.registered) {
            registeredUser = data.user;
            transitionToDashboard(true); // Skip animation for returning user
        }
    } catch (e) {
        console.log("Server not reachable yet, showing landing page.");
    }
}

// ========== TRANSITION TO DASHBOARD ==========
function transitionToDashboard(instant = false) {
    if (window._stopParticles) window._stopParticles();

    if (instant) {
        landingPage.style.display = "none";
        registrationModal.style.display = "none";
        dashboardPage.style.display = "block";
    } else {
        // Smooth fade out
        landingPage.style.opacity = "0";
        landingPage.style.transition = "opacity 0.6s ease";
        registrationModal.style.opacity = "0";
        registrationModal.style.transition = "opacity 0.4s ease";

        setTimeout(() => {
            landingPage.style.display = "none";
            registrationModal.style.display = "none";
            dashboardPage.style.display = "block";
            dashboardPage.style.opacity = "0";
            dashboardPage.style.transition = "opacity 0.6s ease";
            requestAnimationFrame(() => {
                dashboardPage.style.opacity = "1";
            });
        }, 600);
    }

    // Set user info in header
    const userName = registeredUser ? registeredUser.name : localStorage.getItem("aura_user_name") || "User";
    const userId = registeredUser ? registeredUser.user_id : (localStorage.getItem("aura_user_id") || "pat_1");
    currentPatientId = userId;

    const avatarEl = document.getElementById("user-avatar");
    const nameEl = document.getElementById("user-name-display");
    if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = userName;

    // Add option to patient-select list if not already present
    const patientSelect = document.getElementById("patient-select");
    if (patientSelect) {
        let exists = false;
        for (let i = 0; i < patientSelect.options.length; i++) {
            if (patientSelect.options[i].value === userId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            const opt = document.createElement("option");
            opt.value = userId;
            opt.textContent = `${userName} (${registeredUser ? registeredUser.place : 'Registered Patient'})`;
            patientSelect.appendChild(opt);
        }
        patientSelect.value = userId;
    }

    // Initialize dashboard
    setTimeout(() => {
        initDashboard();
    }, instant ? 50 : 700);
}

// ========== DASHBOARD INITIALIZATION ==========
function initDashboard() {
    initWebSocket();
    setupDashboardEvents();
    loadDashboardData();
    setupSpeechRecognition();
    initWaveformCanvas();
}

// ========== WEBSOCKET ==========
function initWebSocket() {
    const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${wsScheme}//${serverHost}:${serverPort}/ws`);

    ws.onopen = () => {
        const dot = document.getElementById("server-status-dot");
        const text = document.getElementById("server-status-text");
        if (dot) { dot.style.backgroundColor = "var(--success)"; dot.style.boxShadow = "0 0 8px var(--success)"; }
        if (text) text.innerText = "Connected";

        // Trigger automatic welcome greeting from voice agent
        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "text", text: "hello", patient_id: currentPatientId }));
            }
        }, 500);
    };

    ws.onclose = () => {
        const dot = document.getElementById("server-status-dot");
        const text = document.getElementById("server-status-text");
        if (dot) { dot.style.backgroundColor = "var(--error)"; dot.style.boxShadow = "0 0 8px var(--error)"; }
        if (text) text.innerText = "Disconnected";
        setTimeout(initWebSocket, 3000);
    };

    ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        handleServerMessage(payload);
    };
}

// ========== DASHBOARD EVENTS ==========
function setupDashboardEvents() {
    const patientSelect = document.getElementById("patient-select");
    const micBtn = document.getElementById("mic-btn");
    const sendQueryBtn = document.getElementById("send-query-btn");
    const textQueryInput = document.getElementById("text-query-input");
    const interruptBtn = document.getElementById("interrupt-btn");
    const saveKeyBtn = document.getElementById("save-key-btn");

    if (patientSelect) patientSelect.addEventListener("change", (e) => {
        currentPatientId = e.target.value;
        loadPatientProfile(currentPatientId);
    });

    if (micBtn) micBtn.addEventListener("click", toggleVoiceListening);

    if (sendQueryBtn) sendQueryBtn.addEventListener("click", sendTextMessage);
    if (textQueryInput) textQueryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendTextMessage();
    });

    if (interruptBtn) interruptBtn.addEventListener("click", triggerManualInterruption);
    if (saveKeyBtn) saveKeyBtn.addEventListener("click", saveGeminiKey);
}

// ========== PATIENT PROFILE ==========
async function loadPatientProfile(patientId) {
    try {
        const response = await fetch(`/api/patient/${patientId}`);
        const profile = await response.json();

        const docNames = { "doc_1": "Dr. Aarav Patel", "doc_2": "Dr. Priya Sharma", "doc_3": "Dr. Ananya Nair", "doc_4": "Dr. Vikram Sen" };
        const el = (id) => document.getElementById(id);

        if (el("dbg-pat-name")) el("dbg-pat-name").innerText = profile.name;
        if (el("dbg-pat-lang")) el("dbg-pat-lang").innerText = profile.preferred_language;
        if (el("dbg-pat-doc")) el("dbg-pat-doc").innerText = docNames[profile.preferred_doctor] || "—";
        if (el("dbg-pat-hosp")) el("dbg-pat-hosp").innerText = profile.preferred_hospital || "—";
    } catch (e) {
        console.error("Error loading patient profile:", e);
    }
}

// ========== DASHBOARD DATA ==========
async function loadDashboardData() {
    try {
        loadPatientProfile(currentPatientId);

        const resDocs = await fetch("/api/doctors");
        const doctors = await resDocs.json();
        const doctorTabsContainer = document.getElementById("doctor-tabs");

        if (doctorTabsContainer) {
            doctorTabsContainer.innerHTML = "";
            doctors.forEach((doc) => {
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
        }

        const statDoctors = document.getElementById("stat-doctors");
        if (statDoctors) statDoctors.textContent = doctors.length;

        renderScheduleGrid();
        loadAppointmentsList();
    } catch (e) {
        console.error("Error fetching dashboard data:", e);
    }
}

// ========== SCHEDULE GRID ==========
async function renderScheduleGrid() {
    try {
        const resSched = await fetch("/api/schedules");
        const schedules = await resSched.json();
        const container = document.getElementById("schedule-grid");
        if (!container) return;

        const docSchedules = schedules.filter(s => s.doctor_id === activeDoctorId);
        container.innerHTML = "";

        if (docSchedules.length === 0) {
            container.innerHTML = `<p class="empty-state">No available schedules found.</p>`;
            return;
        }

        docSchedules.forEach(sched => {
            const row = document.createElement("div");
            row.className = "grid-day-row";
            const dateObj = new Date(sched.date);
            const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            row.innerHTML = `
                <div class="day-label">${dateString} (${sched.date})</div>
                <div class="slots-flex" id="slots-for-${sched.date}"></div>
            `;
            container.appendChild(row);

            const slotsFlex = document.getElementById(`slots-for-${sched.date}`);
            const allSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];

            allSlots.forEach(slot => {
                const bubble = document.createElement("div");
                const isAvailable = sched.available_slots.includes(slot);
                bubble.className = `slot-bubble ${isAvailable ? '' : 'booked'}`;
                bubble.innerText = slot;

                if (isAvailable) {
                    bubble.onclick = () => {
                        const input = document.getElementById("text-query-input");
                        if (input) {
                            input.value = `Book appointment with selected doctor on ${sched.date} at ${slot}`;
                            input.focus();
                        }
                    };
                } else {
                    bubble.title = "Slot booked";
                }
                slotsFlex.appendChild(bubble);
            });
        });
    } catch (e) {
        console.error("Error rendering schedules:", e);
    }
}

// ========== APPOINTMENTS LIST ==========
async function loadAppointmentsList() {
    try {
        const res = await fetch("/api/appointments");
        const appointments = await res.json();
        const activeApps = appointments.filter(a => a.patient_id === currentPatientId && a.status === "booked");
        const container = document.getElementById("appointments-list");
        const countEl = document.getElementById("active-booking-count");
        const statAppts = document.getElementById("stat-appointments");

        if (countEl) countEl.innerText = `${activeApps.length} Appointment${activeApps.length === 1 ? '' : 's'}`;
        if (statAppts) statAppts.textContent = activeApps.length;
        if (!container) return;

        container.innerHTML = "";
        if (activeApps.length === 0) {
            container.innerHTML = `<p class="empty-state">No active booked appointments for this patient.</p>`;
            return;
        }

        activeApps.forEach(app => {
            const item = document.createElement("div");
            item.className = "appointment-item";
            const isBooked = app.status === "booked";
            item.innerHTML = `
                <div class="app-meta-left">
                    <h4>${app.doctor_name}</h4>
                    <p>${app.date} · ${app.time}</p>
                </div>
                <div class="app-meta-right">
                    <span class="app-status ${app.status}">${app.status}</span>
                    ${isBooked ? `<button class="cancel-app-btn" onclick="cancelAppointment('${app.id}')">Cancel</button>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        console.error("Error loading appointments:", e);
    }
}

// ========== CANCEL APPOINTMENT ==========
async function cancelAppointment(appId) {
    if (!confirm("Cancel this appointment?")) return;
    try {
        const res = await fetch(`/api/cancel/${appId}`, { method: "POST" });
        const result = await res.json();
        if (result.success) {
            addChatBubble("assistant", `Appointment ${appId} cancelled successfully.`);
            loadDashboardData();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Server communication error.");
    }
}

// ========== SPEECH RECOGNITION ==========
function setupSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    speechRecognition = new SR();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;

    const micConsole = document.getElementById("mic-console");
    const voiceStatus = document.getElementById("voice-status");

    speechRecognition.onstart = () => {
        isListening = true;
        if (micConsole) micConsole.classList.add("active");
        if (voiceStatus) voiceStatus.innerText = "Listening...";
        window.speechSynthesis.cancel();
    };

    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        addChatBubble("user", transcript);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "speech", text: transcript, patient_id: currentPatientId }));
        }
    };

    speechRecognition.onerror = () => {
        isListening = false;
        if (micConsole) micConsole.classList.remove("active");
        if (voiceStatus) voiceStatus.innerText = "Error capturing audio. Try again.";
    };

    speechRecognition.onend = () => {
        isListening = false;
        if (micConsole) micConsole.classList.remove("active");
        if (voiceStatus) voiceStatus.innerText = "Processing...";
    };
}

function toggleVoiceListening() {
    if (isListening) {
        if (speechRecognition) speechRecognition.stop();
    } else {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        if (speechRecognition) {
            const lang = document.getElementById("dbg-pat-lang");
            const langText = lang ? lang.innerText : "English";
            speechRecognition.lang = langText === "Hindi" ? "hi-IN" : langText === "Tamil" ? "ta-IN" : "en-US";
            speechRecognition.start();
        } else {
            const text = prompt("Speech recognition unavailable. Type your query:");
            if (text) {
                addChatBubble("user", text);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "text", text, patient_id: currentPatientId }));
                }
            }
        }
    }
}

// ========== SEND TEXT ==========
function sendTextMessage() {
    const input = document.getElementById("text-query-input");
    const text = input ? input.value.trim() : "";
    if (!text) return;

    addChatBubble("user", text);
    if (input) input.value = "";
    window.speechSynthesis.cancel();
    isSpeaking = false;

    const voiceStatus = document.getElementById("voice-status");
    if (voiceStatus) voiceStatus.innerText = "Processing...";

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "text", text, patient_id: currentPatientId }));
    }
}

// ========== SERVER MESSAGE HANDLER ==========
function handleServerMessage(payload) {
    if (payload.type === "audio_response") {
        const voiceStatus = document.getElementById("voice-status");
        if (voiceStatus) voiceStatus.innerText = "Online";
        addChatBubble("assistant", payload.agent_reply, payload.language);
        updateLatencyMeters(payload.latency);
        updateSessionDebugger(payload.session_state);
        loadDashboardData();
        if (payload.reasoning_trace) renderReasoningTrace(payload.reasoning_trace);
        speakText(payload.agent_reply, payload.language);
    }

    if (payload.type === "campaign_speech") {
        const banner = document.getElementById("campaign-banner");
        if (banner) banner.style.display = "flex";
        addChatBubble("assistant", `[Outbound] ${payload.text}`, payload.language);
        updateSessionDebugger(payload.session_state);
        speakText(payload.text, payload.language, true);
    }

    if (payload.type === "interrupted") {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        const banner = document.getElementById("campaign-banner");
        if (banner) banner.style.display = "none";
        const voiceStatus = document.getElementById("voice-status");
        if (voiceStatus) voiceStatus.innerText = "Interrupted. Ready.";
        addChatBubble("assistant", `[Interrupted] ${payload.message}`);
        updateSessionDebugger(payload.session_state);
    }

    if (payload.type === "fallback_alert") {
        addChatBubble("assistant", payload.text);
        updateLatencyMeters(payload.latency);
        speakText(payload.text, "English");
    }
}

// ========== SPEECH SYNTHESIS ==========
function speakText(text, language = "English", isCampaign = false) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    isSpeaking = true;

    utterance.lang = language === "Hindi" ? "hi-IN" : language === "Tamil" ? "ta-IN" : "en-US";

    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    if (language === "Hindi") voice = voices.find(v => v.lang.includes("hi"));
    else if (language === "Tamil") voice = voices.find(v => v.lang.includes("ta"));
    else voice = voices.find(v => v.lang.includes("en") && v.name.includes("Aria"));
    if (voice) utterance.voice = voice;

    const voiceStatus = document.getElementById("voice-status");
    const micConsole = document.getElementById("mic-console");

    utterance.onstart = () => {
        if (voiceStatus) voiceStatus.innerText = "Agent speaking...";
        if (micConsole) micConsole.classList.remove("active");
        if (speechRecognition && isListening) {
            speechRecognition.stop();
        }
    };
    utterance.onend = () => {
        isSpeaking = false;
        if (voiceStatus) voiceStatus.innerText = "Online · Ready";
        if (isCampaign) {
            const banner = document.getElementById("campaign-banner");
            if (banner) banner.style.display = "none";
        }
        
        // Hands-Free Dialogue Auto-Listen
        setTimeout(() => {
            if (speechRecognition && !isListening && !isSpeaking) {
                const lang = document.getElementById("dbg-pat-lang");
                const langText = lang ? lang.innerText : "English";
                speechRecognition.lang = langText === "Hindi" ? "hi-IN" : langText === "Tamil" ? "ta-IN" : "en-US";
                try {
                    speechRecognition.start();
                } catch (e) {
                    console.log("Hands-free voice recognition auto-start avoided/failed:", e);
                }
            }
        }, 300);
    };
    utterance.onerror = () => { isSpeaking = false; };

    window.speechSynthesis.speak(utterance);
}

// ========== CAMPAIGNS ==========
function triggerCampaign(type) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "trigger_campaign", campaign: type, patient_id: currentPatientId }));
    }
}

function triggerManualInterruption() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "interruption" }));
    }
}

// ========== CHAT BUBBLES ==========
function addChatBubble(role, text, lang = "English") {
    const box = document.getElementById("transcript-box");
    if (!box) return;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role} ${role === 'user' ? 'slide-in-right' : 'slide-in-left'}`;
    const meta = role === "user" ? "You" : `AURA AI (${lang})`;

    bubble.innerHTML = `
        <div class="bubble-meta"><span>${meta}</span></div>
        <div class="bubble-content">${text}</div>
    `;
    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;
}

// ========== LATENCY METERS ==========
function updateLatencyMeters(lat) {
    if (!lat) return;

    const setBar = (id, val, max) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.min((val / max) * 100, 100)}%`;
    };
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = `${val} ms`;
    };

    setBar("bar-stt", lat.stt, 150);
    setBar("bar-lang", lat.lang, 10);
    setBar("bar-llm", lat.llm, 300);
    setBar("bar-tts", lat.tts, 150);
    setVal("val-stt", lat.stt);
    setVal("val-lang", lat.lang);
    setVal("val-llm", lat.llm);
    setVal("val-tts", lat.tts);

    const totalEl = document.getElementById("total-latency-val");
    const badgeEl = document.getElementById("sla-badge");
    const statLat = document.getElementById("stat-latency");

    if (totalEl) totalEl.innerText = `${lat.total}ms`;
    if (statLat) statLat.textContent = `${Math.round(lat.total)}ms`;

    if (lat.total < 450) {
        if (badgeEl) { badgeEl.className = "sla-compliant"; badgeEl.innerText = "SLA COMPLIANT"; }
        if (totalEl) totalEl.style.color = "var(--success)";
    } else {
        if (badgeEl) { badgeEl.className = "sla-warning"; badgeEl.innerText = "SLA BREACHED"; }
        if (totalEl) totalEl.style.color = "var(--error)";
    }
}

// ========== SESSION DEBUGGER ==========
function updateSessionDebugger(state) {
    if (!state) return;
    const el = (id) => document.getElementById(id);
    const docNames = { "doc_1": "Dr. Aarav Patel", "doc_2": "Dr. Priya Sharma", "doc_3": "Dr. Ananya Nair", "doc_4": "Dr. Vikram Sen" };
    const slots = state.pending_slots || {};

    if (el("dbg-sess-intent")) el("dbg-sess-intent").innerText = state.intent || "idle";
    if (el("dbg-sess-lang")) el("dbg-sess-lang").innerText = state.current_language || "English";
    if (el("dbg-sess-doc")) el("dbg-sess-doc").innerText = docNames[slots.doctor_id] || "—";
    if (el("dbg-sess-date")) el("dbg-sess-date").innerText = slots.date || "—";
    if (el("dbg-sess-time")) el("dbg-sess-time").innerText = slots.time || "—";
}

// ========== GEMINI KEY ==========
async function saveGeminiKey() {
    const input = document.getElementById("gemini-key-input");
    const key = input ? input.value.trim() : "";
    if (!key) { alert("Please enter a valid key!"); return; }

    try {
        const res = await fetch("/api/config/api_key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key })
        });
        const result = await res.json();
        if (result.status === "success") {
            alert("Gemini API key configured!");
            if (input) input.value = "";
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Could not communicate with the backend.");
    }
}

// ========== WAVEFORM CANVAS ==========
function initWaveformCanvas() {
    const canvas = document.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function draw() {
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        let freq = 0.02, amp = 2, speed = 0.05;
        if (isListening) { amp = 14; speed = 0.15; }
        else if (isSpeaking) { amp = 20; speed = 0.1; }

        const time = Date.now() * speed;

        // Wave 1
        ctx.beginPath();
        ctx.strokeStyle = isSpeaking ? "rgba(6, 214, 160, 0.6)" : (isListening ? "rgba(247, 37, 133, 0.6)" : "rgba(124, 58, 237, 0.25)");
        ctx.lineWidth = 2;
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * freq + time) * amp * Math.sin(x / 100);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Wave 2
        ctx.beginPath();
        ctx.strokeStyle = isSpeaking ? "rgba(124, 58, 237, 0.35)" : (isListening ? "rgba(124, 58, 237, 0.35)" : "rgba(6, 214, 160, 0.12)");
        ctx.lineWidth = 1.5;
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * (freq * 1.5) - time) * (amp * 0.7) * Math.sin(x / 100);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        requestAnimationFrame(draw);
    }
    draw();
}

// ========== REASONING TRACE ==========
function renderReasoningTrace(trace) {
    const card = document.getElementById("reasoning-trace-card");
    const container = document.getElementById("reasoning-trace-content");
    if (!trace || trace.length === 0) { if (card) card.style.display = "none"; return; }

    if (card) card.style.display = "block";
    if (container) {
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
}

// ========== VOICE INIT ==========
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {};
}
