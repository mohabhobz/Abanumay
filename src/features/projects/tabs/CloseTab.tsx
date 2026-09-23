import { Link } from 'react-router-dom'
import { MISSING_ITEM, nounAfter } from '@/lib/format'
import { DateText, Empty, Glass, Head, Icon, KV, Money, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import {
  CLOSE_DOCS, CLOSE_TONE, canOpenClose, closeCycle, closeRequirements, closeStageLabel,
  closeStageWho, evalApproved, needsComms, reportApproved, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   تاب الإغلاق في صفحة المشروع · BPD-011

   ⚠️ **التاب بيجاوب «فين إغلاق المشروع ده» · الصندوق بيجاوب «إيه
   اللي واقف عندي».** نفس منطق تاب الاتفاقية والخطة بالحرف.

   ⚠️ **والتاب الفاضي بيقول ليه هو فاضي.** قاعدة 1 و2 بيحدّدوا
   إمتى الإغلاق يقدر يبدأ: المدة خلصت أو الأنشطة اكتملت، **و**
   الدفعات اتسوّت. فمشروع ما اتفتحش له إغلاق إما إنه لسه شغّال،
   وإما إن عليه دفعة معلّقة · والفرق ده هو كل الإجابة، فمكتوب.
   والتاب الفاضي اللي ما بيقولش سببه بيتقري «فيه حاجة ناقصة».
   ═══════════════════════════════════════════════════════════ */

export interface CloseTabProps {
  row?: CloseRow
  projectId: string
  /** يفتح طلب التقرير الختامي · فاضي لو المستخدم مالوش الصلاحية */
  onOpen?: () => void
}

export function CloseTab({ row: c, projectId, onOpen }: CloseTabProps) {
  if (!c) {
    const gate = canOpenClose(projectId)
    return (
      <Glass>
        <Head
          title="إغلاق المشروع"
          meta={gate.ok
            ? <Tag tone="ok">مؤهَّل للإغلاق</Tag>
            : <Tag tone="mute">غير مؤهَّل بعد</Tag>}
        />
        <Empty
          title={gate.ok
            ? 'المشروع مؤهَّل ولم يُفتح له طلب تقرير ختامي بعد.'
            : `لا يمكن بدء الإغلاق الآن · ${gate.why}`}
          note={gate.ok
            ? 'يفتح مشرف المنح الطلب، فيصل إلى الجهة المستفيدة لتعبئة التقرير الختامي · ثم يمرّ بدورتي اعتماد مستقلتين: التقرير الختامي ثم تقييم المشروع (القاعدة 17).'
            : 'القاعدة 1 تشترط انتهاء مدة التنفيذ أو اكتمال الأنشطة، والقاعدة 2 تشترط استكمال جميع الدفعات المستحقة أو تسوية الالتزامات · والشرطان معًا لا أحدهما.'}
          actions={gate.ok && onOpen && (
            <button
              className="btn btn-p"
              title="يفتح طلب التقرير الختامي ويرسله إلى الجهة لتعبئته"
              onClick={onOpen}
            >
              <Icon name={icons.plus} size="sm" />
              افتح طلب التقرير الختامي
            </button>
          )}
        />
      </Glass>
    )
  }

  const missing = reportBlockers(c)
  const req = closeRequirements(c)
  const done = reportApproved(c)
  const closed = evalApproved(c)
  const cycle = closeCycle(c)

  return (
    <Glass>
      <Head
        title="إغلاق المشروع"
        meta={<Tag tone={CLOSE_TONE[c.stage]}>{closeStageLabel(c.stage)}</Tag>}
      />

      <KV
        rows={[
          {
            k: 'الدورة الحالية',
            v: <>
              {cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}
              <span className="sub"> · دورة {cycle === 'report' ? 1 : 2} من 2</span>
            </>,
          },
          {
            k: 'المسؤول الآن',
            v: closeStageWho(c.stage)
              ? closeStageWho(c.stage)
              : <span className="sub">اكتمل</span>,
          },
          {
            k: 'المستفيدون الفعليون',
            v: c.report.beneficiaries === null
              ? <span className="sub">لم يُسجَّل بعد</span>
              : <><Num>{c.report.beneficiaries}</Num> <span className="sub">مستفيد</span></>,
          },
          {
            k: 'الميزانية الفعلية',
            v: c.report.budget === null
              ? <span className="sub">لم تُسجَّل بعد</span>
              : <Money sm>{c.report.budget}</Money>,
          },
          {
            k: 'المستندات الداعمة',
            v: <>
              <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
              {missing.length > 0 && (
                <span className="bad"> · <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</span>
              )}
            </>,
          },
          {
            k: 'النشر الإعلامي',
            /* قاعدة 9 · واللي مش مطلوب بيتقال لا بيتشال */
            v: needsComms(c)
              ? (done
                ? <Tag tone="ok">اعتمده الاتصال المؤسسي</Tag>
                : <Tag tone="mute">يحتاج مراجعة الاتصال المؤسسي</Tag>)
              : <span className="sub">لا ينطبق · لا التزام بالنشر</span>,
          },
          {
            k: 'الإصدارات',
            v: <>
              <Num>{c.versions.length}</Num> للتقرير ·{' '}
              <Num>{c.evalVersions.length}</Num> للتقييم
              <span className="sub"> · سجلّان منفصلان</span>
            </>,
          },
          ...(closed ? [{
            k: 'تاريخ الإغلاق',
            v: <DateText>{c.closedAt ?? ''}</DateText>,
          }] : []),
        ]}
      />

      {/* ⚠️ **الجملة دي هي أثر الإغلاق على المشروع** · قاعدة 16
          بتمنع أي أثر أثناء الدورة، وقاعدة 8 و18 بيحدّدوا التلاتة
          اللي بيحوّلوه «مكتمل». ومن غيرها التاب بيبقى عرضًا لأرقام
          مالهاش نتيجة. */}
      {closed ? (
        <p className="ok cnote">
          اعتُمد التقرير والتقييم واكتملت المتطلبات · المشروع «مكتمل»، وأي
          تعديل بعد ذلك يحتاج إجراءً جديدًا (القاعدة <span className="num">21</span>).
        </p>
      ) : (
        <p className="sub cnote">
          محطة الإغلاق لا تغيّر حالة المشروع · يبقى «تحت التنفيذ» حتى تكتمل
          الثلاثة: اعتماد التقرير الختامي، واعتماد التقييم، واستكمال
          المتطلبات المالية والإدارية (القاعدة <span className="num">8</span> و
          <span className="num">18</span>).
          {!req.ok && <> والوضع الآن: {req.say}.</>}
        </p>
      )}

      <div className="rowf gp-2">
        <Link to={ROUTES.closing(c.id)} className="btn btn-p">
          افتح الإغلاق
          <Icon name={icons.chevron} size="sm" />
        </Link>
        <Link to={ROUTES.closings} className="btn btn-2">صندوق الإغلاق</Link>
      </div>
    </Glass>
  )
}
