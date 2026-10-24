# Verba

**Speech for patients on a breathing tube, in their own voice.**

ICU patients on a ventilator are often fully awake but can't make a sound. Today they point at letter boards. Verba is a phone app:
1. A family member points the camera at the patient and taps **Listen**.
2. The patient silently mouths a phrase.
3. The phone reads their lips on the device, shows **how confident it is**, and speaks the phrase **in the patient's own cloned voice** (Cartesia).
4. When it isn't sure, it doesn't guess out loud. It asks the patient to confirm with a **long blink**.

**Live demo:** https://verba-voice.vercel.app. Open it on a phone and add it to the home screen. Add `?mock` to try the flow without a camera or a trained face.

Built at Cal Hacks 2026.

## The user flow

1. Tap **Listen**. The live lip outline glows over the patient's mouth.
2. The patient mouths "Where's my mom?" Capture stops by itself when their mouth goes still.
3. A **confidence bar** fills. At or above the threshold (70%), the phrase appears and plays in the patient's cloned voice.
4. Below the threshold it shows **"Not entirely sure"** with its top guesses. The family member asks "Did you mean this?" and the patient **holds their eyes closed** to confirm, filling a ring, or **blinks twice** for the next guess. Tapping a guess also works.

## Cartesia features used

| Feature | How we use it |
|---|---|
| **Instant Voice Cloning** (`POST /voices/clone`, or the playground) | Clones the patient's voice from 10–60 s of an old video or voice memo. Families usually have one even when the patient can no longer speak. |
| **Text-to-Speech, Sonic 3.6** (`POST /tts/bytes`, `Cartesia-Version: 2026-08-14`) | Generates every phrase in the cloned voice as mp3 (`web/scripts/make-audio.mjs`). Sonic 3.6 uses up to 60 s of the clone clip, which keeps more of the person's accent and tone. |
| **Pre-generated phrase bank** | All phrases are synthesized ahead of time and shipped with the app, so speaking is instant and works offline at the bedside. The API key never reaches the phone. |

## How it's built

Everything at runtime happens **on the phone**. There's no server, and no video leaves the device.

```
camera ─► MediaPipe Face Landmarker (WASM) ─► 40 lip points + 4 head reference points per frame
       ─► normalization (nose origin, eye-line rotation, eye-distance scale)
       ─► 3,840-dim motion features ─► small MLP (exported from Python to JSON)
       ─► temperature-calibrated confidence ─► speak (≥ 70%) or ask to confirm with a blink
```

- **Training** (`silentvoice.py`, Python): recording, training, confidence calibration and export. Takes are stored as lip landmarks only, not video.
- **On-device inference** (`web/src/engine/`, TypeScript): an exact port of the Python feature pipeline. `npm run test:engine` checks it against a Python-generated fixture, matching to about 1e-15.
- **App** (`web/`): React, TypeScript, Vite and Tailwind, installable as a PWA, deployed on Vercel through GitHub Actions.

**Results** (8-phrase set, leave-one-person-out, so every number is measured on a person the model never saw):

| | First guess right | Right phrase in top 3 |
|---|---|---|
| Shared model | 53% | 80.6% |
| After personal calibration (3 takes per phrase) | 62% | 87.3% |
| With the family's question as context ("Are you in pain?") | 62% | 86% |

The confidence is calibrated: at the 70% threshold the app speaks right away for 12% of takes and is right 79% of the time when it does. Everything else goes through blink confirmation. Details are in [`engine/personal-calibration.md`](engine/personal-calibration.md) and [`engine/conversation-priors.md`](engine/conversation-priors.md).

## Setup

**App** (Node 23.6+)
```bash
npm install            # from the repo root (installs web/ too)
npm run dev            # http://localhost:5173 (add ?mock for the scripted demo)
npm run dev:phone      # HTTPS on your LAN IP, so a phone on the same Wi-Fi can use the camera
npm run test:engine    # TypeScript port == Python
```

**Cloned voice:** create `web/.env.local` with `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID`, then run `npm run audio`. This writes `web/public/audio/<phrase_id>.mp3`.

**Training** (Python 3.10–3.12)
```bash
curl -L -o engine/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3.11 -m venv .venv && source .venv/bin/activate && pip install -r engine/requirements.txt
python silentvoice.py record --person <name>    # mouth each phrase on cue
python silentvoice.py train --set core8         # report + exports web/public/model/lipreader.json
```

No API keys or secrets are in this repo. Keys live in git-ignored `.env.local` files and GitHub Actions secrets.

## Known limitations

- **Small vocabulary.** The shipped model recognizes 8 phrases (yes, no, I'm in pain, I can't breathe, Where's my mom?, I'm thirsty, I'm scared, Thank you). `phrases.json` holds 50, and the rest need training data.
- **Small training set.** The model was trained on about 4 people over one night. Accuracy on strangers (53% first guess, 81% top 3) is why the confirm-by-blink step exists, and why the app rarely speaks without confirmation.
- **Not a medical device.** It hasn't been tested with patients, and real ICU conditions differ from our recordings: tubes and tape around the mouth, lying flat, low light.
- **Lighting and angle.** Tracking degrades in dim light or with the face turned away. The app asks you to point the camera at the face.
- **Fixed phrases.** It can't produce free-form speech, only phrases from the set, spoken in the cloned voice.
- **In progress:** personal calibration and question-aware ranking are implemented and tested in the engine (above), and their screens in the app are being built.
- **Voice consent.** A clone should only be made with the patient's or family's consent. In this demo we cloned a teammate, with their permission.
