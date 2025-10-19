### Emotion Recognition Models

Visual (active) model, passive biosignal CNN, and rule-based late fusion used in the project. This folder includes demo scripts, pretrained weights, and a FastAPI server that exposes prediction and fusion endpoints for local development.

### Structure

- `active/`
  - `emotion_detector.py`: Frame-level visual emotion inference
  - `api_server.py`: FastAPI server exposing visual, passive, and fusion endpoints
  - `test_fer_plus.py`: Simple sanity test for the visual detector
  - `requirements.txt`: Python dependencies for active server/detector
- `passive/model/network/`
  - Core CNN code: `CNN.py`, `DataLoader.py`, `Run.py`, `Train.py`, helpers
  - Weights: `emotion_cnn*.pth`
  - Samples: `input-folder/tester.csv` and others
- `late_fusion_module.py`: Rule-based late-fusion utilities used by the app
- `demo_pipeline.py`: Integrated demo that runs passive CSV + visual video + fusion and saves JSON outputs under `demo_outputs/`

### Prerequisites

- Python 3.11+ (3.12 recommended)
- Windows 10+ tested; CPU is sufficient for demos
- Create and activate a virtual environment

### Install dependencies

```bash
# From this folder (Emotion Recognition Models)
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: . .venv/Scripts/Activate.ps1
pip install --upgrade pip

# Active model + API server
pip install -r active/requirements.txt
```

If you plan to run training scripts under `passive/model/network/`, install any additional requirements those scripts prompt for.

### Run visual (active) model locally (sanity test)

```bash
python active/test_fer_plus.py
```

This runs a quick check of the visual detector on a sample frame/video path if configured in the script.

### Run emotion_detector.py as a standalone webcam app

Runs the visual emotion classifier with a live webcam feed, drawing labels and saving classified frames locally.

```bash
python active/emotion_detector.py
```

Behavior and controls:

- On start, available cameras are listed; if multiple are detected you can select an index.
- Window controls: press `q` to quit, `c` to cycle to the next camera.
- Annotated frames are saved to the `webcam_captures/` directory.
- Uses the `dima806/facial_emotions_image_detection` model via Hugging Face Transformers; downloads will occur on first run if not cached.

Notes:

- Ensure dependencies are installed via `pip install -r active/requirements.txt`.
- GPU will be used if `torch.cuda.is_available()`; otherwise CPU is used.

### Run passive CNN locally on sample CSV

```bash
python passive/model/network/Run.py --input passive/model/network/input-folder/tester.csv --weights passive/model/network/emotion_cnn.pth
```

This will print valence and arousal class predictions for the provided biosignal window.

### Start local API server (FastAPI)

The server exposes endpoints for visual detection, passive prediction (12s window), and late fusion. CORS is enabled for `http://localhost:5173` by default.

```bash
python active/api_server.py
# Server: http://127.0.0.1:8001 (hosted via Uvicorn)
```

Endpoints:

- `POST /predict`

  - Accepts either multipart `image_file` or form/JSON `image_base64`.
  - Optional form fields: `pid`, `video_id`, `video_time_sec`. Saves annotated frame under `active/output/<pid>/<video_id>-<sec>.jpg`.
  - Returns detected faces with confidences and the most confident face as `primary`.

- `GET /passive/predict`

  - Pulls a 12-second PPG window from a research API if configured, otherwise simulates.
  - Returns `valence`, `arousal` in [-1, 1], their class labels, and the time window used.
  - Environment variables (optional) to enable real data:
    - `PASSIVE_BASE_URL` (default `http://130.216.217.53:8000`)
    - `PASSIVE_EMAIL`, `PASSIVE_PASSWORD`, `PASSIVE_USER_ID`
    - `PASSIVE_SIMULATE_FROM` (ISO datetime) to force simulated flag and deterministic windows
    - `PASSIVE_DEBUG=1` to log debug messages

- `POST /fusion/predict`

  - Request body:
    - `visual`: `{ valence: number, arousal: number, confidence: number }` (optional)
    - `passive`: `{ valence: number, arousal: number }` (optional)
  - Returns fused `valence`, `arousal`, a `discrete_emotion`, `fusion_confidence`, and `strategy`.
  - Behavior if a modality is missing: falls back to the available modality.

- `GET /health`
  - Returns `{ "status": "ok" }`.

### Hosting locally for the web app

- Start this API server first: `python active/api_server.py` (default `http://127.0.0.1:8001`).
- Ensure your web app points to these endpoints in components such as `PassiveSensor.jsx` and `FusionSensor.jsx`.
- CORS is configured to allow `http://localhost:5173` by default.

### Integrated demo pipeline

Run a complete demo over a sample biosignal CSV and video, saving outputs to `demo_outputs/`:

```bash
python demo_pipeline.py
```

Requirements:

- Ensure `passive/model/network/emotion_cnn.pth` exists
- Ensure `passive/model/network/input-folder/tester.csv` exists
- Ensure `visual_data_test.mp4` exists in this folder

Outputs:

- `demo_outputs/biosignal_predictions.json`
- `demo_outputs/visual_predictions.json`
- `demo_outputs/fused_predictions.json`
- `demo_outputs/demo_summary.json`

### Notes on models and data

- Pretrained weights are included under `passive/model/network/` (`emotion_cnn*.pth`).
- Large training datasets are not included; demos rely on packaged weights and sample CSVs/videos.
- If GPU is available, PyTorch will use it; otherwise CPU inference is used.

### Troubleshooting

- Import errors for passive CNN: ensure this folder is used as the working directory so relative imports resolve (`.../passive/model/network`).
- Missing weights: verify `emotion_cnn.pth` exists under `passive/model/network/`.
- Research API unavailable: set `PASSIVE_SIMULATE_FROM` or omit credentials to use simulated predictions.
