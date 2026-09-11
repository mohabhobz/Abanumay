import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { nf } from '@/lib/format'
import { highlight } from './highlight'
import type { Reading } from './reading'

export interface ReadingBlockProps {
  reading: Reading
  /** بيتكتب دلوقتي · بيعرض النص مقصوصًا ومعاه المؤشر */
  typing: boolean
  chars: number
  /** لسه ما وصلش دوره في الكتابة */
  hidden: boolean
}

/**
 * قراءة واحدة.
 *
 * الكومبوننت ده هو **الراسم الوحيد للقراءة في السيستم**: الشريط
 * المختصر فوق القوائم، وكارت السياق الكامل، وتحليلات المشروع · كلهم
 * بيستدعوه. قبل كده كانت تحليلات المشروع بترسم بلوكاتها بإيدها،
 * فكانت نفس المعلومة (تجاوز مدة الإجراء) بتتكتب مرتين بشكلين
 * مختلفين في نفس الصفحة.
 */
export function ReadingBlock({ reading: r, typing, chars, hidden }: ReadingBlockProps) {
  if (hidden) return null
  const body = typing ? r.text.slice(0, chars) : highlight(r.text, r.bold, r.danger)

  return (
    <div className={`qr-item${r.kind === 'flag' ? ' flag' : ''}${typing ? ' typing' : ''}`}>
      {r.label && (
        <div className="qr-lbl">
          <span className={`itag${r.kind === 'flag' ? ' no' : ''}`}>{r.label}</span>
        </div>
      )}

      {/* الرقم في أول السطر لا فوقه: الرقم الضخم كان بياخد وزنًا
          أكبر من الجملة نفسها، والصفحة كانت بتمتلي أرقامًا حمرا. */}
      <div className="qr-tx">
        {r.metric && (
          <>
            <b className="qr-lead num">{r.metric.value}</b>
            <span className="qr-unit">{r.metric.unit}</span>
            {'، '}
          </>
        )}
        {body}
        {typing && <span className="caret" />}
      </div>

      {!typing && (
        <div className="rise">
          {r.bar && (
            <>
              {/* فوق الحدّ: الشريط بيمتلئ ومعاه علامة عند الحدّ نفسه.
                  من غيرها الشريط الممتلئ بيتقري «تمام» بينما هو
                  بالظبط اللي بيقول «عدّى». */}
              <div className={`bar${r.bar.value > r.bar.limit ? ' over' : ''}`}>
                <i
                  style={{
                    width: `${Math.min(100, (r.bar.value / r.bar.limit) * 100)}%`,
                    background:
                      r.bar.value > r.bar.limit
                        ? undefined
                        : 'linear-gradient(90deg,var(--teal),var(--lime))',
                  }}
                />
                {r.bar.value > r.bar.limit && (
                  <u style={{ insetInlineStart: `${Math.round((r.bar.limit / r.bar.value) * 100)}%` }} />
                )}
              </div>
              <div className="qr-barl">
                <span className="sub">
                  {r.bar.limitLabel} <span className="num">{nf.format(r.bar.limit)}</span>
                  {r.bar.unit && ` ${r.bar.unit}`}
                </span>
                <span className="sub">
                  {r.bar.valueLabel} <span className="num">{nf.format(r.bar.value)}</span>
                  {r.bar.unit && ` ${r.bar.unit}`}
                </span>
              </div>
            </>
          )}

          {r.src && <div className="src">المصدر: {r.src}</div>}

          {(r.to || r.actions) && (
            <div className="qr-acts">
              {r.to && (
                <Link className="btn btn-2 btn-sm" to={r.to}>
                  {r.toLabel ?? 'اعرضها'}
                  <Icon name={icons.chevron} size={14} />
                </Link>
              )}
              {r.actions?.map((a) => (
                <button key={a.label} className={`btn ${a.kind ?? 'btn-2'} btn-sm`} onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** لمحة سطر واحد لأهمّ قراءة · بتتعرض والكارت مقفول */
export function ReadingPeek({ reading: r }: { reading: Reading }) {
  return (
    <div className="qr-peek">
      {r.metric && (
        <b className={r.kind === 'flag' ? 'bad' : undefined}>{r.metric.value}</b>
      )}
      <span className="trim1">
        {r.metric ? `${r.metric.unit}، ` : ''}
        {r.text}
      </span>
    </div>
  )
}
