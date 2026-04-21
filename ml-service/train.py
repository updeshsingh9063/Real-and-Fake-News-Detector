"""
train.py -- Train a fake news classifier on FAKE.csv and TRUE.csv
Produces: saved_model/pipeline.pkl  and  saved_model/meta.pkl
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix
)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
FAKE_CSV   = os.path.join(BASE_DIR, "FAKE.csv")
TRUE_CSV   = os.path.join(BASE_DIR, "TRUE.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "saved_model")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── 1. Load data ───────────────────────────────────────────────────────────────
print("[1/6] Loading FAKE.csv ...")
fake_df = pd.read_csv(FAKE_CSV)
fake_df["label"] = 1          # 1 = Fake

print("[1/6] Loading TRUE.csv ...")
true_df = pd.read_csv(TRUE_CSV)
true_df["label"] = 0          # 0 = Real

df = pd.concat([fake_df, true_df], ignore_index=True)
print(f"      Total samples: {len(df)}  |  Fake: {len(fake_df)}  |  Real: {len(true_df)}")

# ── 2. Feature engineering ─────────────────────────────────────────────────────
print("[2/6] Building features ...")

import re
def clean_text(text):
    # Remove "Reuters" source tags: "WASHINGTON (Reuters) - "
    text = re.sub(r'^.*?\(reuters\) - ', '', text, flags=re.IGNORECASE)
    # Remove generic patterns like " (Reuters) "
    text = re.sub(r'\(reuters\)', '', text, flags=re.IGNORECASE)
    return text.strip()

print("      Cleaning text source tags ...")
df["text"] = df["text"].fillna("").str.lower().apply(clean_text)

df["content"] = df["title"].fillna("").str.lower() + " " + df["text"]
df["content"] = df["content"].str.strip()

X = df["content"]
y = df["label"]

# ── 3. Train / test split ──────────────────────────────────────────────────────
print("[3/6] Splitting train/test ...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"      Train: {len(X_train)}  |  Test: {len(X_test)}")

# ── 4. Build pipeline  ─────────────────────────────────────────────────────────
print("[4/6] Building TF-IDF + Logistic Regression pipeline ...")
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1, 2),       # unigrams + bigrams
        max_features=100_000,
        sublinear_tf=True,        # log-scaling of term frequency
        min_df=2,
        max_df=0.95,
    )),
    ("clf", LogisticRegression(
        max_iter=1000,
        C=5.0,
        solver="lbfgs",
        n_jobs=-1,
    )),
])

# ── 5. Train ───────────────────────────────────────────────────────────────────
print("[5/6] Training ...")
pipeline.fit(X_train, y_train)

# ── 6. Evaluate ────────────────────────────────────────────────────────────────
print("[6/6] Evaluating ...")
y_pred = pipeline.predict(X_test)

acc = accuracy_score(y_test, y_pred)
print(f"\n  Test Accuracy : {acc * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Real", "Fake"]))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# ── 7. Save model ──────────────────────────────────────────────────────────────
model_path = os.path.join(MODEL_DIR, "pipeline.pkl")
with open(model_path, "wb") as f:
    pickle.dump(pipeline, f)

meta_path = os.path.join(MODEL_DIR, "meta.pkl")
with open(meta_path, "wb") as f:
    pickle.dump({"accuracy": acc}, f)

print(f"\nModel saved to: {model_path}")
print("Training complete! Run 'python main.py' to start the API.")
