# 🏃 PaceUp — Virtual Pacer

**Your AI running pacer in your pocket.** A voice-guided running companion that adapts to your run type — easy runs, tempo, intervals, long runs, and race day.

---

## What It Does

PaceUp acts like a human pacer running beside you. Unlike typical running apps that beep *after* you drift off pace, PaceUp gives you **continuous, contextual voice guidance** that changes based on what you're training for:

| Run Type    | Pacer Behavior |
|-------------|----------------|
| **Easy Run**    | Only warns if you're going too fast. Keeps you honest on recovery days. |
| **Tempo Run**   | Holds you in a tight pace band. Nudges in both directions. |
| **Intervals**   | Counts reps, manages work/rest, countdowns before each rep. |
| **Long Run**    | Patient and gentle. Checks every few km. Warns against going out too fast. |
| **Race Mode**   | Tracks you against goal time split-by-split. 5K through full marathon. |

---

## Features

- 📍 **Live GPS tracking** with route on map
- 🗣️ **Voice pacer** with run-type-aware coaching
- 📊 **Real-time stats** — pace, distance, time, avg pace
- 🔄 **GPS smoothing** — filters jitter so voice cues are calm, not jittery
- 📈 **Km splits** with color-coded pace vs target
- 📤 **GPX export** — import your run into Strava, Garmin Connect, etc.
- 📱 **PWA** — installs on your phone like a native app
- 🔒 **Screen lock** — prevents accidental taps mid-run
- 🔋 **Wake lock** — keeps screen alive during runs
- 🌑 **Dark theme** — designed for outdoor visibility

---

## Quick Start

### Option A: Run locally (for testing)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/paceup.git
cd paceup

# Serve with any static server — GPS requires HTTPS or localhost
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000` on your phone (same WiFi network).

### Option B: Deploy free (for real use on your phone)

#### GitHub Pages (recommended)

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/paceup.git
   git push -u origin main
   ```

2. Go to **Settings → Pages → Source → main branch** → Save

3. Your app is live at `https://YOUR_USERNAME.github.io/paceup/`

4. Open that URL on your phone → tap **"Add to Home Screen"**

> **Important:** GPS requires HTTPS. GitHub Pages provides this automatically.

#### Vercel (alternative)

```bash
npm i -g vercel
vercel --prod
```

#### Netlify (alternative)

Drag and drop the `paceup/` folder at [app.netlify.com/drop](https://app.netlify.com/drop).

---

## Install as App on Phone

Once deployed to HTTPS:

### iPhone
1. Open the URL in Safari
2. Tap the **Share** button (bottom center)
3. Tap **"Add to Home Screen"**
4. Tap **"Add"**

### Android
1. Open the URL in Chrome
2. You'll see **"Add PaceUp to Home screen"** banner
3. Or tap **⋮ menu → "Install app"**

The app now opens fullscreen like a native app.

---

## Project Structure

```
paceup/
├── index.html          # Main HTML — all screens
├── manifest.json       # PWA manifest (name, icons, theme)
├── sw.js               # Service worker (offline caching)
├── css/
│   └── style.css       # Complete stylesheet
├── js/
│   ├── gps.js          # GPS tracking, haversine, pace smoothing, GPX export
│   ├── voice.js        # Speech synthesis, queue, message generators
│   ├── pacer.js        # Run-type pacing logic, status indicators
│   ├── map.js          # Leaflet map init, route drawing, markers
│   ├── ui.js           # Screen management, form builders, DOM helpers
│   └── app.js          # Main controller — state, lifecycle, events
├── icons/
│   ├── icon-192.png    # PWA icon
│   └── icon-512.png    # PWA icon (high-res)
├── .gitignore
└── README.md
```

### Module responsibilities

| Module | Purpose |
|--------|---------|
| `gps.js` | Haversine distance, GPS processing with outlier filtering, pace smoothing (rolling average with 2σ rejection), format helpers, GPX generation |
| `voice.js` | Web Speech Synthesis API wrapper with queue (prevents overlap), preferred voice selection, all run-type-specific message templates |
| `pacer.js` | Pure logic: given run type + config + current pace → status (on pace / too fast / too slow), dot color, indicator text |
| `map.js` | Leaflet map lifecycle: create, add points, draw route polyline, runner marker, summary map with start/end markers |
| `ui.js` | Screen switching, setup form HTML generation per run type, config parsing, DOM updates, summary builder |
| `app.js` | App controller: wires events, manages state, run lifecycle (start → countdown → GPS watch → pause/stop → summary), interval rep tracking |

---

## How the GPS Smoothing Works

Raw GPS is noisy — pace jumps around, especially in cities. PaceUp uses:

1. **Accuracy filter** — rejects readings with >25m accuracy
2. **Speed filter** — rejects impossible jumps (>12 m/s ≈ 43 km/h)
3. **Distance filter** — ignores <1m movements (stationary noise)
4. **Rolling average** — smooths speed over the last 8 readings
5. **Outlier rejection** — removes readings >2 standard deviations from the window mean

This means voice cues respond to your *actual* pace trend, not GPS wobble.

---

## Customization

### Add a new run type

1. Add a card in `index.html` (home screen)
2. Add setup form builder in `ui.js` → `buildSetupForm()`
3. Add pacing logic in `pacer.js` → `getPaceStatus()`
4. Add voice messages in `voice.js` → `startMessage()` and `paceCue()`
5. Handle in `app.js` state machine

### Change voice frequency / style

Edit `voice.js`:
- `utter.rate` — speech speed (0.5–2.0)
- `utter.pitch` — voice pitch (0.5–2.0)
- Preferred voice selection in `loadVoice()`

### Add language support

The Web Speech API supports many languages. Modify `voice.js` to select voices by locale (e.g., `hi-IN` for Hindi, `ta-IN` for Tamil).

---

## Tech Stack

- **HTML5 + CSS3 + Vanilla JS** — no frameworks, no build step
- **Leaflet.js** — maps (OpenStreetMap tiles)
- **Web Geolocation API** — GPS tracking
- **Web Speech Synthesis API** — voice coaching
- **Screen Wake Lock API** — keeps screen on
- **Service Worker** — offline PWA support

---

## Requirements

- A phone with GPS (any modern smartphone)
- A browser that supports Geolocation + Speech Synthesis (Chrome, Safari, Firefox)
- HTTPS for GPS access (localhost works for testing)
- Headphones recommended for voice pacer

---

## License

MIT — use it, modify it, ship it.
