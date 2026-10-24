"""
Silent Voice engine: record lip data, train a phrase classifier, run it live.

One-time setup (run from the repo root):
  curl -L -o engine/models/face_landmarker.task \
    https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
  python3.11 -m venv .venv && source .venv/bin/activate
  pip install -r engine/requirements.txt

Usage:
  python silentvoice.py record --person jenna            # 12 phrases x 12 reps (core12)
  python silentvoice.py record --person sam --set core8 --reps 3
  python silentvoice.py train                            # trains on everything in engine/data
  python silentvoice.py train --set core8                # Checkpoint 1 fallback
  (train also writes web/public/model/lipreader.json: the model the phone app runs)
  python silentvoice.py live                             # OpenCV debug window, events printed as JSON

How it works:
  MediaPipe Face Landmarker -> 40 lip points + 4 reference points per frame.
  Each take is normalized (nose-centred, eye-line rotated, scaled by eye distance),
  resampled to a fixed length, and turned into a feature vector. A regularized
  logistic regression picks the phrase. That is fast to train (seconds) and needs
  little data. Swap in a small GRU/1D-CNN later if there is time.

Live mode emits events in the format defined in CLAUDE.md ("Event contract").
engine/server.py (Block 2) wraps LiveEngine and forwards the events over a WebSocket.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import queue
import sys
import time
from collections import deque
from typing import Callable, Optional

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.join(ROOT, "engine")
DATA_DIR = os.path.join(ENGINE_DIR, "data")
MODELS_DIR = os.path.join(ENGINE_DIR, "models")
REPORTS_DIR = os.path.join(ENGINE_DIR, "reports")
FACE_MODEL = os.path.join(MODELS_DIR, "face_landmarker.task")
LIP_MODEL = os.path.join(MODELS_DIR, "lipreader.joblib")
WEB_MODEL = os.path.join(ROOT, "web", "public", "model", "lipreader.json")
GOLDEN = os.path.join(ROOT, "web", "src", "engine", "golden.json")
PHRASES_FILE = os.path.join(ROOT, "phrases.json")

# MediaPipe face-mesh indices. Outer lip loop (20) then inner lip loop (20), both clockwise
# from the left mouth corner. The web app draws points[0:20] and points[20:40] as two loops.
OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
INNER_LIPS = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
LIPS = OUTER_LIPS + INNER_LIPS
# Reference points used only for normalization: left eye outer, right eye outer, nose tip, chin.
REF = [33, 263, 1, 152]
TRACKED = LIPS + REF
N_LIPS = len(LIPS)
I_EYE_L, I_EYE_R, I_NOSE = N_LIPS, N_LIPS + 1, N_LIPS + 2
I_INNER_TOP, I_INNER_BOTTOM = N_LIPS - 5, 25  # landmarks 13 and 14

SEQ_LEN = 24          # frames per take after resampling
MIN_FRAMES = 8        # shorter takes are discarded


# --------------------------------------------------------------------------- phrases

def load_phrases() -> list[dict]:
    with open(PHRASES_FILE) as f:
        return json.load(f)["phrases"]


def phrase_set(name: str) -> list[dict]:
    """'core8', 'core12', 'all', or a comma-separated list of ids."""
    phrases = load_phrases()
    if name == "core8":
        return phrases[:8]
    if name == "core12":
        return phrases[:12]
    if name == "all":
        return phrases
    ids = [s.strip() for s in name.split(",") if s.strip()]
    by_id = {p["id"]: p for p in phrases}
    missing = [i for i in ids if i not in by_id]
    if missing:
        sys.exit(f"Unknown phrase ids: {missing}")
    return [by_id[i] for i in ids]


# --------------------------------------------------------------------------- tracking

class FaceFrame:
    __slots__ = ("points", "blink", "w", "h")

    def __init__(self, points: np.ndarray, blink: float, w: int, h: int):
        self.points = points  # (44, 3) normalized image coords, un-mirrored
        self.blink = blink    # 0..1, mean of eyeBlinkLeft / eyeBlinkRight blendshapes
        self.w, self.h = w, h

    @property
    def lips_xy(self) -> list[list[float]]:
        """Lip points in 0..1 camera-frame coords for the web app's lip outline."""
        return np.round(self.points[:N_LIPS, :2], 4).tolist()


