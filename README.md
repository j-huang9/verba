# Silent Voice

ICU patients on a breathing tube are fully awake but can't speak. Silent Voice reads their lips with a webcam, picks from about 50 common ICU phrases, lets them confirm with a blink, and speaks the phrase in their own cloned voice (Cartesia). Nurses and family get the message on their phones.

Built at Cal Hacks 2026.

## Quick start

**Engine** (Computer A, Python 3.10–3.12)
```bash
curl -L -o engine/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r engine/requirements.txt
python silentvoice.py record --person <your-name>
python silentvoice.py train
python silentvoice.py live
```

**Web** (Computer B, Node 20+)
```bash
cd web && npm install && cp .env.example .env.local && npm run dev
```
Open http://localhost:5173. Without the engine it plays mock events.

See [CLAUDE.md](CLAUDE.md) for the architecture, the event contract, the design system and the plan.
