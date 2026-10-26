import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, businessesApi, dashboardApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import { useBusinessStore } from '@/stores/business';
import { WorkspaceLoader, loaderElapsed, markSignInReveal } from '@/components/ui/workspace-loader';

/** The sign-in loader always shows for this long, start to finish. */
const SIGN_IN_LOADER_MS = 5000;
/** Never keep someone waiting longer than this, even on a slow connection. */
const MAX_WAIT_MS = 15000;

/**
 * Straight after sign-in. The loader stays up for five seconds in all,
 * counted from when it first appeared, and meanwhile the account, the
 * business list and the dashboard figures are fetched. The dashboard then
 * opens already filled in, and the loader fades away over it.
 */
export function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const state = location.state as { redirectTo?: string } | null;
  const redirectTo = state?.redirectTo || '/dashboard';

  useEffect(() => {
    let done = false;
    const open = () => {
      if (done) return;
      done = true;
      markSignInReveal();
      navigate(redirectTo, { replace: true });
    };

    // Same keys as the app shell and dashboard use, so they find it ready
    const prefetch = Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
          const user = await authApi.me();
          useAuthStore.getState().setUser(user);
          return user;
        },
      }),
      queryClient.prefetchQuery({
        queryKey: ['businesses', 'mine'],
        queryFn: async () => {
          const businesses = await businessesApi.mine();
          useBusinessStore.getState().setBusinesses(businesses);
          return businesses;
        },
      }),
      queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get }),
      // The dashboard's own code, so opening it doesn't stop to download it
      import('@/features/dashboard/dashboard-page'),
    ]);
    const minimum = new Promise((resolve) =>
      window.setTimeout(resolve, Math.max(0, SIGN_IN_LOADER_MS - loaderElapsed())),
    );

    void Promise.all([prefetch, minimum]).then(open);
    const cap = window.setTimeout(open, MAX_WAIT_MS);
    return () => {
      done = true;
      window.clearTimeout(cap);
    };
  }, [navigate, redirectTo, queryClient]);

  return <WorkspaceLoader />;
}
