import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import ProjectPage from '@/features/projects/ProjectPage'
import AssistantPage from '@/features/assistant/AssistantPage'
import { ModulePlaceholder } from '@/features/shared/ModulePlaceholder'
import { DEFAULT_PROJECT_TAB, ROUTES } from './routes'
import { fixtures } from '@/data/repository'

/** المشروع اللي البروتوتايب بيعرضه لحد ما تبقى في قائمة حقيقية */
const DEMO_PROJECT = fixtures.project.id

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

        {/* الرئيسية لسه ما اتبنتش — بتوجّه لصفحة المشروع كعرض */}
        <Route
          path={ROUTES.home}
          element={
            <ModulePlaceholder
              title="الرئيسية"
              scope="شريط قرار: ما ينتظر قرارك والمتأخر منه · المالي بخمس قيم (مخصص · محجوز · ملتزم به · مصروف · متبقٍ) · التشغيلي: تحت التنفيذ ونسب الإنجاز ودفعات الشهر · ما يحتاج انتباه: مشاريع متأخرة وبنود استنفدت مخصصاتها ومستندات جهات منتهية."
              facts={[
                { k: 'في الدراسة الآن', v: '٢٩' },
                { k: 'وسيط مدة المشرف', v: '٢٢ يوم' },
                { k: 'مشاريع بلا مالك', v: '١٬٢٥٣' },
              ]}
              demoTo={{ label: 'افتح مشروع ٢٠٩٤٠', to: `${ROUTES.projects}/${DEMO_PROJECT}` }}
            />
          }
        />

        <Route
          path={ROUTES.projects}
          element={
            <ModulePlaceholder
              title="المشاريع"
              scope="قائمة بعمود فقري من ١٢ حقلًا بدل ٦٢، والحالة هي القسم الإجرائي الفعلي لا المجموعة، ومعها مدة المكوث في القسم. الفلاتر الأربعتاشر مطوية خلف طبقات."
              facts={[
                { k: 'مشروع في النظام', v: '٤٬٩٢٩' },
                { k: 'أعمدة الجدول الحالي', v: '٦٢' },
                { k: 'حالات معروضة اليوم', v: '٥ من ٥٠' },
              ]}
              demoTo={{ label: 'افتح مشروع ٢٠٩٤٠', to: `${ROUTES.projects}/${DEMO_PROJECT}` }}
            />
          }
        />

        <Route path={`${ROUTES.projects}/:id`} element={<ProjectPage />} />
        <Route path={`${ROUTES.projects}/:id/:tab`} element={<ProjectPage />} />

        <Route
          path={ROUTES.entities}
          element={
            <ModulePlaceholder
              title="الجهات"
              scope="ست قوائم في النظام الحالي بنفس الستة عشر عمودًا و٢٠٠ صف في الصفحة. البديل: كارت جهة فيه سجلها وأداؤها ومستنداتها الناقصة ودرجة حوكمتها."
              facts={[
                { k: 'جهة مسجلة', v: '٣٬٢٧٢' },
                { k: 'معلقة', v: '٨٩٣' },
                { k: 'أعمدة في الصفحة', v: '١٦ × ٢٠٠ صف' },
              ]}
            />
          }
        />
        <Route path={`${ROUTES.entities}/:id`} element={<Navigate to={ROUTES.entities} replace />} />

        <Route
          path={ROUTES.budget}
          element={
            <ModulePlaceholder
              title="الميزانية"
              scope="شجرة السنة ← المسار ← المجال ← الهدف بخمس قيم لكل بند: مخصص · محجوز · ملتزم به · مصروف · متبقٍ. ومعها المناقلات والتعزيزات."
              facts={[
                { k: 'ميزانية ٢٠٢٦', v: '٧٣٫٧ م' },
                { k: 'مسار · مجال · هدف', v: '١٥ · ٥٥ · ٩٧' },
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
              facts={[{ k: 'مراحل الاتفاقية', v: '٧' }, { k: 'نماذج جاهزة', v: '١٣' }]}
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
              facts={[{ k: 'مراحل الصرف', v: '٧' }, { k: 'حالات السداد', v: 'مدفوع · غير مدفوع' }]}
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
                { k: 'تقارير', v: '١٤' },
                { k: 'تقارير ختامية', v: '٩٧٢' },
                { k: 'أقسام إجرائية', v: '٥٠' },
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

        {/* أي مسار غير معروف يرجع للرئيسية بدل شاشة بيضا */}
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/** التبويب الافتراضي معروض هنا عشان ما يضيعش لو اتغيّر */
export { DEFAULT_PROJECT_TAB }
