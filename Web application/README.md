### P4P Web Application

Vite + React app used to present video stimuli, collect SAM ratings, optionally overlay webcam, and integrate with local passive/visual emotion services. This directory excludes `node_modules/` to keep the compendium small.

### Prerequisites

- Node.js 18+ (LTS recommended)
- Modern browser (Chrome/Edge) with webcam permission if using the overlay

### Install and run

```bash
# from this folder (Web application)
npm ci
npm run dev
# Dev server default: http://localhost:5173
```

Build and preview:

```bash
npm run build
npm run preview
```

Lint:

```bash
npm run lint
```

### Project structure

- Root: `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `index.html`, `README.md`, `public/`
- Source (`src/`):
  - Core: `main.jsx`, `App.jsx`, `App.css`, `index.css`
  - Views: `Landing.jsx`, `Home.jsx`, `Player.jsx`, `Ending.jsx`, `Admin.jsx`
  - Context: `context/StudyContext.jsx`
  - Components: `components/MP4Player.jsx`, `components/YouTubePlayer.jsx`, `components/WebcamOverlay.jsx`, `components/PassiveSensor.jsx`, `components/FusionSensor.jsx`
  - SAM UI: `SAMScale/SAMPopup.jsx`, `SAMScale/SAMPopup.css`
  - Utilities: `utils/capture.js`, `utils/exportCsv.js`, `utils/localStorage.js`
  - Media: `videos/HVHA2.mp4`, `videos/HVLA1.mp4`, `videos.json`
  - Assets: `assets/SAMValence.png`, `assets/SAMArousal.png`, `assets/react.svg`
  - Public: `public/` (static assets)

### Configuration

- Videos and playlist: edit `src/videos/videos.json` to change the video list, labels, or metadata.
- Study timing/flow: see `src/Player.jsx` and related components under `src/components/`.
- Data export: `src/utils/exportCsv.js` is invoked from study screens to save CSV locally.
- Local emotion APIs (optional): if running the passive/visual API servers locally, set endpoint URLs in `src/components/PassiveSensor.jsx` and `src/components/FusionSensor.jsx` as needed. Ensure CORS allows `http://localhost:5173`.

### Typical study flow

1. `Landing` for participant setup/consent.
2. `Player` presents `videos.json` entries with optional overlays (`WebcamOverlay`, `PassiveSensor`, `FusionSensor`).
3. `SAMScale/SAMPopup` prompts for valence and arousal after stimuli.
4. `Ending`/`Admin` allows exporting CSV via `exportCsv.js`.

### Troubleshooting

- Dev server fails to start: use Node 18+, run `npm ci` again, or delete `node_modules` and lockfile before reinstalling.
- Videos do not play: verify files exist under `src/videos/` and paths in `videos.json` match.
- Webcam overlay not visible: allow browser camera permission and use a supported browser.
- API integration errors: check the endpoint URLs and that the local API is running.

### License and attribution

Built with Vite + React. This web application is part of the P4P project compendium.
