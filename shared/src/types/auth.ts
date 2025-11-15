export interface User {
  id: string;
  email: string;
  createdAt: Date;
  lastLoginAt?: Date;
  profile: {
    displayName?: string;
    preferences: UserPreferences;
  };
}

export interface UserPreferences {
  defaultTravelMode: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
  distanceUnit: 'metric' | 'imperial';
  autoSaveJourneys: boolean;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginResponse {
  user: User;
  token: AuthToken;
}

export interface RegisterResponse {
  user: User;
  token: AuthToken;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  preferences?: Partial<UserPreferences>;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthState {
  user: User | null;
  token: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}