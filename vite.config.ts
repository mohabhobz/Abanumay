import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // لازم '/' مش './' — الروابط النسبية بتتكسر على أي مسار متداخل
  // زي /projects/20940 لأن الأصول بتتحل نسبة للمسار مش للجذر
  base: '/',
  // مجلّد المخرجات جوّه مجلّد المستخدم، والصدفة هنا ما بتقدرش تمسح
  // ملفات · `emptyOutDir` بيحاول يفضّيه فالبِناء كان بيقع بـEPERM.
  // بالكتابة فوق القديم البِناء بيعدّي، والأصول باسم مجزّأ فالقديم
  // ما بيتقريش. `npm run clean` بيشيله لما يلزم.
  build: { emptyOutDir: false },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
