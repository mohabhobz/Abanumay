import { CFG, persist, readJson } from '@/lib/config'

/* Entities proposed for attraction (3.3.3) · a short register per grant year: an entity the team
   wants to invite to apply, the domain it fits and who follows it up. Not a registration — the
   entity still registers from the portal; this is the outreach list behind that invitation. */

export interface Prospect {
  id: string
  name: string
  field: string
  owner: string
  year: string
  note: string
  status: 'مقترحة' | 'تم التواصل' | 'سجّلت'
}

const DEFAULT: { list: Prospect[] } = {
  list: [
    { id: 'pr1', name: 'جمعية رواد التقنية للشباب', field: 'التعليم', owner: 'عمر قاسم', year: '2026', note: 'برامج برمجة لطلاب الثانوية في الشرقية', status: 'تم التواصل' },
    { id: 'pr2', name: 'جمعية نقاء لرعاية مرضى السكري', field: 'الصحة', owner: 'حصة النملة', year: '2026', note: 'لا جهة لدينا في هذا الهدف بالمنطقة الجنوبية', status: 'مقترحة' },
    { id: 'pr3', name: 'مؤسسة الإتقان القرآنية', field: 'القرآن', owner: 'عزام الخريف', year: '2026', note: 'سجلها جيد مع جهات مانحة أخرى', status: 'سجّلت' },
    { id: 'pr4', name: 'جمعية سقيا الخيرية', field: 'الإغاثة', owner: 'أحمد العبداللطيف', year: '2027', note: 'للدورة القادمة · بعد اكتمال ترخيصها', status: 'مقترحة' },
  ],
}

export const PROSPECTS: { list: Prospect[] } = readJson(CFG.prospects, DEFAULT)

export const saveProspects = (list: Prospect[]): void => {
  PROSPECTS.list = structuredClone(list)
  persist(CFG.prospects, PROSPECTS)
}
