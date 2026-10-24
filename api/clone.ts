// POST /api/clone: multipart { clip: WAV file, name } -> { id } (a new Cartesia voice).
// Keeps CARTESIA_API_KEY on the server. Web APIs only (Vercel function, and the Vite dev
// plugin in web/vite.config.ts serves it locally).
declare const process: { env: Record<string, string | undefined> }

const MAX_BYTES = 4_400_000 // Vercel rejects request bodies over 4.5 MB

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

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Expected multipart form data with a clip')
  }
  const clip = form.get('clip')
  const name = String(form.get('name') ?? '').trim().slice(0, 80) || 'Verba patient'
  if (!(clip instanceof Blob) || clip.size === 0) return fail(400, 'Missing clip')
  if (clip.size > MAX_BYTES) return fail(413, 'Clip is too large (keep it under 45 seconds)')

  const body = new FormData()
  body.append('clip', clip, 'clip.wav')
  body.append('name', name)
  body.append('language', 'en')
  // API reference: https://docs.cartesia.ai/api-reference/voices/clone
  const res = await fetch('https://api.cartesia.ai/voices/clone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Cartesia-Version': '2026-08-14' },
    body,
  })
  if (!res.ok) return fail(502, `Cartesia clone failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  const voice = (await res.json()) as { id?: string }
  if (!voice.id) return fail(502, 'Cartesia returned no voice id')
  return Response.json({ id: voice.id })
}
