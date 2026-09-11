/**
 * صفحات الجرد، **مكتوبة مرة واحدة**.
 *
 * القايمة دي كانت متكرّرة في تلات ملفات (`uiaudit` و`uicheck`
 * و`contrast`). ودي بالظبط نفس المرض اللي بنطارده في الـCSS:
 * التعريف المكرّر. لما ضفنا مشروعًا جديدًا للجرد، الملف اللي
 * اتنسي فضل بيفحص القايمة القديمة ويطلع أخضر.
 *
 * ### ليه مشروعان لا واحد
 * المشروع ٢٠٩٤٠ لسّه في أول الطريق: مفيش اتفاقية ومفيش دفعات،
 * فتابَّي «الاتفاقية» و«الدفعات» بيرجّعوا **حالة فاضية**. الجرد
 * فضل بيقيس شاشتين فاضيتين وهو فاكر إنه بيقيس الشاشتين، وده
 * اللي خلّى اختلاف نقطة الاستِبر (١٦ في الاتفاقية و١٥ في الدفعات)
 * يعدّي من تحت ٢٣ صفحة × ٣ ثيمات من غير ما يتمسك.
 *
 * ٢٠٨٥٢ واصل لمرحلة الصرف، فالشاشتين بترسموا فعلًا. والاتنين
 * موجودين: الحالة الفاضية شاشة برضو ومحتاجة تتفحص.
 */
export const ROUTES = [
  '/', '/projects',
  '/projects/20940', '/projects/20940/agreement', '/projects/20940/payments',
  '/projects/20852', '/projects/20852/agreement', '/projects/20852/payments',
  '/entities', '/entities/694', '/entities/694/docs', '/entities/694/banks', '/entities/694/log',
  '/budget', '/payments', '/agreements',
  '/reports', '/reports/build', '/reports/catalog', '/reports/coverage',
  '/reports/view/budget', '/reports/screen/budget', '/reports/screen/closing',
  '/reports/process/p1', '/assistant', '/account',
]
