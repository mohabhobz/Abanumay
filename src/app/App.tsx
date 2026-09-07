import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import ProjectPage from '@/features/projects/ProjectPage'
import HomePage from '@/features/home/HomePage'
import ProjectsListPage from '@/features/projects/list/ProjectsListPage'
import EntitiesListPage from '@/features/entities/EntitiesListPage'
import EntityPage from '@/features/entities/EntityPage'
import AssistantPage from '@/features/assistant/AssistantPage'
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

        <Route
          path={ROUTES.budget}
          element={
            <ModulePlaceholder
              title="الميزانية"
              scope="شجرة السنة ← المسار ← المجال ← الهدف بخمس قيم لكل بند: مخصص · محجوز · ملتزم به · مصروف · متبقٍ. ومعها المناقلات والتعزيزات."
              facts={[
                { k: 'ميزانية 2026', v: '73.7 م' },
                { k: 'مسار · مجال · هدف', v: '15 · 55 · 97' },
                { k: 'مصادر التمويل', v: 'المؤسسة والوقف' },
              ]}
            />
          }
        />
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

        <Route
          path={ROUTES.payments}
          element={
            <ModulePlaceholder
              title="الصرف"
              scope="سبع مراحل: إذن الصرف والمعاد، وسند الصرف، ورفع سند القبض والقيد واعتماده. ومعها جدول الدفعات وحالة السداد."
              facts={[{ k: 'مراحل الصرف', v: '7' }, { k: 'حالات السداد', v: 'مدفوع · غير مدفوع' }]}
            />
          }
        />
        <Route path={`${ROUTES.payments}/:id`} element={<Navigate to={ROUTES.payments} replace />} />

        <Route
          path={ROUTES.reports}
          element={
            <ModulePlaceholder
              title="التقارير"
              scope="أربعة عشر تقريرًا في النظام الحالي، أهمها: تقارير الشركاء (سجل أداء كل جهة)، التقارير الختامية (الفعلي مقابل المخطط)، وأداء الموظفين والأقسام (زمن كل موظف في كل قسم)."
              facts={[
                { k: 'تقارير', v: '14' },
                { k: 'تقارير ختامية', v: '972' },
                { k: 'أقسام إجرائية', v: '50' },
              ]}
            />
          }
        />
        <Route path={`${ROUTES.reports}/:key`} element={<Navigate to={ROUTES.reports} replace />} />

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
