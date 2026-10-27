import { useState } from 'react'
import { Glass, Head, Select, Switch, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { AI_CFG, AI_TASK_SAY, saveAiCfg, type AiCfg, type AiTask } from '@/lib/ai/provider'
import { TEXT_RULES, saveTextRules, type TextRules } from '@/lib/textRules'
import { logSettings } from '@/data/shared/settingsLog'

/* «الذكاء الاصطناعي» settings · batch 8 · where the readings come from: local rules (today) or the
   server's AI service, task by task. See `lib/ai/provider.ts` for the contract. */

const TASKS = Object.keys(AI_TASK_SAY) as AiTask[]

/* 18 Oct · 2.6.3 · 8.5.3 · 8.5.4 · the lists behind the text checks · one entry per line */
const LISTS: { k: keyof TextRules; t: string; n: string }[] = [
  { k: 'spell', t: 'تصحيحات إملائية إضافية', n: 'سطر لكل تصحيح · الخطأ=الصواب' },
  { k: 'mandatory', t: 'بنود إلزامية في الاتفاقية', n: 'موضوع لكل سطر' },
  { k: 'forbidden', t: 'صياغات غير معتمدة', n: 'عبارة لكل سطر' },
]

export default function AiSettingsPage() {
  const dock = useDockSlot()
  const { role, user } = useRole()
  const admin = role.key === 'admin'
  const [saved, setSaved] = useState<AiCfg>(() => structuredClone(AI_CFG))
  const [d, setD] = useState<AiCfg>(() => structuredClone(AI_CFG))
  const [ping, setPing] = useState('')
  const [tSaved, setTSaved] = useState<TextRules>(() => structuredClone(TEXT_RULES))
  const [t, setT] = useState<TextRules>(() => structuredClone(TEXT_RULES))
  const tDirty = JSON.stringify(t) !== JSON.stringify(tSaved)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved) || tDirty
  const live = d.mode === 'api' && Boolean(d.endpoint)

  return (
    <AppLayout assistantContext={assistFor.page('الذكاء الاصطناعي')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">الذكاء الاصطناعي</h1>
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
          </Glass>

          <Glass>
            <Head title="خدمة التعرف الضوئي (OCR)" />
            <div className="apv-row">
              <span className="fld"><input dir="ltr" value={d.ocrEndpoint ?? ''} disabled={!admin} onChange={(e) => setD({ ...d, ocrEndpoint: e.target.value })} aria-label="عنوان خدمة التعرف الضوئي" placeholder="https://api…/ocr" /></span>
              {d.ocrEndpoint ? <Tag tone="teal">مربوطة</Tag> : <Tag tone="warn">غير مربوطة</Tag>}
            </div>
          </Glass>

          <Glass>
            <Head title="المهام" />
            {TASKS.map((t) => (
              <Switch
                key={t}
                label={AI_TASK_SAY[t].title}
                disabled={!admin}
                note={<>الآن: {live && d.tasks[t] ? 'من النموذج' : AI_TASK_SAY[t].local}</>}
                on={d.tasks[t]}
                onChange={(v) => setD({ ...d, tasks: { ...d.tasks, [t]: v } })}
              />
            ))}
          </Glass>

          <Glass>
            <Head title="قواعد النصوص" />
            {LISTS.map((x, i) => (
              <label key={x.k} className={`regf regf-w${i ? ' mt-3' : ''}`}>
                <span className="lb">{x.t}</span>
                <span className="fld fld-a">
                  <textarea rows={4} value={t[x.k].join('\n')} disabled={!admin} aria-label={x.t} placeholder={x.n}
                    onChange={(e) => setT({ ...t, [x.k]: e.target.value.split('\n') })} />
                </span>
              </label>
            ))}
          </Glass>

          {admin && dirty && (
            <SaveBar
              count={1}
              sentence="إعدادات الذكاء الاصطناعي"
              onSave={() => {
                saveAiCfg(d, user.name); setSaved(structuredClone(d))
                if (tDirty) {
                  const before = structuredClone(TEXT_RULES)
                  saveTextRules(t)
                  logSettings('الذكاء الاصطناعي', '/settings/ai', user.name, LISTS.filter((x) => before[x.k].join('|') !== TEXT_RULES[x.k].join('|')).map((x) => ({ k: x.t, from: `${before[x.k].length} عنصر`, to: `${TEXT_RULES[x.k].length} عنصر` })))
                  setT(structuredClone(TEXT_RULES)); setTSaved(structuredClone(TEXT_RULES))
                }
              }}
              onDiscard={() => { setD(structuredClone(saved)); setT(structuredClone(tSaved)) }}
            />
          )}
        </div>
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}
