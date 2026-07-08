export type InterestLevel = "Hot" | "Warm" | "Cold";
export type UserRole = "admin" | "user";
export type UserStatus = "active" | "disabled";

export interface VisitPayload {
  date: string;
  username: string;
  executive: string;
  school_name: string;
  visitor: string;
  designation: string;
  mobile: string;
  address: string;
  google_map: string;
  latitude: string;
  longitude: string;
  accuracy: string;
  instruction: string;
  students: string;
  teachers: string;
  current_software: string;
  interest: InterestLevel | "";
  report: string;
  followup: string;
  notes: string;
}

export interface VisitRecord extends VisitPayload {
  timestamp?: string;
  visit_id?: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  deleted?: string;
  deleted_by?: string;
  deleted_at?: string;
  /** Status of the most recent (non-deleted) Follow-up entry for this
   * visit, if any — computed server-side, not stored on the row. */
  latest_followup_status?: FollowUpStatus | "";
}

/**
 * Fields a visit edit is allowed to change. Kept in sync with the
 * Apps Script VISIT_EDITABLE_FIELDS list.
 *
 * "followup" (the single next-follow-up-date field captured at visit
 * creation) is intentionally NOT editable here — scheduling follow-ups
 * is now done through the dedicated multi-entry Follow-up Timeline
 * (see FollowUpRecord) instead of editing this one field in place.
 */
export type VisitEditableFields = Pick<
  VisitPayload,
  | "school_name"
  | "visitor"
  | "designation"
  | "mobile"
  | "address"
  | "students"
  | "teachers"
  | "current_software"
  | "interest"
  | "report"
  | "notes"
  | "google_map"
  | "latitude"
  | "longitude"
  | "accuracy"
>;

export type FollowUpType = "Phone Call" | "Physical Visit" | "WhatsApp" | "Email" | "Online Meeting";

export type FollowUpStatus = "Pending" | "Completed" | "Interested" | "Not Interested" | "No Response";

export interface FollowUpRecord {
  followup_id: string;
  visit_id: string;
  followup_date: string;
  next_followup_date?: string;
  type: FollowUpType | "";
  status: FollowUpStatus | "";
  notes?: string;
  created_by: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  deleted?: string;
  deleted_by?: string;
  deleted_at?: string;
}

export interface FollowUpPayload {
  visit_id: string;
  followup_date: string;
  next_followup_date: string;
  type: FollowUpType | "";
  status: FollowUpStatus | "";
  notes: string;
}

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export interface LoginResponse {
  success: boolean;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  message?: string;
}

export interface UserRecord {
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ActivityLogRecord {
  timestamp?: string;
  username: string;
  action: string;
  details?: string;
  date: string;
  time: string;
  ip: string;
}
