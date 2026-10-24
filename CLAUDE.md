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
- **Training happens on Computer A** in Python (`silentvoice.py train`). The export is `web/public/model/lipreader.json`, which **gets committed**, and that file is the handoff between the two computers.
- **Phones only allow the camera over HTTPS.** Use the deployed Vercel URL, or `npm run dev:phone` (a self-signed certificate, so tap through the warning).

## Who owns what

Three computers. Both Max plans do the heavy coding. The Pro has the tightest Claude limits, so it takes the work that depends on people more than code.

| | **A: "the model"**, Pro Max (Pokpong) | **C: "the app"**, Pro Max (new) | **B: "voice, design and story"**, Pro (Jenna) |
|---|---|---|---|
| Owns | `silentvoice.py`, `engine/`, `web/public/model/`, `web/src/engine/features.ts`, `classifier.ts`, `golden.*` | the rest of `web/`: `src/engine/` runtime (`tracker`, `useLipReader`, `mock`, `types`), `src/pages/`, `src/components/`, `src/lib/`, config, PWA, deploy | `web/public/audio/`, `web/scripts/make-audio.mjs`, `pitch/` |
| Goal | the most accurate and honest model possible | the app works flawlessly on a real iPhone in a dim room | the demo makes the room go quiet |
| Builds | data collection (team, iPhone camera, strangers), training, confidence calibration and threshold, error analysis, the personal-calibration math, accuracy charts for the pitch | real-phone tuning (segmentation, blink), on-screen guidance, offline mode, iOS audio, history, onboarding, the personal-calibration flow, conversation-aware ranking | Cartesia voice and audio QA, UX review on the phone, nurse quotes, pitch, Devpost, demo video, props and logistics |
| Claude | long ML sessions | long app sessions; takes over UI work from B | one task per session, `/clear` between tasks; draft writing in claude.ai |

**Interfaces between owners:**
- A to C: `lipreader.json` and the `features.ts`/`classifier.ts` math. A changes the features in Python and TS together and keeps `npm run test:engine` passing.
- C to UI: the `LipReader` type in `web/src/engine/types.ts`.
- B to C: UX fixes go to C as a list (GitHub issue or chat), not as code edits, except copy tweaks and audio files.
- Shared files: `phrases.json` and this file. Mention changes to them in the commit message.

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
  src/engine/             on-device lip reader (math: A, runtime: C)
    features.ts           MUST match silentvoice.py normalize/resample/features
    classifier.ts         loads lipreader.json, softmax with temperature
    tracker.ts            MediaPipe Face Landmarker wrapper
    useLipReader.ts       camera + state machine (phases in types.ts) + tuning constants
    mock.ts               ?mock: fake face + scripted readings (one confident, one unsure, …)
    golden.test.ts        `npm run test:engine`: TS port == Python
  src/pages/PatientApp.tsx      the app (C)
pitch/                    pitch script, Devpost draft, demo shot list, nurse quotes (B)
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
**Optional, after the first model: record with an iPhone as the Mac's camera** (macOS Continuity Camera, `--cam 1` or `--cam 2`). It's still the same `record` command on the Mac. The app runs on phone cameras, so phone-camera training data closes the domain gap. Hold it the way a family member would: in front of the face, slightly below it.

**App (C, and anyone testing it).**
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

### Friday night

**8:45–10:30 PM, Block 1**
- **A:**
  - Set up Python and get `record` working.
  - Record every teammate on core12 × 12 with the Mac's own webcam: one person at a time, sitting in front of the Mac.
  - Run the first `train` and push `lipreader.json`.
- **C:**
  - Deploy to Vercel and open the app on a real iPhone with `?mock`.
  - Switch to real mode and add a `?debug` overlay: fps, motion energy, blink score, phase and segment length.
  - Make sure the cloned voice plays on iOS after the Listen tap.
- **B:**
  - Clone the voice, run `npm run audio` and listen to every clip. Regenerate any that sound off, then push the mp3s.
  - Message nurses for Saturday calls.
  - Find props: a phone stand, a desk lamp, a scarf.
  - Record your own takes on A.

**10:30 PM, Checkpoint 1**
- A pushes the first model, and C runs it on the iPhone.
- If top-3 is at least 80%, continue. If it's below 80%, retrain with `--set core8`. If it's still below 60%, lean on the confirm sheet: always show the top 3 and let blink or tap choose. Lip-reading is then presented as "in progress".

**10:30 PM–1:30 AM, Block 2**
- **A:**
  - Optional: add 3–4 reps per person through an iPhone used as the Mac's webcam (Continuity Camera, `--cam 1`). It's still the same `record` command on the Mac, not a separate phone recording, and it makes the training footage look like the app's phone camera.
  - Pick the threshold from the confidence report.
  - Do error analysis: find which phrase pairs get confused. Re-record the worst pairs, or swap a phrase for one that looks more distinct on the lips.
  - Optionally compare a one-hidden-layer MLP against the logistic regression under leave-one-person-out. Switch only if it wins by more than 5 points, and update `classifier.ts` and the golden test to match.
