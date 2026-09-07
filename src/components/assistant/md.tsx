import type { ReactNode } from 'react'

/** ماركداون خفيف: **بولد** وأسطر وبوليت — كفاية للنص اللي بيوصل من المساعد */
export function md(text: string): ReactNode[] {
  return String(text)
    .split('\n')
    .map((line, i) => {
      if (!line.trim()) return <div key={i} className="mdbr" />
      const bullet = line.trim().startsWith('•')
      const parts = line.split('**')
      return (
        <div key={i} className={bullet ? 'mdli' : 'mdp'}>
          {parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : <span key={j}>{p}</span>))}
        </div>
      )
    })
}
