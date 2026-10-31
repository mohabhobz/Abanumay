/* Client 30 Oct (Mozaffar · «حقول دراسة المشروع.xlsx») · the old system's study fields, grouped into the
   study's first four sections as the sheet groups them:

   · بيانات المشروع · the year, track, field and goal, two yes/no checks and four of the points questions
   · الجهة · the entity's experience (points) and the partnership, interim-report and agreement questions
   · التغطية الإعلامية · the media questions and the four sponsorship kinds
   · قرار دعم المشروع · duration, beneficiaries, the supervisor's opinion, the amount, payments, outputs,
     the summary of the idea and the opinion, and the tags

   The points questions are the study criteria (`CRITERIA`), edited in settings · the rest are kept
   on the study under these keys. */

export type StudySection = 'project' | 'entity' | 'media' | 'decision'
export type FieldKind = 'yesno' | 'text' | 'long' | 'money' | 'number'

export interface StudyField {
  key: string
  label: string
  section: StudySection
  kind: FieldKind
  /** Shown only when another yes/no field reads «نعم» */
  when?: string
}

export const STUDY_FIELDS: StudyField[] = [
  { key: 'specialty', label: 'هل المشروع من تخصص الجهة ورسالتها؟', section: 'project', kind: 'yesno' },
  { key: 'serves', label: 'هل المشروع يخدم أهداف المؤسسة؟', section: 'project', kind: 'yesno' },

  { key: 'interim', label: 'هل يلزم تقرير مرحلي؟', section: 'entity', kind: 'yesno' },
  { key: 'shared', label: 'هل المشروع منح تشاركي؟', section: 'entity', kind: 'yesno' },
  { key: 'partners', label: 'الجهات التشاركية والمبالغ', section: 'entity', kind: 'long', when: 'shared' },
  { key: 'sharedAmount', label: 'مبلغ المنح التشاركي (الإجمالي)', section: 'entity', kind: 'money', when: 'shared' },
  { key: 'eAgreement', label: 'هل الاتفاقية إلكترونية؟', section: 'entity', kind: 'yesno' },

  { key: 'launch', label: 'هل يحتاج تدشين إعلامي؟', section: 'media', kind: 'yesno' },
  { key: 'coverage', label: 'هل يحتاج تغطية إعلامية؟', section: 'media', kind: 'yesno' },
  { key: 'logo', label: 'إبراز شعار المؤسسة على إعلانات ومنتجات المشروع', section: 'media', kind: 'yesno' },
  { key: 'visual', label: 'هل يحتوي على منتجات مرئية؟', section: 'media', kind: 'yesno' },
  { key: 'found', label: 'تأسيس وتشغيل الجهات', section: 'media', kind: 'yesno' },
  { key: 'develop', label: 'تطوير الجهات والعاملين فيها', section: 'media', kind: 'yesno' },
  { key: 'products', label: 'رعاية المنتجات والدراسات', section: 'media', kind: 'yesno' },
  { key: 'social', label: 'رعاية المشاريع ذات الأثر المجتمعي', section: 'media', kind: 'yesno' },

  { key: 'days', label: 'مدة التنفيذ بالأيام', section: 'decision', kind: 'number' },
  { key: 'reach', label: 'عدد المستفيدين', section: 'decision', kind: 'number' },
  { key: 'payments', label: 'عدد الدفعات', section: 'decision', kind: 'number' },
  { key: 'tags', label: 'الوسوم', section: 'decision', kind: 'text' },
]

export const fieldsOf = (section: StudySection): StudyField[] => STUDY_FIELDS.filter((f) => f.section === section)
