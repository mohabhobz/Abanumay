import { MISSING_ITEM, NOUN, nounAfter } from '@/lib/format'
import { ButtonLink, Button, DateText, Empty, Glass, Head, Icon, KV, Money, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import {
  CLOSE_DOCS, CLOSE_TONE, canOpenClose, closeCycle, closeRequirements, closeStageLabel,
  closeStageWho, evalApproved, needsComms, reportApproved, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'
import { projectById } from '@/data/mock/projects'

/* Close tab on the project page.

   The tab answers "where does closing this project stand," while the panel
   answers "what's currently pending on it" — the same split as the agreement
   and plan tabs.

   An empty tab states why it's empty. Closing can only start once the
   duration has ended or activities are complete, and payments are settled.
   A project with no close process open either is still active or has a
   pending payment — that distinction is the whole answer, so it's spelled
   out. An empty tab that doesn't say why reads as "something's missing." */

export interface CloseTabProps {
  row?: CloseRow
  projectId: string
  /** Opens the final report request — empty if the user lacks permission. */
  onOpen?: () => void
}

export function CloseTab({ row: c, projectId, onOpen }: CloseTabProps) {
  /* Client sheet 24 Oct (#27) · a project closed directly has no closing cycle · it says so */
  const direct = projectById(projectId)?.closedDirect
  if (!c && direct) {
    return (
      <Glass>
        <Head title="إغلاق المشروع" meta={<Tag tone="ok">مغلق مباشرة</Tag>} />
        <Empty title={`أُغلق المشروع بإجراء الإغلاق المباشر ${direct.id}.`}
          actions={<ButtonLink variant="2" to={ROUTES.distress(direct.id)}>افتح الإغلاق المباشر</ButtonLink>} />
      </Glass>
    )
  }
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
          /* The fee applies only when eligible — "blocked by rule" is text, not a fee. */
          art={gate.ok ? { done: 3 } : undefined}
          title={gate.ok
            ? 'المشروع مؤهَّل ولم يُفتح له طلب تقرير ختامي بعد.'
            : `لا يمكن بدء الإغلاق الآن · ${gate.why}`}
          actions={gate.ok && onOpen && (
            <Button
              variant="p"
              title="يفتح طلب التقرير الختامي ويرسله إلى الجهة لتعبئته"
              onClick={onOpen}
            >
              <Icon name={icons.plus} size="sm" />
              افتح طلب التقرير الختامي
            </Button>
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
              : <><Num>{c.report.beneficiaries}</Num> <span className="sub">{nounAfter(c.report.beneficiaries, NOUN.beneficiary)}</span></>,
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
            /* Anything not required is stated, not hidden. */
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
            </>,
          },
          ...(closed ? [{
            k: 'تاريخ الإغلاق',
            v: <DateText>{c.closedAt ?? ''}</DateText>,
          }] : []),
        ]}
      />

      {/* This line is closing's effect on the project — closing has no effect while
          it's mid-cycle, and specific conditions determine the three things that
          flip it to "complete." Without this line, the tab would just be a display
          of numbers with no consequence. */}
      {closed ? (
        <p className="ok cnote">
          اعتُمد التقرير والتقييم واكتملت المتطلبات · المشروع «مكتمل».
        </p>
      ) : !req.ok && (
        <p className="sub cnote">{req.say}.</p>
      )}

      <div className="rowf gp-2">
        <ButtonLink to={ROUTES.closing(c.id)} variant="p">
          افتح الإغلاق
          <Icon name={icons.chevron} size="sm" />
        </ButtonLink>
        <ButtonLink to={ROUTES.closings} variant="2">صندوق الإغلاق</ButtonLink>
      </div>
    </Glass>
  )
}
