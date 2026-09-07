# بنية الواجهة — منح أبانمي

وثيقة تسليم: إزاي الكود متقسّم، وفين تعدّل كل حاجة، وإيه اللي لازم
يتغيّر يوم ما الباك اند يجهز.

---

## الحالة

- **React 18 + TypeScript 5.6 + Vite 5** · RTL بالكامل
- **بيانات تجريبية** بشكل النظام العامل `sys.abanumay.sa` — مفيش أي API لسه
- `npm run typecheck` و`npx eslint src` و`npm run build` **كلهم نضاف**

```bash
npm install
npm run dev        # خادم التطوير
npm run typecheck  # فحص الأنواع
npm run build      # فحص الأنواع + بناء الإنتاج
npm run preview    # معاينة نسخة الإنتاج
```

---

## الشجرة

```
src/
├─ app/                  التطبيق والمسارات
│  ├─ App.tsx            خريطة الشاشات
│  ├─ routes.ts          ★ المصدر الوحيد لأي URL
│  └─ layout/AppLayout   القشرة: خلفية + تنقّل + لوح المساعد
│
├─ components/           عناصر مشتركة، مالهاش علاقة بموديول بعينه
│  ├─ ui/                نظام التصميم (Glass · Tag · KV · GateArc …)
│  ├─ shell/             الريل وشريط القرار وقائمة الحساب واللوح
│  └─ assistant/         محرّك المساعد (تفكير → كتابة → أدلة)
│
├─ features/             شاشة لكل موديول
│  ├─ auth/              الدخول
│  ├─ projects/          صفحة المشروع (تبويبات + لوحات جانبية)
│  ├─ assistant/         شاشة المساعد الكاملة
│  └─ shared/            شاشة الموديول اللي لسه ما اتبناش
│
├─ data/
│  ├─ repository.ts      ★ نقطة التماس الوحيدة مع مصدر البيانات
│  └─ mock/              الـfixtures
│
├─ types/domain.ts       ★ نموذج البيانات
├─ hooks/                هوكس مشتركة
├─ lib/format.ts         تنسيق الأرقام والمال
└─ styles/index.css      نظام التصميم كامل
```

### القاعدة الحاكمة
الاتجاه في اتجاه واحد: `features` بتستورد من `components` و`data` و`hooks`.
**`components` ما بتستوردش من `features` أبدًا** — لو احتجت كده، يبقى
الكومبوننت مكانه `components`.

---

## ★ الثلاث ملفات اللي بتحكم كل حاجة

### ١ — `app/routes.ts` — المسارات
ممنوع كتابة URL كنص في أي كومبوننت.

```ts
ROUTES.project('20940')            // /projects/20940
ROUTES.projectTab('20940', 'log')  // /projects/20940/log
```

| الشاشة | المسار | الحالة |
|---|---|---|
| الدخول | `/login` | ✅ |
| الرئيسية | `/` | placeholder |
| المشاريع | `/projects` | placeholder |
| **المشروع** | `/projects/:id/:tab?` | ✅ مبنية |
| الجهات | `/entities` · `/entities/:id` | placeholder |
| الميزانية | `/budget` · `/budget/:year` | placeholder |
| الاتفاقيات | `/agreements` · `/agreements/:id` | placeholder |
| الصرف | `/payments` · `/payments/:id` | placeholder |
| التقارير | `/reports` · `/reports/:key` | placeholder |
| **المساعد** | `/assistant` · `/assistant/:id` | ✅ مبنية |
| الحساب | `/account` · `/account/preferences` | placeholder |

المسار بيطابق الـendpoint المتوقّع: `/projects/:id` ← `GET /api/projects/:id`.

نفس الملف فيه `NAV` — عناصر التنقّل، ولكل عنصر مفتاح صلاحية `perm`.
لما الباك اند يرجّع صلاحيات المستخدم، تتبعت لـ`<Rail permissions={…}>`
والقائمة بتتفلتر لوحدها.

### ٢ — `types/domain.ts` — نموذج البيانات
كل حقل هنا له مقابل حقيقي في النظام العامل، والمصطلحات المقنّنة اتحوّلت
لأنواع: `ProcedureStage` (١٨ قسمًا) · `DeclineReason` (٩ مبررات) ·
`FollowUpType` (٨) · `GrantMethod` · `TransferMethod`.

لو الباك اند سلّم شكلًا مختلفًا، الفرق **بيبان وقت البيلد** مش وقت
التشغيل عند المستخدم.

### ٣ — `data/repository.ts` — مصدر البيانات
كل دالة بترجّع `Promise` وبتاخد نفس شكل الباراميترات اللي الـAPI هياخدها.

