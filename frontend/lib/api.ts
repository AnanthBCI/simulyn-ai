const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("simulyn_token");
}

export function setToken(token: string) {
  localStorage.setItem("simulyn_token", token);
}

export function clearToken() {
  localStorage.removeItem("simulyn_token");
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as object),
  };
  if (options.auth !== false) {
    const t = getToken();
    if (t) (headers as Record<string, string>)["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; userId: string; name: string; email: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }), auth: false }
    ),
  register: (name: string, email: string, password: string) =>
    request<{ token: string; userId: string; name: string; email: string }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ name, email, password }), auth: false }
    ),
  projects: () =>
    request<ProjectDto[]>("/api/projects"),
  project: (id: string) =>
    request<ProjectDto>(`/api/projects/${id}`),
  createProject: (body: CreateProjectBody) =>
    request<ProjectDto>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  tasks: (projectId: string) =>
    request<TaskDto[]>(`/api/tasks/project/${projectId}`),
  createTask: (body: CreateTaskBody) =>
    request<TaskDto>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<CreateTaskBody>) =>
    request<TaskDto>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
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
  dashboardSummary: () =>
    request<DashboardSummary>("/api/dashboard/summary"),
  alerts: () =>
    request<AlertItem[]>("/api/dashboard/alerts"),
  me: () => request<MeDto>("/api/me"),
  adminUsers: () => request<AdminUserDto[]>("/api/admin/users"),
  adminUpdateSubscription: (userId: string, body: SubscriptionUpdateBody) =>
    request<void>(`/api/admin/users/${userId}/subscription`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importSchedule: async (projectId: string, file: File): Promise<ImportScheduleResult> => {
    const t = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/import-schedule`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json() as Promise<ImportScheduleResult>;
  },
};

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
};

export type CreateTaskBody = {
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status?: string;
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
};

export type DashboardSummary = {
  totalProjects: number;
  highRiskTasks: number;
  openAlerts: number;
};

export type AlertItem = {
  type: string;
  message: string;
  projectId?: string | null;
  taskId?: string | null;
  riskLevel: string;
  createdAt: string;
};

export type MeDto = {
  userId: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  isEntitled: boolean;
};

export type AdminUserDto = {
  userId: string;
  name: string;
  email: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string | null;
  isEntitled: boolean;
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
