/* 17 Oct · «ارجع ليومك · التالي» · the item opened from «اليوم» is remembered for the visit, so the
   record page can say, once its action is taken, what comes next and take the person back */
export interface Trail { id: string; queueKey: string; title: string; to: string }
const KEY = 'ab-today-trail'
export const setTrail = (t: Trail) => { try { sessionStorage.setItem(KEY, JSON.stringify(t)) } catch { /* storage blocked · no return bar */ } }
export const getTrail = (): Trail | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Trail | null } catch { return null } }
export const clearTrail = () => { try { sessionStorage.removeItem(KEY) } catch { /* nothing kept */ } }
/** The record's own path · a link with a query or a hash lands on the same record */
export const pathOf = (to: string) => to.split(/[?#]/)[0]
