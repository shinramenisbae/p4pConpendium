import cv2
import numpy as np
import pandas as pd
import json
import os
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
import torch
from scipy.signal import resample
import ast
import re

from active.emotion_detector import EmotionDetector
from passive.model.network.CNN import EmotionCNN
from late_fusion_module import LateFusionModule, FusionStrategy


def convert_numpy_types(obj: Any) -> Any:
    """
    Recursively convert numpy types to Python native types for JSON serialization

    Args:
        obj: Any object that may contain numpy types

    Returns:
        Object with numpy types converted to Python native types
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(item) for item in obj)
    else:
        return obj


class IntegratedDemoPipeline:
    """
    Integrated Demo Pipeline for showcasing the complete emotion recognition system

    This pipeline:
    1. Processes passive sensor data (CSV) for biosignal emotion prediction
    2. Processes active sensor data (video) for facial expression emotion prediction
    3. Fuses both predictions using the late fusion module
    4. Saves all outputs as JSON files
    5. Provides real-time progress indicators
    """

    def __init__(
        self,
        csv_file_path: str,
        video_file_path: str,
        output_dir: str = "demo_outputs",
        biosignal_weight: float = 0.4,
        visual_weight: float = 0.6,
    ):
        """
        Initialize the demo pipeline

        Args:
            csv_file_path: Path to the CSV file with biosignal data
            video_file_path: Path to the video file for visual analysis
            output_dir: Directory to save all outputs
            biosignal_weight: Weight for biosignal predictions in fusion (0.4)
            visual_weight: Weight for visual predictions in fusion (0.6)
        """
        self.csv_file_path = csv_file_path
        self.video_file_path = video_file_path
        self.output_dir = output_dir
        self.biosignal_weight = biosignal_weight
        self.visual_weight = visual_weight

        os.makedirs(output_dir, exist_ok=True)
        self._initialize_components()
        self.biosignal_predictions = []
        self.visual_predictions = []
        self.fused_predictions = []

        print("🎯 Integrated Demo Pipeline initialized successfully!")
        print(f"📁 Output directory: {output_dir}")
        print(
            f"⚖️  Fusion weights: Biosignal={biosignal_weight}, Visual={visual_weight}"
        )

    def _initialize_components(self):
        """Initialize all the required components"""
        print("🔧 Initializing pipeline components...")

        print("  📊 Loading biosignal CNN model...")
        try:
            self.biosignal_model = EmotionCNN()
            model_path = "passive/model/network/emotion_cnn.pth"
            self.biosignal_model.load_state_dict(
                torch.load(model_path, map_location="cpu")
            )
            self.biosignal_model.eval()
            print("  ✅ Biosignal model loaded successfully")
        except Exception as e:
            print(f"  ❌ Failed to load biosignal model: {e}")
            self.biosignal_model = None

        print("  🎭 Loading visual emotion detector...")
        try:
            self.visual_detector = EmotionDetector(enable_valence_arousal=True)
            print("  ✅ Visual detector initialized successfully")
        except Exception as e:
            print(f"  ❌ Failed to initialize visual detector: {e}")
            self.visual_detector = None

        print("  🔀 Initializing late fusion module...")
        try:
            self.fusion_module = LateFusionModule(
                fusion_strategy=FusionStrategy.WEIGHTED_AVERAGE,
                weights={
                    "biosignal": self.biosignal_weight,
                    "visual": self.visual_weight,
                },
            )
            print("  ✅ Fusion module initialized successfully")
        except Exception as e:
            print(f"  ❌ Failed to initialize fusion module: {e}")
            self.fusion_module = None

        print("  🎉 All components initialized!")

    def process_biosignal_data(self) -> List[Dict]:
        """
        Process the CSV file and generate biosignal predictions

        Returns:
            List of biosignal prediction dictionaries
        """
        print(f"\n📊 Processing biosignal data from: {self.csv_file_path}")

        if self.biosignal_model is None:
            print("❌ Biosignal model not available, skipping biosignal processing")
            return []

        try:
            df = pd.read_csv(self.csv_file_path)
            print(f"  📋 Loaded CSV with {len(df)} rows")

            ppg_data = []
            for idx, row in df.iterrows():
                try:
                    ppg_str = row["ppg_gr"]
                    if isinstance(ppg_str, str):
                        ppg_str = ppg_str.strip("[]")
                        ppg_values = [int(x.strip()) for x in ppg_str.split(",")]
                        ppg_data.extend(ppg_values)
                    else:
                        print(f"  ⚠️  Row {idx}: Invalid PPG data format")
                except Exception as e:
                    print(f"  ⚠️  Row {idx}: Error parsing PPG data: {e}")
                    continue

            print(f"  📈 Extracted {len(ppg_data)} PPG data points")

            if len(ppg_data) == 0:
                print("❌ No valid PPG data found")
                return []

            ppg_array = np.array(ppg_data)
            ppg_64hz = self._upsample_to_64hz(ppg_array)
            ppg_min = np.min(ppg_64hz)
            ppg_max = np.max(ppg_64hz)
            ppg_normalized = (ppg_64hz - ppg_min) / (ppg_max - ppg_min) * 1000
            segments = self._extract_pulses(ppg_normalized, pulse_len=140)

            print(f"  🔄 Created {len(segments)} signal segments")

            predictions = []
            for i, segment in enumerate(segments):
                print(f"  🧠 Processing segment {i+1}/{len(segments)}...")

                segment_tensor = torch.tensor(
                    segment.reshape(1, -1), dtype=torch.float32
                )

                with torch.no_grad():
                    valence_logits, arousal_logits = self.biosignal_model(
                        segment_tensor
                    )

                    valence_pred = torch.argmax(valence_logits, dim=1).item()
                    arousal_pred = torch.argmax(arousal_logits, dim=1).item()

                    valence_probs = torch.softmax(valence_logits, dim=1)
                    arousal_probs = torch.softmax(arousal_logits, dim=1)
                    valence_conf = torch.max(valence_probs, dim=1)[0].item()
                    arousal_conf = torch.max(arousal_probs, dim=1)[0].item()
                    overall_conf = (valence_conf + arousal_conf) / 2.0

                prediction = {
                    "segment_id": i + 1,
                    "valence": valence_pred,
                    "arousal": arousal_pred,
                    "confidence": overall_conf,
                    "valence_confidence": valence_conf,
                    "arousal_confidence": arousal_conf,
                    "timestamp": time.time(),
                    "ppg_segment": segment.tolist(),
                }

                predictions.append(prediction)
                print(
                    f"    ✅ Segment {i+1}: V={valence_pred}, A={arousal_pred}, Conf={overall_conf:.3f}"
                )

            predictions_serializable = convert_numpy_types(predictions)

            biosignal_output_path = os.path.join(
                self.output_dir, "biosignal_predictions.json"
            )
            with open(biosignal_output_path, "w") as f:
                json.dump(predictions_serializable, f, indent=2)

            print(f"  💾 Saved biosignal predictions to: {biosignal_output_path}")
            self.biosignal_predictions = predictions

            return predictions

        except Exception as e:
            print(f"❌ Error processing biosignal data: {e}")
            import traceback

            traceback.print_exc()
            return []

    def process_video_data(self) -> List[Dict]:
        """
        Process the video file and generate visual emotion predictions

        Returns:
            List of visual prediction dictionaries
        """
        print(f"\n🎬 Processing video data from: {self.video_file_path}")

        if self.visual_detector is None:
            print("❌ Visual detector not available, skipping video processing")
            return []

        try:
            cap = cv2.VideoCapture(self.video_file_path)
            if not cap.isOpened():
                print(f"❌ Could not open video file: {self.video_file_path}")
                return []

            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0

            print(
                f"  📹 Video info: {total_frames} frames, {fps:.2f} FPS, {duration:.2f}s duration"
            )

            frame_interval = int(fps * 2)
            predictions = []
            frame_count = 0

            print("  🎭 Starting frame-by-frame emotion detection...")

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_count += 1

                if frame_count % frame_interval == 0:
                    current_time = frame_count / fps
                    print(
                        f"  🖼️  Processing frame {frame_count}/{total_frames} at {current_time:.1f}s..."
                    )

                    processed_frame, results = self.visual_detector.detect_emotions(
                        frame.copy()
                    )

                    if results:
                        for face_idx, result in enumerate(results):
                            valence_arousal = (
                                self.visual_detector.map_emotion_to_valence_arousal(
                                    result["emotion"], result["confidence"]
                                )
                            )

                            prediction = {
                                "frame_id": frame_count,
                                "timestamp": current_time,
                                "face_id": face_idx,
                                "emotion": result["emotion"],
                                "confidence": result["confidence"],
                                "valence": (
                                    valence_arousal["valence"]
                                    if valence_arousal
                                    else 0.0
                                ),
                                "arousal": (
                                    valence_arousal["arousal"]
                                    if valence_arousal
                                    else 0.0
                                ),
                                "position": result["position"],
                                "processing_time": time.time(),
                            }

                            predictions.append(prediction)
                            print(
                                f"    ✅ Face {face_idx+1}: {result['emotion']} (Conf: {result['confidence']:.3f})"
                            )
                    else:
                        print(f"    ⚠️  No faces detected in frame {frame_count}")

                if frame_count % (frame_interval * 5) == 0:
                    progress = (frame_count / total_frames) * 100
                    print(
                        f"  📊 Progress: {progress:.1f}% ({frame_count}/{total_frames} frames)"
                    )

            cap.release()

            print(
                f"  🎯 Completed video processing: {len(predictions)} emotion predictions"
            )

            predictions_serializable = convert_numpy_types(predictions)

            visual_output_path = os.path.join(
                self.output_dir, "visual_predictions.json"
            )
            with open(visual_output_path, "w") as f:
                json.dump(predictions_serializable, f, indent=2)

            print(f"  💾 Saved visual predictions to: {visual_output_path}")
            self.visual_predictions = predictions

            return predictions

        except Exception as e:
            print(f"❌ Error processing video data: {e}")
            import traceback

            traceback.print_exc()
            return []

    def perform_fusion(self) -> List[Dict]:
        """
        Perform late fusion of biosignal and visual predictions

        Returns:
            List of fused prediction dictionaries
        """
        print(f"\n🔀 Performing late fusion of predictions...")

        if self.fusion_module is None:
            print("❌ Fusion module not available, skipping fusion")
            return []

        if not self.biosignal_predictions and not self.visual_predictions:
            print("❌ No predictions available for fusion")
            return []

        try:
            fused_predictions = []

            print(f"  📊 Biosignal predictions: {len(self.biosignal_predictions)}")
            print(f"  🎭 Visual predictions: {len(self.visual_predictions)}")

            for bio_idx, bio_pred in enumerate(self.biosignal_predictions):
                print(f"  🔄 Fusing biosignal segment {bio_idx + 1}...")

                best_visual_match = None
                best_time_diff = float("inf")

                for vis_pred in self.visual_predictions:
                    bio_time = bio_idx * 2.2
                    vis_time = vis_pred["timestamp"]
                    time_diff = abs(bio_time - vis_time)

                    if time_diff < best_time_diff:
                        best_time_diff = time_diff
                        best_visual_match = vis_pred

                if best_visual_match:
                    print(
                        f"    🎯 Matched with visual frame at {best_visual_match['timestamp']:.1f}s (diff: {best_time_diff:.1f}s)"
                    )

                    from late_fusion_module import BiosignalPrediction, VisualPrediction

                    bio_pred_obj = BiosignalPrediction(
                        valence=bio_pred["valence"],
                        arousal=bio_pred["arousal"],
                        confidence=bio_pred["confidence"],
                        timestamp=bio_pred["timestamp"],
                    )

                    vis_pred_obj = VisualPrediction(
                        emotion=best_visual_match["emotion"],
                        valence=best_visual_match["valence"],
                        arousal=best_visual_match["arousal"],
                        confidence=best_visual_match["confidence"],
                        faces_detected=1,
                        timestamp=best_visual_match["timestamp"],
                    )

                    fused_pred = self.fusion_module.fuse_predictions(
                        bio_pred_obj, vis_pred_obj
                    )

                    fused_dict = {
                        "fusion_id": bio_idx + 1,
                        "biosignal_segment": bio_idx + 1,
                        "visual_frame": best_visual_match["frame_id"],
                        "timestamp": bio_pred["timestamp"],
                        "valence": fused_pred.valence,
                        "arousal": fused_pred.arousal,
                        "discrete_emotion": fused_pred.discrete_emotion,
                        "fusion_confidence": fused_pred.fusion_confidence,
                        "fusion_strategy": fused_pred.fusion_strategy,
                        "biosignal_contribution": fused_pred.biosignal_contribution,
                        "visual_contribution": fused_pred.visual_contribution,
                        "metadata": fused_pred.metadata,
                    }

                    fused_predictions.append(fused_dict)
                    print(
                        f"    ✅ Fused: {fused_pred.discrete_emotion} (V: {fused_pred.valence:.3f}, A: {fused_pred.arousal:.3f})"
                    )
                else:
                    print(
                        f"    ⚠️  No visual match found for biosignal segment {bio_idx + 1}"
                    )

            print(f"  🎯 Completed fusion: {len(fused_predictions)} fused predictions")

            fused_predictions_serializable = convert_numpy_types(fused_predictions)

            fused_output_path = os.path.join(self.output_dir, "fused_predictions.json")
            with open(fused_output_path, "w") as f:
                json.dump(fused_predictions_serializable, f, indent=2)

            print(f"  💾 Saved fused predictions to: {fused_output_path}")
            self.fused_predictions = fused_predictions

            return fused_predictions

        except Exception as e:
            print(f"❌ Error during fusion: {e}")
            import traceback

            traceback.print_exc()
            return []

    def run_demo(self):
        """Run the complete demo pipeline"""
        print("\n" + "=" * 60)
        print("🚀 STARTING INTEGRATED DEMO PIPELINE")
        print("=" * 60)

        start_time = time.time()

        print("\n📊 STEP 1: Processing Biosignal Data")
        print("-" * 40)
        self.process_biosignal_data()

        print("\n🎬 STEP 2: Processing Video Data")
        print("-" * 40)
        self.process_video_data()

        print("\n🔀 STEP 3: Performing Late Fusion")
        print("-" * 40)
        self.perform_fusion()

        print("\n📋 STEP 4: Generating Summary Report")
        print("-" * 40)
        self._generate_summary_report()

        total_time = time.time() - start_time
        print(f"\n🎉 DEMO PIPELINE COMPLETED IN {total_time:.2f} SECONDS!")
        print(f"📁 All outputs saved to: {self.output_dir}")

        return {
            "biosignal_predictions": len(self.biosignal_predictions),
            "visual_predictions": len(self.visual_predictions),
            "fused_predictions": len(self.fused_predictions),
            "total_time": total_time,
        }

    def _generate_summary_report(self):
        """Generate a summary report of all predictions"""
        try:
            summary = {
                "demo_info": {
                    "timestamp": datetime.now().isoformat(),
                    "csv_file": self.csv_file_path,
                    "video_file": self.video_file_path,
                    "fusion_weights": {
                        "biosignal": self.biosignal_weight,
                        "visual": self.visual_weight,
                    },
                },
                "prediction_counts": {
                    "biosignal": len(self.biosignal_predictions),
                    "visual": len(self.visual_predictions),
                    "fused": len(self.fused_predictions),
                },
                "biosignal_summary": self._analyze_biosignal_predictions(),
                "visual_summary": self._analyze_visual_predictions(),
                "fusion_summary": self._analyze_fusion_predictions(),
            }

            summary_serializable = convert_numpy_types(summary)

            summary_path = os.path.join(self.output_dir, "demo_summary.json")
            with open(summary_path, "w") as f:
                json.dump(summary_serializable, f, indent=2)

            print(f"  💾 Summary report saved to: {summary_path}")

            print("\n📊 DEMO SUMMARY:")
            print(f"  📈 Biosignal predictions: {len(self.biosignal_predictions)}")
            print(f"  🎭 Visual predictions: {len(self.visual_predictions)}")
            print(f"  🔀 Fused predictions: {len(self.fused_predictions)}")

        except Exception as e:
            print(f"❌ Error generating summary report: {e}")

    def _analyze_biosignal_predictions(self) -> Dict:
        """Analyze biosignal predictions"""
        if not self.biosignal_predictions:
            return {}

        valence_counts = {}
        arousal_counts = {}
        confidences = []

        for pred in self.biosignal_predictions:
            valence_counts[pred["valence"]] = valence_counts.get(pred["valence"], 0) + 1
            arousal_counts[pred["arousal"]] = arousal_counts.get(pred["arousal"], 0) + 1
            confidences.append(pred["confidence"])

        return {
            "valence_distribution": valence_counts,
            "arousal_distribution": arousal_counts,
            "average_confidence": np.mean(confidences) if confidences else 0.0,
        }

    def _analyze_visual_predictions(self) -> Dict:
        """Analyze visual predictions"""
        if not self.visual_predictions:
            return {}

        emotion_counts = {}
        confidences = []

        for pred in self.visual_predictions:
            emotion_counts[pred["emotion"]] = emotion_counts.get(pred["emotion"], 0) + 1
            confidences.append(pred["confidence"])

        return {
            "emotion_distribution": emotion_counts,
            "average_confidence": np.mean(confidences) if confidences else 0.0,
        }

    def _analyze_fusion_predictions(self) -> Dict:
        """Analyze fused predictions"""
        if not self.fused_predictions:
            return {}

        emotion_counts = {}
        confidences = []

        for pred in self.fused_predictions:
            emotion_counts[pred["discrete_emotion"]] = (
                emotion_counts.get(pred["discrete_emotion"], 0) + 1
            )
            confidences.append(pred["fusion_confidence"])

        return {
            "emotion_distribution": emotion_counts,
            "average_confidence": np.mean(confidences) if confidences else 0.0,
        }

    def _upsample_to_64hz(self, x_25hz, original_rate=25, target_rate=64):
        """Upsample signal from 25Hz to 64Hz"""
        original_len = len(x_25hz)
        duration_sec = original_len / original_rate
        target_len = int(duration_sec * target_rate)
        x_64hz = resample(x_25hz, target_len)
        return x_64hz

    def _extract_pulses(self, signal, pulse_len=140):
        """Extract pulse segments from signal"""
        segments = []
        for start in range(0, len(signal) - pulse_len + 1, pulse_len):
            segments.append(signal[start : start + pulse_len])
        return segments


def main():
    """Main function to run the demo pipeline"""
    csv_file = "passive/model/network/input-folder/tester.csv"
    video_file = "visual_data_test.mp4"

    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return

    if not os.path.exists(video_file):
        print(f"❌ Video file not found: {video_file}")
        return

    print("🎯 P4P Integrated Emotion Recognition Demo Pipeline")
    print("=" * 60)
    print(f"📊 Biosignal data: {csv_file}")
    print(f"🎬 Video data: {video_file}")
    print(f"⚖️  Fusion weights: Biosignal=40%, Visual=60%")
    print("=" * 60)

    pipeline = IntegratedDemoPipeline(
        csv_file_path=csv_file,
        video_file_path=video_file,
        biosignal_weight=0.4,
        visual_weight=0.6,
    )

    results = pipeline.run_demo()

    print("\n" + "=" * 60)
    print("🎉 DEMO COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print(f"📊 Biosignal predictions: {results['biosignal_predictions']}")
    print(f"🎭 Visual predictions: {results['visual_predictions']}")
    print(f"🔀 Fused predictions: {results['fused_predictions']}")
    print(f"⏱️  Total processing time: {results['total_time']:.2f} seconds")
    print(f"📁 Check the 'demo_outputs' folder for all results!")


if __name__ == "__main__":
    main()
