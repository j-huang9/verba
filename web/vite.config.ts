import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// `npm run dev:phone` serves over HTTPS on your LAN IP: phones only allow the camera on HTTPS.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: true,
    fs: { allow: ['..'] }, // lets src/ import ../phrases.json from the repo root
  },
}))