```ts
// دلوقتي
getProject(id) { return resolve(mockProject) }

// بعد الربط — التغيير هنا وبس
getProject(id) { return api.get<Project>(`/projects/${id}`) }
```

الشاشات دلوقتي بتقرا من `fixtures` (متزامن) عشان مفيش تحميل حقيقي.
**خطوة الربط:** الشاشة تتحوّل لـ`repository.*` وتضيف حالة تحميل وخطأ.
مفيش كومبوننت واحد فيه `fetch`.

---

## صفحة المشروع — نموذج لأي موديول جاي

```
ProjectPage.tsx          الترويسة + التبويبات + التخطيط
├─ tabs/DataTab          بيانات المشروع
├─ tabs/EntityTab        الجهة
├─ tabs/index.tsx        التبويبات الأصغر
└─ panels/               العمود الجانبي — سياق ثابت مش تبويب
   ├─ QuickAnalysis      القراءة الآلية (تفكير ثم كتابة)
   ├─ EntityProjectsPanel
   └─ LastActionPanel
```

**التبويب جزء من الـURL** فينشارك ويترجع له.
**التبويبات بتاخد الداتا props** — مفيش تبويب بيستورد الـfixture لوحده،
فالتحوّل للباك اند بيحصل في مكان واحد.

---

## نظام التصميم

- `components/ui` — عناصر بلا معرفة بأي موديول
- `styles/index.css` — التوكنز والأسطح والحركة
- الأزرار: `.btn` + `.btn-1` أساسي · `.btn-2` ثانوي · `.btn-3` إجراء مميّز ·
  `.btn-d` خطر · `.btn-ghost` شفاف · `.btn-off` معطّل · `.btn-full` عرض كامل

### مصايد RTL موثّقة في الكود
- `inset-inline-start` = **يمين** · `inset-inline-end` = **شمال**
- `box-shadow: inset +Npx` بيرسم الشريط على **الشمال**
- `flex-direction:column` + `flex-wrap:wrap` بيلفّ في **أعمدة**
- صف `nowrap` من غير `min-width:0` بيوسّع الصفحة
- `1fr` في الجريد = `minmax(auto,1fr)` — استعمل `minmax(0,1fr)`
- أنيميشن بـ`fill-mode:both` بيلغي أي `transform` من الهوفر:
  الحل إن الحركة تبقى على خاصية `translate` المستقلة
- `backdrop-filter` على أي أب بيبقى الحاوية لـ`position:fixed`،
  فالمودالات لازم `createPortal` على `document.body`

---

## الأمان والبيانات

- **الريبو عام.** الهويات الشخصية والمالية في `data/mock/project.ts`
  **منزوعة**: الآيبان والجوالات والبُرد وأسماء الأفراد وأرقام الترخيص
  قيم وهمية سليمة الشكل.
- لو محتاج الأرقام الحقيقية لعرض العميل: `data/mock/project.local.ts` —
  الامتداد ده متجاهَل في git.
- `vite.config.ts` فيه `base: '/'` **عن قصد**. `'./'` بيكسر أي رابط
  متداخل زي `/projects/20940` لأن الأصول بتتحل نسبة للمسار مش للجذر.
- النشر لازم يكون SPA fallback (كل المسارات → `index.html`).

---

## اللي لسه ناقص

1. **الوضع الداكن** — المبدّل موجود وبيكتب `data-theme`، بس الباليتة
   الداكنة نفسها ما اتعملتش. محتاج `rgba(255,255,255,…)` المتناثرة
   تتحوّل لتوكن واحد وتتعمل نسختين منه.
2. **قوائم الموديولز السبعة** — الشاشات موجودة كـplaceholder بتقول
   إيه اللي هيقع فيها وبأي أرقام حقيقية.
3. **الربط بالباك اند** — `repository.ts` جاهز، ناقص عميل HTTP
   وحالات تحميل/خطأ في الشاشات.
4. **بوابة الجهة** — التطبيق الخارجي كله لسه ما اتلمسش.
5. **اختبارات** — مفيش. المرشّح الأول: `routes.ts` و`format.ts` و
   منطق صاحب القرار في `GateArc`.

---

## أسئلة مفتوحة للعميل

السقوف المالية بالأرقام · حدّ المدة لكل قسم من الـ٥٠ · الفرق بين
«معتذر عنه» و«مرفوض» · «مشروع وفرة» · «تسكين المشروع» · هل الوقف
والمؤسسة شاشة واحدة بمصدر تمويل ولا شاشتين.

التفاصيل في `Abanumay_System_Live_Audit.md` بمجلد المشروع.
