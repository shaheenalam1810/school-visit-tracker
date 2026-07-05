export type InterestLevel = "Hot" | "Warm" | "Cold";

export interface VisitPayload {
  date: string;
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
}

export interface LoginResponse {
  success: boolean;
  name?: string;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
