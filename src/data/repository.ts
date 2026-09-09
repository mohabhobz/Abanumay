/**
 * طبقة الوصول للبيانات — نقطة التماس الوحيدة مع مصدر الداتا.
 *
 * دلوقتي بتقرأ من `data/mock/*`، وكل دالة بترجّع Promise وبتاخد
 * نفس شكل الباراميترات اللي الـAPI هياخدها. يوم ما الباك اند يجهز،
 * التغيير كله جوّه الملف ده: `return api.get('/projects/' + id)`
 * بدل `return resolve(mock.project)` — ولا كومبوننت واحد بيتغيّر.
 *
 * الفلترة والترتيب والتقسيم بتتعمل هنا كمان بنفس أسماء الحقول اللي
 * هتتبعت للسيرفر كـquery string، عشان الشاشة ما تتغيّرش وقت الربط.
 */
import type {
  Project, Entity, AuthorityMatrix, CurrentUser, Insight, FollowUpType,
  ProjectRow, EntityRow,
} from '@/types/domain'
import {
  project as mockProject,
  entity as mockEntity,
  authority as mockAuthority,
  currentUser as mockUser,
  insights as mockInsights,
  followUpTypes as mockFollowUpTypes,
} from './mock/project'
import { projectRows, projectById, projectsOfEntity } from './mock/projects'
import { entityRows, entityById } from './mock/entities'
import { projectCode } from '@/lib/format'

/** تأخير بسيط عشان حالات التحميل في الواجهة تتجرّب فعلًا */
const LATENCY_MS = 0

function resolve<T>(value: T): Promise<T> {
  return LATENCY_MS > 0
    ? new Promise((r) => setTimeout(() => r(value), LATENCY_MS))
    : Promise.resolve(value)
}

/* ═══════════════ الاستعلامات ═══════════════ */

/** ترتيب قائمة المشاريع — المفتاح واتجاهه */
export type ProjectSort =
  | 'waiting'      // الأطول انتظارًا في القسم — الافتراضي
  | 'newest'
  | 'amount'
  | 'weight'
  | 'name'

/** فلاتر قائمة المشاريع — نفس أسماء فلاتر النظام الأربعتاشر */
/**
 * فلتر يقبل قيمة واحدة أو مجموعة قيم.
 *
 * المجموعة معناها «أي واحدة منها» لا «كلها»: المستخدم اللي بيختار
 * الرياض ومكة عايز يشوف الاتنين، مش المشروع اللي في الاتنين — وده
 * مستحيل أصلًا في الحقول دي. المصفوفة الفاضية = بلا فلتر، عشان
 * الشاشة ما تضطرش تحوّلها لـ`undefined` قبل ما تبعتها.
 */
export type Filter = string | string[] | undefined

export interface ProjectQuery {
  year?: Filter
  track?: Filter
  field?: Filter
  goal?: Filter
  tag?: Filter
  region?: Filter
  city?: Filter
  /** الحالة المجمّعة */
  status?: Filter
  /** القسم الإجرائي الفعلي */
  stage?: Filter
  supportStatus?: Filter
  grantMethod?: Filter
  funding?: Filter
  owner?: Filter
  /** true = بلا مالك فقط */
  unowned?: boolean
  /** true = المتجاوز حدّ القسم فقط */
  overdue?: boolean
  shared?: boolean
  impact?: boolean
  from?: string
  to?: string
  search?: string
  sort?: ProjectSort
  page?: number
  pageSize?: number
}

export interface EntityQuery {
  activation?: Filter
  type?: Filter
  licensor?: Filter
  region?: Filter
  city?: Filter
  governance?: Filter
  /** true = ملف المستندات ناقص */
  docsIncomplete?: boolean
  /** true = لها مشاريع تحت التشغيل */
  hasRunning?: boolean
  search?: string
  sort?: 'granted' | 'projects' | 'newest' | 'name'
  page?: number
  pageSize?: number
}

