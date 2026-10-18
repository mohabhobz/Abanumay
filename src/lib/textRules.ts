import { CFG, persist, readJson } from '@/lib/config'

/* 18 Oct · the editable lists behind the text checks (2.6.3 · 8.5.3 · 8.5.4).

   Rules, not a model: the foundation extends them from «الذكاء الاصطناعي» settings with no code
   change. One entry per line in the settings page.
   · spell · extra corrections, «الخطأ=الصواب» · added to the built-in dictionary
   · mandatory · clause topics every agreement must carry · matched in the clause titles and text
   · forbidden · wording the foundation doesn't approve in an agreement */

export interface TextRules { spell: string[]; mandatory: string[]; forbidden: string[] }

const DEFAULT: TextRules = {
  spell: [],
  mandatory: ['الالتزامات', 'الإنهاء', 'السرية', 'تسوية النزاعات', 'المخرجات'],
  forbidden: ['غير ملزم', 'دون أدنى مسؤولية', 'حسب تقدير الجهة', 'بلا قيد أو شرط'],
}

export const TEXT_RULES: TextRules = readJson(CFG.textRules, structuredClone(DEFAULT))
export const TEXT_RULES_DEFAULT = DEFAULT

export function saveTextRules(next: TextRules): void {
  const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
  Object.assign(TEXT_RULES, { spell: clean(next.spell), mandatory: clean(next.mandatory), forbidden: clean(next.forbidden) })
  persist(CFG.textRules, TEXT_RULES)
}

/** The settings' corrections as pairs · «انشاء=إنشاء» or «انشاء ← إنشاء» */
export const spellPairs = (): [string, string][] =>
  TEXT_RULES.spell.map((l) => l.split(/\s*(?:=|←|->)\s*/)).filter((p) => p.length === 2 && p[0] && p[1]).map((p) => [p[0]!, p[1]!])
