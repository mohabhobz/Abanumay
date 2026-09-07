/**
 * طبقة الوصول للبيانات — نقطة التماس الوحيدة مع مصدر الداتا.
 *
 * دلوقتي بتقرأ من `data/mock/*`، وكل دالة بترجّع Promise وبتاخد
 * نفس شكل الباراميترات اللي الـAPI هياخدها. يوم ما الباك اند يجهز،
 * التغيير كله جوّه الملف ده: `return api.get('/projects/' + id)`
 * بدل `return delay(mock.project)` — ولا كومبوننت واحد بيتغيّر.
 */
import type {
  Project, Entity, AuthorityMatrix, CurrentUser, Insight, FollowUpType,
} from '@/types/domain'
import {
  project as mockProject,
  entity as mockEntity,
  authority as mockAuthority,
  currentUser as mockUser,
  insights as mockInsights,
  followUpTypes as mockFollowUpTypes,
} from './mock/project'

/** تأخير بسيط عشان حالات التحميل في الواجهة تتجرّب فعلًا */
const LATENCY_MS = 0

function resolve<T>(value: T): Promise<T> {
  return LATENCY_MS > 0
    ? new Promise((r) => setTimeout(() => r(value), LATENCY_MS))
    : Promise.resolve(value)
}

/** فلاتر قائمة المشاريع — نفس أسماء فلاتر النظام الأربعتاشر */
export interface ProjectQuery {
  year?: string
  track?: string
  field?: string
  goal?: string
  tag?: string
  region?: string
  city?: string
  status?: string
  supportStatus?: string
  grantMethod?: string
  shared?: boolean
  impact?: boolean
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface Page<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export const repository = {
  // ── المشاريع ──
  listProjects(query: ProjectQuery = {}): Promise<Page<Project>> {
    const rows = [mockProject]
    return resolve({
      rows,
      total: rows.length,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    })
  },

  getProject(id: string): Promise<Project | null> {
    return resolve(id === mockProject.id ? mockProject : null)
  },

  // ── الجهات ──
  getEntity(_id?: string): Promise<Entity> {
    return resolve(mockEntity)
  },

  // ── سياق القرار ──
  getAuthority(): Promise<AuthorityMatrix> {
    return resolve(mockAuthority)
  },

  getProjectInsights(_id: string): Promise<Insight[]> {
    return resolve(mockInsights)
  },

  getFollowUpTypes(): Promise<FollowUpType[]> {
    return resolve(mockFollowUpTypes)
  },

  // ── المستخدم ──
  getCurrentUser(): Promise<CurrentUser> {
    return resolve(mockUser)
  },
}

/**
 * قراءات متزامنة للـfixtures.
 * الشاشات دلوقتي بتستعمل دي عشان مفيش باك اند ولا حالات تحميل حقيقية؛
 * لما الربط يحصل، الشاشة بتتحوّل لـ`repository.*` وبتضيف حالة تحميل.
 */
export const fixtures = {
  project: mockProject,
  entity: mockEntity,
  authority: mockAuthority,
  currentUser: mockUser,
  insights: mockInsights,
  followUpTypes: mockFollowUpTypes,
}
