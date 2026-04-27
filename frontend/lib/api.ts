const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "farminstinct_token";

export type User = {
  id: number;
  email: string;
  full_name: string | null;
  preferred_locale: string;
  is_admin: boolean;
};

export type AdminUserSummary = {
  id: number;
  email: string;
  full_name: string | null;
  preferred_locale: string;
  is_admin: boolean;
  created_at: string;
  session_count: number;
  last_completed_at: string | null;
  top_theme_code: string | null;
  top_theme_name: string | null;
};

export type AdminSessionSummary = {
  id: number;
  locale: string;
  started_at: string;
  completed_at: string | null;
  top: ThemeResult[];
};

export type AdminUserDetail = {
  id: number;
  email: string;
  full_name: string | null;
  preferred_locale: string;
  is_admin: boolean;
  created_at: string;
  sessions: AdminSessionSummary[];
};

export type AdminResponseOption = {
  position: number;
  text: string;
  theme_code: string;
  theme_name: string;
};

export type AdminResponseDetail = {
  question_id: number;
  question_code: string;
  order: number;
  kind: "paired" | "likert";
  prompt: string | null;
  value: number;
  value_label: string | null;
  likert_themes: string[];
  options: AdminResponseOption[];
  chosen_text: string | null;
  chosen_theme_code: string | null;
  chosen_theme_name: string | null;
};

export type AdminSessionUser = {
  id: number;
  email: string;
  full_name: string | null;
  preferred_locale: string;
  is_admin: boolean;
};

export type AdminSessionDetail = {
  id: number;
  locale: string;
  started_at: string;
  completed_at: string | null;
  user: AdminSessionUser;
  all_themes: ThemeResult[];
  responses: AdminResponseDetail[];
  primary_archetype: Archetype | null;
  secondary_archetype: Archetype | null;
  recommended_roles: RecommendedRole[];
};

export type TokenResponse = { access_token: string; token_type: string; user: User };

export type AssessmentOption = { position: number; text: string };
export type AssessmentQuestion = {
  id: number;
  code: string;
  kind: "paired" | "likert";
  prompt?: string | null;
  options?: AssessmentOption[];
};
export type AssessmentStart = {
  session_id: number;
  locale: string;
  questions: AssessmentQuestion[];
};

export type ThemeResult = {
  code: string;
  name: string;
  description: string;
  tips: string[];
  score: number;
  rank: number;
};

export type Archetype = {
  code: string;
  rank: number;
  score: number;
  emoji: string;
  color: string;
  name: string;
  tagline: string;
  description: string;
  hidden_truth: string;
  vs_others: string;
  strengths: string[];
  best_role: string;
  frustrated_by: string;
  struggles_with: string;
  wrong_role: string;
  management: string;
};

export type RecommendedRole = {
  code: string;
  emoji: string;
  name: string;
  reason: string;
};

export type AssessmentResult = {
  session_id: number;
  locale: string;
  completed_at: string | null;
  top: ThemeResult[];
  all_themes: ThemeResult[];
  primary_archetype: Archetype | null;
  secondary_archetype: Archetype | null;
  recommended_roles: RecommendedRole[];
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register(payload: { email: string; password: string; full_name?: string; preferred_locale: string }) {
    return request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }, false);
  },
  login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    return request<TokenResponse>(
      "/api/auth/login",
      { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      false,
    );
  },
  me() {
    return request<User>("/api/auth/me");
  },
  startAssessment(locale: "en" | "es") {
    return request<AssessmentStart>(`/api/assessment/start?locale=${locale}`, { method: "POST" });
  },
  submitAssessment(payload: { session_id: number; responses: { question_id: number; value: number }[] }) {
    return request<AssessmentResult>("/api/assessment/submit", { method: "POST", body: JSON.stringify(payload) });
  },
  getResult(sessionId: number) {
    return request<AssessmentResult>(`/api/assessment/result/${sessionId}`);
  },
  history() {
    return request<AssessmentResult[]>("/api/assessment/history");
  },
  adminListUsers() {
    return request<AdminUserSummary[]>("/api/admin/users");
  },
  adminUserDetail(userId: number) {
    return request<AdminUserDetail>(`/api/admin/users/${userId}`);
  },
  adminSessionDetail(sessionId: number) {
    return request<AdminSessionDetail>(`/api/admin/sessions/${sessionId}`);
  },
};
