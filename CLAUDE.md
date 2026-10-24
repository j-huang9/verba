# Silent Voice

Speech for ICU patients on breathing tubes. They're awake but can't talk. **It's one phone app.** A family member points the phone's camera at the patient and taps **Listen**, then the patient silently mouths a phrase. The app reads their lips on the phone itself and shows a **confidence bar**. Then one of two things happens:
- **Confident** (at or above the threshold, default 60%): it speaks the phrase in a clone of the patient's own voice (Cartesia), with the message on screen.
- **Not sure** (below the threshold): it shows "Not entirely sure" with its top guesses. The family member asks "Did you mean this?", and the patient **holds their eyes closed** to confirm or **blinks twice** for the next guess. Tapping a guess also works.

**Demo moment:** a teammate with a scarf over their throat silently mouths "Where's my mom?" The confidence bar fills to 86%, and the room hears it in their own voice.

Cal Hacks 2026, about 37 hours. Tracks: Most Technically Advanced, People-First, Cartesia, Meta, overall.

## Architecture: everything runs on the phone

```
phone camera ─► MediaPipe Face Landmarker (WASM, in browser) ─► 40 lip points + 4 reference points
   ─► features.ts (port of silentvoice.py) ─► classifier.ts (weights from lipreader.json)
   ─► calibrated confidence ─► ≥ threshold: speak /audio/<phrase_id>.mp3 (pre-generated clone voice)
                              < threshold: confirm sheet, blink-to-confirm via eyeBlink blendshapes
```

- There is **no server and no live API call** during the demo, so it works on bad hackathon Wi-Fi once loaded.
- It's a **PWA** (web app added to the home screen), not a native app. It's the same React code and can use the camera.
- **Training happens on the Pro Max** in Python (`silentvoice.py train`). The export is `web/public/model/lipreader.json`, which **gets committed**, and that file is the handoff between the two computers.
- **Phones only allow the camera over HTTPS.** Use the deployed Vercel URL, or `npm run dev:phone` (a self-signed certificate, so tap through the warning).

## Who owns what

| | Computer A, MacBook Pro Max (Pokpong) | Computer B, MacBook Pro (Jenna) |
|---|---|---|
| Owns | `silentvoice.py`, `engine/`, **`web/src/engine/`** (on-device lip reader) | `web/src/pages/`, `web/src/components/`, `web/src/lib/`, `web/scripts/make-audio.mjs`, deploy |
| Builds | recording, training, confidence calibration, model export, accuracy charts, the TS port, segmentation and blink tuning, personal calibration | app UI and flow, Cartesia voice clone and audio, PWA polish, Vercel deploy, pitch, Devpost, demo video |
| Claude usage | Max plan: long multi-step work, plus big jobs handed over from B | Pro plan: one component per session, `/clear` between tasks |

Stephanie: nurse outreach and quotes, the Devpost draft, and recording takes. Confirm with her.

**Interface between the owners:** the `LipReader` type in `web/src/engine/types.ts`, returned by `useLipReader()`. The UI only touches the engine through it. Change it together. The other shared files are `phrases.json` and this file. Mention changes to them in the commit message.

## Layout

```
silentvoice.py            Python: record | train | live. train also exports the phone model + golden fixture
phrases.json              phrase set. Order matters: first 8 = core8, first 12 = core12
engine/
  requirements.txt
  models/ data/ reports/  joblib model, recorded takes, charts. All git-ignored
web/                      Vite + React 19 + TypeScript + Tailwind v4, PWA
  public/model/lipreader.json   exported by train. COMMIT IT
  public/audio/<id>.mp3         cloned voice, from `npm run audio`. COMMIT THEM
  public/mediapipe/             WASM + face model, auto-fetched before dev/build. Git-ignored
  src/engine/             on-device lip reader (A)
    features.ts           MUST match silentvoice.py normalize/resample/features
    classifier.ts         loads lipreader.json, softmax with temperature
    tracker.ts            MediaPipe Face Landmarker wrapper
    useLipReader.ts       camera + state machine (phases in types.ts) + tuning constants
    mock.ts               ?mock: fake face + scripted readings (one confident, one unsure, …)
    golden.test.ts        `npm run test:engine`: TS port == Python
  src/pages/PatientApp.tsx      the app (B)
  src/components/         CameraView (lip overlay), ConfidenceBar, ResultSheets, ConfirmRing, Waveform
  src/lib/speaker.ts      plays the clone audio, falls back to the device voice
  scripts/                setup-mediapipe.mjs, make-audio.mjs (Cartesia)
```

