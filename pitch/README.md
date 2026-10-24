# Pitch materials (Computer B)

## Submission requirements (from the event)
- [ ] **A working demo**: the live app on a phone, plus a backup video in case it fails
- [ ] **A 2-minute, demo-first presentation**: one complete user flow first, then a brief problem + how we built it
- [ ] **A short README** with setup, Cartesia features used and known limitations (done; update "In progress" when C ships calibration and the question feature)
- [ ] **Source access for judges**: make the repo public, or add the judges, per event rules
- [x] **No API keys or secrets in the repo** (full git history checked)

## 2-minute presentation, demo first
| Time | What |
|---|---|
| 0:00–1:00 | **Demo, one complete flow.** "Patient" (scarf over throat) mouths "Where's my mom?" → confidence bar → their cloned voice. Then an unsure one → "Did you mean this?" → long blink → voice. |
| 1:00–1:25 | **Problem.** Ventilated ICU patients are awake but voiceless. One nurse quote. |
| 1:25–1:55 | **How we built it.** On-device lip reading (MediaPipe + MLP exported from Python), calibrated confidence, blink confirmation, Cartesia voice clone + Sonic 3.6. One number: 81% → 87% top-3 after 3 personal takes. |
| 1:55–2:00 | One closing line. |

## Files
- `demo-script.md`: the exact lines and actions for the 2 minutes above
- `devpost.md`: the Devpost draft, with a paragraph per track (Most Technically Advanced, People-First, Cartesia, Meta)
- `nurse-quotes.md`: quotes from the nurse and RT calls, with name, role and permission to quote
- `video-shots.md`: the demo video shot list
