export type UserRole = 'ADMIN' | 'STUDENT';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'On Duty' | 'Pending';

export type Department = {
  id: string;
  name: string;
};

export type StudentProfile = {
  id: string;
  register_number: string;
  name: string;
  dob?: string | null;
  blood_group?: string | null;
  address?: string | null;
  year?: number | string | null;
  semester?: number | string | null;
  parent_phone?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type SessionUser = {
  role: UserRole;
  name: string;
  email?: string | null;
  studentId?: string;
  registerNumber?: string | null;
};

export type AppSession = {
  role: UserRole;
  token: string;
  expiresAt: string | null;
  user: SessionUser;
  student?: StudentProfile | null;
};

export type SessionSubject = {
  id?: string;
  subject?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type AttendanceRecord = {
  id: string;
  student_id: string;
  session_id?: string | null;
  status: AttendanceStatus | string;
  period?: string | null;
  timestamp: string;
  source?: string | null;
  confidence?: number | null;
  review_id?: string | null;
  notes?: string | null;
  is_derived?: boolean;
  students?: StudentProfile | null;
  sessions?: SessionSubject | null;
};

export type RecognitionReview = {
  id: string;
  candidate_student_id?: string | null;
  period?: string | null;
  confidence?: number | null;
  created_at: string;
  image_url?: string | null;
  candidate_student?: Pick<StudentProfile, 'id' | 'name' | 'register_number'> | null;
};

export type AttendanceSettings = {
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
  auto_mark_absent: boolean;
  auto_accept_threshold: number;
  review_threshold: number;
  consensus_frames: number;
  cooldown_seconds: number;
  review_expiry_minutes: number;
};

export type HolidayItem = {
  id: string;
  date: string;
  reason: string;
  is_holiday: boolean;
};