## Running

**Engine and training (A).** Use Python 3.10 to 3.12, because MediaPipe has no wheels for newer versions.
```bash
curl -L -o engine/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3.11 -m venv .venv && source .venv/bin/activate && pip install -r engine/requirements.txt
python silentvoice.py record --person <name>      # core12 x 12 reps, about 15 min
python silentvoice.py train                       # accuracy + confidence report, exports web/public/model/lipreader.json
cd web && npm run test:engine                     # must print PASS
git add web/public/model web/src/engine/golden.json && git commit -m "model: …" && git push
```
**Record with an iPhone as the camera** (macOS Continuity Camera, `--cam 1` or `--cam 2`) for at least some takes. The app runs on phone cameras, so phone-camera training data closes the domain gap. Hold it the way a family member would: in front of the face, slightly below it.

**App (B).**
```bash
cd web && npm install
npm run dev          # http://localhost:5173 (laptop webcam works on localhost). Add ?mock for fake data
npm run dev:phone    # https://<LAN-IP>:5173 for a phone on the same Wi-Fi
npm run audio        # pre-generate cloned voice (needs CARTESIA_API_KEY + CARTESIA_VOICE_ID in web/.env.local)
```
Deploy: `cd web && npx vercel`, with the root directory set to `web/`. Then open the URL on the phone and add it to the home screen.

## The lip reader

- **Tracking:** MediaPipe Face Landmarker in VIDEO mode with blendshapes. Per frame it takes 40 lip points (outer loop, then inner loop, each clockwise from the left corner) plus the outer eye corners, nose tip and chin.
- **Normalization:** origin at the nose tip, x-axis along the eye line, and one unit equals the eye-corner distance. This removes head position, roll and distance.
- **Features:** each take is resampled to 24 frames, then combined as motion around the mean shape, velocity × 4 and the mean shape, for 3,840 dimensions in total.
- **Classifier:** StandardScaler followed by LogisticRegression(C=0.05), trained on 4 jittered augmentations per take. The export folds the scaler into the weights.
- **Confidence:** temperature scaling is fitted on held-out predictions, so "86% sure" means it's right about 86% of the time at that level. `train` prints how often the app will speak right away and how often it's right when it does. Tune `--threshold` from that report; it's exported in `lipreader.json`.
- **Evaluation:** with 2 or more people it uses leave-one-person-out, which is the honest number for strangers; otherwise it uses k-fold.
- **Segmentation in the app:** after Listen, a capture auto-stops once the mouth has moved and then stayed still for 0.9 s, or when the family member taps stop. Tuning constants are at the top of `useLipReader.ts`.
- **Blink:** the average of the `eyeBlinkLeft` and `eyeBlinkRight` scores above 0.45 means eyes closed. Holding 1.0 s confirms the highlighted guess. Two short blinks within 0.8 s move to the next guess.
- **Golden test:** `train` writes `web/src/engine/golden.json`, a synthetic take with Python's features and logits. `npm run test:engine` checks that the TS port matches. **Run it after any change to the features.**

## Phrases

`phrases.json` is the single source of truth: about 50 phrases, each with an `id`, `text`, `category` and `urgent` flag. Ids are stable, so add new ids instead of renaming. The recording set is `core12`: yes, no, I'm in pain, I can't breathe, Where's my mom?, I'm thirsty, I'm scared, Thank you, Where's my family?, I need suction, I'm cold, I love you. The fallback set is `core8`, the first 8.

## Design system

The app is used by a scared family member at a bedside, often one-handed, in a dim room. It should be calm, show one decision at a time, use large type, and never use red.

- **Type:** Fraunces for phrases (`font-phrase`) and Inter for UI (`font-sans`). Phrases are 36 to 48 px on the phone.
- **Color tokens** (Tailwind classes, defined in `web/src/index.css`; never use raw hex):
  `canvas` #F6F3EC · `surface` #FFFFFF is for sheets · `ink` #1E2A2F · `muted` #6B7A80 · `line` #E9E1D3 · `sage` #5B8A72 is confident, primary and confirm · `sage-soft` · `sky` #7FA7C9 is the live lip outline · `honey` #A86B12 is "not entirely sure", a calm amber · `honey-soft`. The `coral` token exists but is unused.
  Dark mode follows `prefers-color-scheme`. The camera screen itself is always dark.
