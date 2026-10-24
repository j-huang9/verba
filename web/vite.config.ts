import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Serves the Vercel functions in ../api (clone, tts) during `npm run dev`, with the env from
 * web/.env.local, so live voice cloning works locally. Production uses Vercel's own runtime.
 */
function apiFunctions(mode: string): Plugin {
  return {
    name: 'silent-voice-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv(mode, process.cwd(), 'CARTESIA_'))
      server.middlewares.use(async (req, res, next) => {
        const route = /^\/api\/(clone|tts)(?:\?|$)/.exec(req.url ?? '')?.[1]
        if (!route) return next()
        try {
          const file = fileURLToPath(new URL(`../api/${route}.ts`, import.meta.url))
          const mod = (await server.ssrLoadModule(file)) as Record<string, (r: Request) => Promise<Response>>
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const out = await handler(new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          }))
          res.statusCode = out.status
          out.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (e) {
          server.config.logger.error(`api/${route}: ${(e as Error).message}`)
          res.statusCode = 500
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
// `npm run dev:phone` serves over HTTPS on your LAN IP: phones only allow the camera on HTTPS.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), apiFunctions(mode), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: true,
    fs: { allow: ['..'] }, // lets src/ import ../phrases.json from the repo root
  },
}))
