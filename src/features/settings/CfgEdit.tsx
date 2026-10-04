import { useState, type ReactNode } from 'react'
import { Nil, Tag } from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { CFG, isConfigured, persist } from '@/lib/config'
import { nf } from '@/lib/format'

/* Editable settings values · meeting 1 Oct, change item 9: limits and durations change from
   settings without code.

   Two pieces shared by every settings page that holds a rule:
     `CfgNum`        a numeric field sized for a table cell
     `StageLimits`   a stage → limit-in-days table, edited as a draft and saved through the
                     system's action dock, like every other draft in the prototype.

   A stage with no limit (execution, paid, closed) stays «بلا حدّ» and isn't editable: its time
   comes from the record itself, and a zero here would read as "must finish today". */

export function CfgNum({ value, onChange, label, suffix, min = 0 }: {
  value: number
  onChange: (n: number) => void
  label: string
  suffix?: ReactNode
  min?: number
}) {
  return (
    <span className="cfgnum">
      <span className="fld">
        <input
          className="num"
          inputMode="numeric"
          dir="ltr"
          value={Number.isFinite(value) ? nf.format(value) : ''}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^\d]/g, ''))
            onChange(Number.isFinite(n) ? Math.max(min, n) : min)
          }}
          aria-label={label}
        />
      </span>
      {suffix && <span className="sub">{suffix}</span>}
    </span>
  )
}

export interface StageRow {
  key: string
  label: string
  who?: string
  extra?: ReactNode
}

type Limits = Record<string, number>

export function StageLimits({ stages, limits, cfgKey, countAt, unitLabel = 'الطلبات فيها الآن', extraHead }: {
  stages: StageRow[]
  /** Hours per stage · mutated in place on save so every reader sees the new limit */
  limits: Limits
  cfgKey: (typeof CFG)[keyof typeof CFG]
  countAt: (key: string) => number
  unitLabel?: string
  extraHead?: string
}) {
  const days = (h: number) => Math.round(h / 24)
  const base = () => Object.fromEntries(stages.map((s) => [s.key, days(limits[s.key] ?? 0)]))
  const [saved, setSaved] = useState<Record<string, number>>(base)
  const [d, setD] = useState<Record<string, number>>(saved)
  const changed = stages.filter((s) => d[s.key] !== saved[s.key])
  const configured = isConfigured(cfgKey)

  const save = () => {
    for (const s of stages) if ((limits[s.key] ?? 0) > 0) limits[s.key] = d[s.key] * 24
    persist(cfgKey, Object.fromEntries(stages.map((s) => [s.key, limits[s.key] ?? 0])))
    setSaved(d)
  }

  return (
    <>
      <p className="sub cnote">
        {configured
          ? <>عُدّلت هذه المدد من الإعدادات · وتُقرأ في ألوان «متأخر» وقوائم «اليوم» فورًا</>
          : <><Tag tone="warn">افتراضي</Tag> مدد مؤقتة حتى تؤكدها المؤسسة · وتعديلها يغيّر من يُعدّ متأخرًا فورًا</>}
      </p>
      <table className="tbl cfgtbl">
        <thead>
          <tr>
            <th><span className="th-t">المحطة</span></th>
            {extraHead && <th><span className="th-t">{extraHead}</span></th>}
            <th><span className="th-t">المسؤول</span></th>
            <th className="n"><span className="th-t">الحدّ بالأيام</span></th>
            <th className="n"><span className="th-t">{unitLabel}</span></th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => {
            const open = (limits[s.key] ?? 0) > 0
            const n = countAt(s.key)
            return (
              <tr key={s.key}>
                <td>{s.label}</td>
                {extraHead && <td>{s.extra}</td>}
                <td>{s.who || <Nil />}</td>
                <td className="n">
                  {open ? (
                    <CfgNum
                      value={d[s.key]}
                      min={1}
                      onChange={(x) => setD((y) => ({ ...y, [s.key]: x }))}
                      label={`حدّ ${s.label} بالأيام`}
                    />
                  ) : (
                    <span className="sub">بلا حدّ</span>
                  )}
                </td>
                <td className="n">{n > 0 ? <span className="num">{n}</span> : <span className="sub">0</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {changed.length > 0 && (
        <SaveBar
          count={changed.length}
          sentence={<>{changed.length === 1 ? 'مدة معدّلة' : 'مدد معدّلة'}<span className="decsep" /><span className="sub">{changed.map((s) => s.label).join('، ')}</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
        />
      )}
    </>
  )
}
