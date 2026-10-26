import { useQuery } from '@tanstack/react-query';
import { authApi, businessesApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import { useBusinessStore } from '@/stores/business';

/**
 * Loads the current user and the list of businesses once on app mount.
 * Returns whether bootstrap is still in flight. If the token is missing
 * the caller should redirect to /login.
 */
export function useBootstrap() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const setBusinesses = useBusinessStore((s) => s.setBusinesses);

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const businessesQuery = useQuery({
    queryKey: ['businesses', 'mine'],
    queryFn: async () => {
      const businesses = await businessesApi.mine();
      setBusinesses(businesses);
      return businesses;
    },
    enabled: Boolean(token) && meQuery.isSuccess,
    retry: false,
    staleTime: 60 * 1000,
  });

  const loading = Boolean(token) && (meQuery.isLoading || businessesQuery.isLoading);

  return {
    token,
    loading,
    meError: meQuery.error,
    businessesError: businessesQuery.error,
  };
}