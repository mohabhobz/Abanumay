import { logSettings } from './settingsLog'

/* v3 · 2.4.35 · test data is kept apart from production (18 Oct · audit partial closed).

   Rejected real projects and entities stay as a history record and are never deleted (the stores
   already refuse it). This module is the second half, in the frontend: a «بيانات تجريبية» flag on
   an entity or a project, and the system environment. In «إنتاج» a flagged record leaves the
   reports, the KPIs, the impact board and the exports, and lists tag it «تجريبي»; in «اختبار» it
   shows like any other. The physical separation (two environments on the server) belongs to the
   integration · this is what the interface does with it. */

export type SysEnv = 'prod' | 'test'
export type TestKind = 'entity' | 'project'
export const ENV_SAY: Record<SysEnv, string> = { prod: 'إنتاج', test: 'اختبار' }
export const TEST_KIND_SAY: Record<TestKind, string> = { entity: 'جهة', project: 'مشروع' }

const KEY = 'ab-test-data'
interface Store { env: SysEnv; entity: string[]; project: string[] }

const read = (): Store => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Store> | null
    if (v && typeof v === 'object') return { env: v.env === 'test' ? 'test' : 'prod', entity: [...(v.entity ?? [])], project: [...(v.project ?? [])] }
  } catch { /* storage blocked */ }
  return { env: 'prod', entity: [], project: [] }
}
const S: Store = read()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch { /* holds for this visit */ } }

const HREF = '/settings'
const REF = 'بيانات الاختبار والبيئة'

/** The system environment · «إنتاج» by default */
export const sysEnv = (): SysEnv => S.env
export function setSysEnv(env: SysEnv, by: string): void {
  if (env === S.env) return
  const from = S.env
  S.env = env
  save()
  logSettings(REF, HREF, by, [{ k: 'بيئة النظام', from: ENV_SAY[from], to: ENV_SAY[env] }])
}

/** Is the record flagged as test data? */
export const isTest = (kind: TestKind, id: string): boolean => S[kind].includes(id)
/** All flagged ids of a kind */
export const testIds = (kind: TestKind): string[] => [...S[kind]]

/** Mark or unmark a record · admins only · every change is logged */
export function markTest(kind: TestKind, id: string, on: boolean, by: string, role: string): string[] {
  if (role !== 'admin') return ['تعليم البيانات التجريبية لمدير النظام']
  if (!id.trim()) return [`اكتب رقم ${TEST_KIND_SAY[kind]}`]
  if (isTest(kind, id) === on) return []
  S[kind] = on ? [...S[kind], id] : S[kind].filter((x) => x !== id)
  save()
  logSettings(REF, HREF, by, [{ k: `${TEST_KIND_SAY[kind]} ${id}`, from: on ? 'إنتاج' : 'تجريبي', to: on ? 'تجريبي' : 'إنتاج' }])
  return []
}

/** Hidden from reports, KPIs, impact and exports · only in production */
export const hiddenAsTest = (kind: TestKind, id: string): boolean => S.env === 'prod' && isTest(kind, id)

/** A project row is test data when it or its entity is flagged */
export const projectIsTest = (p: { id: string; entityId?: string }): boolean =>
  isTest('project', p.id) || Boolean(p.entityId && isTest('entity', p.entityId))
/** Keep a project row in the reports? */
export const reportable = (p: { id: string; entityId?: string }): boolean => S.env !== 'prod' || !projectIsTest(p)
/** Keep an entity row in the reports? */
export const reportableEntity = (e: { id: string }): boolean => !hiddenAsTest('entity', e.id)
