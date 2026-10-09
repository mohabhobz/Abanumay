import { useState } from 'react'
import { Glass, Head, Select, Switch, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { AI_CFG, AI_TASK_SAY, saveAiCfg, type AiCfg, type AiTask } from '@/lib/ai/provider'

/* «الذكاء الاصطناعي» settings · batch 8 · where the readings come from: local rules (today) or the
   server's AI service, task by task. See `lib/ai/provider.ts` for the contract. */

const TASKS = Object.keys(AI_TASK_SAY) as AiTask[]

export default function AiSettingsPage() {
  const dock = useDockSlot()
  const { role, user } = useRole()
  const admin = role.key === 'admin'
  const [saved, setSaved] = useState<AiCfg>(() => structuredClone(AI_CFG))
  const [d, setD] = useState<AiCfg>(() => structuredClone(AI_CFG))
  const [ping, setPing] = useState('')
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const live = d.mode === 'api' && Boolean(d.endpoint)

  return (
    <AppLayout assistantContext={assistFor.page('الذكاء الاصطناعي')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">الذكاء الاصطناعي</h1>
              <p className="sub mt-1">من أين تأتي القراءات الاسترشادية · قواعد محلية تعمل الآن، وخدمة الخادم حين تُربط · لا قرار يتوقف على أيٍّ منهما</p>
            </div>
            <Tag tone={live ? 'teal' : 'warn'}>{live ? 'مربوط بخدمة الخادم' : 'قواعد محلية'}</Tag>
          </header>

          <Glass>
            <Head title="الخدمة" />
            <div className="apv-row">
              <Select label="الوضع" value={d.mode} options={[{ value: 'rules', label: 'قواعد محلية' }, { value: 'api', label: 'خدمة الخادم' }]} onChange={(v) => admin && setD({ ...d, mode: (v ?? 'rules') as AiCfg['mode'] })} />
              <span className="fld"><input dir="ltr" value={d.endpoint} disabled={!admin} onChange={(e) => setD({ ...d, endpoint: e.target.value })} aria-label="عنوان خدمة الذكاء الاصطناعي" placeholder="https://api…/ai" /></span>
              <button type="button" className="btn btn-2 btn-sm" disabled={!d.endpoint} onClick={() => {
                setPing('جارٍ الاختبار…')
                fetch(d.endpoint, { method: 'HEAD' }).then((r) => setPing(r.ok ? 'الخدمة تستجيب' : `ردّت الخدمة بالرمز ${r.status}`)).catch(() => setPing('تعذّر الوصول إلى الخدمة'))
              }}>اختبر الاتصال</button>
              {ping && <span className="sub">{ping}</span>}
            </div>
            <p className="sub cnote">العقد مع الخادم: طلب <bdi className="num">POST {'{العنوان}/{المهمة}'}</bdi> بالبيانات، ويعود بنص القراءة · إن لم تستجب الخدمة تُعرض قراءة القواعد مع تنبيه.</p>
          </Glass>

          <Glass>
            <Head title="المهام" meta={<span className="sub">كل مهمة تُربط وحدها</span>} />
            {TASKS.map((t) => (
              <Switch
                key={t}
                label={AI_TASK_SAY[t].title}
                disabled={!admin}
                note={<>{AI_TASK_SAY[t].where} · الآن: {live && d.tasks[t] ? 'من النموذج' : AI_TASK_SAY[t].local}</>}
                on={d.tasks[t]}
                onChange={(v) => setD({ ...d, tasks: { ...d.tasks, [t]: v } })}
              />
            ))}
          </Glass>

          {admin && dirty && (
            <SaveBar
              count={1}
              sentence={<>إعدادات الذكاء الاصطناعي<span className="decsep" /><span className="sub">تسري على القراءات فور الحفظ</span></>}
              onSave={() => { saveAiCfg(d, user.name); setSaved(structuredClone(d)) }}
              onDiscard={() => setD(structuredClone(saved))}
            />
          )}
        </div>
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}
