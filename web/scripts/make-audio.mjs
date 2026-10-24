// Pre-generates every phrase in the patient's cloned voice -> public/audio/<phrase_id>.mp3,
// so the demo never waits on the network. Skips files that already exist (--force redoes all).
//   1. Clone the voice in the Cartesia playground, copy its voice id.
//   2. Put CARTESIA_API_KEY and CARTESIA_VOICE_ID in web/.env.local
//   3. npm run audio
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const { CARTESIA_API_KEY: key, CARTESIA_VOICE_ID: voice } = process.env
if (!key || !voice) throw new Error('Set CARTESIA_API_KEY and CARTESIA_VOICE_ID in web/.env.local')
const model = process.env.CARTESIA_MODEL ?? 'sonic-3.5'
const force = process.argv.includes('--force')

const { phrases } = JSON.parse(readFileSync(new URL('../../phrases.json', import.meta.url), 'utf8'))
const out = new URL('../public/audio/', import.meta.url)
mkdirSync(out, { recursive: true })

for (const p of phrases) {
  const file = new URL(`${p.id}.mp3`, out)
  if (existsSync(file) && !force) continue
  // API reference: https://docs.cartesia.ai/2026-03-01/api-reference/tts/bytes
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Cartesia-Version': '2026-03-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: model,
      transcript: p.text,
      voice: { mode: 'id', id: voice },
      language: 'en',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    }),
  })
  if (!res.ok) throw new Error(`${p.id}: ${res.status} ${await res.text()}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(`✓ ${p.id}`)
}
console.log('done')
