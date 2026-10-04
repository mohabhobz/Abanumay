import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/data/entities/store'
import '@/data/budget/store'
import App from '@/app/App'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('عنصر #root غير موجود في index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
