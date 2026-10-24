# Silent Voice

ICU patients on a breathing tube are fully awake but can't speak. Silent Voice is a phone app. A family member points the camera at the patient, and the patient silently mouths a phrase. The app reads their lips on the phone itself, shows how confident it is, and speaks the phrase in the patient's own cloned voice (Cartesia). When it isn't sure, it asks the patient to confirm with a long blink.

Built at Cal Hacks 2026.

## Quick start

**App** (Node 20+)
```bash
cd web && npm install
npm run dev            # http://localhost:5173 (add ?mock to try it without a trained model)
npm run dev:phone      # HTTPS on your LAN IP, for testing on a phone
```

**Training** (Python 3.10–3.12)
```bash
curl -L -o engine/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r engine/requirements.txt
python silentvoice.py record --person <your-name>
python silentvoice.py train          # exports web/public/model/lipreader.json for the app
```

See [CLAUDE.md](CLAUDE.md) for the architecture, the plan, the design system and who owns what.
