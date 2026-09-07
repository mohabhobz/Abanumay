/** تنسيقات الأرقام والتواريخ — مكان واحد عشان كل الشاشات تعرض بنفس الشكل */

export const nf = new Intl.NumberFormat('en-US')

/** أرقام هندية للنصوص العربية */
export const nfAr = new Intl.NumberFormat('ar-EG')

export const money = (n: number): string => nf.format(n)

export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/** تكلفة المستفيد — مقياس المقارنة بين المشاريع */
export const costPerBeneficiary = (amount: number, beneficiaries: number): number =>
  beneficiaries === 0 ? 0 : Math.round(amount / beneficiaries)

/** قصّ نص طويل مع الحفاظ على الكلمة الأخيرة كاملة */
export const trim = (text: string, max = 90): string =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`