export interface Page<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

/* ═══════════════ أدوات داخلية ═══════════════ */

const eq = (filter: Filter, value: string): boolean =>
  !filter || (Array.isArray(filter) ? filter.length === 0 || filter.includes(value) : filter === value)

/** للحقول اللي الصف فيها مجموعة (الأوسمة): تقاطع مش تطابق */
const eqAny = (filter: Filter, values: readonly string[]): boolean =>
  !filter
    ? true
    : Array.isArray(filter)
      ? filter.length === 0 || filter.some((f) => values.includes(f))
      : values.includes(filter)

const paginate = <T>(rows: T[], page = 1, pageSize = 20): Page<T> => ({
  rows: rows.slice((page - 1) * pageSize, page * pageSize),
  total: rows.length,
  page,
  pageSize,
})

/** نسبة المكوث للحدّ — أساس ترتيب «الأطول انتظارًا» وتلوين الصف */
export const stagePressure = (row: ProjectRow): number =>
  row.stageLimit === 0 ? 0 : row.hoursInStage / row.stageLimit

const matchProject = (r: ProjectRow, q: ProjectQuery): boolean => {
  if (!eq(q.year, r.year)) return false
  if (!eq(q.track, r.track)) return false
  if (!eq(q.field, r.field)) return false
  if (!eq(q.goal, r.goal)) return false
  if (!eq(q.region, r.region)) return false
  if (!eq(q.city, r.city)) return false
  if (!eq(q.status, r.statusGroup)) return false
  if (!eq(q.stage, r.stage)) return false
  if (!eq(q.grantMethod, r.grantMethod)) return false
  if (!eq(q.funding, r.funding)) return false
  /* `?? ''` مش تجميل: المشروع بلا مالك أو بلا قرار دعم لازم يقع
     برّه الفلتر لما المستخدم يختار مالكًا أو حالة دعم بعينها. */
  if (!eq(q.supportStatus, r.supportStatus ?? '')) return false
  if (!eq(q.owner, r.owner ?? '')) return false
  if (!eqAny(q.tag, r.tags)) return false
  if (q.unowned && r.owner !== null) return false
  if (q.overdue && stagePressure(r) <= 1) return false
  if (q.shared && !r.shared) return false
  if (q.impact && !r.impact) return false
  if (q.from && r.submittedAt < q.from) return false
  if (q.to && r.submittedAt > q.to) return false
  if (q.search) {
    /* الكود المعروض جزء من نطاق البحث: المستخدم بينسخه من الجدول
       أو من إيميل ويلزقه هنا، ولو ما اتقبلش هيفتكر إن المشروع اتشال. */
    const needle = q.search.trim()
    const hay = `${r.id} ${projectCode(r.id, r.year)} ${r.name} ${r.entityName} ${r.goal} ${r.city}`
    if (!hay.toLowerCase().includes(needle.toLowerCase())) return false
  }
  return true
}

const sortProjects = (rows: ProjectRow[], sort: ProjectSort = 'waiting'): ProjectRow[] => {
  const out = [...rows]
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    case 'amount':
      return out.sort((a, b) => b.amountRequested - a.amountRequested)
    case 'weight':
      return out.sort((a, b) => b.weight - a.weight)
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    default:
      // الأطول انتظارًا أولًا؛ اللي خلص (بلا حدّ) في الآخر
      return out.sort((a, b) => stagePressure(b) - stagePressure(a))
  }
}

const matchEntity = (e: EntityRow, q: EntityQuery): boolean => {
  if (!eq(q.activation, e.activation)) return false
  if (!eq(q.type, e.type)) return false
  if (!eq(q.licensor, e.licensor)) return false
  if (!eq(q.region, e.region)) return false
  if (!eq(q.city, e.city)) return false
  if (!eq(q.governance, e.governance)) return false
  if (q.docsIncomplete && e.docsUploaded >= ENTITY_DOCS_TOTAL) return false
  if (q.hasRunning && e.projectsRunning === 0) return false
  if (q.search) {
    const hay = `${e.id} ${e.name} ${e.licenseNo} ${e.city}`
    if (!hay.includes(q.search.trim())) return false
  }
  return true
}

