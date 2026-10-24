import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchUploads } from '@/lib/docCache'
/* Batch 8 · the stage clocks are armed before any store replays, so a move replayed from the log starts its clock (data/stageClock.ts) */
import '@/data/slaSeed'
import '@/data/entities/store'
import '@/data/budget/store'
import '@/data/budget/hooks'
import '@/data/agreements/store'
import '@/data/plans/store'
import '@/data/approvals/store'
import '@/data/payments/store'
/* v3 · 9.4.5 · BPD-011 · the partners store routes projects to external parties and gives the payments their
   external schedules · the payments replay waits for it, so it loads right after them, before the closing */
import '@/data/partners/store'
import '@/data/closing/store'
import App from '@/app/App'
import * as escMod from '@/data/shared/escalation'
import * as escRulesMod from '@/data/shared/escRules'
import * as auditMod from '@/data/shared/audit'
import * as behalfMod from '@/data/behalf'
import { installScrollHints } from '@/lib/scrollHint'
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
import { projectRows, subRows } from '@/data/mock/projects'
import { agreements as agrRows } from '@/data/mock/agreements'
import * as kpi from '@/data/kpi'
import * as closeMock from '@/data/mock/closing'
import * as criteriaMod from '@/data/intake/criteria'
import { spendLevelFor } from '@/data/budget/rules'
import * as budgetRules from '@/data/budget/rules'
import * as entStore from '@/data/entities/store'
import * as entVal from '@/data/entities/validate'
import { entityDetail } from '@/data/mock/entityDetail'
import { entityRows } from '@/data/mock/entities'
import { ibanValid } from '@/lib/iban'
import * as partnersStore from '@/data/partners/store'
import * as apprStore from '@/data/approvals/store'
import * as flowStore from '@/data/intake/flow'
import * as authStore from '@/data/entities/auth'
import * as aiShared from '@/data/shared/ai'
import * as decisions from '@/data/shared/decisions'
import * as priority from '@/data/intake/priority'
import * as recon from '@/data/partners/reconcile'
import * as legacy from '@/data/payments/legacy'
import * as textCheck from '@/lib/textCheck'
import * as sheet from '@/lib/sheetRead'
import * as guard from '@/data/authGuard'
import * as aiProvider from '@/lib/ai/provider'
import * as notify from '@/data/shared/notify'
import * as exportLib from '@/lib/export'
import * as impactMod from '@/data/impact'
import * as cycle from '@/data/intake/cycle'
import * as taxonomy from '@/data/mock/taxonomy'
import * as relocStore from '@/data/budget/relocate'
import { APPROVAL_RULES as apprRules } from '@/data/approvals/rules'
import '@/styles/index.css'

/* The end-to-end tests sign in as the entity that owns a record · they ask whose record it is here.
   Reading only: the session still decides what opens. */
try {
  if (localStorage.getItem('ab-e2e') === '1') {
    const w = window as unknown as Record<string, unknown>
    w.__abOwner = ownerOfPath
    /* Reading the stores from a test · the figures behind a screen, not a way to change them */
    w.__abProbe = { budget: budgetStore, pay: payStore, allBudgets, moneyOf, payRequests, agr: agrStore, plan: planStore, planMock, close: closeStore, stageMeta, projectRows, subRows, agrRows, kpi, closeMock, spendLevelFor, ent: entStore, entVal, entityDetail, entityRows, ibanValid, partners: partnersStore, appr: apprStore, rules: budgetRules, flow: flowStore, auth: authStore, ai: aiShared, apprRules, decisions, priority, recon, legacy, textCheck, sheet, guard, aiProvider, notify, exportLib, impactMod, cycle, reloc: relocStore, esc: escMod, escRules: escRulesMod, audit: auditMod, behalf: behalfMod, criteria: criteriaMod, taxonomy }
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

installScrollHints()
/* 18 Oct · every picked file is read in the browser as it's picked (audit 2.6.4 · 9.6.2 · 11.6.1) */
watchUploads()
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
