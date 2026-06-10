import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export function useAuth(requireAuth = true) {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading && requireAuth && !user) {
      navigate('/login');
    }
  }, [user, isLoading, requireAuth, navigate]);

  return { user, isLoading };
}
