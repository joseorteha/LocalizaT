export type User = {
  id: number;
  email: string;
  is_staff: boolean;
  is_point_member: boolean;
  point_ids: number[];
};
export type Kind = "lost" | "found";
export type Report = {
  id: string;
  folio: string;
  kind: Kind;
  category: string;
  description: string;
  approximate_area: string;
  occurred_on: string;
  holder: string;
  status: string;
  created_at: string;
  publication_status: string;
  public_summary: string;
  public_area: string;
  publication_review_reason: string;
  match_count: number;
};
export type ReportInput = {
  client_request_id: string;
  kind: Kind;
  category: string;
  description: string;
  approximate_area: string;
  occurred_on: string;
  ownership_clue: string;
};
export type PublicReport = {
  id: string;
  kind: Kind;
  category: string;
  public_summary: string;
  public_area: string;
  occurred_on: string;
  published_at: string | null;
};
export type Page<T> = {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
};
export type Suggestion = {
  id: number;
  reasons: string[];
  status: string;
  counterpart: PublicReport | null;
  requires_operator_review: boolean;
};
export type Claim = {
  id: number;
  found_report: string;
  lost_report: string | null;
  claimant: number;
  status: string;
  created_at: string;
  decided_at: string | null;
  evidence?: string;
  decision_reason?: string;
  found_summary: PublicReport;
  handover: { id: number; status: string } | null;
  verification?: Verification;
};
// Solo para el equipo: lo necesario para comparar la evidencia y coordinar.
export type CaseReport = {
  folio: string;
  description: string;
  approximate_area: string;
  occurred_on: string;
  owner_email: string;
  ownership_clue?: string;
};
export type Verification = {
  claimant_email: string;
  found: CaseReport;
  lost: CaseReport | null;
};
export type Notice = {
  id: number;
  kind: string;
  title: string;
  body: string;
  report_id: string | null;
  created_at: string;
  read_at: string | null;
};
export type Point = { id: number; name: string; public_area: string };
export type Publication = PublicReport & { description: string; publication_status: "pending" | "public" };
export type PublicationResult = {
  publication_status: "public" | "pending";
  public_summary: string;
  public_area: string;
};
export type MapZone = {
  name: string;
  coordinates: [number, number];
  lost: number;
  found: number;
  total: number;
};
export type ReportMap = { zones: MapZone[]; without_municipality: number };
export type PushConfig = { enabled: boolean; public_key: string };
export type ReviewMatch = {
  id: number;
  lost_report: Report;
  found_report: Report;
  reasons: string[];
};
export type Inventory = {
  report_id: string;
  folio: string;
  description: string;
  status: string;
  point_id: number;
  point_name: string;
};
export type Metrics = {
  reports_by_status: Record<string, number>;
  publications_pending: number;
  public_reports: number;
  suggestions_pending: number;
  claims_by_status: Record<string, number>;
  handovers_confirmed: number;
  matching_jobs_failed: number;
};

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorText).join(" ");
  if (value && typeof value === "object")
    return Object.values(value).map(errorText).join(" ");
  return "";
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (method !== "GET") {
    const csrfResponse = await fetch("/api/auth/csrf/", {
      credentials: "same-origin",
    });
    if (!csrfResponse.ok)
      throw new Error("No se pudo preparar tu sesión. Intenta de nuevo.");
    const csrf = (await csrfResponse.json()) as { csrfToken: string };
    headers.set("X-CSRFToken", csrf.csrfToken);
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      method,
      headers,
      credentials: "same-origin",
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new APIError(
      errorText(data) || "No se pudo completar la solicitud.",
      response.status,
    );
  return data as T;
}
const post = <T>(path: string, data: unknown = {}) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data) });
export const api = {
  me: () => request<{ user: User | null }>("/api/auth/me/"),
  login: (email: string, password: string) =>
    post<{ user: User }>("/api/auth/login/", { email, password }),
  signup: (email: string, password: string) =>
    post<{ user: User }>("/api/auth/signup/", { email, password }),
  logout: () => post("/api/auth/logout/"),
  authConfig: () => request<{ google_client_id: string }>("/api/auth/config/"),
  googleLogin: (credential: string) =>
    post<{ user: User }>("/api/auth/google/", { credential }),
  pushConfig: () => request<PushConfig>("/api/push/config/"),
  pushSubscriptionStatus: (endpoint: string) =>
    request<{ subscribed: boolean }>(`/api/push/subscriptions/?${new URLSearchParams({ endpoint })}`),
  savePushSubscription: (subscription: PushSubscriptionJSON) =>
    post<{ subscribed: boolean }>("/api/push/subscriptions/", subscription),
  deletePushSubscription: (endpoint: string) =>
    request<{ subscribed: boolean }>("/api/push/subscriptions/", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  publicReports: (filters: Record<string, string> = {}) =>
    request<Page<PublicReport>>(
      `/api/public/reports/?${new URLSearchParams(filters)}`,
    ),
  publicReport: (id: string) =>
    request<PublicReport>(`/api/public/reports/${id}/`),
  reports: () => request<Report[]>("/api/reports/"),
  report: (id: string) => request<Report>(`/api/reports/${id}/`),
  createReport: (data: ReportInput) => post<Report>("/api/reports/", data),
  publishBasic: (id: string, municipality = "") =>
    post<PublicationResult>(`/api/reports/${id}/publication/`, {
      mode: "instant", ...(municipality ? { municipality } : {}),
    }),
  reportMap: (filters: Record<string, string> = {}) =>
    request<ReportMap>(`/api/public/report-map/?${new URLSearchParams(filters)}`),
  publish: (id: string, public_summary: string, public_area: string) =>
    post<PublicationResult>(`/api/reports/${id}/publication/`, {
      mode: "review", public_summary, public_area,
    }),
  withdraw: (id: string) =>
    request(`/api/reports/${id}/publication/`, { method: "DELETE" }),
  close: (id: string) => post(`/api/reports/${id}/close/`),
  suggestions: (id: string) =>
    request<Suggestion[]>(`/api/reports/${id}/suggestions/`),
  claims: () => request<Claim[]>("/api/claims/"),
  claim: (id: number) => request<Claim>(`/api/claims/${id}/`),
  createClaim: (
    found_report_id: string,
    evidence: string,
    lost_report_id?: string,
  ) =>
    post<Claim>("/api/claims/", {
      found_report_id,
      evidence,
      ...(lost_report_id ? { lost_report_id } : {}),
    }),
  confirmHandover: (id: number) => post(`/api/handovers/${id}/confirm/`),
  notices: () => request<Notice[]>("/api/notifications/"),
  readNotice: (id: number) => post(`/api/notifications/${id}/read/`),
  points: () => request<Point[]>("/api/points/"),
  publications: (status: "pending" | "public" = "pending") =>
    request<Publication[]>(`/api/ops/publications/?status=${status}`),
  reviewPublication: (id: string, decision: string, reason: string) =>
    post(`/api/ops/reports/${id}/publication/`, { decision, reason }),
  reviewMatches: () => request<ReviewMatch[]>("/api/ops/suggestions/"),
  dismissMatch: (id: number) =>
    post(`/api/ops/suggestions/${id}/review/`, { decision: "dismiss" }),
  decideClaim: (id: number, decision: string, reason: string) =>
    post(`/api/ops/claims/${id}/decision/`, { decision, reason }),
  metrics: () => request<Metrics>("/api/ops/metrics/"),
  inventory: () => request<Inventory[]>("/api/custody/inventory/"),
  intake: (folio: string, point_id: number, note: string) =>
    post("/api/custody/intake/", { folio, point_id, note }),
  transfer: (report_id: string, target_point_id: number, note: string) =>
    post("/api/custody/transfer/", { report_id, target_point_id, note }),
  startHandover: (claim_id: number, note: string) =>
    post("/api/handovers/", { claim_id, note }),
};
