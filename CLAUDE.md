# Silent Voice

Speech for ICU patients on breathing tubes. They're awake but can't talk. **It's one phone app.** A family member points the phone's camera at the patient and taps **Listen**, then the patient silently mouths a phrase. The app reads their lips on the phone itself and shows a **confidence bar**. Then one of two things happens:
- **Confident** (at or above the threshold, default 70%): it speaks the phrase in a clone of the patient's own voice (Cartesia), with the message on screen.
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
Deploy: **automatic on every push to `main`** (Jenna's Vercel project, root directory `./`; `vercel.json` builds `web/` and needs the root `phrases.json`). Live at https://silent-voice-one.vercel.app. Then open the URL on the phone and add it to the home screen. Add `?debug` for the tuning overlay.

## The lip reader

- **Tracking:** MediaPipe Face Landmarker in VIDEO mode with blendshapes. Per frame it takes 40 lip points (outer loop, then inner loop, each clockwise from the left corner) plus the outer eye corners, nose tip and chin.
- **Normalization:** origin at the nose tip, x-axis along the eye line, and one unit equals the eye-corner distance. This removes head position, roll and distance.
- **Features:** each take is resampled to 24 frames, then combined as motion around the mean shape, velocity × 4 and the mean shape, for 3,840 dimensions in total.
- **Classifier:** StandardScaler followed by a one-hidden-layer MLP (128 ReLU units, alpha=3), trained on 4 jittered augmentations per take. It beat LogisticRegression by about 12 points top-1 under leave-one-person-out. The export folds the scaler into the hidden layer, and `classifier.ts` runs the forward pass (it still accepts version-1 linear models).
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

## Cartesia (owner: B)

Every phrase is **pre-generated** in the cloned voice and committed as `web/public/audio/<phrase_id>.mp3`. The app never calls Cartesia at runtime and never sees the API key.

1. **Pick the voice.** Clone the teammate who plays the patient in the demo, so the room hears the person who's mouthing.
2. **Get a clip:** 10 to 60 s of that person talking alone, with no music and no echo. An old Instagram or TikTok video matches the pitch story ("from an old family video"); a voice memo is the backup. Convert a video to audio with `afconvert -f WAVE -d LEI16 video.mp4 clip.wav`, which is built into macOS. The clone accepts wav, mp3, flac, ogg and webm up to 16 MB.
3. **Clone** at https://play.cartesia.ai/voices/create/clone: upload or record the clip, set the language to English, and name it. Copy the **voice id** and test it on "Where's my mom?" in the playground. If it doesn't sound like them, try a cleaner or longer clip.
4. **API key:** create one in the playground (`sk_car_…`). Ask the Cartesia booth about credits; all 50 phrases come to only about 1,000 characters.
5. In `web/.env.local`, set `CARTESIA_API_KEY=…` and `CARTESIA_VOICE_ID=…`, then run `cd web && npm run audio`. It uses `POST https://api.cartesia.ai/tts/bytes` with `Cartesia-Version: 2026-08-14` and model `sonic-3.6`, which uses up to 60 s of the clip. It skips files that already exist; `--force` redoes them all, and deleting one mp3 then rerunning regenerates just that phrase.
6. Listen to the clips, especially core12. Commit and push `web/public/audio/`. If a file is missing, the app falls back to the device voice and shows a small note.
7. If `phrases.json` changes (a new or swapped phrase), rerun `npm run audio`; only the new ones are generated.

API alternative to step 3: `curl -X POST https://api.cartesia.ai/voices/clone -H "Authorization: Bearer $KEY" -H "Cartesia-Version: 2026-08-14" -F clip=@clip.wav -F name="Patient" -F language=en`. The new voice is the `id` in the response.

**Live cloning in the app (A, Saturday; see "Saturday build").** The family uploads a video, a Vercel function calls `/voices/clone` and then `/tts/bytes` with the key kept server-side, and the app caches the mp3s. It's great for the Cartesia track, but it needs network, so keep the pre-generated voice as the demo default.

## Saturday build (current plan: replaces the Saturday blocks below)

The app grows from one camera screen into a full app: home screen, add a patient, give them their voice (live cloning), teach it their lips, talk (lip reading + phrase board, with confirm and undo), and a conversation log. **Ownership for today is by file, so the two Max computers never edit the same file:**

| | **C (Claire): the app shell** | **A (Pokpong): engine, AI, Cartesia** | **B (Jenna): story, keys, QA** |
|---|---|---|---|
| Files | `web/src/App.tsx`, `src/pages/*` (except `Teach.tsx`), `src/components/*` (except `VoiceSetup.tsx`), new `src/lib/store.ts`, `router.ts`, `useBlinkSwitch.ts` | `web/src/engine/*`, new top-level `api/`, `src/lib/voice.ts`, `src/lib/speaker.ts`, `src/pages/Teach.tsx`, `src/components/VoiceSetup.tsx`, `web/vite.config.ts` | `README.md`, `pitch/`, this file, Vercel env vars |

**Timeline:** ~11:15 C pushes `store.ts` + router (A is waiting on the `Patient` type) · ~11:00 A pushes the engine hooks (C needs them) · 2 PM each feature works alone · 3:30 PM C wires everything together, B tests on a real iPhone · **6 PM feature freeze**, then calibrate the demo actor, film, rehearse.

**Rules:** `git pull --rebase` before every push, small commits, only your files, `npm run build && npm run test:engine` before pushing.

**Shared contract** (`web/src/lib/store.ts`, C writes it exactly like this):
```ts
Patient { id; name; preferredName; room; relationship; notes; createdAt;
  voice: { kind: 'demo'|'clone'|'device'; voiceId?: string; source?: 'upload'|'record'; bank?: number };
  calibration: { at: number; takes: number; personal: Personal | null;
                 check?: { before: number; after: number; n: number } } | null }
LogEntry { id; patientId; at; phraseId; text; how: 'lips'|'board'|'scan';
  confirmedBy: 'confident'|'blink'|'tap'; confidence?: number; undone?: boolean; correctedFrom?: string }
```
Plus actions `addPatient`, `updatePatient`, `removePatient`, `addEntry`, `updateEntry` and a `usePatient(id)` hook. `Personal` comes from `engine/mlp.ts`.

**Other cross-owner interfaces (A provides, C uses):**
- `useLipReader({ personal, onTake })` and the exported `BLINK_CLOSED`, `BLINK_HOLD_MS`, `SHORT_BLINK_MS`, `DOUBLE_BLINK_MS`, `isMock`.
- `voiceUrl(patient, phraseId): Promise<string | null>` from `lib/voice.ts`, and `speak(id, text, src?)` (src undefined = today's `/audio/<id>.mp3`; null = device voice).
- `<VoiceSetup patientId onDone />` and the `#/p/:id/teach` page.
- Until A's piece lands, C stubs it (plain `useLipReader()`, `/audio/<id>.mp3`, a placeholder VoiceSetup).

**Product rules for every flow:** nothing is said in the patient's voice without their yes (confident reading, a blink, or the family tapping after the patient nods), every spoken message can be undone, and every message is logged (undone ones stay in the log, struck through).

### Prompt for C (Claire), paste after `/clear`

> Read CLAUDE.md, section "Saturday build". I'm Computer C. Turn the single camera screen into a full app. Only edit the files C owns there.
>
> **Step 1 (push within 45 min; A is waiting):** `lib/router.ts`, a tiny hash router: `#/`, `#/new`, `#/p/:id`, `#/p/:id/talk`, `#/p/:id/teach`, `#/p/:id/voice`, `#/p/:id/log` (`?mock` and `?debug` stay in location.search and keep working). `lib/store.ts` with the exact shared contract, a localStorage store via useSyncExternalStore, storage wrapped in try/catch. `App.tsx` switches routes; Teach and Voice are placeholders for now.
>
> **Step 2, the pages.** Use design-system tokens. Pages are light; camera screens stay dark.
> - **Home:** patient cards (initials avatar, name, room, voice status chip, "lips taught" chip, last message and time), "Add a patient", an empty state with 3 steps (Add them, Give them their voice, Talk), and "Try the demo patient", which creates one with `voice.kind = 'demo'`. Footer: "Everything stays on this phone. Not a medical device."
> - **New patient:**
>   1. Details: name, what they like to be called, hospital and room, your relationship (chips), notes for the care team.
>   2. `<VoiceSetup patientId onDone />` (A builds it; stub it until then).
>   3. "Teach it their lips now?" with Start (goes to teach) or Later (goes to the patient page).
> - **Patient page:** big "Start talking". Rows: Phrase board · Teach it their lips (status and check result) · Their voice (status) · Conversation (last 3 entries). Small "Remove patient" with a confirm step.
> - **Talk:** move PatientApp.tsx here.
>   - Use `useLipReader({ personal: patient.calibration?.personal ?? null })` once A lands it.
>   - Back button and a "Calibrated for {name}" pill.
>   - Log every decided message. Picking another guess under "Not right?" for the same reading updates that entry with `correctedFrom` instead of adding a new one.
>   - Add **Undo** to MessageSheet (buttons Replay · Not right? · Undo). It stops the audio, marks the entry `undone`, returns to ready and shows "Undone".
> - **Phrase board** (`components/PhraseBoard.tsx`), opened by a Board button next to Listen. It covers the camera, but the camera keeps running underneath so blinks are still seen.
>   - Sections: Urgent first, then "Their usual" (top 4 from the log), then each category from phrases.json.
>   - Big 2-column buttons, plus a small lips icon on the phrases the model can read.
>   - A face status chip: "Eyes visible" or "Can't see their face".
>   - **Tap mode:** tapping a phrase opens a confirm panel: "Ask them: '{text}?' Hold eyes closed to say it, or tap Yes if they nod." It has a ConfirmRing driven by the blink hold, plus Yes and Not this.
>   - **Blink scan mode (switch scanning, a standard AAC method):** highlight one section at a time (adjustable 1–3 s, default 1.5 s), pausing while the eyes are closed. A long blink enters the section, the scan steps through its phrases plus a "Back" item, and a long blink speaks the phrase. A double blink goes back. Scroll the highlighted item into view.
>   - The board speaks through the same MessageSheet with Undo. Log it as `how: 'board'` (tap) or `'scan'` (blink).
>   - `lib/useBlinkSwitch(faceRef, active, onHold, onDouble)`: a rAF loop on `faceRef.current.blink` using A's BLINK_* constants. In `?mock`, add "Hold = simulate blink" via `lr.simulateBlink`.
> - **Log:** entries grouped by day. Each shows the phrase in Fraunces and a meta line ("2:14 PM · Lip reading · 82% sure", "Confirmed by blink", "Phrase board"). Undone entries are struck through; corrected ones say what they replaced. Replay per entry, filters All and Urgent, and Share (a navigator.share text summary for the nurse).
>
> Commit after each page. When A's pieces land, wire them in and speak through `speak(id, text, await voiceUrl(patient, id))`.

### Prompt for A (Pokpong), paste after `/clear`

> Read CLAUDE.md, section "Saturday build". I'm Computer A. Only edit the files A owns there. C pushes `lib/store.ts` (the Patient type) within about 45 min; do tasks 1 and 2 first and pull before task 3.
>
> **1. Engine hooks (push within 30 min, C needs them).**
> - `useLipReader(options?: { personal?: Personal | null; onTake?: (x: Float64Array) => void })`. Keep both in refs and predict with `applyPersonal(model, personal)`.
> - When `onTake` is set (calibration), `finish()` hands `features(seg)` to it instead of predicting (an empty array in `?mock`), then returns to 'ready'. A take with no motion sets the "Didn't catch that" notice.
> - Export `BLINK_CLOSED`, `BLINK_HOLD_MS`, `SHORT_BLINK_MS`, `DOUBLE_BLINK_MS` and `isMock`.
> - Keep the golden test passing.
>
> **2. Live cloning on the server.** The Vercel project root is the repo root, so functions go in `/api`.
> - `api/clone.ts`: `export async function POST(req: Request)`. Takes multipart `clip` (WAV) and `name`, then calls `POST https://api.cartesia.ai/voices/clone` with headers `Authorization: Bearer $CARTESIA_API_KEY` and `Cartesia-Version: 2026-08-14`, and form fields `clip`, `name` and `language=en`. Return `{ id }`.
> - `api/tts.ts`: takes `{ voiceId, text }` (text ≤ 200 chars) and calls `/tts/bytes` with the same body as `scripts/make-audio.mjs` (sonic-3.6, mp3 44100/128000). Return audio/mpeg.
> - Reject requests whose Origin doesn't match the host. Use only Web APIs, with no npm deps and no reliance on @types/node.
> - Add a Vite dev plugin in `vite.config.ts` that serves `/api/*` through `server.ssrLoadModule`, with the env from `web/.env.local`, so `npm run dev` can clone locally.
>
> **3. Voice on the phone.**
> - `lib/voice.ts`:
>   - `toWav(blob)`: decodeAudioData, mix to mono, resample to 22.05 kHz, keep the first 45 s. This stays under Vercel's 4.5 MB body limit and works with iPhone .mov and .m4a.
>   - `cloneVoice(wav, name)`.
>   - `buildBank(patientId, voiceId, onProgress)`: generates all 50 phrases through `/api/tts`, 3 at a time, core 8 first, into Cache Storage. It runs at module level so it survives navigation and updates `patient.voice.bank`.
>   - `voiceUrl(patient, phraseId)`: demo patients get `/audio/<id>.mp3`. Clones get the cached blob URL, else live TTS, else null. Device-voice patients get null.
> - `speaker.speak(id, text, src?)`: src undefined keeps today's behavior, and src null uses the device voice.
> - `components/VoiceSetup.tsx` (`{ patientId, onDone }`). Four choices:
>   - Upload a video or voice memo ("families usually have one").
>   - Record them now, for patients who can still speak, e.g. before a planned surgery. Uses MediaRecorder, a timer, a passage to read aloud and an auto-stop at 60 s.
>   - Use the demo voice.
>   - Skip and use the phone's voice.
>
>   Then preview the extracted audio and require a consent checkbox ("I have permission from them or their legal representative"). Show "Creating their voice…", then auto-play a sample ("Hi, it's me. I can hear you."), then the phrase bank progress (n/50). On any error, offer "Use the demo voice instead".
>
> **4. `pages/Teach.tsx`, "Teach it their lips."**
> - Camera full-bleed with CameraView, using `useLipReader({ onTake })`.
> - Plan: `model.personal.takes` rounds × the model's classes, round by round. Each prompt reads "Ask them to mouth: '{phrase}'".
> - Hands-free: show the next phrase for 1.4 s, then listen automatically. Advance only when a take arrives, otherwise retry the same phrase.
> - A progress grid (phrases × rounds), plus Pause, Redo last and Finish now (after round 1).
> - When done, run `personalize()` on all takes. Run an honest check: leave one round out, comparing first-guess accuracy of the shared vs. the calibrated model on the held-out takes.
> - Save `patient.calibration` and show "Calibrated for {name}" with the check ("On takes it didn't learn from: 3/8 → 6/8"), then "Try it now", which goes to Talk.
> - `?mock`: fake the takes and save `personal: null`.
>
> **5. If time remains:** record 5+ strangers at the venue (3 reps × core8) and retrain. Update the README results table only if the numbers improve.

### B (Jenna), short tasks
1. **Before 2 PM:** add the Cartesia key to Vercel (only the project owner can): `npx vercel env add CARTESIA_API_KEY production`, and paste the key at the prompt, never in chat.
2. **Nurse calls:** get 1–2 quotes. Update the video shot list:
   1. Add a patient.
   2. Upload an old video and hear the clone after about 30 s.
   3. Teach it their lips, sped up.
   4. Talk: confident, then unsure, then blink-confirm.
   5. Phrase board scan for a phrase the model can't read.
   6. Undo.
   7. The log.
3. **~3:30 PM:** test the whole flow on the iPhone, including airplane mode with the demo patient. Send bugs to the file's owner.
4. **After the freeze:** update the README (live cloning in the Cartesia table; remove "In progress") and write the Devpost.

**Demo-day setup:**
1. Create the demo actor as a patient.
2. Use "demo voice", or clone live if the Wi-Fi is good.
3. Run Teach it their lips about 10 minutes before judging.

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
