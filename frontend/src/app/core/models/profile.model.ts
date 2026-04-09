export interface UserProfilePayload {
  avatar_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  language?: string | null;
  headline?: string | null;
  bio?: string | null;
  website_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CurrentProfileResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  status: string;
  email_verified: boolean;
  is_superuser: boolean;
  roles: string[];
  profile?: UserProfilePayload | null;
}

export interface UserProfileUpdatePayload {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  language?: string | null;
  headline?: string | null;
  bio?: string | null;
  website_url?: string | null;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}
