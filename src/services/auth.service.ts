import { supabase } from '../lib/supabase';
import { User } from '../features/auth/types';

const isSandbox = () => {
  const mode = import.meta.env.VITE_AUTH_MODE || (typeof process !== 'undefined' ? process.env.AUTH_MODE : '');
  // By default, if the deployment is not explicitly set to production and auth mode is sandbox or development
  return mode === 'sandbox' || import.meta.env.MODE === 'development';
};

export const authService = {
  // Mobile OTP Request
  async sendOtp(phoneNumber: string): Promise<{ error: any }> {
    if (isSandbox()) {
      console.log(`[AUTH SANDBOX] Simulated sending OTP to: ${phoneNumber}`);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });
    return { error };
  },

  // Verify OTP SMS Code
  async verifyOtp(phoneNumber: string, token: string): Promise<{ data: { user: User | null }; error: any }> {
    if (isSandbox()) {
      console.log(`[AUTH SANDBOX] Simulated OTP code: ${token} for phone: ${phoneNumber}`);
      
      // Determine user ID based on phone number for state consistency
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const mockUserId = '11111111-2222-3333-4444-' + cleanPhone.padEnd(12, '0').slice(-12);
      
      // Check for custom roles based on phone extension
      let matchedRole: 'customer' | 'merchant' | 'driver' | 'admin' = 'customer';
      if (cleanPhone.endsWith('9')) matchedRole = 'admin';
      else if (cleanPhone.endsWith('8')) matchedRole = 'merchant';
      else if (cleanPhone.endsWith('7')) matchedRole = 'driver';

      // Insert profiles into the database so mock orders can be placed under this user ID correctly
      try {
        if (matchedRole === 'customer') {
          const { data: profile } = await supabase
            .from('customers')
            .select('id')
            .eq('id', mockUserId)
            .maybeSingle();
          
          if (!profile) {
            await supabase.from('customers').insert({
              id: mockUserId,
              phone_number: phoneNumber,
              full_name: 'عميل تجريبي (صندوق الرمل)',
              email: null
            });
          }
        } else if (matchedRole === 'driver') {
          const { data: driver } = await supabase
            .from('drivers')
            .select('id')
            .eq('id', mockUserId)
            .maybeSingle();
          
          if (!driver) {
            await supabase.from('drivers').insert({
              id: mockUserId,
              phone_number: phoneNumber,
              full_name: 'كابتن تجريبي (صندوق الرمل)',
              is_online: true
            });
          }
        }
      } catch (err) {
        console.warn('[AUTH SANDBOX] Silently skipped sandbox developer-profile auto-insertion:', err);
      }

      const mappedUser: User = {
        id: mockUserId,
        phone_number: phoneNumber,
        role: matchedRole
      };

      return {
        data: { user: mappedUser },
        error: null
      };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token,
      type: 'sms',
    });

    if (error) {
      return { data: { user: null }, error };
    }

    const sbUser = data.user;
    if (!sbUser) {
      return { data: { user: null }, error: new Error('User not generated') };
    }

    // Try to retrieve user custom roles or configure custom profile on first login
    const { data: roleAssigned } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', sbUser.id)
      .single();

    const matchedRole = (roleAssigned as any)?.roles?.name || 'customer';

    // Auto-create customer profile if it doesn't exist
    if (matchedRole === 'customer') {
      const { data: profile } = await supabase
        .from('customers')
        .select('id')
        .eq('id', sbUser.id)
        .single();
      
      if (!profile) {
        await supabase.from('customers').insert({
          id: sbUser.id,
          phone_number: phoneNumber,
          full_name: 'عميل جديد',
          email: null
        });
      }
    }

    const mappedUser: User = {
      id: sbUser.id,
      phone_number: sbUser.phone || phoneNumber,
      role: matchedRole
    };

    return {
      data: { user: mappedUser },
      error: null
    };
  },

  // Get current active session user
  async getCurrentUser(): Promise<User | null> {
    if (isSandbox()) {
      const saved = localStorage.getItem('haat_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (_) {
          return null;
        }
      }
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: roleAssigned } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)
      .single();

    const matchedRole = (roleAssigned as any)?.roles?.name || 'customer';

    return {
      id: user.id,
      phone_number: user.phone || '',
      role: matchedRole
    };
  },

  // Log user out
  async signOut(): Promise<{ error: any }> {
    if (isSandbox()) {
      localStorage.removeItem('haat_session');
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  }
};
