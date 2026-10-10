import { Link } from 'react-router-dom'
import { DateText, Icon, icons, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, NOUN, nounAfter } from '@/lib/format'
import {
  REG_DOCS, REG_STATE_SAY, REG_TONE, docRequired, regMissingDocs, type RegRequest,
} from '@/data/mock/registration'

/* A single registration request, treated as a decision.

   Note: this card is not an entity card. The entity doesn't exist yet (rule 2), so there is no link
   to its file, no grant numbers, and no activation status. What exists here is a declaration from
   an outside party, and everything in it can be reversed.

   Three things gate approval, each noted here with its source:
     Rule 4 - all mandatory data and documents before submission
     Rule 8 - license number must not repeat, unless the category differs (rule 9)
     Validity of the board assignment decision and the license - rules 18 and 19, on update

   The required documents change by entity category - three of them are mandatory for commercial
   entities only, so the "required" count itself isn't fixed across cards. This comes from the live
   system, not the spec document. */

export function RegCard({ r }: { r: RegRequest }) {
  const need = REG_DOCS.filter((d) => docRequired(d, r.type))
  const missing = regMissingDocs(r)
  const have = need.length - missing.length

  return (
    <article className="agrq glass">
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.entityRequest(r.id)}>{r.name}</Link>
          <div className="payq-m sub">
            <Mono>{r.id}</Mono>
            <span className="pc-dot" />
            {r.type}
            <span className="pc-dot" />
            {r.region} · {r.city}
          </div>
        </div>

        <div className="payq-amt">
          <b><Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag></b>
          <span className="payq-due sub">
            {r.state === 'draft'
              ? 'لم يُرسل بعد'
              : <>أُرسل <DateText>{r.submittedAt}</DateText></>}
          </span>
        </div>
      </header>

      <div className="payq-cond">
        <span className="lb">الترخيص</span>
        <span><Mono>{r.licenseNo}</Mono> · {r.licensor}</span>
      </div>

      <ul className="payq-ck">
        <li className={missing.length === 0 ? 'ok' : 'no'}>
          <Icon name={missing.length === 0 ? icons.check : icons.alert} size="sm" />
          <span>
            {missing.length === 0
              ? <>ملف المستندات مكتمل · <Num>{have}</Num> من <Num>{need.length}</Num></>
              : <>ينقص <Num>{missing.length}</Num> من <Num>{need.length}</Num> {nounAfter(need.length, NOUN.requiredDoc)} لهذا التصنيف</>}
          </span>
          {/* doc rule 4 */}
        </li>
        <li className={r.governanceClaim > 0 ? 'ok' : 'no'}>
          <Icon name={r.governanceClaim > 0 ? icons.check : icons.alert} size="sm" />
          <span>
            {r.governanceClaim > 0
              ? <>درجة الحوكمة المُقرّة <span className="num">{r.governanceClaim}</span></>
              : 'لم تُجرِ الجهة تقييم حوكمة · وأقرّت بدرجة صفر'}
          </span>
          <span className="payq-r">إقرار الجهة</span>
        </li>
        <li className="ok">
          <Icon name={icons.check} size="sm" />
          <span>تكليف المجلس حتى <DateText>{r.boardEndsAt}</DateText></span>
          {/* doc rule 18 */}
        </li>
      </ul>

      {/* Admin note - required on return-for-revision and rejection - rule 31 */}
      {r.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size="sm" />
          <span>{isolate(r.note)}</span>
        </div>
      )}

      <footer className="payq-f">
        <Person name={r.clerkName} />
        <span className="pc-sp" />
        <Link className="btn btn-2 btn-sm" to={ROUTES.entityRequest(r.id)}>
          افتح الطلب
          <Icon name={icons.chevron} size="sm" />
        </Link>
      </footer>
    </article>
  )
}
