# Silent Voice

Speech for ICU patients on breathing tubes. They're awake but can't talk. A webcam reads their lips, a classifier picks from a fixed set of ICU phrases (`phrases.json`), the patient confirms with a long blink, and Cartesia speaks the phrase in a clone of the patient's own voice. Nurses and family get the message on their phones through Convex.

**Demo moment:** a teammate silently mouths "Where's my mom?" and the room hears it in their own voice.

Cal Hacks 2026, about 37 hours. Tracks: Most Technically Advanced, People-First, Cartesia, Meta, overall.

## Two computers, two owners

| | Computer A, MacBook Pro Max ("the brain") | Computer B, MacBook Pro ("the face") |
|---|---|---|
| Owns | `silentvoice.py`, `engine/` | `web/`, `convex/` |
| Builds | recording, training, live loop, `engine/server.py`, accuracy charts, personal calibration, conversation-aware ranking | bedside screen, `/nurse`, `/family`, Convex relay, Cartesia voice, landing page, pitch, demo video |
| Claude usage | Max plan: long multi-step coding, bug hunts, and big jobs handed over from B | Pro plan: one component per session, `/clear` between tasks |

**Don't edit the other computer's folders.** The only shared files are `CLAUDE.md`, `phrases.json` and the event contract (in this file and in `web/src/lib/events.ts`). If you change any of them, say so in the commit message and tell the other computer.

## Layout

```
silentvoice.py          engine CLI: record | train | live  (LiveEngine class is reused by server.py)
phrases.json            the phrase set. Order matters: first 8 = core8, first 12 = core12
engine/
  requirements.txt
  server.py             Block 2 (A): FastAPI WebSocket on :8765, wraps LiveEngine
  models/               face_landmarker.task (curl), lipreader.joblib (train). Git-ignored
  data/<person>/<phrase_id>/<ts>.npz   recorded landmark takes. Git-ignored (people's faces)
  reports/              accuracy charts from train. Git-ignored
web/                    Vite + React 19 + TypeScript + Tailwind v4 + react-router
  src/lib/events.ts     TypeScript copy of the event contract
  src/lib/useEngine.ts  WebSocket hook. Falls back to the mock engine while disconnected
  src/lib/mockEngine.ts fake event stream so B can build without A
  src/lib/phrases.ts    imports ../phrases.json
  src/pages/            BedsideScreen (/), NurseView (/nurse), FamilyView (/family)
convex/                 Block 2 (B): created by `npx convex dev` inside web/
```

## Running

**Engine (A).** Use Python 3.10 to 3.12, because MediaPipe has no wheels for newer versions.
```bash
curl -L -o engine/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3.11 -m venv .venv && source .venv/bin/activate && pip install -r engine/requirements.txt
python silentvoice.py record --person <name>     # core12 x 12 reps, about 15 min
python silentvoice.py train                      # prints top-1/top-3, writes chart + model
python silentvoice.py live                       # debug window, events printed as JSON
```
macOS asks for camera permission for the terminal app on the first run.

**Web (B).**
```bash
cd web && npm install && cp .env.example .env.local && npm run dev
```
Open `http://localhost:5173`. Add `?mock` to force mock data. If the engine runs on the other laptop, set `VITE_ENGINE_URL=ws://<A's LAN IP>:8765`. Phones on the same Wi-Fi open `http://<B's LAN IP>:5173/nurse`.

## Engine design (silentvoice.py)

- MediaPipe Face Landmarker, in VIDEO mode with blendshapes. Per frame it tracks 40 lip points (outer loop, then inner loop, each clockwise from the left corner) plus 4 reference points: the two outer eye corners, the nose tip and the chin.
- Normalization: origin at the nose tip, x-axis along the eye line, and one unit equals the eye-corner distance. This removes head position, roll and camera distance.
- Features: each take is resampled to 24 frames, then combined as motion around the mean shape, velocity and the mean shape. The model is StandardScaler followed by LogisticRegression(C=0.05), trained on 4 jittered augmentations per take. Training takes seconds.
- Evaluation: with 2 or more people it uses leave-one-person-out, which is the honest number for strangers; otherwise it uses 5-fold. Checkpoint guidance prints after training.
- Live: an adaptive mouth-motion threshold starts and ends a segment, and the segment is classified into the top 3. Holding the eyes closed for 1.0 s confirms the highlighted candidate. A quick double blink moves the highlight. Candidates expire after 20 s. SPACE in the debug window, or `capture_start` / `capture_stop` from the web app, segments manually, which is the safe mode for the demo.

