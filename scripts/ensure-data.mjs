// لو ملف الداتا الحقيقي مش موجود (زي ما بيحصل على أي بيئة بناء)،
// بننسخ نسخة العرض مكانه فالمشروع يبني في أي مكان.
import { existsSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const real = join(root, 'src/data/project.js')
const example = join(root, 'src/data/project.example.js')

if (!existsSync(real)) {
  copyFileSync(example, real)
  console.log('› project.js مش موجود — اتنسخ من project.example.js')
}
