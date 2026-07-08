import axios from "axios";
import {
  ActivityLogRecord,
  ApiResponse,
  FollowUpPayload,
  FollowUpRecord,
  LoginResponse,
  UserRecord,
  UserRole,
  VisitEditableFields,
  VisitPayload,
  VisitRecord,
} from "@/types";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

if (!APPS_SCRIPT_URL && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "NEXT_PUBLIC_APPS_SCRIPT_URL is not set. Add it to .env.local to connect to Google Sheets."
  );
}

/**
 * Google Apps Script web apps do not reliably support the
 * "application/json" content-type for cross-origin POST requests
 * because it triggers a CORS pre-flight (OPTIONS) request that
 * Apps Script cannot answer. Sending the body as text/plain avoids
 * the pre-flight while Apps Script still parses e.postData.contents
 * as JSON on the server side.
 */
const apiClient = axios.create({
  baseURL: APPS_SCRIPT_URL,
  headers: {
    "Content-Type": "text/plain;charset=utf-8",
  },
  timeout: 20000,
});

/**
 * Logs a user in against the "Users" sheet. Disabled accounts and bad
 * credentials both come back as success: false.
 */
export async function loginRequest(
  username: string,
  password: string
): Promise<LoginResponse> {
  const res = await apiClient.post("", {
    action: "login",
    username,
    password,
  });
  return res.data as LoginResponse;
}

/**
 * Submits a new school visit. Appended as a new row in the "Visits" sheet.
 * Rejected server-side if the same school_name + latitude + longitude
 * has already been logged.
 */
export async function submitVisit(
  payload: VisitPayload
): Promise<ApiResponse> {
  const res = await apiClient.post("", {
    action: "addVisit",
    ...payload,
  });
  return res.data as ApiResponse;
}

/**
 * Fetches visit rows from the "Visits" sheet. Admins get every row;
 * everyone else only gets rows tagged with their own username — the
 * scoping happens server-side in Code.gs (the `role` param is not
 * trusted by the backend, only sent for parity with the request shape).
 */
export async function getVisits(
  username: string,
  role: UserRole
): Promise<VisitRecord[]> {
  const res = await apiClient.get("", {
    params: { action: "visits", username, role },
  });
  const data = res.data as ApiResponse<VisitRecord[]>;
  return data.data || [];
}

/**
 * Updates an existing visit row in place (never appends a new row).
 * The backend re-verifies the requester is an admin or the visit's
 * owner before applying any change.
 */
export async function updateVisit(payload: {
  requestedBy: string;
  visit_id: string;
} & Partial<VisitEditableFields>): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "updateVisit", ...payload });
  return res.data as ApiResponse;
}

/**
 * Soft-deletes a visit (kept in the sheet with deleted/deleted_by/
 * deleted_at stamped, excluded from all normal queries).
 */
export async function deleteVisit(payload: {
  requestedBy: string;
  visit_id: string;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "deleteVisit", ...payload });
  return res.data as ApiResponse;
}

/**
 * Fetches the follow-up history for one visit. The backend verifies
 * the requester is an admin or the visit's owner before returning
 * anything (soft-deleted entries are excluded).
 */
export async function getFollowUps(visitId: string, requestedBy: string): Promise<FollowUpRecord[]> {
  const res = await apiClient.get("", {
    params: { action: "followups", visit_id: visitId, requestedBy },
  });
  const data = res.data as ApiResponse<FollowUpRecord[]>;
  return data.data || [];
}

/** Adds a follow-up entry to a visit. Admin or the visit's owner only. */
export async function addFollowUp(
  payload: { requestedBy: string } & FollowUpPayload
): Promise<ApiResponse<FollowUpRecord>> {
  const res = await apiClient.post("", { action: "addFollowUp", ...payload });
  return res.data as ApiResponse<FollowUpRecord>;
}

/**
 * Updates a follow-up entry in place. Admin or whoever created that
 * specific entry only — not merely the visit's owner, so one rep
 * can't alter a note an admin (or, in principle, someone else) added.
 */
export async function updateFollowUp(
  payload: { requestedBy: string; followup_id: string } & Partial<FollowUpPayload>
): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "updateFollowUp", ...payload });
  return res.data as ApiResponse;
}

/** Soft-deletes a follow-up entry. Admin or its creator only. */
export async function deleteFollowUp(payload: {
  requestedBy: string;
  followup_id: string;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "deleteFollowUp", ...payload });
  return res.data as ApiResponse;
}

/** Lists all users. Admin only (enforced server-side). */
export async function getUsers(requestedBy: string): Promise<UserRecord[]> {
  const res = await apiClient.get("", {
    params: { action: "listUsers", requestedBy },
  });
  const data = res.data as ApiResponse<UserRecord[]>;
  return data.data || [];
}

export async function addUser(payload: {
  requestedBy: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "addUser", ...payload });
  return res.data as ApiResponse;
}

export async function updateUser(payload: {
  requestedBy: string;
  username: string;
  name: string;
  role: UserRole;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "updateUser", ...payload });
  return res.data as ApiResponse;
}

export async function setUserStatus(payload: {
  requestedBy: string;
  username: string;
  status: "active" | "disabled";
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "setUserStatus", ...payload });
  return res.data as ApiResponse;
}

export async function deleteUser(payload: {
  requestedBy: string;
  username: string;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "deleteUser", ...payload });
  return res.data as ApiResponse;
}

export async function resetPassword(payload: {
  requestedBy: string;
  username: string;
  newPassword: string;
}): Promise<ApiResponse> {
  const res = await apiClient.post("", { action: "resetPassword", ...payload });
  return res.data as ApiResponse;
}

/** Fetches the Activity Log. Admin only (enforced server-side). */
export async function getActivityLog(requestedBy: string): Promise<ActivityLogRecord[]> {
  const res = await apiClient.get("", {
    params: { action: "activityLog", requestedBy },
  });
  const data = res.data as ApiResponse<ActivityLogRecord[]>;
  return data.data || [];
}

/**
 * Best-effort log of a logout event. Fire-and-forget: failures are
 * swallowed since the user is leaving anyway.
 */
export async function logoutRequest(username: string): Promise<void> {
  try {
    await apiClient.post("", { action: "logout", username });
  } catch {
    // Logging a logout must never block the user from actually logging out.
  }
}

export default apiClient;
