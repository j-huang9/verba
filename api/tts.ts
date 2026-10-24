// POST /api/tts: JSON { voiceId, text } -> audio/mpeg in that voice.
// Same request as web/scripts/make-audio.mjs. Keeps CARTESIA_API_KEY on the server.
declare const process: { env: Record<string, string | undefined> }

const MAX_TEXT = 200

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

/** Only our own pages may spend the Cartesia credits. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return fail(403, 'Forbidden')
  const key = process.env.CARTESIA_API_KEY
  if (!key) return fail(500, 'CARTESIA_API_KEY is not set on the server')

  let input: { voiceId?: unknown; text?: unknown }
  try {
    input = await req.json()
  } catch {
    return fail(400, 'Expected JSON { voiceId, text }')
  }
  const voiceId = typeof input.voiceId === 'string' ? input.voiceId.trim() : ''
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!/^[\w-]{8,64}$/.test(voiceId)) return fail(400, 'Bad voiceId')
  if (!text || text.length > MAX_TEXT) return fail(400, `text must be 1-${MAX_TEXT} characters`)

  // API reference: https://docs.cartesia.ai/api-reference/tts/bytes
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Cartesia-Version': '2026-08-14',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3.6',
      transcript: text,
      voice: { mode: 'id', id: voiceId },
      language: 'en',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    }),
  })
  if (!res.ok) return fail(502, `Cartesia TTS failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
}
