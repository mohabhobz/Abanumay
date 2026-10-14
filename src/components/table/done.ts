import { createContext } from 'react'

/** 14 Oct · rows a batch just ran on · they stay selected with a success mark (LOCTech §2) */
export const DoneRows = createContext<Set<string> | null>(null)