const sortEntities = (rows: EntityRow[], sort: EntityQuery['sort'] = 'granted'): EntityRow[] => {
  const out = [...rows]
  switch (sort) {
    case 'projects':
      return out.sort(
        (a, b) =>
          b.projectsApproved + b.projectsRunning - (a.projectsApproved + a.projectsRunning),
      )
    case 'newest':
      return out.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    default:
      return out.sort((a, b) => b.grantedTotal - a.grantedTotal)
  }
}

/** ملف الجهة كامل = 8 مستندات */
export const ENTITY_DOCS_TOTAL = 8

/* ═══════════════ الواجهة ═══════════════ */

export const repository = {
  // ── المشاريع ──
  listProjects(query: ProjectQuery = {}): Promise<Page<ProjectRow>> {
    const filtered = projectRows.filter((r) => matchProject(r, query))
    return resolve(paginate(sortProjects(filtered, query.sort), query.page, query.pageSize))
  },

  /** عدّاد سريع لكل مجموعة حالة — للشرائح فوق القائمة */
  countByStatus(query: ProjectQuery = {}): Promise<Record<string, number>> {
    const base = { ...query, status: undefined }
    const rows = projectRows.filter((r) => matchProject(r, base))
    const out: Record<string, number> = {}
    for (const r of rows) out[r.statusGroup] = (out[r.statusGroup] ?? 0) + 1
    return resolve(out)
  },

  getProjectRow(id: string): Promise<ProjectRow | null> {
    return resolve(projectById(id) ?? null)
  },

  /** المشروع الكامل — لسه فيه فيكستشر واحد مفصّل */
  getProject(id: string): Promise<Project | null> {
    return resolve(id === mockProject.id ? mockProject : null)
  },

  // ── الجهات ──
  listEntities(query: EntityQuery = {}): Promise<Page<EntityRow>> {
    const filtered = entityRows.filter((e) => matchEntity(e, query))
    return resolve(paginate(sortEntities(filtered, query.sort), query.page, query.pageSize))
  },

  getEntityRow(id: string): Promise<EntityRow | null> {
    return resolve(entityById(id) ?? null)
  },

  /** ملف الجهة المفصّل — فيكستشر واحد لحد ما يتوسّع */
  getEntity(_id?: string): Promise<Entity> {
    return resolve(mockEntity)
  },

  /** الربط بين الجهة ومشاريعها في الاتجاهين */
  listEntityProjects(entityId: string): Promise<ProjectRow[]> {
    return resolve(sortProjects(projectsOfEntity(entityId), 'newest'))
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
  projects: projectRows,
  entities: entityRows,
}

/** نسخ متزامنة من نفس المنطق — الشاشات بتستعملها لحد ما يبقى فيه سيرفر */
export const query = {
  projects(q: ProjectQuery = {}): Page<ProjectRow> {
    const filtered = projectRows.filter((r) => matchProject(r, q))
    return paginate(sortProjects(filtered, q.sort), q.page, q.pageSize)
  },
  projectStatusCounts(q: ProjectQuery = {}): Record<string, number> {
    const rows = projectRows.filter((r) => matchProject(r, { ...q, status: undefined }))
    const out: Record<string, number> = {}
    for (const r of rows) out[r.statusGroup] = (out[r.statusGroup] ?? 0) + 1
    return out
  },
  entities(q: EntityQuery = {}): Page<EntityRow> {
    const filtered = entityRows.filter((e) => matchEntity(e, q))
    return paginate(sortEntities(filtered, q.sort), q.page, q.pageSize)
  },
  entityProjects(entityId: string): ProjectRow[] {
    return sortProjects(projectsOfEntity(entityId), 'newest')
  },
}
