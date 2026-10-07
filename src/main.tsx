import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/data/entities/store'
import '@/data/budget/store'
import '@/data/budget/hooks'
import '@/data/agreements/store'
import '@/data/plans/store'
import '@/data/approvals/store'
import '@/data/payments/store'
import '@/data/closing/store'
import App from '@/app/App'
import { ownerOfPath } from '@/app/entityAccess'
import '@/styles/index.css'

/* The end-to-end tests sign in as the entity that owns a record · they ask whose record it is here.
   Reading only: the session still decides what opens. */
try {
  if (localStorage.getItem('ab-e2e') === '1') (window as unknown as { __abOwner: typeof ownerOfPath }).__abOwner = ownerOfPath
  /* The drawn audits (tools/) visit entity views too · each load takes the session its URL needs:
     the record's own entity for an entity view or a portal, staff otherwise */
  if (sessionStorage.getItem('ab-auto') === '1') {
    const q = new URLSearchParams(location.search)
    const as = q.get('as') === 'entity' || q.get('as') === 'partner'
    const id = location.pathname.startsWith('/entities/portal') ? q.get('entity') : as ? ownerOfPath(location.pathname + location.search) : null
    const req = location.pathname.startsWith('/entities/portal') ? q.get('req') : null
    if (id || req) { sessionStorage.setItem('ab-role', 'entity'); sessionStorage.setItem('ab-scope', JSON.stringify(id ? { entityId: id } : { reqId: req })) }
    else { sessionStorage.setItem('ab-role', 'staff'); sessionStorage.removeItem('ab-scope') }
  }
} catch { /* storage blocked */ }

const root = document.getElementById('root')
if (!root) throw new Error('عنصر #root غير موجود في index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
