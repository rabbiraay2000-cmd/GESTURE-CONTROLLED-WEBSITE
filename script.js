/*
 * Gesture-Controlled Website - JavaScript
 * Touchless control using MediaPipe Hands
 */

const SWIPE_DIST = 0.25;
const SWIPE_WINDOW = 400;
const COOLDOWN = 900;
const DETECTION_CONFIDENCE = 0.7;
const TRACKING_CONFIDENCE = 0.7;
const MAX_NUM_HANDS = 1;

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];
const PALM_LANDMARK = 9;

const state = {
    index: 0,
    paused: false,
    lastSwipe: 0,
    trail: [],
    totalPages: 5,
    mediapipeReady: false,
    cameraActive: false
};

const PAGES = [
    { title: "Welcome", content: "This is a touchless gesture-controlled website.<br>Show your hand to the camera and use gestures to navigate." },
    { title: "About", content: "Control web content without touching your device.<br>Powered by MediaPipe Hands real-time hand tracking." },
    { title: "Features", content: "• Swipe right to go next<br>• Swipe left to go back<br>• Fist to pause control<br>• Open palm to resume" },
    { title: "Privacy", content: "All video is processed locally in your browser.<br>Nothing is stored or uploaded to any server." },
    { title: "Conclusion", content: "Thank you for viewing!<br>Use keyboard arrow keys as fallback if camera fails." }
];

const videoEl = document.getElementById('video');
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');
const camEmpty = document.getElementById('camEmpty');
const cameraError = document.getElementById('cameraError');
const debugInfo = document.getElementById('debugInfo');
const startBtn = document.getElementById('startCam');
const stopBtn = document.getElementById('stopCam');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const pageCounter = document.getElementById('pageCounter');
const pageTitle = document.getElementById('pageTitle');
const pageContent = document.getElementById('pageContent');
const gestureText = document.getElementById('gestureText');
const modeText = document.getElementById('modeText');
const handText = document.getElementById('handText');

let hands = null;
let camera = null;

function log(msg) {
    console.log('[Gesture]', msg);
    if (debugInfo) debugInfo.textContent += msg + '\n';
}

function init() {
    // Check if MediaPipe loaded
    if (typeof Hands === 'undefined') {
        log('ERROR: Hands is not defined - MediaPipe Hands library not loaded');
        showCameraError('MediaPipe Hands library failed to load. Check internet connection.');
        return;
    }
    if (typeof Camera === 'undefined') {
        log('ERROR: Camera is not defined - MediaPipe Camera Utils not loaded');
        showCameraError('MediaPipe Camera Utils failed to load.');
        return;
    }

    log('MediaPipe libraries loaded successfully');
    state.mediapipeReady = true;

    renderPage(0);
    updateStatus('—', 'Active', 'No');
    setupKeyboard();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    log('Initialized');
}

function renderPage(i) {
    state.index = Math.min(PAGES.length - 1, Math.max(0, i));
    const p = PAGES[state.index];
    pageTitle.textContent = p.title;
    pageContent.innerHTML = p.content;
    pageCounter.textContent = `Page ${state.index + 1} / ${PAGES.length}`;
}

prevBtn.addEventListener('click', () => renderPage(state.index - 1));
nextBtn.addEventListener('click', () => renderPage(state.index + 1));

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); renderPage(state.index + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); renderPage(state.index - 1); }
    });
}

function updateStatus(gesture, mode, hand) {
    gestureText.textContent = gesture;
    modeText.textContent = mode;
    modeText.className = mode === 'Paused' ? 'status-value mode-paused' : 'status-value mode-active';
    handText.textContent = hand;
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

function showCameraError(msg) {
    cameraError.style.display = 'block';
    cameraError.textContent = '⚠️ ' + msg;
    log('Camera error: ' + msg);
}

startBtn.addEventListener('click', async () => {
    if (!state.mediapipeReady) {
        showCameraError('MediaPipe Hands not ready. Refresh the page and try again.');
        return;
    }

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

        log('Initializing Hands solution...');
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

        log('Starting camera...');
        camera = new Camera(videoEl, {
            onFrame: async () => {
                await hands.send({ image: videoEl });
            },
            width: videoWidth,
            height: videoHeight
        });

        await camera.start();
        state.cameraActive = true;
        log('Camera started');

        startBtn.disabled = true;
        stopBtn.disabled = false;
        updateStatus('Starting...', 'Active', 'Yes');
    } catch (err) {
        console.error('Camera error:', err);
        showCameraError(err.message || 'Camera unavailable');
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
    hands = null;
    state.cameraActive = false;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    videoEl.style.display = 'none';
    overlayCanvas.style.display = 'none';
    camEmpty.style.display = 'flex';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    state.trail = [];
    updateStatus('Camera stopped', 'Active', 'No');
    log('Camera stopped');
});

function resizeCanvas() {
    if (videoEl.videoWidth) {
        overlayCanvas.width = videoEl.videoWidth;
        overlayCanvas.height = videoEl.videoHeight;
    }
}

function onResults(results) {
    if (!state.cameraActive || !state.mediapipeReady) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const lm = results.multiHandLandmarks && results.multiHandLandmarks[0];

    if (!lm) {
        state.trail = [];
        updateStatus('No hand', 'Active', 'No');
        return;
    }

    drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#38bdf8', lineWidth: 2 });
    drawLandmarks(ctx, lm, { color: '#f472b6', lineWidth: 2, radius: 3 });

    const now = performance.now();

    const nUp = TIPS.filter((tip, i) => lm[tip].y < lm[PIPS[i]].y).length;
    const pose = nUp === 4 ? 'open' : nUp === 0 ? 'fist' : 'other';

    if (pose === 'fist') {
        state.paused = true;
        state.trail = [];
        setMode();
        updateStatus('Fist (Paused)', state.paused ? 'Paused' : 'Active', 'Yes');
        return;
    }

    if (pose === 'open' && state.paused) {
        state.paused = false;
        state.trail = [];
        setMode();
    }

    if (state.paused) {
        updateStatus('Show open palm to resume', 'Paused', 'Yes');
        return;
    }

    let swipe = null;
    if (pose === 'open') {
        swipe = detectSwipe(lm, now);
    }

    if (swipe) {
        renderPage(state.index + (swipe === 'Swipe Right' ? 1 : -1));
        state.lastSwipe = now;
        state.trail = [];
        updateStatus(swipe, 'Active', 'Yes');
        setTimeout(() => {
            if (gestureText.textContent === swipe) {
                gestureText.textContent = 'Open Palm';
            }
        }, 800);
    } else {
        updateStatus(pose === 'open' ? 'Open Palm' : 'Hand', 'Active', 'Yes');
    }
}

function detectSwipe(lm, now) {
    state.trail.push({ x: lm[PALM_LANDMARK].x, y: lm[PALM_LANDMARK].y, t: now });
    state.trail = state.trail.filter(p => now - p.t <= SWIPE_WINDOW);

    if (state.trail.length < 4 || now - state.lastSwipe < COOLDOWN) {
        return null;
    }

    const a = state.trail[0];
    const b = state.trail[state.trail.length - 1];
    const dx = -(b.x - a.x);
    const dy = b.y - a.y;

    if (Math.abs(dx) > SWIPE_DIST && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        return dx > 0 ? 'Swipe Right' : 'Swipe Left';
    }
    return null;
}

init();
