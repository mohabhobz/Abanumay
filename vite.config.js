import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // مسارات نسبية عشان الملف المبني يشتغل من أي مكان يترفع فيه
  base: './',
  server: { port: 5173, open: true },
})
