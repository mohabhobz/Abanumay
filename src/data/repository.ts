/**
 * Data access layer · the single point of contact with the data source.
 *
 * Right now it reads from the mock data files, and every function returns a Promise and takes the
 * same parameter shape the real API will expect. Once the backend is ready, the whole change
 * happens inside this file: `return api.get('/projects/' + id)` instead of `return
 * resolve(mock.project)` — not a single component needs to change.
 *
 * Filtering, sorting, and pagination happen here too, using the same field names that will
 * eventually be sent to the server as a query string, so the screen doesn't change when the real
 * connection is wired in.
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

/** A small delay so loading states in the UI can actually be tested */
const LATENCY_MS = 0

function resolve<T>(value: T): Promise<T> {
  return LATENCY_MS > 0
    ? new Promise((r) => setTimeout(() => r(value), LATENCY_MS))
    : Promise.resolve(value)
}

/* Queries */

/** Project list sort order · key and direction */
export type ProjectSort =
  | 'waiting'      // Longest waiting in its department · the default
  | 'newest'
  | 'amount'
  | 'weight'
  | 'name'

/** Project list filters · same field names as the system's own filters */
/**
 * A filter accepting a single value or a set of values.
 *
 * A set means "any of these", not "all of these": a user selecting Riyadh and Makkah wants to see
 * both, not a project that belongs to both — which isn't even possible for these fields. An empty
 * array means no filter, so the screen never has to convert it to `undefined` before sending it.
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
  /** Grouped status */
  status?: Filter
  /** The actual process department */
  stage?: Filter
  supportStatus?: Filter
  grantMethod?: Filter
  funding?: Filter
  owner?: Filter
  /** true = unowned only */
  unowned?: boolean
  /** true = only those past the department's time limit */
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
  /** true = incomplete document file */
  docsIncomplete?: boolean
  /** true = has projects in execution */
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

/* Internal helpers */

const eq = (filter: Filter, value: string): boolean =>
  !filter || (Array.isArray(filter) ? filter.length === 0 || filter.includes(value) : filter === value)

/** For fields where a row holds a set (tags): intersection, not exact match */
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

/** Ratio of time-in-department to its limit · the basis for "longest waiting" sort order and row coloring */
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
  /* `?? ''` isn't decoration: a project with no owner or no support decision must fall outside the
   filter when the user selects a specific owner or support status. */
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
    /* The displayed code is part of the search scope: a user copies it from the table or an email and
   pastes it here, and if it doesn't match they'll think the project was removed. */
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
      // Longest waiting first; those already done (no limit) go last
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

/** A complete entity file = 8 documents */
export const ENTITY_DOCS_TOTAL = 8

/* Interface */

export const repository = {
  // Projects
  listProjects(query: ProjectQuery = {}): Promise<Page<ProjectRow>> {
    const filtered = projectRows.filter((r) => matchProject(r, query))
    return resolve(paginate(sortProjects(filtered, query.sort), query.page, query.pageSize))
  },

  /** Quick count per status group · for the tiers above the list */
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

  /** The full project · still only one detailed fixture */
  getProject(id: string): Promise<Project | null> {
    return resolve(id === mockProject.id ? mockProject : null)
  },

  // Entities
  listEntities(query: EntityQuery = {}): Promise<Page<EntityRow>> {
    const filtered = entityRows.filter((e) => matchEntity(e, query))
    return resolve(paginate(sortEntities(filtered, query.sort), query.page, query.pageSize))
  },

  getEntityRow(id: string): Promise<EntityRow | null> {
    return resolve(entityById(id) ?? null)
  },

  /** Detailed entity file · one fixture until it's expanded */
  getEntity(_id?: string): Promise<Entity> {
    return resolve(mockEntity)
  },

  /** Two-way link between an entity and its projects */
  listEntityProjects(entityId: string): Promise<ProjectRow[]> {
    return resolve(sortProjects(projectsOfEntity(entityId), 'newest'))
  },

  // Decision context
  getAuthority(): Promise<AuthorityMatrix> {
    return resolve(mockAuthority)
  },

  getProjectInsights(_id: string): Promise<Insight[]> {
    return resolve(mockInsights)
  },

  getFollowUpTypes(): Promise<FollowUpType[]> {
    return resolve(mockFollowUpTypes)
  },

  // User
  getCurrentUser(): Promise<CurrentUser> {
    return resolve(mockUser)
  },
}

/**
 * Synchronous readings for the fixtures.
 * Screens currently use these since there's no backend or real loading states; once the connection
 * is wired in, the screen switches to `repository.*` and adds a loading state.
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

/** Synchronous copies of the same logic · used by screens until there's a real server */
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
