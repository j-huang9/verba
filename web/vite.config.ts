import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // reachable from phones on the same Wi-Fi (nurse / family views)
    fs: { allow: ['..'] }, // lets src/ import ../phrases.json from the repo root
  },
})
