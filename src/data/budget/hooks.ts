import { setCloseHook } from '@/data/mock/closing'
import { hasFunding, releaseSavings } from './store'

/* Cross-module money effects · registered at start-up, so neither the closing mock nor the budget
   store imports the other (a cycle there breaks module initialisation) ·
   final closing returns a project's unused balance to its lines (1.4.32) */
setCloseHook((id, by) => { if (hasFunding(id)) releaseSavings(id, by, 'إغلاق نهائي بعد اعتماد التقييم') })
