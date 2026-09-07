import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // لازم '/' مش './' — الروابط النسبية بتتكسر على أي مسار متداخل
  // زي /projects/20940 لأن الأصول بتتحل نسبة للمسار مش للجذر
  base: '/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