## Event contract (engine → web)

Transport: WebSocket `ws://<engine-host>:8765`, one JSON object per message. Every event has `type` and `t` (Unix ms). Field names are snake_case. **Both sides build against this format. Don't change it without updating `web/src/lib/events.ts` in the same commit.**

```jsonc
// ~20 fps while a face is visible. 40 [x, y] points in 0..1 camera-frame coords, NOT mirrored.
// points[0..19] = outer lip loop, points[20..39] = inner loop. Draw mirrored: x -> 1 - x.
{ "type": "lips", "t": 0, "points": [[0.47, 0.63], ...], "mouth_open": 0.12 }

// After a mouthing segment, whenever the highlight moves, and with top3: [] when cleared.
{ "type": "candidates", "t": 0, "selected": 0,
  "top3": [{ "phrase_id": "where_mom", "text": "Where's my mom?", "prob": 0.71 }, ...] }

// While the eyes are closed in "choosing" mode, up to 20 Hz. value 0..1. Sends 0 on release.
{ "type": "blink_progress", "t": 0, "value": 0.4, "selected": 0 }

// The phrase was chosen. source: "blink" | "override" | "gaze". confidence is null for overrides.
{ "type": "confirmed", "t": 0, "phrase_id": "where_mom", "text": "Where's my mom?",
  "urgent": false, "source": "blink", "confidence": 0.71 }

// Every 1 s and on each mode change (fps is null on mode-change events).
{ "type": "status", "t": 0, "mode": "idle" | "capturing" | "choosing",
  "face": true, "fps": 29.8, "model_loaded": true }
```

Web → engine (overrides from the bedside screen or a caregiver):
```jsonc
{ "type": "override", "action": "select", "phrase_id": "in_pain" }  // or "index": 1
{ "type": "override", "action": "next" }
{ "type": "override", "action": "capture_start" }   // and "capture_stop"
{ "type": "override", "action": "reset" }
```

Convex (B): the bedside app writes every `confirmed` event to a `messages` table with these fields: `phrase_id`, `text`, `urgent`, `source`, `confidence`, `t`, `patient` and `audio_url?`. `/nurse` and `/family` subscribe to it.

## Phrases

`phrases.json` is the single source of truth: about 50 phrases, each with an `id`, `text`, `category` and `urgent` flag. Ids are stable, so add new ids instead of renaming. The recording set is `core12`: yes, no, I'm in pain, I can't breathe, Where's my mom?, I'm thirsty, I'm scared, Thank you, Where's my family?, I need suction, I'm cold, I love you. The fallback set is `core8`, the first 8. Urgent phrases trigger the nurse banner and vibration.

## Design system

The bedside screen is read by a frightened patient from a bed about 2 m away. **It shows at most 3 things at once. Colors stay calm, type is huge, and nothing on the patient's own screen is red.**

- **Type:** Fraunces for phrases (`font-phrase`) and Inter for UI (`font-sans`). Confirmed phrase is `text-phrase` (96 px), candidate cards are `text-candidate` (44 px), and UI text is 16 to 20 px.
- **Color tokens** (Tailwind classes, defined in `web/src/index.css`; never use raw hex):
  `canvas` #F6F3EC is the warm paper background · `surface` #FFFFFF is for cards · `ink` #1E2A2F is text · `muted` #6B7A80 · `line` #E9E1D3 is for borders · `sage` #5B8A72 is primary and confirm · `sage-soft` #DCE8E0 is the highlighted card · `sky` #7FA7C9 is the live lip outline · `coral` #E46F5C is urgent, **used on /nurse only** · `coral-soft`.
  Dark mode follows `prefers-color-scheme`, and `data-theme="light|dark"` on `<html>` overrides it.
