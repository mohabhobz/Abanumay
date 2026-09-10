/** محرّك المساعد المشترك — الشاشة الكاملة واللوح الجانبي بيستعملوه سوا */
export { useAssistant, type AssistantController } from './useAssistant'
export { AiMessage } from './AiMessage'
export { EvidenceBlock } from './EvidenceBlock'
export { Composer, type ComposerProps } from './Composer'
export { Disclaimer } from './Disclaimer'
export { md } from './md'
export { QuickRead, type QuickReadProps } from './QuickRead'
export { AnalysisCard, type AnalysisCardProps } from './AnalysisCard'
export { ReadingBlock, ReadingPeek } from './ReadingBlock'
export { highlight } from './highlight'
export type { Reading, ReadingAction } from './reading'
export type {
  ChatMessage, AiMessageModel, UserMessage, AssistantAnswer,
  AssistantContext, EvidenceBlock as EvidenceBlockModel, AssistantAction,
} from './types'
