export interface LoginRequest {
  email: string;
  password: string;
}

export interface AdminIdentityResponse {
  id: string;
  orgId: string | null;
  role: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: AdminIdentityResponse;
}

export interface RefreshRequest {
  refreshToken: string;
}
