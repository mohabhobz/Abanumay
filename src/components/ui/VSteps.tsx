import type { Gate } from '@/types/domain'

/** نسخة رأسية من مؤشر البوابات، بتتقرا كسُلّم اعتماد */
export function VSteps({ gates }: { gates: Gate[] }) {
  return (
    <div className="stepv">
      {gates.map((g, i) => (
        <div key={i} className={`s ${g.state}`}>
          <div>
            <div className="n2">{g.role}</div>
            <div className="k">{g.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
