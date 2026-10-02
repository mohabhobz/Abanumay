import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import ProjectPage from '@/features/projects/ProjectPage'
import HomePage from '@/features/home/HomePage'
import ProjectsListPage from '@/features/projects/list/ProjectsListPage'
import EntitiesListPage from '@/features/entities/EntitiesListPage'
import EntityPage from '@/features/entities/EntityPage'
import PortalPage from '@/features/entities/register/PortalPage'
import RegisterPage from '@/features/entities/register/RegisterPage'
import RegisterAccountPage from '@/features/entities/register/AccountPage'
import RequestsPage from '@/features/entities/register/RequestsPage'
import RegReviewPage from '@/features/entities/register/RegReviewPage'
import EntityNewPage from '@/features/entities/register/EntityNewPage'
import AssistantPage from '@/features/assistant/AssistantPage'
import ReportsPage from '@/features/reports/ReportsPage'
import ProcessReport from '@/features/reports/ProcessReport'
import ReportView from '@/features/reports/ReportView'
import LiveReport from '@/features/reports/LiveReport'
import BudgetPage from '@/features/budget/BudgetPage'
import BudgetSettingsPage from '@/features/budget/BudgetSettingsPage'
import BudgetDocPage from '@/features/budget/BudgetDocPage'
import AgreementsPage from '@/features/agreements/AgreementsPage'
import AgreementPage from '@/features/agreements/AgreementPage'
import AgreementNewPage from '@/features/agreements/AgreementNewPage'
import ClosingPage from '@/features/closing/ClosingPage'
import ClosePage from '@/features/closing/ClosePage'
import ReportEditPage from '@/features/closing/ReportEditPage'
import EvalEditPage from '@/features/closing/EvalEditPage'
import CloseSettingsPage from '@/features/closing/CloseSettingsPage'
import PlansPage from '@/features/plans/PlansPage'
import PlanPage from '@/features/plans/PlanPage'
import PlanEditPage from '@/features/plans/PlanEditPage'
import PlanSettingsPage from '@/features/plans/PlanSettingsPage'
import PlanNewPage from '@/features/plans/PlanNewPage'
import PaymentsPage from '@/features/payments/PaymentsPage'
import RequestPage from '@/features/payments/RequestPage'
import RequestForm from '@/features/payments/RequestForm'
import OrderPage from '@/features/payments/OrderPage'
import LatePage from '@/features/payments/LatePage'
import SettingsIndexPage from '@/features/settings/SettingsIndexPage'
import AccountPage from '@/features/account/AccountPage'
import PermissionsPage from '@/features/settings/PermissionsPage'
import PreferencesPage from '@/features/account/PreferencesPage'
import EntitySettingsPage from '@/features/entities/EntitySettingsPage'
import ProjectSettingsPage from '@/features/projects/ProjectSettingsPage'
import ProjectNewPage from '@/features/projects/ProjectNewPage'
import PortfolioPage from '@/features/projects/PortfolioPage'
import { AFTER_LOGIN, DEFAULT_PROJECT_TAB, ROUTES } from './routes'
import { RequireAuth } from './RequireAuth'

