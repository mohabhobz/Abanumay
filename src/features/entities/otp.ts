import { useEffect, useState } from 'react'
import type { OtpResult } from '@/data/entities/auth'

/** Ticks once a second while mounted · for the countdowns */
export function useTick(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return n
}

export const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export const OTP_SAY: Record<Exclude<OtpResult, 'ok'>, string> = {
  wrong: 'الرمز غير صحيح.',
  expired: 'انتهت صلاحية الرمز · اطلب رمزًا جديدًا.',
  dead: 'أُلغي الرمز بعد تجاوز المحاولات المسموحة · اطلب رمزًا جديدًا.',
  none: 'لم يُرسل رمز بعد.',
}

