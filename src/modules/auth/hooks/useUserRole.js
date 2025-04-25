import { useState, useEffect } from 'react';
import { useAuthContext } from '../providers/AuthProvider';
import { supabase } from '@/supabaseClient';
import * as Sentry from '@sentry/browser';

export function useUserRole() {
  const { user } = useAuthContext();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch('/api/getUserRole', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch user role');
        }
        
        const { role } = await response.json();
        setRole(role);
      } catch (error) {
        console.error('Error fetching user role:', error);
        Sentry.captureException(error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserRole();
  }, [user]);
  
  return { role, loading };
}