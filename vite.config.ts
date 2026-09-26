import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // Must be '/' not './' — relative paths break on any nested route like
  // /projects/20940 because assets resolve relative to the path, not the root.
  base: '/',
  // Keep previous hashed assets instead of clearing dist/ (useful on hosts that
  // disallow deletes). Run `npm run clean` for a fresh output folder.
  build: { emptyOutDir: false },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
