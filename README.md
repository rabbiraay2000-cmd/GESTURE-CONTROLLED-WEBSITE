# Gesture-Controlled Website

A touchless gesture-controlled website built using **HTML5, CSS3, JavaScript (ES6)** and the **MediaPipe Hands** library for real-time hand tracking.

## Project Overview

This website lets a user navigate web pages by moving a hand in front of an ordinary laptop webcam — no mouse, keyboard, touch screen, or extra hardware required. All video is processed locally in the browser, protecting user privacy.

## Features

- **Hand Gesture Control:**
  - 👉 Open palm swipe → **Next page**
  - 👈 Open palm swipe ← **Previous page**
  - ✊ Closed fist → **Pause gesture control**
  - 🖐 Open palm (when paused) → **Resume**
- **Hand skeleton overlay** drawn on the live camera feed
- **Status panel** shows detected gesture and Active/Paused state in real time
- **Cooldown timer** (900 ms) prevents accidental page changes
- **Keyboard fallback** — left/right arrow keys always work
- **On-screen Previous/Next buttons** as an additional backup
- **Page counter** (e.g., "Page 2 / 5")
- **Privacy-first:** all video processed locally in the browser; nothing is stored or uploaded
- **Single-page app** — no backend, no installation, no special hardware

## How to Run

Because the browser's `getUserMedia` API requires a **secure origin**, the page must be opened via **localhost** or **HTTPS**.

### Option 1: Using Python (simplest)

```bash
cd "D:\CONTROLLED MINI PROJECT"
python -m http.server 8000
```

Then open: `http://localhost:8000`

### Option 2: Using VS Code Live Server

Install the "Live Server" extension, open the project folder, and click "Go Live".

## Project Structure

```
CONTROLLED MINI PROJECT/
├── index.html    # Main HTML page
├── style.css     # Stylesheet
├── script.js     # Gesture engine & navigation logic
└── README.md     # This file
```

## Gesture Engine

The system uses **MediaPipe Hands** to detect **21 hand landmarks** per frame:

1. **Finger state detection:** A finger is "up" when its tip landmark is above its middle joint (PIP). All four fingers up = open palm; none up = fist.
2. **Swipe detection:** The palm centre (landmark 9) position is tracked over a 400 ms window. If horizontal movement exceeds 25% of frame width, a swipe is reported.
3. **Gesture stabilisation:** A fist pauses control; an open palm resumes. A 900 ms cooldown prevents repeated triggers from a single swipe.

## Browser Requirements

- Modern browser with WebAssembly support (Chrome, Edge, Firefox, Safari)
- Camera access permission
- Page served over **localhost** or **HTTPS** (required for `getUserMedia`)

## Deployment (GitHub Pages)

1. Push files to GitHub repository
2. Go to Settings → Pages
3. Source: Deploy from a branch → `main` / `/ (root)`
4. Site will be live at your GitHub Pages URL

## Project Team

Department of CSE (Cyber Security)  
J. J. College of Engineering and Technology, Tiruchirappalli  
Anna University, Chennai

November 2026
