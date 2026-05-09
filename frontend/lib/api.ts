const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/** Direct URL for downloading the Excel import template (anonymous endpoint). */
export function importTemplateUrl(): string {
  return `${API_BASE}/api/projects/import-template`;
}

const TOKEN_KEY = "simulyn_token";
const ORG_KEY = "simulyn_active_org";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_KEY);
}

export function setActiveOrgId(orgId: string | null) {
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
  // Notify the rest of the app (Nav, switcher) that org changed.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("simulyn:org-changed"));
  }
}

/** Error thrown by the API client. Carries the HTTP status so UI code can
 *  render different paths (e.g. redirect on 401, banner on 429). */
export class ApiError extends Error {
  status: number;
  body: string;
  /** Server-provided trace id (when ProblemDetails returned) — useful for support. */
  traceId?: string;
  /** Seconds until budget reset (for 429 budget_exceeded only). */
  retryAfterSeconds?: number;
  constructor(message: string, status: number, body: string, opts: { traceId?: string; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.traceId = opts.traceId;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

/** Subscribe to global "user must re-authenticate" events. The Nav clears
 *  state and pushes the user to /login when this fires. */
export type AuthExpiredHandler = () => void;
const authExpiredHandlers: AuthExpiredHandler[] = [];
export function onAuthExpired(h: AuthExpiredHandler) {
  authExpiredHandlers.push(h);
  return () => {
    const i = authExpiredHandlers.indexOf(h);
    if (i >= 0) authExpiredHandlers.splice(i, 1);
  };
}
function fireAuthExpired() {
  for (const h of authExpiredHandlers) {
    try { h(); } catch { /* ignore handler errors */ }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("simulyn:auth-expired"));
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.auth !== false) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
    const orgId = getActiveOrgId();
    if (orgId) headers["X-Organization-Id"] = orgId;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // DNS / TCP / CORS errors land here. Surface as a 0-status ApiError so UI
    // code can branch on it the same way as other failures.
    throw new ApiError(
      "Could not reach the Simulyn API. Check your network connection and try again.",
      0,
      networkErr instanceof Error ? networkErr.message : String(networkErr),
    );
  }

  if (!res.ok) {
    const text = await res.text();

    // 401: token expired or missing. Clear local auth state and let the app
    // redirect to /login so the user isn't stuck retrying with a dead token.
    // We deliberately scope this to authenticated requests — login itself can
    // (legitimately) return 401 for "wrong password" without us nuking state.
    if (res.status === 401 && options.auth !== false) {
      clearToken();
      fireAuthExpired();
    }

    let traceId: string | undefined;
    let retryAfterSeconds: number | undefined;
    let friendlyMessage: string | undefined;

    // Try to parse RFC 7807 ProblemDetails (global handler) or our budget JSON.
    if (text) {
      try {
        const j = JSON.parse(text) as Record<string, unknown>;
        if (typeof j.traceId === "string") traceId = j.traceId;
        if (typeof j.retryAfterSeconds === "number") retryAfterSeconds = j.retryAfterSeconds;
        if (typeof j.message === "string") friendlyMessage = j.message;
        else if (typeof j.title === "string") friendlyMessage = j.title;
      } catch {
        // not JSON — fall through to text
      }
    }

    if (res.status === 429 && retryAfterSeconds === undefined) {
      const ra = res.headers.get("Retry-After");
      const n = ra ? Number(ra) : NaN;
      if (Number.isFinite(n)) retryAfterSeconds = n;
    }

    const message = friendlyMessage
      ?? text
      ?? defaultStatusMessage(res.status);
    throw new ApiError(message, res.status, text, { traceId, retryAfterSeconds });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function defaultStatusMessage(status: number): string {
  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 402: return "Subscription required. Upgrade your plan or contact sales.";
    case 403: return "You don't have permission to do that.";
    case 404: return "Not found.";
    case 429: return "Too many requests. Please wait a moment and try again.";
    case 503: return "Service is temporarily unavailable. Try again in a minute.";
    default:
      if (status >= 500) return "The server hit an unexpected error. The team has been notified.";
      return `Request failed (${status}).`;
  }
}

export type InvitePreview = {
  email: string;
  organizationName: string;
  role: string;
  expiresAt: string;
};

export type BudgetStatus = {
  todayMills: number;
  softCapMills: number;
  hardCapMills: number;
  level: "Ok" | "Warning" | "Blocked";
};

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; userId: string; name: string; email: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }), auth: false }
    ),
  register: (name: string, email: string, password: string, inviteToken?: string) =>
    request<{ token: string; userId: string; name: string; email: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ name, email, password, inviteToken }),
        auth: false,
      },
    ),
  requestPasswordReset: (email: string) =>
    request<{ status: string }>("/api/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    }),
  resetPassword: (token: string, password: string) =>
    request<{ status: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      auth: false,
    }),
  invitePreview: (token: string) =>
    request<InvitePreview>(
      `/api/auth/invite-preview?token=${encodeURIComponent(token)}`,
      { auth: false },
    ),

  // Billing / budget
  getBudget: () => request<BudgetStatus>("/api/billing/budget"),
  createCheckoutSession: (plan: string) =>
    request<{ sessionId: string; url: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  // Organizations
  myOrganizations: () => request<OrganizationDto[]>("/api/organizations"),
  createOrganization: (name: string) =>
    request<OrganizationDto>("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateOrganization: (id: string, name: string) =>
    request<void>(`/api/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteOrganization: (id: string) =>
    request<void>(`/api/organizations/${id}`, { method: "DELETE" }),
  organizationMembers: (id: string) =>
    request<OrganizationMemberDto[]>(`/api/organizations/${id}/members`),
  addOrganizationMember: (id: string, email: string, role: string) =>
    request<OrganizationMemberDto>(`/api/organizations/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  updateMemberRole: (id: string, userId: string, role: string) =>
    request<void>(`/api/organizations/${id}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  removeMember: (id: string, userId: string) =>
    request<void>(`/api/organizations/${id}/members/${userId}`, { method: "DELETE" }),

  // Projects / tasks (org-scoped via X-Organization-Id header)
  projects: () => request<ProjectDto[]>("/api/projects"),
  project: (id: string) => request<ProjectDto>(`/api/projects/${id}`),
  createProject: (body: CreateProjectBody) =>
    request<ProjectDto>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: Partial<CreateProjectBody>) =>
    request<ProjectDto>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  createSampleProject: () =>
    request<ProjectDto>("/api/projects/sample", { method: "POST" }),
  createSampleBundle: () =>
    request<ProjectDto[]>("/api/projects/sample-bundle", { method: "POST" }),
  projectBrief: (id: string, refresh = false) =>
    request<ProjectBriefDto>(
      `/api/projects/${id}/brief${refresh ? "?refresh=true" : ""}`,
    ),
  tasks: (projectId: string) =>
    request<TaskDto[]>(`/api/tasks/project/${projectId}`),
  createTask: (body: CreateTaskBody) =>
    request<TaskDto>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<CreateTaskBody>) =>
    request<TaskDto>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTask: (id: string) =>
    request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  runPrediction: (body: { taskId?: string; projectId?: string }) =>
    request<PredictionResult[]>("/api/predictions/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runSimulation: (body: { projectId: string; inputDelayDays: number }) =>
    request<SimulationResult>("/api/simulation", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runScenario: (body: RunScenarioBody) =>
    request<SimulationResult>("/api/simulation", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  compareScenarios: (body: CompareScenariosBody) =>
    request<CompareScenariosResponse>("/api/simulation/compare", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  autoSuggestScenarios: (projectId: string) =>
    request<AutoSuggestResponse>(
      `/api/simulation/auto-suggest?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST" },
    ),
  dashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  alerts: () => request<AlertItem[]>("/api/dashboard/alerts"),
  insights: (limit = 5) => request<InsightItem[]>(`/api/dashboard/insights?limit=${limit}`),
  riskTrend: (days = 30) =>
    request<RiskTrendPoint[]>(`/api/dashboard/risk-trend?days=${days}`),
  weeklyRecap: (refresh = false) =>
    request<WeeklyRecapDto>(
      `/api/dashboard/weekly-recap${refresh ? "?refresh=true" : ""}`,
    ),
  me: () => request<MeDto>("/api/me"),

  // Platform admin
  adminOrganizations: () => request<AdminOrgDto[]>("/api/admin/organizations"),
  adminUpdateOrgSubscription: (orgId: string, body: SubscriptionUpdateBody) =>
    request<void>(`/api/admin/organizations/${orgId}/subscription`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  chat: (body: { message: string; history?: ChatMessage[] }) =>
    request<ChatReply>("/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  importSchedule: async (projectId: string, file: File): Promise<ImportScheduleResult> => {
    const t = getToken();
    const orgId = getActiveOrgId();
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (t) headers["Authorization"] = `Bearer ${t}`;
    if (orgId) headers["X-Organization-Id"] = orgId;

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/projects/${projectId}/import-schedule`, {
        method: "POST",
        headers,
        body: fd,
      });
    } catch (networkErr) {
      throw new ApiError(
        "Could not reach the Simulyn API. Check your network connection and try again.",
        0,
        networkErr instanceof Error ? networkErr.message : String(networkErr),
      );
    }
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        clearToken();
        fireAuthExpired();
      }
      throw new ApiError(text || defaultStatusMessage(res.status), res.status, text);
    }
    return res.json() as Promise<ImportScheduleResult>;
  },
};

// ----- Types -----

export type ProjectDto = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  taskCount: number;
  highRiskTaskCount: number;
};

export type CreateProjectBody = {
  name: string;
  startDate: string;
  endDate: string;
  status?: string;
};

export type TaskDto = {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  latestRisk?: string | null;
  latestDelayDays?: number | null;
  latestSummary?: string | null;
  latestRecommendation?: string | null;
  latestPredictionAt?: string | null;
  /** Risk level from the prediction run just before the latest (null on first run). */
  previousRisk?: string | null;
  previousDelayDays?: number | null;
  previousPredictionAt?: string | null;
};

export type CreateTaskBody = {
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status?: string;
};

/** One-glance AI project health brief — powers the ProjectHealthBrief widget. */
export type ProjectBriefDto = {
  projectId: string;
  headline: string;
  body: string;
  healthScore: number;
  toneTags: string[];
  createdAt: string;
  /** True when the cached copy was returned because the AI service was unreachable. */
  isStale: boolean;
};

export type PredictionResult = {
  id: string;
  taskId: string;
  riskLevel: string;
  delayDays: number;
  summary?: string | null;
  recommendation?: string | null;
  createdAt: string;
};

export type SimulationResult = {
  id: string;
  projectId: string;
  inputDelay: number;
  predictedDelay: number;
  impactSummary?: string | null;
  createdAt: string;
  scenarioType: string;
  headline?: string | null;
  scenarioConfigJson?: string | null;
};

/** One of the five supported scenario types. Keep in sync with ScenarioTypes.cs. */
export type ScenarioType =
  | "UniformSlip"
  | "SingleTaskSlip"
  | "AddResource"
  | "WeatherPause"
  | "ScopeReduction";

export const SCENARIO_TYPES: ScenarioType[] = [
  "UniformSlip",
  "SingleTaskSlip",
  "AddResource",
  "WeatherPause",
  "ScopeReduction",
];

export const SCENARIO_LABEL: Record<ScenarioType, string> = {
  UniformSlip: "Uniform slip",
  SingleTaskSlip: "Single task slip",
  AddResource: "Add resource",
  WeatherPause: "Weather pause",
  ScopeReduction: "Scope reduction",
};

export type ScenarioConfig =
  | { InputDelayDays: number }
  | { TaskId: string; DelayDays: number }
  | { CapacityMultiplier: number }
  | { PauseDays: number }
  | { TasksRemoved: number };

export type RunScenarioBody = {
  projectId: string;
  scenarioType: ScenarioType;
  config: ScenarioConfig;
};

export type CompareScenariosBody = {
  projectId: string;
  scenarios: RunScenarioBody[];
};

export type CompareScenariosResponse = {
  projectId: string;
  results: SimulationResult[];
};

export type SuggestedScenario = {
  scenarioType: ScenarioType;
  label: string;
  rationale: string;
  /** Raw config object as returned by the AI — shape matches ScenarioConfig. */
  config: Record<string, unknown>;
};

export type AutoSuggestResponse = {
  projectId: string;
  suggestions: SuggestedScenario[];
};

export type DashboardSummary = {
  totalProjects: number;
  highRiskTasks: number;
  openAlerts: number;
  lowRiskTasks: number;
  mediumRiskTasks: number;
  unpredictedTasks: number;
};

export type InsightItem = {
  taskId: string;
  taskName: string;
  projectId: string;
  projectName: string;
  riskLevel: string;
  delayDays: number;
  summary?: string | null;
  recommendation?: string | null;
  createdAt: string;
};

/** One day of historical risk counts. Powers the dashboard "Risk trend" chart. */
export type RiskTrendPoint = {
  date: string;
  highRiskTasks: number;
  mediumRiskTasks: number;
  lowRiskTasks: number;
};

/** AI-generated weekly recap shown at the top of the dashboard. */
export type WeeklyRecapDto = {
  headline: string;
  bullets: string[];
  generatedAt: string;
  /** True when returned via deterministic fallback (AI service unreachable). */
  isStale: boolean;
};

export type AlertItem = {
  type: string;
  /** Legacy combined message (taskName + reason). Kept for back-compat. */
  message: string;
  projectId?: string | null;
  taskId?: string | null;
  riskLevel: string;
  createdAt: string;
  taskName?: string | null;
  projectName?: string | null;
  /** AI-generated plain-English reason for the alert. */
  reason?: string | null;
  /** AI-generated recommended actions (plain text with bullets). */
  recommendation?: string | null;
  delayDays?: number | null;
  /** Deterministic math behind the risk call — rendered in the "Why?" tooltip. */
  whySignal?: string | null;
};

export type MeDto = {
  userId: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  activeOrganizationId?: string | null;
  activeOrganizationName?: string | null;
  activeOrganizationRole?: string | null;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  isEntitled: boolean;
};

export type OrganizationDto = {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  isEntitled: boolean;
  myRole: string;
  memberCount: number;
  projectCount: number;
};

export type OrganizationMemberDto = {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
};

export type AdminOrgDto = {
  organizationId: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  isEntitled: boolean;
  memberCount: number;
  projectCount: number;
};

export type SubscriptionUpdateBody = {
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  billingNotes?: string | null;
};

export type ImportScheduleResult = {
  tasksCreated: number;
  rowsSkipped: number;
  messages: string[];
};

// ----- Chat copilot -----

/**
 * One turn in the chat copilot history. Mirrors the backend ChatMessageDto and
 * the OpenAI message shape so it round-trips cleanly through the AI service.
 *
 * `tool` and assistant-with-tool_calls turns are produced by the orchestrator
 * server-side and surfaced in `usedTools`; the frontend only persists `user`
 * and final-answer `assistant` turns to localStorage.
 */
export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: ChatToolCall[] | null;
  toolCallId?: string | null;
  name?: string | null;
};

export type ChatToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatUsedTool = {
  name: string;
  arguments?: Record<string, unknown> | null;
};

export type ChatReply = {
  reply: string;
  usedTools: ChatUsedTool[];
  detectedLanguage?: string | null;
  provider: string;
  iterationCount: number;
  truncated: boolean;
};

export const ROLES = ["Owner", "Admin", "Member", "Viewer"] as const;
export type Role = (typeof ROLES)[number];

export function canManageMembers(role: string | null | undefined) {
  return role === "Owner" || role === "Admin";
}
export function canWrite(role: string | null | undefined) {
  return role === "Owner" || role === "Admin" || role === "Member";
}
