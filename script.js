/*
 * Gesture-Controlled Presentation - JavaScript
 * Touchless slideshow control using MediaPipe Hands
 *
 * Gestures (from project report):
 *   - Open palm swipe right  -> Next slide
 *   - Open palm swipe left   -> Previous slide
 *   - Closed fist            -> Pause gesture control
 *   - Open palm (when paused)-> Resume control
 *   - Cooldown 900ms prevents repeated triggers
 *
 * All video is processed locally in the browser. Nothing is uploaded.
 */

/* ========== Tunable constants ========== */
const SWIPE_DIST = 0.25;      // min palm travel (fraction of frame width)
const SWIPE_WINDOW = 400;     // ms of hand history examined
const COOLDOWN = 900;         // ms ignored after each swipe
const DETECTION_CONFIDENCE = 0.7;
const TRACKING_CONFIDENCE = 0.7;
const MAX_NUM_HANDS = 1;

const TIPS = [8, 12, 16, 20];   // index, middle, ring, little fingertips
const PIPS = [6, 10, 14, 18];   // matching middle joints (PIP)
const PALM_LANDMARK = 9;        // middle-finger base ~ palm centre

/* ========== Application state ========== */
const state = {
    index: 0,            // current slide index
    paused: false,       // fist-pause flag
    lastSwipe: 0,        // timestamp of last accepted swipe
    trail: [],           // palm position history for swipe detection
    totalSlides: 5
};

/* ========== Slide content ========== */
const SLIDES = [
    {
        title: "Welcome",
        bullets: [
            "Touchless Gesture-Controlled Presentation",
            "Control your slideshow with hand gestures — no mouse or keyboard needed",
            "Powered by MediaPipe Hands real-time hand tracking",
            "Show your open palm and swipe to change slides"
        ]
    },
    {
        title: "Problem Statement",
        bullets: [
            "Conventional input devices need physical contact",
            "Shared touch screens can spread germs",
            "Wireless clickers can be lost or run out of battery",
            "People with limited mobility need accessible alternatives"
        ]
    },
    {
        title: "Proposed System",
        bullets: [
            "Browser-based gesture-controlled website",
            "Works with any ordinary laptop webcam",
            "No special sensors, gloves, or installation needed",
            "Single HTML file — no backend required"
        ]
    },
    {
        title: "How It Works",
        bullets: [
            "MediaPipe Hands detects 21 hand landmarks per frame",
            "Finger counting recognises open palm vs fist",
            "Palm movement over time detects left/right swipes",
            "Fist-to-pause and cooldown prevent accidental triggers"
        ]
    },
    {
        title: "Conclusion & Future Work",
        bullets: [
            "Low-cost, hygienic, and accessible touchless control",
            "All video processed locally — privacy protected",
            "Future: virtual mouse mode, more gestures, offline operation",
            "Keyboard arrow keys always available as fallback"
        ]
    }
];

/* ========== DOM elements ========== */
const videoEl = document.getElementById('video');
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');
const camEmpty = document.getElementById('camEmpty');
const cameraError = document.getElementById('cameraError');
const startBtn = document.getElementById('startCam');
const stopBtn = document.getElementById('stopCam');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const slideCounter = document.getElementById('slideCounter');
const gestureText = document.getElementById('gestureText');
const modeText = document.getElementById('modeText');
const handText = document.getElementById('handText');

let hands = null;
let camera = null;
let animationId = null;

/* ========== Initialisation ========== */
function init() {
    renderSlides();
    goTo(0);
    updateStatus('—', 'Active', 'No');
    setupKeyboard();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function renderSlides() {
    const slidesContainer = document.getElementById('slides');
    slidesContainer.innerHTML = SLIDES.map((slide, i) => `
        <div class="slide${i === 0 ? ' active' : ''}" id="slide-${i}">
            <h2>${slide.title}</h2>
            <ul>
                ${slide.bullets.map(b => `<li>${b}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

/* ========== Slideshow control ========== */
function goTo(i) {
    state.index = Math.min(SLIDES.length - 1, Math.max(0, i));
    const slides = document.querySelectorAll('.slide');
    slides.forEach((el, idx) => {
        el.classList.remove('active', 'exit-left', 'exit-right');
        if (idx === state.index) {
            el.classList.add('active');
        }
    });
    slideCounter.textContent = `Slide ${state.index + 1} / ${SLIDES.length}`;
}

prevBtn.addEventListener('click', () => goTo(state.index - 1));
nextBtn.addEventListener('click', () => goTo(state.index + 1));

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            goTo(state.index + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goTo(state.index - 1);
        }
    });
}

/* ========== Status panel ========== */
function setStatus(gesture, durationMs = 0) {
    gestureText.textContent = gesture;
    if (durationMs > 0) {
        setTimeout(() => {
            if (gestureText.textContent === gesture) {
                gestureText.textContent = state.paused ? 'Paused' : 'Hand';
            }
        }, durationMs);
    }
}

function setMode() {
    if (state.paused) {
        modeText.textContent = 'Paused';
        modeText.className = 'status-value mode-paused';
    } else {
        modeText.textContent = 'Active';
        modeText.className = 'status-value mode-active';
    }
}

