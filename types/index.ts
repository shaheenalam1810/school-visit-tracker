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
