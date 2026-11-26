/* 26 Nov · audit #61 · the two empty pages of the system, said one way everywhere.

   · `NotFound` · a record that isn't there (a wrong number, an old link, a removed record, or one
     this role can't open) · the path names what was asked for (never «…»), the card says what
     happened, why it can happen, and the ways on: back to the module's list, search the list for
     that number, or back to where the person came from
   · `ModuleEmpty` · a module with nothing in it for this person at all · its rail icon, what will
     appear here and when · the page shows it **instead of** its tabs, filters, quick read and table
     (`.screen.is-void` hides them), since filters over nothing are noise
   · `ModuleEmpty filtered` · data exists but the filters hide all of it · the same card with
     «مسح الفلاتر»

   Every module reads its icon from the rail (`NAV` in routes.ts), so the empty page carries the
   same mark the person clicked to get there. */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { Crumbs } from '@/components/shell'
import { Button, Glass, Icon, icons } from '@/components/ui'

type IconKey = keyof typeof icons

export type ModuleKey =
  | 'projects' | 'portfolio' | 'subproject' | 'entities' | 'requests' | 'updates' | 'archive' | 'partners'
  | 'budget' | 'budgetOps' | 'agreements' | 'plans' | 'payments' | 'closings' | 'cases'
  | 'approvals' | 'sessions' | 'brief' | 'reports' | 'audit' | 'notify'

interface ModuleSay {
  icon: IconKey
  /** The record's name in «لم نجد …» */
  one: string
  /** The list's name and address */
  list: string
  to: string
  /** The empty module · title and what will appear here */
  none: string
  when: string
}

export const MODULE_SAY: Record<ModuleKey, ModuleSay> = {
  projects: { icon: 'navProjects', one: 'المشروع', list: 'المشاريع', to: ROUTES.projects, none: 'لا مشاريع في نطاقك بعد', when: 'تظهر هنا المشاريع حين تصل من الجهات في دورة الاستقبال أو تُسند إليك.' },
  portfolio: { icon: 'navProjects', one: 'المحفظة', list: 'المشاريع', to: ROUTES.projects, none: 'لا محافظ بعد', when: 'تظهر المحافظ الخيرية هنا حين يُنشئها مدير المنح لشريك.' },
  subproject: { icon: 'navProjects', one: 'المشروع الفرعي', list: 'المشاريع', to: ROUTES.projects, none: 'لا مشاريع فرعية بعد', when: 'يرفعها الشريك من محفظته.' },
  entities: { icon: 'entity', one: 'الجهة', list: 'الجهات', to: ROUTES.entities, none: 'لا جهات مسجّلة بعد', when: 'تظهر الجهات هنا بعد اعتماد طلبات تسجيلها.' },
  requests: { icon: 'entity', one: 'طلب التسجيل', list: 'طلبات التسجيل', to: ROUTES.entityRequests, none: 'لا طلبات تسجيل', when: 'تصل الطلبات هنا حين تسجّل جهة جديدة من صفحة الدخول.' },
  updates: { icon: 'entity', one: 'طلب التحديث', list: 'طلبات التحديث', to: ROUTES.entityUpdates, none: 'لا طلبات تحديث', when: 'تصل هنا حين تطلب جهة تعديل بيانات تحتاج اعتمادًا.' },
  archive: { icon: 'entity', one: 'الجهة', list: 'الأرشيف', to: ROUTES.entityArchive, none: 'الأرشيف فارغ', when: 'تُنقل الجهات هنا حين تُؤرشف من ملفها.' },
  partners: { icon: 'entity', one: 'الشريك', list: 'الجهات', to: ROUTES.entities, none: 'لا شركاء بعد', when: 'يظهر الشركاء الاستراتيجيون هنا بعد اعتمادهم.' },
  budget: { icon: 'budget', one: 'الميزانية', list: 'الميزانية', to: ROUTES.budget, none: 'لا ميزانيات بعد', when: 'تظهر الميزانيات هنا بعد إعدادها واعتمادها.' },
  budgetOps: { icon: 'budget', one: 'طلب عملية الميزانية', list: 'طلبات العمليات', to: ROUTES.budgetOps, none: 'لا طلبات عمليات', when: 'تظهر هنا طلبات التعزيز والمناقلة حين تُرفع.' },
  agreements: { icon: 'contract', one: 'الاتفاقية', list: 'الاتفاقيات', to: ROUTES.agreements, none: 'لا اتفاقيات في نطاقك بعد', when: 'تُنشأ الاتفاقية بعد اعتماد المشروع، وتظهر هنا.' },
  plans: { icon: 'navPlans', one: 'الخطة', list: 'الخطط', to: ROUTES.plans, none: 'لا خطط في نطاقك بعد', when: 'تُولَّد خطة المشروع من تبويب «الخطة» بعد اعتماده، وتظهر هنا.' },
  payments: { icon: 'pay', one: 'سجل الصرف', list: 'الصرف', to: ROUTES.payments, none: 'لا طلبات صرف في نطاقك بعد', when: 'تظهر الدفعات هنا حين تُفتح جداولها بعد تفعيل الاتفاقية.' },
  closings: { icon: 'navClosings', one: 'طلب الإغلاق', list: 'الإغلاق', to: ROUTES.closings, none: 'لا طلبات إغلاق في نطاقك بعد', when: 'يُفتح الإغلاق بعد اكتمال صرف دفعات المشروع، ويظهر هنا.' },
  cases: { icon: 'alert', one: 'حالة التعثر', list: 'حالات التعثر', to: ROUTES.distresses, none: 'لا حالات تعثر', when: 'تظهر هنا المشاريع التي تُعلن متعثرة.' },
  approvals: { icon: 'shield', one: 'المشروع', list: 'الاعتمادات', to: ROUTES.committee, none: 'لا مشاريع بانتظار العرض', when: 'تصل المشاريع هنا بعد إحالتها إليك من المحطة السابقة.' },
  sessions: { icon: 'date', one: 'الجلسة', list: 'الاعتمادات', to: ROUTES.committee, none: 'لا جلسات بعد', when: 'تظهر الجلسات هنا حين تُجدول.' },
  brief: { icon: 'doc', one: 'ملف العرض', list: 'المشاريع', to: ROUTES.projects, none: 'لا ملفات عرض', when: 'يُنشأ ملف العرض عند إحالة المشروع.' },
  reports: { icon: 'chart', one: 'التقرير', list: 'التقارير', to: ROUTES.reports, none: 'لا تقارير بعد', when: 'تظهر التقارير هنا حين تتوفر بياناتها.' },
  audit: { icon: 'doc', one: 'السجل', list: 'سجل التدقيق', to: ROUTES.reports, none: 'لا حركات مسجّلة بعد', when: 'يُسجَّل هنا كل إجراء يُتخذ في النظام.' },
  notify: { icon: 'bell', one: 'الإشعار', list: 'الإشعارات', to: ROUTES.home, none: 'لا إشعارات بعد', when: 'تظهر هنا الإشعارات المرسلة.' },
}

