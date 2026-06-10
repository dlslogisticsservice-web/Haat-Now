export interface User {
  id: string;
  phone_number: string;
  role: 'customer' | 'merchant' | 'driver' | 'admin';
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
