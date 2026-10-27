import { useState } from 'react'
import { FieldBox, Button, FieldSelect, Glass, Head, Tag } from '@/components/ui'
import { toast } from '@/data/feedback'
import { useRole } from '@/hooks/useRole'
import { entityById } from '@/data/mock/entities'
import { projectRows } from '@/data/mock/projects'
import {
  ENV_SAY, TEST_KIND_SAY, markTest, setSysEnv, sysEnv, testIds,
  type SysEnv, type TestKind,
} from '@/data/shared/testData'

/* v3 · 2.4.35 · «بيئة النظام» and the records flagged as test data.

   In «إنتاج» a flagged entity or project (an entity's flag covers its projects) leaves the reports,
   the KPIs, the impact board and the exports, and lists tag it «تجريبي»; in «اختبار» it shows like
   any other. Rejected real records stay as history and are never deleted · a test record can be
   archived freely. Only the system admin changes any of it, and every change goes to the settings
   log. The physical separation of the two environments is on the server at integration. */

const nameOf = (kind: TestKind, id: string): string =>
  kind === 'entity' ? entityById(id)?.name ?? '' : projectRows.find((p) => p.id === id)?.name ?? ''

export function TestDataCard() {
  const { role, user } = useRole()
  const admin = role.key === 'admin'
  const [env, setEnv] = useState<SysEnv>(sysEnv())
  const [kind, setKind] = useState<TestKind>('project')
  const [id, setId] = useState('')
  const [, tick] = useState(0)

  const pick = (v: SysEnv) => { setSysEnv(v, user.name); setEnv(sysEnv()); toast(`بيئة النظام: ${ENV_SAY[v]} · تسري على التقارير بعد إعادة التحميل`, 'ok') }
  const add = () => {
    const key = id.trim()
    if (!nameOf(kind, key)) { toast(`لا ${TEST_KIND_SAY[kind]} بهذا الرقم`, 'warn'); return }
    const out = markTest(kind, key, true, user.name, role.key)
    if (out.length) { toast(out[0]!, 'warn'); return }
    setId(''); tick((n) => n + 1); toast(`عُلّم ${TEST_KIND_SAY[kind]} ${key} بيانات تجريبية`, 'ok')
  }
  const drop = (k: TestKind, x: string) => { markTest(k, x, false, user.name, role.key); tick((n) => n + 1); toast(`أُعيد ${TEST_KIND_SAY[k]} ${x} إلى الإنتاج`, 'ok') }
  const flagged = (['entity', 'project'] as TestKind[]).flatMap((k) => testIds(k).map((x) => ({ k, x })))

  return (
    <Glass>
      <Head title="بيئة النظام والبيانات التجريبية" meta={<Tag tone={env === 'prod' ? 'ok' : 'warn'}>{ENV_SAY[env]}</Tag>} />
      <div className="apv-row">
        <FieldSelect label="بيئة النظام" value={env} disabled={!admin} options={(Object.keys(ENV_SAY) as SysEnv[]).map((v) => ({ value: v, label: ENV_SAY[v] }))} onChange={(v) => pick(v as SysEnv)} />
      </div>
      {admin && (
        <div className="apv-row mt-2">
          <FieldSelect label="النوع" value={kind} options={(Object.keys(TEST_KIND_SAY) as TestKind[]).map((v) => ({ value: v, label: TEST_KIND_SAY[v] }))} onChange={(v) => setKind(v as TestKind)} />
          <FieldBox><input value={id} onChange={(e) => setId(e.target.value)} aria-label="رقم السجل التجريبي" placeholder={kind === 'entity' ? 'رقم الجهة' : 'رقم المشروع'} /></FieldBox>
          <Button type="button" variant="2" onClick={add}>علّمه تجريبيًا</Button>
        </div>
      )}
      {flagged.length > 0 ? (
        <ul className="cfglist">
          {flagged.map(({ k, x }) => (
            <li key={`${k}-${x}`}>
              <b>{TEST_KIND_SAY[k]} {x}</b>
              <span className="sub">{nameOf(k, x)}</span>
              <span className="pc-sp" />
              <Tag tone="mute">تجريبي</Tag>
              {admin && <Button type="button" variant="ghost" size="sm" onClick={() => drop(k, x)}>أعده للإنتاج</Button>}
            </li>
          ))}
        </ul>
      ) : <p className="sub cnote">لا سجلات معلّمة تجريبية.</p>}
    </Glass>
  )
}
