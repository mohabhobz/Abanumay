import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import ProjectPage from '@/features/projects/ProjectPage'
import HomePage from '@/features/home/HomePage'
import ProjectsListPage from '@/features/projects/list/ProjectsListPage'
import EntitiesListPage from '@/features/entities/EntitiesListPage'
import EntityPage from '@/features/entities/EntityPage'
import AssistantPage from '@/features/assistant/AssistantPage'
import ReportsPage from '@/features/reports/ReportsPage'
import ProcessReport from '@/features/reports/ProcessReport'
import ReportView from '@/features/reports/ReportView'
import LiveReport from '@/features/reports/LiveReport'
import BudgetPage from '@/features/budget/BudgetPage'
import PaymentsPage from '@/features/payments/PaymentsPage'
import RequestPage from '@/features/payments/RequestPage'
import RequestForm from '@/features/payments/RequestForm'
import OrderPage from '@/features/payments/OrderPage'
import LatePage from '@/features/payments/LatePage'
import { ModulePlaceholder } from '@/features/shared/ModulePlaceholder'
import { AFTER_LOGIN, DEFAULT_PROJECT_TAB, ROUTES } from './routes'
import { RequireAuth } from './RequireAuth'

/**
 * خريطة الشاشات.
 *
 * كل موديول له مسار حتى لو لسه ما اتبناش، عشان التنقّل يشتغل كامل
 * والفجوة تبان: الشاشة الفاضية بتقول إيه اللي هيقع فيها وبأي أرقام.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />

        {/* بوّابة واحدة على كل الشاشات الداخلية بدل تكرارها على كل
            مسار: أي شاشة جديدة بتتحمي تلقائيًا لمجرد إنها جوّه. */}
        <Route
          element={
            <RequireAuth>
              <Outlet />
            </RequireAuth>
          }
        >
        <Route path={ROUTES.home} element={<HomePage />} />

        <Route path={ROUTES.projects} element={<ProjectsListPage />} />

        <Route path={`${ROUTES.projects}/:id`} element={<ProjectPage />} />
        <Route path={`${ROUTES.projects}/:id/:tab`} element={<ProjectPage />} />

        <Route path={ROUTES.entities} element={<EntitiesListPage />} />
        <Route path={`${ROUTES.entities}/:id`} element={<EntityPage />} />
        <Route path={`${ROUTES.entities}/:id/:tab`} element={<EntityPage />} />

        <Route path={ROUTES.budget} element={<BudgetPage />} />

        <Route path={`${ROUTES.budget}/:year`} element={<Navigate to={ROUTES.budget} replace />} />

        <Route
          path={ROUTES.agreements}
          element={
            <ModulePlaceholder
              title="الاتفاقيات"
              scope="سبع مراحل مستقلة عن حالة المشروع: إلكترونية وورقية، واعتماد مدير المنح والقسم المالي والمدير التنفيذي، ومعها ثلاثة عشر نموذجًا."
              facts={[{ k: 'مراحل الاتفاقية', v: '7' }, { k: 'نماذج جاهزة', v: '13' }]}
            />
          }
        />
        <Route path={`${ROUTES.agreements}/:id`} element={<Navigate to={ROUTES.agreements} replace />} />

        {/* الصرف · BPD-009 · مبني على الوثيقة، والفروق عن النظام
            العامل مسجَّلة نوتس في `DISBURSEMENT_MODULE_BRIEF.md` */}
        <Route path={ROUTES.payments} element={<PaymentsPage />} />
        {/* ⚠️ `new` قبل `:id` · الراوتر بيطابق بالترتيب، ولولا كده
            «/payments/new» هيتقرا كرقم طلب اسمه new ويطلع «غير موجود» */}
        <Route path={`${ROUTES.payments}/new`} element={<RequestForm />} />
        <Route path={ROUTES.paymentsLate} element={<LatePage />} />
        <Route path={`${ROUTES.payments}/:id`} element={<RequestPage />} />
        <Route path={`${ROUTES.payments}/:id/edit`} element={<RequestForm />} />
        <Route path={`${ROUTES.payments}/:id/order`} element={<OrderPage />} />

        <Route path={ROUTES.reports} element={<ReportsPage />} />
        {/* المفتاح هو slug الإجراء (`bpd-004`). أي مفتاح مش معروف
            بيرجّع للفهرس من جوّه الشاشة نفسها بدل مسار حارس هنا. */}
        <Route path={`${ROUTES.reports}/view/:key`} element={<ReportView />} />
        <Route path={`${ROUTES.reports}/process/:key`} element={<ProcessReport />} />
        <Route path={`${ROUTES.reports}/screen/:key`} element={<LiveReport />} />
        <Route path={`${ROUTES.reports}/:tab`} element={<ReportsPage />} />

        <Route path={ROUTES.assistant} element={<AssistantPage />} />
        <Route path={`${ROUTES.assistant}/:id`} element={<AssistantPage />} />

        <Route
          path={ROUTES.account}
          element={
            <ModulePlaceholder
              title="إعدادات الحساب"
              scope="البيانات الشخصية وكلمة المرور والتحقق بخطوتين والصلاحيات الممنوحة."
            />
          }
        />
        <Route
          path={ROUTES.preferences}
          element={
            <ModulePlaceholder
              title="التفضيلات والإشعارات"
              scope="قنوات الإشعار وتكرارها، واللغة والمظهر، وما يظهر في الرئيسية."
            />
          }
        />

        </Route>

        {/* أي مسار غير معروف يرجع للشاشة الافتراضية بدل شاشة بيضا */}
        <Route path="*" element={<Navigate to={AFTER_LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/** التبويب الافتراضي معروض هنا عشان ما يضيعش لو اتغيّر */
export { DEFAULT_PROJECT_TAB }
