import { useState } from 'react'
import { readDocument, readMismatches } from '@/lib/ai/provider'

/* 10 Oct · reading an uploaded file's content against what the form says · see DocRead.tsx */

export interface ReadOut { note: string; diff: string[]; source: 'model' | 'local' | 'none' }

export function useDocReads() {
  const [reads, setReads] = useState<Record<string, ReadOut>>({})
  const read = (key: string, file: File, kind: string, typed: Record<string, string>) => {
    void readDocument(file, kind, typed).then((r) => setReads((x) => ({
      ...x,
      [key]: { note: r.note, source: r.source, diff: readMismatches(r.fields, typed).map((m) => `${m.label}: في الملف «${m.value}» والمُدخَل «${typed[m.key]}»`) },
    })))
  }
  return { reads, read }
}
