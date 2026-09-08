import { units } from '@/lib/format'
import type { Basis } from '@/data/kpi'

/**
 * المقام مكتوبًا بوحدته: «من 30 مشروعًا» لا «من 30».
 *
 * النسبة من غير مقامها بتكدب: «100%» من مشروع واحد ومن ألف مشروع
 * بيتكتبوا بنفس الشكل. والوحدة لازم تكون صريحة كمان، وإلا مقام
 * الميزانية (بالريال) بيتقري كأنه عدد حالات.
 *
 * بترجّع نصًّا فيه رقم وكلمة، فلازم يتلفّ بـ`isolate` لا بـ`.num`:
 * `.num` بتعزل العنصر كله LTR، فالكلمة العربية بتتزحلق لشمال الرقم
 * («ريال 73,700,000»). `isolate` بتعزل الرقم لوحده والكلمة تفضل في
 * تدفّق الجملة العربي.
 */
export const basisText = (n: number, basis: Basis): string =>
  basis === 'riyal'
    ? units.riyal(n)
    : basis === 'entity'
      ? units.entity(n, true)
      : basis === 'line'
        ? units.line(n, true)
        : basis === 'source'
          ? units.source(n, true)
          : units.project(n, true)
