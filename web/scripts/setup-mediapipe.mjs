// Puts MediaPipe's WASM + face model in public/mediapipe so the app runs offline after
// the first run. Runs automatically before `npm run dev` / `npm run build`.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../public/mediapipe/', import.meta.url)
mkdirSync(out, { recursive: true })
cpSync(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', out), { recursive: true })

const model = new URL('face_landmarker.task', out)
if (!existsSync(model)) {
  const url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  console.log('downloading face_landmarker.task …')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  writeFileSync(model, Buffer.from(await res.arrayBuffer()))
}
