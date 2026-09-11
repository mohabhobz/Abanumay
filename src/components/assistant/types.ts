import type { IconName } from '@/components/ui'
import type { DecisionKind, Tone } from '@/types/domain'

/** بلوكات الأدلة اللي المساعد بيعرضها تحت الإجابة */
export type EvidenceBlock =
  | { kind: 'meter'; label: string; value: number; limit: number; note: string }
  | { kind: 'stats'; items: { k: string; v: string | number; u?: string }[] }
  | { kind: 'ledger'; rows: { k: string; v: string; strong?: boolean }[] }
  | { kind: 'bars'; items: { k: string; real: number; plan?: number }[]; note?: string }
  | { kind: 'list'; items: { t: string; s: string; tone: Tone | '' }[] }

export interface AssistantAction {
  label: string
  kind: DecisionKind
}

/** الإجابة المُعدّة سلفًا لسؤال معروف */
export interface AssistantAnswer {
  think: string[]
  text: string
  more?: string
  block?: EvidenceBlock
  sources?: string[]
  actions?: AssistantAction[]
  follow?: string[]
  /** مخرجات AI مساندة وغير مُلزِمة · القاعدة دي بتتعلّم في الواجهة */
  advisory?: boolean
}

export type MessageState = 'think' | 'type' | 'done'

export interface UserMessage {
  who: 'me'
  text: string
}

export interface AiMessageModel extends AssistantAnswer {
  who: 'ai'
  state: MessageState
  /** كام خطوة تفكير ظهرت لحد دلوقتي */
  step: number
  /** كام حرف اتكتب لحد دلوقتي */
  chars: number
}

export type ChatMessage = UserMessage | AiMessageModel

/**
 * سياق اللوح الجانبي · بيتغيّر حسب الصفحة المفتوح منها.
 *
 * اللوح بقى نفس الحالة الأولى بتاعة الشاشة الكاملة بالظبط، فالسياق
 * ده مسؤول عن حاجة واحدة: **الكلام اللي بيقول للمستخدم هيدوّر فين**.
 * الترحيب الشخصي («أهلًا عمر») بييجي من المستخدم لا من هنا، لأنه
 * ثابت في كل الصفحات.
 */
export interface AssistantContext {
  /** عنوان ترويسة اللوح · اسم الشيء اللي أنت فيه */
  title: string
  /** سطر تحت العنوان في الترويسة */
  sub: string
  /** سطر المدى تحت الترحيب: «كيف أقدر أساعدك في «س»؟» */
  scope: string
  cards: { icon: IconName; title: string; sub: string; prompt: string }[]
}