- **Shape:** `rounded-card` (28 px), generous padding, soft shadows at most, no hard borders on the bedside screen.
- **Motion:** use `ease-calm` and spend it on 3 moments only: (1) the live lip outline, (2) the confirm ring filling with `blink_progress`, and (3) the confirmed phrase fading in while the voice plays. Nothing else animates. Respect `prefers-reduced-motion`.
- **Nurse view:** phone-first. Urgent messages show a full-width coral banner and call `navigator.vibrate([200,100,200])`.
- **Family view:** warm and simple. Show one message at a time, in large type, with a play button that uses the patient's cloned voice.

## Cartesia

Clone a voice in the Cartesia playground from about 10 s of clean audio, such as an old family video, and copy the voice id. Call TTS from a **Convex action** so the API key never reaches the browser. Env vars live in the Convex dashboard: `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID`. Check the Cartesia docs for the current TTS endpoint and model id. Cache audio per `phrase_id`, because the phrase set is fixed and pre-generated audio makes the demo instant.

## Plan and checkpoints

- **Fri 8:15–10:30 PM, Block 1.** A: get `record` working, and every teammate records core12 × 12 reps in good light from slightly different angles. B: build the bedside screen against the mock events, and clone a teammate's voice.
- **10:30 PM, Checkpoint 1: run `train`.** If top-3 is at least 80%, continue. If it's below 80%, retrain with `--set core8`. If it's still below 60%, blink-to-select becomes the main input and lip-reading is presented as "in progress".
- **10:30 PM–1:30 AM, Block 2.** A: `engine/server.py`. B: connect the live events, set up Convex, and build `/nurse` and `/family`.
- **1:30 AM, Checkpoint 2.** The full loop works, even if it's ugly: mouth → top 3 → blink → cloned voice → the nurse's phone buzzes.
- **Sat 8 AM–12 PM, Block 3.** A: personal calibration (3 reps per phrase, then a quick retrain) and an evaluation chart of accuracy before and after calibration, using about 10 strangers × 3 reps. B: polish, the calibration flow UI and dark mode.
- **1–6 PM, Block 4, stretch goals.** A: conversation-aware re-ranking from speech-to-text on the nurse's question. B: family view polish, a landing page and a Figma frame.
- **6 PM, Checkpoint 3: feature freeze.** After this, fix bugs only, with no refactors. If a checkpoint slips by more than an hour, cut the next stretch goal.
- **Sun 8:00 AM:** submit to Devpost, an hour before the deadline.

## Ready-made prompts

**A, Block 2:** Read CLAUDE.md. Create engine/server.py: a FastAPI WebSocket server on port 8765 that runs `LiveEngine` from silentvoice.py in a background thread with `window=False`. Broadcast every emitted event to all clients exactly as in the event contract, and use a thread-safe queue into the asyncio loop. Forward incoming override messages to `engine.command()`. Add a `--debug-window` flag and bind to 0.0.0.0 so Computer B can connect over LAN. Test with a tiny client script that prints the events.

**B, Block 1:** Read CLAUDE.md. Replace the placeholder in web/src/pages/BedsideScreen.tsx with the real bedside screen. Use `useEngine()`, which already exists and falls back to mock data: a canvas lip outline from `lipsRef` that is smoothed and mirrored, three large candidate cards with the selected one highlighted, a circular confirm ring driven by `blinkProgress`, and the confirmed phrase in large Fraunces type with a waveform. Show a quiet "reconnecting" pill when `!connected`. It must be readable from 2 m away. Follow the design system.

**B, Block 2:** Read CLAUDE.md. Add Convex in web/ with `npx convex dev`. The bedside app writes each confirmed event to Convex (`messages` table). Build /nurse: a phone-first live feed where urgent events get a full-width coral banner and make the phone vibrate. Build /family: a warm phone page that plays each phrase in the patient's Cartesia voice through a Convex action, with audio cached per phrase_id.

## Conventions

- Keep it simple, because this is a hackathon. Prefer working and readable over clever. Don't refactor after the 6 PM Saturday feature freeze.
- Python: one file (`silentvoice.py`) plus `engine/server.py`, and use type hints where they're cheap. TypeScript: function components, Tailwind classes, no other UI libraries unless needed.
- Commit small and often, and pull before you push. A touches `engine/` and `silentvoice.py`; B touches `web/`.
- Never commit API keys, `.env.local`, recorded data or model files.
