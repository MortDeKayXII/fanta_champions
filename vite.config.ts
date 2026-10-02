import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site under /<repo-name>/
export default defineConfig({
  base: '/fanta_champions/',
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 },
})
