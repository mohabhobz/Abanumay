/**
 * تحويل حالات النظام إلى درجات لون.
 *
 * مكان واحد عشان نفس الحالة تاخد نفس اللون في كل شاشة — الكارت
 * والجدول وصفحة المشروع وصفحة الجهة.
 */
import type { Tone } from '@/types/domain'

/** مجموعة حالة المشروع الخماسية */
export const groupTone = (group: string): Tone => {
  switch (group) {
    case 'في الدراسة': return 'ret'
    case 'في التشغيل': return 'brand'
    case 'مكتمل': return 'ok'
    case 'متعثر': return 'warn'
    default: return 'no'
  }
}

/** حالة تفعيل الجهة — أول ما يُقرأ قبل أي قرار */
export const activationTone = (activation: string): Tone => {
  switch (activation) {
    case 'مقبول': return 'ok'
    case 'محدث': return 'ret'
    case 'مرفوض': return 'no'
    default: return 'warn'
  }
}

export const governanceTone = (governance: string): Tone => {
  switch (governance) {
    case 'ممتازة': return 'ok'
    case 'جيدة': return 'brand'
    case 'مقبولة': return 'ret'
    case 'ضعيفة': return 'no'
    default: return 'mute'
  }
}

/** الساعات في النظام، الأيام في الواجهة */
export const days = (hours: number): number => Math.round(hours / 24)

/** لون شريط الضغط: أخضر تحت الحد، أصفر قرب منه، أحمر فوقه */
export const pressureColor = (pressure: number): string =>
  pressure > 1 ? 'var(--no)' : pressure > 0.75 ? 'var(--warn)' : 'var(--teal)'
