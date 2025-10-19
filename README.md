### p4pConpendium

Research compendium for the P4P project. This repository contains the materials required to understand, reproduce, and extend the project: models, pre‑pilot study data, and the study web application.

### Folder structure

- `Emotion Recognition Models/`

  - Visual (active) emotion detector, passive biosignal CNN, and rule‑based late fusion.
  - Includes demo scripts, pretrained weights, and a FastAPI server exposing prediction and fusion endpoints.
  - How to run/test: see `Emotion Recognition Models/README.md`.

- `Pre-pilot study data/`

  - Collected data, summaries, and instructions for the pre‑pilot stage.
  - How to use: see the document inside this folder (README - Pre-pilot study data.docx).

- `Web application/`
  - Vite + React study app for stimulus presentation, SAM ratings, webcam overlays, and optional API integration with the models.
  - How to run/build: see `Web application/README.md`.

### Quick start pointers

- Run model API locally:

  - `cd Emotion Recognition Models`
  - Create venv and `pip install -r "active model/requirements.txt"`
  - Start server: `python "active model/api_server.py"` (default `http://127.0.0.1:8001`)

- Run webcam classifier standalone:

  - `cd Emotion Recognition Models`
  - `python "active model/emotion_detector.py"`

- Run web app:
  - `cd Web application`
  - `npm ci && npm run dev` (default `http://localhost:5173`)

### Notes

- Large raw datasets are not included; included samples and weights are sufficient for demos.
- Excluded development artifacts: local `node_modules/` and Python virtual environments.