- **C:**
  - Tune segmentation and blink on the iPhone with the real model.
  - Add live guidance pills: "Move closer", "Too dark", "Face the camera" (from face size, brightness and head turn).
  - Make the app work offline: a service worker caches the app, `lipreader.json`, `/mediapipe` and `/audio`.
- **B:**
  - Test the app on the phone like a scared family member would. Send C a list of UX fixes.
  - Draft the 2-minute demo script and the pitch outline in `pitch/`.

**1:30 AM, Checkpoint 2:** the full loop works on an iPhone with the real model, even if it's ugly.

**About 2–7 AM:** sleep in shifts, with at least 4.5 hours each.

### Saturday

**8 AM–12 PM, Block 3: personalization**
This is the "Most Technically Advanced" headline: the model adapts to each patient on the phone in about 60 seconds.
- **A:** prototype the personal-calibration math in Python. With 3 takes per phrase from a new person, adapt the model, for example by fine-tuning the intercepts and blending in the person's class means. Prove the before/after gain on strangers' data: get about 10 other hackers × 3 reps, and chart it for the pitch.
- **C:** build the "Teach it their lips" flow. The patient mouths each core phrase 3 times, the model adapts on the phone using A's math, and the result is stored on the phone.
- **B:** do the nurse calls from 12 to 1 PM and collect 2–3 quotes. Draft the pitch and Devpost text in claude.ai.

**1–6 PM, Block 4, stretch goals**
- **C:** conversation-aware ranking. `webkitSpeechRecognition` hears the family's question, and A's keyword-to-phrase priors re-rank the guesses, so "Are you in pain?" pushes up "Yes", "No" and "I'm in pain". Then a conversation history list.
- **A:** supply those priors, make the final accuracy charts, and run a stranger test of the calibration flow.
- **B:** a Figma frame, a landing page and a demo video shot list.

**6 PM, Checkpoint 3: feature freeze.** After this, fix bugs only, with no refactors. If a checkpoint slips by more than an hour, cut the next stretch goal.

**6–10 PM: bug bash.** Everyone tests on 2+ phones in bright and dim light. Run 5 full demo rehearsals. Test in airplane mode after the first load.

**10 PM–1 AM: demo video.** B directs and edits. A and C record a backup of the live demo.

### Sunday

**6:30 AM:** final rehearsal. **8:00 AM:** submit to Devpost, an hour early, with the project image, the GitHub link and the video.

## Ready-made prompts (paste after `/clear`)

**A, Block 1:** Read CLAUDE.md. I'm Computer A. Set up the Python environment and get `python silentvoice.py record` working with this Mac's built-in webcam. Recording is just one teammate at a time sitting in front of the Mac, silently mouthing the phrase shown on screen (SPACE to start and stop each take). It saves lip points, not video. After everyone has recorded, run `train`, explain the accuracy and confidence report, and commit `web/public/model/lipreader.json` and `web/src/engine/golden.json`. (iPhone-camera takes are an optional extra for Block 2. Skip them now.)

**A, Block 2:** Read CLAUDE.md. Add error analysis to `train`: a confusion matrix chart and the 5 most-confused phrase pairs. Then compare a one-hidden-layer MLP against the current logistic regression under leave-one-person-out. Only if the MLP wins by more than 5 points: export it, port the forward pass to `web/src/engine/classifier.ts`, and extend the golden test.

**A, Block 3:** Read CLAUDE.md. Design on-device personal calibration. Given 3 takes per phrase from a new person, adapt the exported model with something simple enough to run in the browser (bias fine-tuning plus a class-mean blend). Evaluate it on held-out people: train without them, calibrate on 3 of their takes, test on the rest. Write the math up as a short spec for Computer C and add a before/after chart.

**C, Block 1:** Read CLAUDE.md. I'm Computer C. Deploy `web/` to Vercel and make the app work on a real iPhone. Add a `?debug` overlay to PatientApp that shows fps, motion energy versus thresholds, blink score, phase and segment length. Verify that the cloned voice plays on iOS Safari after the Listen tap, and fix it if it doesn't. Don't change `features.ts` or `classifier.ts`.

**C, Block 2:** Read CLAUDE.md. With the real model loaded, tune the constants at the top of `useLipReader.ts` using the debug overlay. Add guidance pills from face size, frame brightness and head yaw. Add a service worker so the app works offline after the first load, caching `lipreader.json`, `/mediapipe` and `/audio`. Then apply B's UX fix list.

**C, Block 3:** Read CLAUDE.md and A's calibration spec. Build the "Teach it their lips" flow: guided capture of 3 reps per core phrase, on-device adaptation, saved on the phone, with a "Personalized ✓" badge on the confidence bar.

**B, any time (short tasks):**
- Read CLAUDE.md. Run `npm run audio`, then list any phrases whose audio is missing.
- Read CLAUDE.md. Turn my notes into `pitch/demo-script.md`: a 2-minute demo script with exact lines and actions.

## Conventions

- Keep it simple, because this is a hackathon. Prefer working and readable over clever. Don't refactor after the 6 PM Saturday freeze.
- Commit small and often, and pull before you push. Stay inside your own folders.
- Never commit API keys, `.env.local` or recorded data (`engine/data`). **Do** commit `lipreader.json`, `golden.json` and `public/audio/*.mp3`.
