import os
import re
import ast
import numpy as np
import torch
import pandas as pd
from scipy.signal import resample
from CNN import EmotionCNN

# --- Config ---
INPUT_FOLDER = "./input-folder"
MODEL_PATH = "./model/network/emotion_cnn.pth"  # adjust if needed
SEGMENT_LEN = 140  # samples per segment
ORIGINAL_HZ = 25
TARGET_HZ = 64

# --- Load model ---
model = EmotionCNN()
model.load_state_dict(torch.load("emotion_cnn.pth"))
model.eval()

# --- Find first CSV in folder ---
csv_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".csv")]
if not csv_files:
    raise FileNotFoundError(f"No CSV files found in {INPUT_FOLDER}")
INPUT_CSV = os.path.join(INPUT_FOLDER, csv_files[0])
print(f"Using input CSV: {INPUT_CSV}")

# --- Load CSV ---
df = pd.read_csv(INPUT_CSV)

# Ensure column exists
if 'ppg_gr' not in df.columns or 'timestamp' not in df.columns:
    raise ValueError("CSV must contain 'timestamp' and 'ppg_gr' columns")

model_input = []
timestamps = []

for _, row in df.iterrows():
    raw = row['ppg_gr']
    timestamp = row['timestamp']
    # parse string lists if needed
    if isinstance(raw, str):
        try:
            raw = ast.literal_eval(raw)
        except:
            continue
    # skip invalid data
    if not raw or raw == [-1]:
        continue
    model_input.extend(raw)
    timestamps.append(timestamp)

# --- Upsample ---
def upsample(signal, orig_hz=ORIGINAL_HZ, target_hz=TARGET_HZ):
    duration_sec = len(signal) / orig_hz
    target_len = int(duration_sec * target_hz)
    return resample(signal, target_len)

x_64hz = upsample(np.array(model_input))

# --- Normalize ---
x_norm = (x_64hz - np.min(x_64hz)) / (np.max(x_64hz) - np.min(x_64hz)) * 1000

# --- Segment ---
segments = []
segment_times = []
for i in range(0, len(x_norm) - SEGMENT_LEN + 1, SEGMENT_LEN):
    segments.append(x_norm[i:i+SEGMENT_LEN])
    # interpolate timestamp for segment start
    # convert first timestamp to np.datetime64
    start_time = pd.to_datetime(timestamps[0]) + pd.to_timedelta(i / TARGET_HZ, unit='s')
    # ISO 8601 with milliseconds
    iso_time = start_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
    segment_times.append(iso_time)

segments_array = np.array(segments)
X_tensor = torch.tensor(segments_array, dtype=torch.float32)

# --- Predict ---
with torch.no_grad():
    valence_logits, arousal_logits = model(X_tensor)
    valence_preds = torch.argmax(valence_logits, dim=1)
    arousal_preds = torch.argmax(arousal_logits, dim=1)

# --- Save predictions ---
output_file = os.path.join(INPUT_FOLDER, "predictions.csv")
with open(output_file, 'w', newline='') as f:
    writer = pd.DataFrame({
        'timestamp': segment_times,
        'valence_prediction': valence_preds.numpy(),
        'arousal_prediction': arousal_preds.numpy()
    })
    writer.to_csv(f, index=False)

print(f"Saved predictions to {output_file}")