/**
 * Screen route map. Every module has a route even if not built yet, so navigation stays fully wired
 * and gaps are visible — an empty screen states what belongs there.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />

        {/* Registration lives outside the auth gate on purpose: the requester has no account, so
            placing this screen behind `RequireAuth` would mean only a signed-in user could open it
            — the opposite of who it's for. That's what caused the "Register new entity" button on
            the login screen to do nothing. */}
        {/* `account` before the parent path isn't strictly necessary here (the parent path is
            literal, not `:param`), but the order matches its siblings so a later
            `/entities/register/:id` addition doesn't invert it. */}
        <Route path={ROUTES.entityRegisterAccount} element={<RegisterAccountPage />} />
        <Route path={ROUTES.entityRegister} element={<RegisterPage />} />

        {/* The gate sits outside internal auth for the same reason as registration: whoever opens
            this screen doesn't have a system account yet, only one tied to their request. Putting
            it behind `RequireAuth` would mean only staff could open it, not the person it's built
            for. */}
        <Route path={ROUTES.entityPortal} element={<PortalPage />} />

        {/* One gate wraps all internal screens instead of repeating it per route: any new screen is
            protected automatically just by being inside. */}
        <Route
          element={
            <RequireAuth>
              <Outlet />
            </RequireAuth>
          }
        >
        <Route path={ROUTES.home} element={<HomePage />} />

        {/* Settings inventory — entered from the account menu, not the rail. */}
        <Route path={ROUTES.settings} element={<SettingsIndexPage />} />
        <Route path={ROUTES.permissions} element={<PermissionsPage />} />

        <Route path={ROUTES.projects} element={<ProjectsListPage />} />

        {/* `settings` must come **before** `:id` — same trap as `/budget/settings` and
            `/payments/new`: the router matches in order. */}
        <Route path={ROUTES.projectSettings} element={<ProjectSettingsPage />} />
        <Route path={ROUTES.projectNew} element={<ProjectNewPage />} />
        <Route path="/projects/portfolio/:id" element={<PortfolioPage />} />
        <Route path={`${ROUTES.projects}/:id`} element={<ProjectPage />} />
        <Route path={`${ROUTES.projects}/:id/:tab`} element={<ProjectPage />} />

        <Route path={ROUTES.entities} element={<EntitiesListPage />} />
        {/* Register a new entity. ⚠️ `register` and `requests` must come **before** `:id` — the
            router matches in order, otherwise `/entities/register` would be read as an entity id
            named "register" and return "not found", the same trap as `/payments/new`. */}
        {/* Direct registration is internal, so it stays behind the gate, unlike
            `/entities/register`, which is for an entity with no account. */}
        <Route path={ROUTES.entityNew} element={<EntityNewPage />} />
        <Route path={ROUTES.entitySettings} element={<EntitySettingsPage />} />
        <Route path={ROUTES.entityRequests} element={<RequestsPage />} />
        <Route path={`${ROUTES.entityRequests}/:id`} element={<RegReviewPage />} />
        <Route path={`${ROUTES.entities}/:id`} element={<EntityPage />} />
        <Route path={`${ROUTES.entities}/:id/:tab`} element={<EntityPage />} />

        <Route path={ROUTES.budget} element={<BudgetPage />} />

        {/* ⚠️ These three must come **before** `:year` — the router matches in order, otherwise
            `/budget/settings` would be read as a year named "settings" and redirect to the budget,
            the same trap as `/payments/new`. */}
        <Route path={ROUTES.budgetSettings} element={<BudgetSettingsPage />} />
        <Route path={ROUTES.budgetNew} element={<BudgetDocPage />} />
        <Route path={`${ROUTES.budget}/doc/:id`} element={<BudgetDocPage />} />

        <Route path={`${ROUTES.budget}/:year`} element={<Navigate to={ROUTES.budget} replace />} />

        {/* Agreements — a process independent of the project; moving it through its stages doesn't
            change the project's status. */}
        <Route path={ROUTES.agreements} element={<AgreementsPage />} />
        {/* ⚠️ `new` before `:id` — same trap as `/payments/new` and `/budget/settings`. */}
        <Route path="/agreements/new" element={<AgreementNewPage />} />
        <Route path={`${ROUTES.agreements}/:id`} element={<AgreementPage />} />

        {/* Plans — an independent process with its own approval cycle, so it gets its own module,
            like agreements, rather than being just a tab on the project. */}
        <Route path={ROUTES.plans} element={<PlansPage />} />
        {/* Settings before `:id`, otherwise the router reads "settings" as a plan number (same
            lesson as `/entities/register`). */}
        <Route path={ROUTES.planSettings} element={<PlanSettingsPage />} />
        {/* ⚠️ Also before `:id` — otherwise the router reads "new" as a plan number and returns "no
            plan with this number" (which actually happened: the button existed, the screen didn't). */}
        <Route path="/plans/new" element={<PlanNewPage />} />
        <Route path={`${ROUTES.plans}/:id/edit`} element={<PlanEditPage />} />
        <Route path={`${ROUTES.plans}/:id`} element={<PlanPage />} />

        {/* Closure — an independent process with two approval cycles; moving it between stages
            doesn't change the project's status. */}
        <Route path={ROUTES.closings} element={<ClosingPage />} />
        {/* ⚠️ Settings before `:id` — same trap as `/plans/settings`. */}
        <Route path={ROUTES.closingSettings} element={<CloseSettingsPage />} />
        <Route path={`${ROUTES.closings}/:id/report`} element={<ReportEditPage />} />
        <Route path={`${ROUTES.closings}/:id/evaluation`} element={<EvalEditPage />} />
        <Route path={`${ROUTES.closings}/:id`} element={<ClosePage />} />

        {/* Disbursement — built from the spec document, with differences from the legacy system
            tracked separately. */}
        <Route path={ROUTES.payments} element={<PaymentsPage />} />
        {/* ⚠️ `new` before `:id` — the router matches in order, otherwise `/payments/new` would be
            read as a request id named "new" and return "not found". */}
        <Route path={`${ROUTES.payments}/new`} element={<RequestForm />} />
        <Route path={ROUTES.paymentsLate} element={<LatePage />} />
        <Route path={`${ROUTES.payments}/:id`} element={<RequestPage />} />
        <Route path={`${ROUTES.payments}/:id/edit`} element={<RequestForm />} />
        <Route path={`${ROUTES.payments}/:id/order`} element={<OrderPage />} />

        <Route path={ROUTES.reports} element={<ReportsPage />} />
        {/* The key is the process slug (e.g. `bpd-004`). Any unrecognized key falls back to the
            index from inside the screen itself rather than a guard route here. */}
        <Route path={`${ROUTES.reports}/view/:key`} element={<ReportView />} />
        <Route path={`${ROUTES.reports}/process/:key`} element={<ProcessReport />} />
        <Route path={`${ROUTES.reports}/screen/:key`} element={<LiveReport />} />
        <Route path={`${ROUTES.reports}/:tab`} element={<ReportsPage />} />

        <Route path={ROUTES.assistant} element={<AssistantPage />} />
        <Route path={`${ROUTES.assistant}/:id`} element={<AssistantPage />} />

        <Route path={ROUTES.account} element={<AccountPage />} />
        <Route
          path={ROUTES.preferences}
          element={<PreferencesPage />}
        />

        </Route>

        {/* Any unrecognized route falls back to the default screen instead of a blank page. */}
        <Route path="*" element={<Navigate to={AFTER_LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/** The default tab is shown here explicitly so it isn't lost if it changes. */
export { DEFAULT_PROJECT_TAB }
