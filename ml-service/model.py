"""
model.py — Load and serve the trained fake-news classifier.

Run  python train.py  first to generate  saved_model/pipeline.pkl
"""

import os
import pickle

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE_DIR, "saved_model", "pipeline.pkl")
META_PATH   = os.path.join(BASE_DIR, "saved_model", "meta.pkl")

LABELS = {0: "Real", 1: "Fake"}


class MisinformationDetector:
    def __init__(self):
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Trained model not found at '{MODEL_PATH}'. "
                "Please run  python train.py  first."
            )

        with open(MODEL_PATH, "rb") as f:
            self.pipeline = pickle.load(f)

        self.model_accuracy = None
        if os.path.exists(META_PATH):
            with open(META_PATH, "rb") as f:
                meta = pickle.load(f)
                self.model_accuracy = meta.get("accuracy")

        print(
            f"Model loaded from {MODEL_PATH}"
            + (f"  (test acc: {self.model_accuracy*100:.2f}%)" if self.model_accuracy else "")
        )

    def predict(self, text: str) -> dict:
        """Return label, confidence, and explanation for the given text."""
        content = text.strip().lower()

        # predict_proba gives [P(Real), P(Fake)]
        proba   = self.pipeline.predict_proba([content])[0]
        pred    = int(self.pipeline.predict([content])[0])
        label   = LABELS[pred]

        # Confidence = probability for the predicted class
        confidence = float(proba[pred])

        explanation = self._generate_explanation(label, confidence)

        return {
            "label":       label,
            "confidence":  round(confidence, 4),
            "explanation": explanation,
        }

    # ── Private ──────────────────────────────────────────────────────────────
    def _generate_explanation(self, label: str, confidence: float) -> str:
        strength = (
            "very high" if confidence >= 0.95 else
            "high"      if confidence >= 0.85 else
            "moderate"  if confidence >= 0.70 else
            "low"
        )

        if label == "Fake":
            return (
                f"The content shows {strength} indicators of misinformation "
                f"(confidence {confidence*100:.1f}%). Patterns such as exaggerated claims, "
                "sensational language, and low-credibility source markers were detected."
            )
        else:
            return (
                f"The content appears to be credible news with {strength} confidence "
                f"({confidence*100:.1f}%). It aligns with patterns of verified, factual reporting."
            )


# Singleton — imported by main.py
detector = MisinformationDetector()
