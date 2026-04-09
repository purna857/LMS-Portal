export type UserRole = 'admin' | 'instructor' | 'student';

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  status: string;
  is_superuser: boolean;
  roles: UserRole[];
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  access_token_expires_at: string;
  refresh_token_expires_at: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface StudentSignupRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
}

export interface InstructorSignupRequest extends StudentSignupRequest {
  headline?: string | null;
  bio?: string | null;
  expertise?: string | null;
  experience_years?: number | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  resume_file_url?: string | null;
}

export interface SignupResponse {
  message: string;
  user_id: string;
  account_status: string;
  approval_status?: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordResponse extends MessageResponse {
  reset_token?: string | null;
  expires_at?: string | null;
}

export interface ResetPasswordResponse extends MessageResponse {}

export interface SessionState {
  user: AuthenticatedUser;
  tokens: TokenPair;
}
