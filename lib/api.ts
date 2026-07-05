import axios from "axios";
import {
  ApiResponse,
  LoginResponse,
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
 * Logs a marketing executive in against the "Users" sheet.
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
 * Fetches all visit rows from the "Visits" sheet.
 * Filtering (today / by executive) is done client-side so the
 * Apps Script endpoint can stay a single simple GET.
 */
export async function getVisits(): Promise<VisitRecord[]> {
  const res = await apiClient.get("", {
    params: { action: "visits" },
  });
  const data = res.data as ApiResponse<VisitRecord[]>;
  return data.data || [];
}

export default apiClient;
