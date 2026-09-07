/** محرّك المساعد المشترك — الشاشة الكاملة واللوح الجانبي بيستعملوه سوا */
export { useAssistant, type AssistantController } from './useAssistant'
export { AiMessage } from './AiMessage'
export { EvidenceBlock } from './EvidenceBlock'
export { Composer, type ComposerProps } from './Composer'
export { Disclaimer } from './Disclaimer'
export { md } from './md'
export type {
  ChatMessage, AiMessageModel, UserMessage, AssistantAnswer,
  AssistantContext, EvidenceBlock as EvidenceBlockModel, AssistantAction,
} from './types'
