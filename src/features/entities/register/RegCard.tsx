import { Link } from 'react-router-dom'
import { DateText, Icon, icons, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate } from '@/lib/format'
import {
  REG_DOCS, REG_STATE_SAY, REG_TONE, docRequired, regMissingDocs, type RegRequest,
} from '@/data/mock/registration'

/* ═══════════════════════════════════════════════════════════
   طلب تسجيل واحد، كقرار.

   ⚠️ **الكارت ده مش كارت جهة.** الجهة مالهاش وجود لسه (قاعدة 2)،
   فمفيش رابط لملفها ومفيش أرقام منح ومفيش حالة تفعيل. اللي موجود
   هو **إقرار** من طرف برّه المؤسسة، وكل حاجة فيه بتتراجَع.

   واللي بيوقف الاعتماد تلاتة، وكلهم مكتوبين في الكارت بمصدرهم:
     قاعدة 4 · كل البيانات والمستندات الإلزامية قبل الإرسال
     قاعدة 8 · رقم الترخيص ما يتكررش · إلا لو التصنيف مختلف (9)
     سريان قرار تكليف المجلس والترخيص · قاعدتا 18 و19 في التحديث

   والمستندات المطلوبة **بتتغيّر بتصنيف الجهة** · تلاتة منهم
   إلزاميين للتجارية وحدها، فرقم «المطلوب» نفسه مش ثابت بين
   الكروت. وده من النظام العامل لا من الوثيقة (نوتة ن-3).
   ═══════════════════════════════════════════════════════════ */

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
              ? 'لم تُرسل بعد'
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
          <Icon name={missing.length === 0 ? icons.check : icons.alert} size={13} />
          <span>
            {missing.length === 0
              ? <>ملف المستندات مكتمل · <Num>{have}</Num> من <Num>{need.length}</Num></>
              : <>ناقص <Num>{missing.length}</Num> من <Num>{need.length}</Num> إلزاميًا للتصنيف ده</>}
          </span>
          <span className="payq-r">قاعدة <Num>4</Num></span>
        </li>
        <li className={r.governanceClaim > 0 ? 'ok' : 'no'}>
          <Icon name={r.governanceClaim > 0 ? icons.check : icons.alert} size={13} />
          <span>
            {r.governanceClaim > 0
              ? <>درجة الحوكمة المُقرّة <span className="num">{r.governanceClaim}</span></>
              : 'لم تُجرَ تقييم حوكمة · أُقرّت بصفر'}
          </span>
          <span className="payq-r">إقرار الجهة</span>
        </li>
        <li className="ok">
          <Icon name={icons.check} size={13} />
          <span>تكليف المجلس حتى <DateText>{r.boardEndsAt}</DateText></span>
          <span className="payq-r">قاعدة <Num>18</Num></span>
        </li>
      </ul>

      {/* الملاحظة الإدارية · إلزامية مع الإعادة والرفض · قاعدة 31 */}
      {r.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{isolate(r.note)}</span>
        </div>
      )}

      <footer className="payq-f">
        <Person name={r.clerkName} />
        <span className="pc-sp" />
        <Link className="btn btn-2 btn-sm" to={ROUTES.entityRequest(r.id)}>
          افتح الطلب
          <Icon name={icons.chevron} size={14} />
        </Link>
      </footer>
    </article>
  )
}
