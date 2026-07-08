import axios from "axios";
import {
  ApiResponse,
  LoginResponse,
  UserRecord,
  UserRole,
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
 * scoping happens server-side in Code.gs.
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

export default apiClient;
