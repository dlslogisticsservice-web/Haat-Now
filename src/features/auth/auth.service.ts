import { supabase } from '../../lib/supabase';
import { User } from './types';
import { AuthError } from '@supabase/supabase-js';

export const authService = {
  // OTP Auth
  async sendOtp(phoneNumber: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });
    return { error };
  },

  async verifyOtp(phoneNumber: string, token: string): Promise<{ data: { user: User | null }; error: AuthError | null }> {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token,
      type: 'sms',
    });
    
    // Proper mapping of the supabase user to our internal User type
    return {
      data: { 
        user: data.user ? { 
          id: data.user.id, 
          phone_number: data.user.phone || phoneNumber, 
          role: 'customer' 
        } : null 
      },
      error
    };
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id, phone_number: user.phone || '', role: 'customer' } : null;
  },

  async signOut(): Promise<{ error: AuthError | null }> {
    return await supabase.auth.signOut();
  }
};
