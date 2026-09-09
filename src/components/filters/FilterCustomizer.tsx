import { useState } from 'react'
import { Icon, icons } from '@/components/ui'

export interface FilterDef {
  key: string
  label: string
}

/**
 * لوحة تخصيص الفلاتر.
 *
 * الترتيب بالسحب **ومعاه سهمان**. السحب لوحده بيقفل الميزة على اللي
 * معاه ماوس؛ السهام بتخلّيها تشتغل بالكيبورد وباللمس. الاتنين
 * بيعدّلوا نفس القائمة، فمفيش سلوكان.
 *
 * والفلتر المخفي وقيمته مفعّلة مش مشكلة: صف الشرائح تحت اللوحة
 * بيعرض **كل** قيمة شغّالة، مخفي فلترها أو لا، وبتتشال منه بضغطة.
 * فالقيمة مستحيل تفلتر من ورا المستخدم.
 */
export function FilterCustomizer({
  all, visible, onChange, onClose,
}: {
  all: FilterDef[]
  visible: string[]
  onChange: (keys: string[]) => void
  onClose: () => void
}) {
  const [drag, setDrag] = useState<string | null>(null)

  const shown = visible
    .map((k) => all.find((f) => f.key === k))
    .filter((f): f is FilterDef => Boolean(f))
  const hidden = all.filter((f) => !visible.includes(f.key))

  const move = (key: string, by: number) => {
    const i = visible.indexOf(key)
    const j = i + by
    if (i < 0 || j < 0 || j >= visible.length) return
    const next = [...visible]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const dropOn = (target: string) => {
    if (!drag || drag === target) return
    const next = visible.filter((k) => k !== drag)
    next.splice(next.indexOf(target), 0, drag)
    onChange(next)
    setDrag(null)
  }

  return (
    <div className="fcust">
      <div className="fcust-h">
        <span className="fcust-t">الفلاتر الظاهرة وترتيبها</span>
        <span className="sub">
          <span className="num">{shown.length}</span> من{' '}
          <span className="num">{all.length}</span>
        </span>
        <span className="ftool-sp" />
        <button className="fclear" onClick={() => onChange(all.map((f) => f.key))}>
          أعِد الافتراضي
        </button>
        <button className="btn btn-2 btn-sm" onClick={onClose}>تمّ</button>
      </div>

      <ul className="fcust-l">
        {shown.map((f, i) => (
          <li
            key={f.key}
            className={`fcust-r${drag === f.key ? ' dragging' : ''}`}
            draggable
            onDragStart={() => setDrag(f.key)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(f.key)}
          >
            <span className="fcust-g" aria-hidden="true"><Icon path={icons.grip} size={14} /></span>

            <button
              className="fcust-c on"
              aria-pressed="true"
              aria-label={`إخفاء ${f.label}`}
              onClick={() => onChange(visible.filter((k) => k !== f.key))}
            >
              <Icon path={icons.check} size={11} />
            </button>

            <span className="fcust-n">{f.label}</span>

            <span className="fcust-a">
              <button
                aria-label={`تحريك ${f.label} لأعلى`}
                disabled={i === 0}
                onClick={() => move(f.key, -1)}
              >
                <Icon path={icons.chevronUp} size={13} />
              </button>
              <button
                aria-label={`تحريك ${f.label} لأسفل`}
                disabled={i === shown.length - 1}
                onClick={() => move(f.key, 1)}
              >
                <Icon path={icons.chevronDown} size={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {hidden.length > 0 && (
        <>
          <div className="fcust-s sub">مخفية</div>
          <ul className="fcust-l wide">
            {hidden.map((f) => (
              <li key={f.key} className="fcust-r off">
                <span className="fcust-g" aria-hidden="true" />
                <button
                  className="fcust-c"
                  aria-pressed="false"
                  aria-label={`إظهار ${f.label}`}
                  onClick={() => onChange([...visible, f.key])}
                />
                <span className="fcust-n">{f.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
