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
import * as budgetStore from '@/data/budget/store'
import * as payStore from '@/data/payments/store'
import { allBudgets } from '@/data/mock/chain'
import { moneyOf } from '@/data/mock/budgetTree'
import { payRequests } from '@/data/mock/disbursements'
import * as agrStore from '@/data/agreements/store'
import * as planStore from '@/data/plans/store'
import * as planMock from '@/data/mock/plans'
import * as closeStore from '@/data/closing/store'
import { stageMeta } from '@/data/mock/taxonomy'
import { projectRows } from '@/data/mock/projects'
import { agreements as agrRows } from '@/data/mock/agreements'
import * as kpi from '@/data/kpi'
import * as closeMock from '@/data/mock/closing'
import '@/styles/index.css'

/* The end-to-end tests sign in as the entity that owns a record · they ask whose record it is here.
   Reading only: the session still decides what opens. */
try {
  if (localStorage.getItem('ab-e2e') === '1') {
    const w = window as unknown as Record<string, unknown>
    w.__abOwner = ownerOfPath
    /* Reading the stores from a test · the figures behind a screen, not a way to change them */
    w.__abProbe = { budget: budgetStore, pay: payStore, allBudgets, moneyOf, payRequests, agr: agrStore, plan: planStore, planMock, close: closeStore, stageMeta, projectRows, agrRows, kpi, closeMock }
  }
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
