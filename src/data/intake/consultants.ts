import { CFG, persist, readJson } from '@/lib/config'

/* External consultants (3.3.4 · 3.4.17 · 3.4.19 · 3.4.23).

   A consultant is added straight from settings — no approval path, the document is explicit —
   linked to one or more domains, with an access window in days. A referral gives them that many
   days on one project; when it runs out their screen locks on its own.

   Whether the supervisor must wait for the opinion before forwarding to the grants manager is a
   switch, off by default: step 19 forwards without waiting, rule 3.4.23 says wait. The audit
   flags the conflict; until the foundation decides, the switch lets either reading be shown. */

export interface Consultant {
  key: string
  name: string
  title: string
  domains: string[]
  /** Days of access a referral grants */
  accessDays: number
}

interface ConsultantSetup {
  list: Consultant[]
  /** Rule 3.4.23 · forward to the grants manager only after the opinion arrives */
  waitForOpinion: boolean
}

const DEFAULT: ConsultantSetup = {
  list: [
    { key: 'c1', name: 'د. سامي الفايز', title: 'مستشار تعليمي', domains: ['التعليم', 'القيم'], accessDays: 10 },
    { key: 'c2', name: 'د. فهد العمري', title: 'مستشار صحي', domains: ['الصحة', 'مجال الصحة'], accessDays: 7 },
  ],
  waitForOpinion: false,
}

export const CONSULTANTS: ConsultantSetup = readJson(CFG.consultants, DEFAULT)

export const saveConsultants = (next: ConsultantSetup): void => {
  Object.assign(CONSULTANTS, structuredClone(next))
  persist(CFG.consultants, CONSULTANTS)
}

export const consultantsFor = (field: string): Consultant[] =>
  CONSULTANTS.list.filter((c) => c.domains.includes(field))

export const consultantByKey = (key: string): Consultant | undefined =>
  CONSULTANTS.list.find((c) => c.key === key)