/** The module's poster card · its icon, a title, a line, and its ways on */
function Poster({ icon, title, note, children, bare }: { icon: IconKey; title: ReactNode; note?: ReactNode; children?: ReactNode; bare?: boolean }) {
  const Box = bare ? 'div' : Glass
  return (
    <Box className={`mempty${bare ? ' mempty-bare' : ''}`}>
      <span className="mempty-ic" aria-hidden="true"><Icon name={icons[icon]} /></span>
      <h2 className="mempty-t">{title}</h2>
      {note && <div className="mempty-p">{note}</div>}
      {children && <div className="mempty-a">{children}</div>}
    </Box>
  )
}

/** A module with nothing in it · or, with `filtered`, filters that hide everything */
export function ModuleEmpty({ module, filtered, onClear, title, note, actions, bare }: {
  module: ModuleKey
  /** Inside a card that's already there · no card of its own */
  bare?: boolean
  filtered?: boolean
  onClear?: () => void
  title?: ReactNode
  note?: ReactNode
  actions?: ReactNode
}) {
  const m = MODULE_SAY[module]
  if (filtered) {
    return (
      <Poster bare={bare} icon="search" title={title ?? 'لا نتائج بهذه الفلاتر'} note={note ?? `لا يطابق البحث أو الفلاتر الحالية أيًّا من ${m.list}. جرّب كلمة أخرى أو امسح الفلاتر.`}>
        {actions}
        {onClear && <Button variant="2" onClick={onClear}>مسح الفلاتر</Button>}
      </Poster>
    )
  }
  return <Poster bare={bare} icon={m.icon} title={title ?? m.none} note={note ?? m.when}>{actions}</Poster>
}

/** A record that isn't there · the whole page, inside the shell */
export function NotFound({ module, id, back }: { module: ModuleKey; id?: string; back?: { label: string; to: string } }) {
  const navigate = useNavigate()
  const m = MODULE_SAY[module]
  const list = back ?? { label: m.list, to: m.to }
  const canBack = typeof window !== 'undefined' && window.history.length > 1
  return (
    <AppLayout assistantContext={assistFor.page(`${m.one} غير موجود`)}>
      <div className="viewstack">
        <div className="screen col">
          <Crumbs items={[{ label: list.label, to: list.to }, { label: id ? `${m.one} ${id}` : m.one }]} />
          <Poster
            icon={m.icon}
            title={id ? <>لم نجد {m.one} <bdi className="num">{id}</bdi></> : `لم نجد ${m.one} المطلوب`}
            note={
              <>
                <p>الرابط الذي فتحته لا يقود إلى سجل قائم. يحدث هذا حين:</p>
                <ul>
                  <li>يكون الرقم مكتوبًا بخطأ أو الرابط قديمًا</li>
                  <li>يُحذف السجل أو يُدمج في سجل آخر</li>
                  <li>يكون السجل خارج نطاق دورك</li>
                </ul>
              </>
            }
          >
            <Button variant="p" onClick={() => navigate(list.to)}>
              <Icon name={icons[m.icon]} size="sm" />
              {`ارجع إلى ${list.label}`}
            </Button>
            {id && list.to === m.to && (
              <Button variant="2" onClick={() => navigate(`${m.to}?q=${encodeURIComponent(id)}`)}>
                <Icon name={icons.search} size="sm" />
                ابحث عن «{id}»
              </Button>
            )}
            {canBack && <Button variant="ghost" onClick={() => navigate(-1)}>رجوع للصفحة السابقة</Button>}
          </Poster>
        </div>
      </div>
    </AppLayout>
  )
}

/* What doesn't narrow a list · the view, the order, the columns, the paging */
const QUIET = new Set(['view', 'ord', 'cols', 'group', 'size', 'page', 'as', 'from', 'tab'])
/** A list with nothing in it at all, for this person · `n` is its unfiltered count, and no filter or
    search is set in the address · then the page shows `ModuleEmpty` and hides its filters */
export const isVoid = (n: number): boolean =>
  voidPreview() || (n === 0 && ![...new URLSearchParams(window.location.search).keys()].some((k) => !QUIET.has(k)))
/** Review only · `localStorage['ab-void-preview'] = '1'` shows every list as empty, to look at it */
const voidPreview = () => { try { return localStorage.getItem('ab-void-preview') === '1' } catch { return false } }