function updateStatus(gesture, mode, hand) {
    gestureText.textContent = gesture;
    modeText.textContent = mode;
    modeText.className = mode === 'Paused' ? 'status-value mode-paused' : 'status-value mode-active';
    handText.textContent = hand;
}

/* ========== Camera ========== */
startBtn.addEventListener('click', async () => {
    try {
        cameraError.style.display = 'none';
        camEmpty.style.display = 'none';
        videoEl.style.display = 'block';
        overlayCanvas.style.display = 'block';

        const videoWidth = 640;
        const videoHeight = 480;
        videoEl.width = videoWidth;
        videoEl.height = videoHeight;
        overlayCanvas.width = videoWidth;
        overlayCanvas.height = videoHeight;

        // Initialise MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1633958589/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: MAX_NUM_HANDS,
            modelComplexity: 1,
            minDetectionConfidence: DETECTION_CONFIDENCE,
            minTrackingConfidence: TRACKING_CONFIDENCE
        });
        hands.onResults(onResults);

        // Initialise camera
        camera = new Camera(videoEl, {
            onFrame: async () => {
                await hands.send({ image: videoEl });
            },
            width: videoWidth,
            height: videoHeight
        });

        await camera.start();

        startBtn.disabled = true;
        stopBtn.disabled = false;
        updateStatus('Starting...', 'Active', 'Yes');
    } catch (err) {
        console.error('Camera error:', err);
        cameraError.style.display = 'block';
        videoEl.style.display = 'none';
        overlayCanvas.style.display = 'none';
        camEmpty.style.display = 'flex';
        updateStatus('Camera unavailable', 'Active', 'No');
    }
});

stopBtn.addEventListener('click', () => {
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (hands) {
        // Hands doesn't have a close method in older versions; just clear results
        hands = null;
    }
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    videoEl.style.display = 'none';
    overlayCanvas.style.display = 'none';
    camEmpty.style.display = 'flex';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    state.trail = [];
    updateStatus('Camera stopped', 'Active', 'No');
});

function resizeCanvas() {
    if (videoEl.videoWidth) {
        overlayCanvas.width = videoEl.videoWidth;
        overlayCanvas.height = videoEl.videoHeight;
    }
}

/* ========== MediaPipe callback ========== */
function onResults(results) {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const lm = results.multiHandLandmarks && results.multiHandLandmarks[0];

    if (!lm) {
        state.trail = [];
        updateStatus('No hand', 'Active', 'No');
        return;
    }

    // Draw hand skeleton overlay
    drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#38bdf8', lineWidth: 2 });
    drawLandmarks(ctx, lm, { color: '#f472b6', lineWidth: 2, radius: 3 });

    const now = performance.now();

    /* ---------- Finger state detection ---------- */
    const nUp = TIPS.filter((tip, i) => lm[tip].y < lm[PIPS[i]].y).length;
    const pose = nUp === 4 ? 'open' : nUp === 0 ? 'fist' : 'other';

    /* ---------- Fist = pause ---------- */
    if (pose === 'fist') {
        state.paused = true;
        state.trail = [];
        setMode();
        updateStatus('Fist (Paused)', state.paused ? 'Paused' : 'Active', 'Yes');
        return;
    }

    /* ---------- Open palm resumes ---------- */
    if (pose === 'open' && state.paused) {
        state.paused = false;
        state.trail = [];
        setMode();
    }

    if (state.paused) {
        updateStatus('Show open palm to resume', 'Paused', 'Yes');
        return;
    }

    /* ---------- Swipe detection (only for open palm) ---------- */
    let swipe = null;
    if (pose === 'open') {
        swipe = detectSwipe(lm, now);
    }

    if (swipe) {
        goTo(state.index + (swipe === 'Swipe Right' ? 1 : -1));
        state.lastSwipe = now;
        state.trail = [];
        updateStatus(swipe, 'Active', 'Yes');
        // Auto-clear gesture text after 800ms
        setTimeout(() => {
            if (gestureText.textContent === swipe) {
                gestureText.textContent = 'Open Palm';
            }
        }, 800);
    } else {
        updateStatus(pose === 'open' ? 'Open Palm' : 'Hand', 'Active', 'Yes');
    }
}

/* ---------- Swipe detection ---------- */
function detectSwipe(lm, now) {
    // Record palm centre (landmark 9) with timestamp
    state.trail.push({ x: lm[PALM_LANDMARK].x, y: lm[PALM_LANDMARK].y, t: now });

    // Keep only points inside the time window
    state.trail = state.trail.filter(p => now - p.t <= SWIPE_WINDOW);

    // Need enough points and must be past cooldown
    if (state.trail.length < 4 || now - state.lastSwipe < COOLDOWN) {
        return null;
    }

    const a = state.trail[0];
    const b = state.trail[state.trail.length - 1];

    // View is mirrored, so flip horizontal sign to match what the user sees
    const dx = -(b.x - a.x);
    const dy = b.y - a.y;

    // Horizontal movement must exceed threshold and dominate vertical movement
    if (Math.abs(dx) > SWIPE_DIST && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        return dx > 0 ? 'Swipe Right' : 'Swipe Left';
    }
    return null;
}

/* ========== Start ========== */
init();