- **Layout:** a full-bleed camera, a header with the wordmark, a status pill and a flip-camera button, a big round Listen button at the bottom, and bottom sheets (`rounded-t-[2rem]`) for results. Respect the safe areas.
- **Motion:** use `ease-calm` and spend it on a few moments only: (1) the live lip outline over the mouth, which glows while listening; (2) the confidence bar filling; (3) the confirm ring filling with a held blink; and (4) the phrase fading in with the waveform while the voice plays. Respect `prefers-reduced-motion`.

## Cartesia

Clone the voice in the Cartesia playground from about 10 s of clean audio. For the demo, use a teammate's Instagram video; in the pitch, it comes from an old family video. Copy the voice id, put `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID` in `web/.env.local`, and run `npm run audio`. That writes `web/public/audio/<phrase_id>.mp3` for every phrase using `POST https://api.cartesia.ai/tts/bytes` (`Cartesia-Version: 2026-03-01`, model `sonic-3.5`). Commit the mp3s. If a file is missing, the app falls back to the device voice and shows a small note.

## Plan and checkpoints

- **Fri 8:15–10:30 PM, Block 1.**
  - A: get `record` working, then record every teammate on core12 × 12, partly through the iPhone camera.
  - B: run the app with `?mock`, clone the voice, run `npm run audio`, and deploy to Vercel so it opens on a phone.
- **10:30 PM, Checkpoint 1: run `train` and push `lipreader.json`.** If top-3 is at least 80%, continue. If it's below 80%, retrain with `--set core8`. If it's still below 60%, lean on the confirm sheet: always show the top 3 and let blink or tap choose. Lip-reading is then presented as "in progress".
- **10:30 PM–1:30 AM, Block 2.**
  - A: test the real model on a phone, tune the segmentation and blink constants, and check the confidence report and threshold.
  - B: polish the flow, handle errors, make sure audio plays on iOS, and add the home-screen icon.
- **1:30 AM, Checkpoint 2.** The full loop works on a phone, even if it's ugly: tap → mouth → confidence bar → cloned voice, or unsure → blink → voice.
- **Sat 8 AM–12 PM, Block 3.**
  - A: personal calibration (3 reps per phrase, then a quick retrain) and an evaluation chart of accuracy before and after it, using about 10 strangers × 3 reps.
  - B: polish, onboarding (one screen of "how to use") and a conversation history list.
- **1–6 PM, Block 4, stretch goals.**
  - A: conversation-aware ranking, where the phone mic hears the family's question ("Are you in pain?") and re-ranks the phrases.
  - B: an optional nurse alert for `urgent` phrases, a landing page and a Figma frame.
- **6 PM, Checkpoint 3: feature freeze.** After this, fix bugs only, with no refactors. If a checkpoint slips by more than an hour, cut the next stretch goal.
- **Sun 8:00 AM:** submit to Devpost, an hour before the deadline.

## Ready-made prompts

**A, Block 2:** Read CLAUDE.md. The trained model is in web/public/model/lipreader.json. Help me test the on-device lip reader on a real phone and tune it. Log per-take motion energy, segment length and top-3 to the console in web/src/engine/useLipReader.ts behind a `?debug` flag. Then suggest values for MOTION_ON_FLOOR, QUIET_MS and BLINK_CLOSED based on what we see. Keep `npm run test:engine` passing.

**B, Block 2:** Read CLAUDE.md. Polish web/src/pages/PatientApp.tsx and the sheets in components/. Add a one-screen first-run explainer, a conversation history list (the last 10 messages with time), and a proper home-screen icon (apple-touch-icon PNG). Make sure the cloned-voice audio plays on iOS Safari after the Listen tap. Follow the design system. Don't touch web/src/engine/.

## Conventions

- Keep it simple, because this is a hackathon. Prefer working and readable over clever. Don't refactor after the 6 PM Saturday freeze.
- Commit small and often, and pull before you push. Stay inside your own folders.
- Never commit API keys, `.env.local` or recorded data (`engine/data`). **Do** commit `lipreader.json`, `golden.json` and `public/audio/*.mp3`.