class Tracker:
    def __init__(self, model_path: str = FACE_MODEL):
        if not os.path.exists(model_path):
            sys.exit(f"Missing {model_path}. Run the curl command at the top of silentvoice.py.")
        import mediapipe as mp
        from mediapipe.tasks import python as mp_tasks
        from mediapipe.tasks.python import vision

        self._mp = mp
        opts = vision.FaceLandmarkerOptions(
            base_options=mp_tasks.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(opts)
        self._last_ts = 0

    def process(self, frame_bgr: np.ndarray) -> Optional[FaceFrame]:
        import cv2

        h, w = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        ts = max(int(time.monotonic() * 1000), self._last_ts + 1)  # must strictly increase
        self._last_ts = ts
        res = self._landmarker.detect_for_video(image, ts)
        if not res.face_landmarks:
            return None
        lm = res.face_landmarks[0]
        pts = np.array([[lm[i].x, lm[i].y, lm[i].z] for i in TRACKED], dtype=np.float32)
        blink = 0.0
        if res.face_blendshapes:
            scores = {c.category_name: c.score for c in res.face_blendshapes[0]}
            blink = (scores.get("eyeBlinkLeft", 0.0) + scores.get("eyeBlinkRight", 0.0)) / 2
        return FaceFrame(pts, blink, w, h)


def open_camera(index: int):
    import cv2

    cap = cv2.VideoCapture(index)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    if not cap.isOpened():
        sys.exit(f"Could not open camera {index}. Try --cam 1, and check macOS camera permission for your terminal.")
    return cap


# --------------------------------------------------------------------------- features

def normalize(points: np.ndarray, w: int, h: int) -> np.ndarray:
    """(N, 44, 3) image coords -> (N, 40, 2) lips in a head-stable frame.

    Origin at the nose tip, x-axis along the eye line, unit = eye-corner distance.
    Removes head position, roll and distance from the camera, but keeps mouth width
    (smiles and puckers carry information).
    """
    p = points[..., :2].astype(np.float64).copy()
    p[..., 0] *= w / h  # undo the non-square normalization of x
    eye_vec = p[:, I_EYE_R] - p[:, I_EYE_L]
    scale = np.linalg.norm(eye_vec, axis=-1)
    ang = np.arctan2(eye_vec[:, 1], eye_vec[:, 0])
    c, s = np.cos(-ang), np.sin(-ang)
    rot = np.stack([np.stack([c, -s], -1), np.stack([s, c], -1)], -2)  # (N, 2, 2)
    lips = p[:, :N_LIPS] - p[:, I_NOSE][:, None, :]
    lips = np.einsum("nij,nkj->nki", rot, lips)
    return lips / scale[:, None, None]


def resample(seq: np.ndarray, n: int = SEQ_LEN) -> np.ndarray:
    idx = np.linspace(0, len(seq) - 1, n)
    lo = np.floor(idx).astype(int)
    hi = np.minimum(lo + 1, len(seq) - 1)
    frac = (idx - lo)[:, None, None]
    return seq[lo] * (1 - frac) + seq[hi] * frac


def features(seq: np.ndarray) -> np.ndarray:
    """(N, 40, 2) normalized take -> 1-D feature vector."""
    x = resample(seq)
    mean_shape = x.mean(axis=0)
    motion = x - mean_shape
    vel = np.diff(x, axis=0)
    return np.concatenate([motion.ravel(), vel.ravel() * 4, mean_shape.ravel()]).astype(np.float64)


def augment(seq: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Small rotation / scale / shift / time-crop jitter so a tiny dataset generalizes."""
    n = len(seq)
    a, b = rng.integers(0, max(1, n // 10) + 1, size=2)
    seq = seq[a: n - b] if n - a - b >= MIN_FRAMES else seq
    th = np.deg2rad(rng.uniform(-6, 6))
    rot = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]], dtype=np.float32)
    seq = seq @ rot.T * rng.uniform(0.93, 1.07) + rng.normal(0, 0.02, size=2)
    return seq + rng.normal(0, 0.004, size=seq.shape)


# --------------------------------------------------------------------------- record

def cmd_record(args):
    import cv2

    phrases = phrase_set(args.set)
    tracker = Tracker()
    cap = open_camera(args.cam)
    person_dir = os.path.join(DATA_DIR, args.person)

    def takes(pid):
        return sorted(glob.glob(os.path.join(person_dir, pid, "*.npz")))

    # Interleave phrases (rep-major order) so fatigue and lighting drift spread evenly.
    plan = [p for rep in range(args.reps) for p in phrases if len(takes(p["id"])) <= rep]
    print(f"{len(plan)} takes to record for {args.person}. SPACE start/stop, R redo last, N skip, Q quit.")

    i, recording, frames, last_saved, msg = 0, False, [], None, ""
    while i < len(plan):
        ok, frame = cap.read()
        if not ok:
            break
        face = tracker.process(frame)
        if recording:
            frames.append(face)

        view = cv2.flip(frame, 1)
        if face is not None:
            for x, y in face.points[:N_LIPS, :2]:
                cv2.circle(view, (int((1 - x) * face.w), int(y * face.h)), 2, (120, 220, 160), -1)
        p = plan[i]
        done = len(takes(p["id"]))
        cv2.putText(view, p["text"], (40, 90), cv2.FONT_HERSHEY_DUPLEX, 2.0, (255, 255, 255), 3)
        cv2.putText(view, f"{p['id']}  take {done + 1}/{args.reps}   [{i + 1}/{len(plan)}]",
                    (40, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (220, 220, 220), 2)
        if recording:
            cv2.circle(view, (view.shape[1] - 50, 50), 18, (0, 0, 255), -1)
        if face is None:
            cv2.putText(view, "NO FACE", (40, 190), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        if msg:
            cv2.putText(view, msg, (40, view.shape[0] - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.imshow("Silent Voice - record", view)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == ord(" "):
            if not recording:
                recording, frames, msg = True, [], "recording... mouth the phrase, then SPACE"
            else:
                recording = False
                good = [f for f in frames if f is not None]
                if len(good) < MIN_FRAMES or len(good) < 0.7 * len(frames):
                    msg = f"discarded ({len(good)}/{len(frames)} frames with a face) - try again"
                    continue
                os.makedirs(os.path.join(person_dir, p["id"]), exist_ok=True)
                last_saved = os.path.join(person_dir, p["id"], f"{int(time.time() * 1000)}.npz")
                np.savez_compressed(last_saved, points=np.stack([f.points for f in good]),
                                    blink=np.array([f.blink for f in good], dtype=np.float32),
                                    w=good[0].w, h=good[0].h)
                msg, i = f"saved {p['id']} ({len(good)} frames)", i + 1
        elif key == ord("r") and last_saved and not recording:
            os.remove(last_saved)
            last_saved, i, msg = None, max(0, i - 1), "deleted last take - redo it"
        elif key == ord("n") and not recording:
            i, msg = i + 1, "skipped"

    cap.release()
    cv2.destroyAllWindows()
    print("Done.")


# --------------------------------------------------------------------------- train

def load_dataset(ids: Optional[set] = None):
    seqs, labels, people = [], [], []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*", "*", "*.npz"))):
        person, pid = path.split(os.sep)[-3:-1]
        if ids is not None and pid not in ids:
            continue
        d = np.load(path)
        seqs.append(normalize(d["points"], int(d["w"]), int(d["h"])))
        labels.append(pid)
        people.append(person)
    return seqs, np.array(labels), np.array(people)


def make_classifier():
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    return make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=3000))


def fit(seqs, labels, n_aug: int, seed: int = 0):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for s, lab in zip(seqs, labels):
        X.append(features(s))
        y.append(lab)
        for _ in range(n_aug):
            X.append(features(augment(s, rng)))
            y.append(lab)
    clf = make_classifier()
    clf.fit(np.stack(X), np.array(y))
    return clf


def evaluate(seqs, labels, people, n_aug: int):
    """Held-out logits for every take. Leave-one-person-out if there are 2+ people (honest
    'stranger' accuracy), else k-fold. Returns (mode, logits[n, C], classes) or None."""
    from sklearn.model_selection import StratifiedKFold

    classes = np.unique(labels)
    if len(set(people)) >= 2:
        folds = [(np.where(people != p)[0], np.where(people == p)[0]) for p in sorted(set(people))]
        mode = "leave-one-person-out"
    else:
        n_splits = min(5, int(min(np.unique(labels, return_counts=True)[1])))
        if n_splits < 2:
            return None
        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=0)
        folds = list(skf.split(np.zeros(len(labels)), labels))
        mode = f"{n_splits}-fold"
    logits = np.full((len(seqs), len(classes)), -1e9)
    for tr, te in folds:
        clf = fit([seqs[i] for i in tr], labels[tr], n_aug)
        cols = np.searchsorted(classes, clf.classes_)  # a fold may miss a class
        logits[np.ix_(te, cols)] = clf.decision_function(np.stack([features(seqs[i]) for i in te]))
    return mode, logits, classes


def softmax(z: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    z = z / temperature
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    """Temperature scaling: pick T so the app's 'X% sure' matches how often it is right."""
    grid = np.exp(np.linspace(np.log(0.1), np.log(10), 121))
    nll = [-np.log(softmax(logits, t)[np.arange(len(y)), y] + 1e-12).mean() for t in grid]
    return float(grid[int(np.argmin(nll))])


def save_chart(per_phrase: dict, mode: str, path: str):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ids = list(per_phrase)
    fig, ax = plt.subplots(figsize=(max(6, len(ids) * 0.6), 4))
    ax.bar(ids, [per_phrase[i] * 100 for i in ids], color="#5B8A72")
    ax.axhline(80, color="#E46F5C", linestyle="--", linewidth=1)
    ax.set_ylabel("top-3 accuracy (%)")
    ax.set_ylim(0, 100)
    ax.set_title(f"Per-phrase top-3 accuracy ({mode})")
    plt.xticks(rotation=45, ha="right")
    fig.tight_layout()
    fig.savefig(path, dpi=150)


def cmd_train(args):
    # NumPy 2.x on Apple Accelerate raises spurious matmul overflow warnings; results are fine.
    with np.errstate(all="ignore"):
        _train(args)


def _train(args):
    import joblib

    ids = None if args.set == "all" else {p["id"] for p in phrase_set(args.set)}
    seqs, labels, people = load_dataset(ids)
    if len(seqs) == 0:
        sys.exit(f"No takes found in {DATA_DIR}. Run `record` first.")
    classes, counts = np.unique(labels, return_counts=True)
    print(f"{len(seqs)} takes, {len(classes)} phrases, people: {sorted(set(people.tolist()))}")
    print("takes per phrase:", dict(zip(classes.tolist(), counts.tolist())))

    temperature = 1.0
    result = evaluate(seqs, labels, people, args.aug)
    if result:
        mode, logits, classes = result
        y = np.searchsorted(classes, labels)
        order = np.argsort(-logits, axis=1)
        top1 = order[:, 0] == y
        top3 = (order[:, :3] == y[:, None]).any(axis=1)
        t1, t3 = top1.mean(), top3.mean()
        print(f"\n[{mode}]  top-1 {t1:.1%}   top-3 {t3:.1%}")

        # Confidence report: what the app's confidence bar and "not sure" threshold will do.
        temperature = fit_temperature(logits, y)
        conf = softmax(logits, temperature).max(axis=1)
        sure = conf >= args.threshold
        print(f"\nconfidence (temperature {temperature:.2f}), threshold {args.threshold:.0%}:")
        print(f"  speaks right away for {sure.mean():.0%} of takes, and is right {top1[sure].mean() if sure.any() else 0:.0%} of those")
        print(f"  asks to confirm for {(~sure).mean():.0%}; the answer is in its top 3 for {top3[~sure].mean() if (~sure).any() else 0:.0%} of those")
        for lo in (0.0, 0.4, 0.6, 0.8):
            band = (conf >= lo) & (conf < lo + 0.2 if lo < 0.8 else conf <= 1)
            if band.any():
                print(f"  says {lo:.0%}-{min(lo + 0.2, 1):.0%} sure: right {top1[band].mean():.0%} of the time ({band.sum()} takes)")

        per_phrase = {c: float(top3[labels == c].mean()) for c in classes}
        for c, acc in sorted(per_phrase.items(), key=lambda kv: kv[1]):
            print(f"  {c:16s} top-3 {acc:.0%}")
        os.makedirs(REPORTS_DIR, exist_ok=True)
        chart = os.path.join(REPORTS_DIR, f"accuracy_{int(time.time())}.png")
        save_chart(per_phrase, mode, chart)
        print(f"chart -> {chart}")
        if t3 >= 0.8:
            print("Checkpoint 1: >= 80% top-3. Keep going.")
        elif t3 >= 0.6:
            print("Checkpoint 1: below 80%. Retrain with --set core8.")
        else:
            print("Checkpoint 1: below 60%. Make blink-to-select the main input; lip-reading is 'in progress'.")

    clf = fit(seqs, labels, args.aug)
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump({"clf": clf, "classes": clf.classes_.tolist(), "seq_len": SEQ_LEN}, LIP_MODEL)
    print(f"model -> {LIP_MODEL}")
    export_web(clf, temperature, args.threshold)


def export_web(clf, temperature: float, threshold: float):
    """Write the model for the phone app (web/public/model/lipreader.json) plus a golden
    fixture that web/src/engine/golden.test.ts uses to prove the TS port matches Python."""
    scaler = clf.named_steps["standardscaler"]
    lr = clf.named_steps["logisticregression"]
    # Fold the scaler into the weights: logits = W @ x + b on raw features.
    W = lr.coef_ / scaler.scale_
    b = lr.intercept_ - W @ scaler.mean_
    sig = lambda a: [float(f"{v:.7g}") for v in a]  # noqa: E731
    model = {
        "version": 1, "seq_len": SEQ_LEN, "lips": LIPS, "ref": REF,
        "classes": clf.classes_.tolist(), "temperature": round(temperature, 4), "threshold": threshold,
        "intercept": sig(b), "coef": [sig(row) for row in W],
    }
    os.makedirs(os.path.dirname(WEB_MODEL), exist_ok=True)
    with open(WEB_MODEL, "w") as f:
        json.dump(model, f, separators=(",", ":"))
    print(f"phone model -> {WEB_MODEL} ({os.path.getsize(WEB_MODEL) // 1024} KB). Commit + push it.")

    # Golden fixture: a synthetic take (no real faces) and what Python computes for it.
    t = np.linspace(0, 2 * np.pi, 31)[:, None, None]
    rng = np.random.default_rng(7)
    base = np.zeros((len(TRACKED), 2))
    ang = np.linspace(0, 2 * np.pi, N_LIPS, endpoint=False)
    base[:N_LIPS] = np.stack([0.5 + 0.05 * np.cos(ang), 0.62 + 0.02 * np.sin(ang)], -1)
    base[I_EYE_L], base[I_EYE_R], base[I_NOSE], base[-1] = [0.43, 0.42], [0.57, 0.41], [0.5, 0.52], [0.5, 0.75]
    pts = base[None] + 0.01 * np.sin(t * 3 + rng.uniform(0, 6, (1, len(TRACKED), 1))) * (np.arange(len(TRACKED)) < N_LIPS)[None, :, None]
    pts = np.round(pts, 6)
    x = features(normalize(pts, 1280, 720))
    golden = {"w": 1280, "h": 720, "points": pts.tolist(), "features": x.tolist(),
              "logits": (np.asarray(model["coef"]) @ x + np.asarray(model["intercept"])).tolist()}
    os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
    with open(GOLDEN, "w") as f:
        json.dump(golden, f)


# --------------------------------------------------------------------------- live

class LiveEngine:
    """Camera loop: segment mouthing, classify, let the patient confirm with a long blink.

    emit(event_dict) is called for every event in the CLAUDE.md event contract.
    command(msg) is thread-safe; server.py calls it with messages from the web app.

    Selection: candidates appear with #1 highlighted. Hold eyes closed `hold` seconds to
    confirm the highlighted phrase. A quick double blink moves the highlight to the next one.
    """

    def __init__(self, emit: Callable[[dict], None], cam: int = 0, window: bool = True,
                 hold: float = 1.0, blink_thresh: float = 0.45, on_mult: float = 2.5,
                 lips_fps: float = 20.0):
        self.emit = emit
        self.cam = cam
        self.window = window
        self.hold = hold
        self.blink_thresh = blink_thresh
        self.on_mult = on_mult
        self.lips_interval = 1.0 / lips_fps
        self.commands: "queue.Queue[dict]" = queue.Queue()
        self.phrases = {p["id"]: p for p in load_phrases()}
        self.model = None
        if os.path.exists(LIP_MODEL):
            import joblib
            self.model = joblib.load(LIP_MODEL)
        else:
            print(f"warning: no {LIP_MODEL}; run `train`. Lips and status still stream.", file=sys.stderr)

        self.mode = "idle"            # idle | capturing | choosing
        self.manual_capture = False
        self.candidates: list[dict] = []
        self.selected = 0
        self.segment: list[np.ndarray] = []
        self.preroll: deque = deque(maxlen=5)
        self.prev = None
        self.energy = 0.0
        self.baseline = 0.003
        self.quiet_since = 0.0
        self.closed_since: Optional[float] = None
        self.blink_latched = False
        self.last_short_blink = 0.0
        self.last_progress_emit = 0.0
        self.candidates_at = 0.0

    # -- public

    def command(self, msg: dict):
        self.commands.put(msg)

    def run(self, stop=None):
        import cv2

        tracker = Tracker()
        cap = open_camera(self.cam)
        last_lips = last_status = 0.0
        fps, frames, fps_t = 0.0, 0, time.monotonic()
        self._status(face=False, fps=0.0)
        try:
            while stop is None or not stop.is_set():
                ok, frame = cap.read()
                if not ok:
                    break
                now = time.monotonic()
                face = tracker.process(frame)
                self._drain_commands()
                if face is not None:
                    if now - last_lips >= self.lips_interval:
                        self.emit({"type": "lips", "t": _ms(), "points": face.lips_xy,
                                   "mouth_open": round(self._mouth_open(face), 3),
                                   "aspect": round(face.w / face.h, 4)})
                        last_lips = now
                    self._step(face, now)
                frames += 1
                if now - fps_t >= 1.0:
                    fps, frames, fps_t = frames / (now - fps_t), 0, now
                if now - last_status >= 1.0:
                    self._status(face=face is not None, fps=fps)
                    last_status = now
                if self.window and self._draw(frame, face):
                    break
        finally:
            cap.release()
            if self.window:
                cv2.destroyAllWindows()

    # -- internals

    def _status(self, face: bool, fps: float):
        self.emit({"type": "status", "t": _ms(), "mode": self.mode, "face": face,
                   "fps": round(fps, 1), "model_loaded": self.model is not None})

    def _set_mode(self, mode: str):
        if mode != self.mode:
            self.mode = mode
            self.emit({"type": "status", "t": _ms(), "mode": mode, "face": True,
                       "fps": None, "model_loaded": self.model is not None})

    @staticmethod
    def _mouth_open(face: FaceFrame) -> float:
        p = face.points
        gap = np.linalg.norm(p[I_INNER_TOP, :2] - p[I_INNER_BOTTOM, :2])
        width = np.linalg.norm(p[0, :2] - p[10, :2])
        return float(gap / max(width, 1e-6))

    def _step(self, face: FaceFrame, now: float):
        norm = normalize(face.points[None], face.w, face.h)[0]
        if self.prev is not None:
            e = float(np.abs(norm - self.prev).mean())
            self.energy = 0.5 * self.energy + 0.5 * e
        self.prev = norm
        on = self.baseline * self.on_mult
        off = self.baseline * 1.5

        if self.mode == "capturing":
            self.segment.append(norm)
            auto_end = (not self.manual_capture and self.energy < off
                        and now - self.quiet_since > 0.5)
            if self.energy >= off:
                self.quiet_since = now
            if auto_end or len(self.segment) > 120:
                self._finish_segment()
            return

        self.preroll.append(norm)
        eyes_closed = face.blink > self.blink_thresh
        if not eyes_closed:
            self.baseline = 0.98 * self.baseline + 0.02 * min(self.energy, self.baseline * 3)
        if self.manual_capture or (self.energy > on and not eyes_closed):
            self._start_segment(now)
            return

        if self.mode == "choosing":
            self._blink_select(eyes_closed, now)
            if now - self.candidates_at > 20:
                self._clear_candidates()

    def _start_segment(self, now: float):
        self.segment = list(self.preroll)
        self.quiet_since = now
        self._set_mode("capturing")

    def _finish_segment(self):
        seg, self.segment = self.segment, []
        self.manual_capture = False
        if len(seg) < MIN_FRAMES or self.model is None:
            self._set_mode("choosing" if self.candidates else "idle")
            return
        clf = self.model["clf"]
        proba = clf.predict_proba(features(np.stack(seg))[None])[0]
        order = np.argsort(-proba)[:3]
        self.candidates = [{"phrase_id": clf.classes_[i], "text": self.phrases[clf.classes_[i]]["text"],
                            "prob": round(float(proba[i]), 3)} for i in order]
        self.selected = 0
        self.candidates_at = time.monotonic()
        self.closed_since, self.blink_latched = None, False
        self._set_mode("choosing")
        self._emit_candidates()

    def _emit_candidates(self):
        self.emit({"type": "candidates", "t": _ms(), "top3": self.candidates, "selected": self.selected})

    def _clear_candidates(self):
        self.candidates, self.selected = [], 0
        self._emit_candidates()
        self._set_mode("idle")

    def _blink_select(self, eyes_closed: bool, now: float):
        if eyes_closed:
            if self.blink_latched:
                return
            if self.closed_since is None:
                self.closed_since = now
            progress = min((now - self.closed_since) / self.hold, 1.0)
            if now - self.last_progress_emit >= 0.05:
                self._emit_progress(progress)
            if progress >= 1.0:
                self.blink_latched = True
                self._confirm(self.selected, "blink")
            return
        # eyes open
        self.blink_latched = False
        if self.closed_since is not None:
            dur = now - self.closed_since
            self.closed_since = None
            self._emit_progress(0.0)
            if dur < 0.5:
                if now - self.last_short_blink < 0.8:
                    self.selected = (self.selected + 1) % max(1, len(self.candidates))
                    self.last_short_blink = 0.0
                    self._emit_candidates()
                else:
                    self.last_short_blink = now

    def _emit_progress(self, value: float):
        self.last_progress_emit = time.monotonic()
        self.emit({"type": "blink_progress", "t": _ms(), "value": round(value, 3),
                   "selected": self.selected})

    def _confirm(self, index: int, source: str, phrase_id: Optional[str] = None):
        if phrase_id is None:
            if not self.candidates:
                return
            c = self.candidates[index]
            phrase_id, confidence = c["phrase_id"], c["prob"]
        else:
            confidence = None
        p = self.phrases[phrase_id]
        self.emit({"type": "confirmed", "t": _ms(), "phrase_id": phrase_id, "text": p["text"],
                   "urgent": p["urgent"], "source": source, "confidence": confidence})
        self._clear_candidates()

    def _drain_commands(self):
        while True:
            try:
                msg = self.commands.get_nowait()
            except queue.Empty:
                return
            action = msg.get("action")
            if msg.get("type") != "override":
                continue
            if action == "select":
                if msg.get("phrase_id") in self.phrases:
                    self._confirm(0, "override", msg["phrase_id"])
                elif isinstance(msg.get("index"), int) and msg["index"] < len(self.candidates):
                    self._confirm(msg["index"], "override")
            elif action == "next" and self.candidates:
                self.selected = (self.selected + 1) % len(self.candidates)
                self._emit_candidates()
            elif action == "capture_start":
                self.manual_capture = True
            elif action == "capture_stop" and self.mode == "capturing":
                self._finish_segment()
            elif action == "reset":
                self.segment, self.manual_capture = [], False
                self._clear_candidates()

    def _draw(self, frame, face) -> bool:
        """Debug window. Returns True when the user pressed Q."""
        import cv2

        view = cv2.flip(frame, 1)
        if face is not None:
            for x, y in face.points[:N_LIPS, :2]:
                cv2.circle(view, (int((1 - x) * face.w), int(y * face.h)), 2, (120, 220, 160), -1)
        y = 50
        cv2.putText(view, f"mode: {self.mode}   energy {self.energy:.4f}  on>{self.baseline * self.on_mult:.4f}",
                    (30, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        for i, c in enumerate(self.candidates):
            y += 45
            color = (120, 220, 160) if i == self.selected else (220, 220, 220)
            cv2.putText(view, f"{i + 1}. {c['text']}  {c['prob']:.0%}", (30, y),
                        cv2.FONT_HERSHEY_DUPLEX, 1.0, color, 2)
        if face is not None:
            cv2.putText(view, f"blink {face.blink:.2f}", (30, view.shape[0] - 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(view, "SPACE manual capture  N next  R reset  Q quit", (30, view.shape[0] - 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        cv2.imshow("Silent Voice - live", view)
        key = cv2.waitKey(1) & 0xFF
        if key == ord(" "):
            self.command({"type": "override", "action": "capture_stop" if self.mode == "capturing" else "capture_start"})
        elif key == ord("n"):
            self.command({"type": "override", "action": "next"})
        elif key == ord("r"):
            self.command({"type": "override", "action": "reset"})
        return key == ord("q")


def _ms() -> int:
    return int(time.time() * 1000)


def print_event(ev: dict):
    if ev["type"] != "lips":
        print(json.dumps(ev), flush=True)


def cmd_live(args):
    LiveEngine(print_event, cam=args.cam, window=True, hold=args.hold,
               blink_thresh=args.blink_thresh, on_mult=args.on_mult).run()


# --------------------------------------------------------------------------- cli

def main():
    ap = argparse.ArgumentParser(description="Silent Voice engine")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("record", help="record lip-landmark takes for a person")
    r.add_argument("--person", required=True)
    r.add_argument("--set", default="core12", help="core8 | core12 | all | comma-separated ids")
    r.add_argument("--reps", type=int, default=12)
    r.add_argument("--cam", type=int, default=0)
    r.set_defaults(fn=cmd_record)

    t = sub.add_parser("train", help="evaluate + train the phrase classifier")
    t.add_argument("--set", default="all", help="restrict to core8 | core12 | ids (default: all recorded)")
    t.add_argument("--aug", type=int, default=4, help="augmented copies per take")
    t.add_argument("--threshold", type=float, default=0.6,
                   help="app speaks right away at or above this confidence, else asks to confirm")
    t.set_defaults(fn=cmd_train)

    lv = sub.add_parser("live", help="run live with the OpenCV debug window")
    lv.add_argument("--cam", type=int, default=0)
    lv.add_argument("--hold", type=float, default=1.0, help="seconds of closed eyes to confirm")
    lv.add_argument("--blink-thresh", type=float, default=0.45)
    lv.add_argument("--on-mult", type=float, default=2.5, help="mouth-motion trigger, x baseline")
    lv.set_defaults(fn=cmd_live)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
