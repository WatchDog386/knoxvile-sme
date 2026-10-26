import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Pencil, Save, Sun } from 'lucide-react';
import { authApi, clientApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { ChangePinForm } from '@/features/auth/components/change-pin-form';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { requestLogout } from '@/components/layout/session-timeout';
import { notifySuccess } from '@/components/ui/popup-host';
import { cn } from '@/lib/utils';
import { ProfileRing, profileCompletion } from '@/components/layout/profile-visuals';

const detailsSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.'),
  phone: z.string().trim().max(20, 'That number looks too long.'),
});

type DetailsValues = z.infer<typeof detailsSchema>;


function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

/**
 * The subscriber's own account page: who they are, change their password, switch
 * the theme and sign out. Clients get no other page, so this is their settings screen.
 */
export function ClientProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedAvatar, setPickedAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['client-me'], queryFn: clientApi.me });

  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors: detailsErrors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  const name = data?.customer.name || user?.fullName || '';
  const phone = data?.customer.phone ?? user?.phone ?? null;
  const email = user?.email ?? data?.customer.email ?? null;
  /** The photo just picked, or the one already saved on the account. */
  const avatarUrl = pickedAvatar ?? user?.avatarUrl ?? null;
  const completion = profileCompletion(user ? {
    ...user,
    fullName: name,
    phone: phone ?? '',
    email: email ?? '',
    avatarUrl,
  } : user);
  const completedCount = Math.round((completion / 100) * 6);

  // The server holds the real name/phone, so seed the form once it arrives
  useEffect(() => {
    if (!data) return;
    setValue('fullName', data.customer.name || user?.fullName || '');
    setValue('phone', data.customer.phone ?? user?.phone ?? '');
  }, [data, user, setValue]);

  const saveAvatar = useMutation({
    mutationFn: (url: string) => authApi.updateProfile({ avatarUrl: url }),
    onSuccess: (updated) => {
      // The server copy is the one that counts: drop the local copy so every
      // screen (this page and the dashboard) shows the saved photo
      setPickedAvatar(null);
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['client-me'] });
      notifySuccess('Photo updated', 'Your new photo now shows on your dashboard.');
    },
  });

  const saveDetails = useMutation({
    mutationFn: (values: DetailsValues) =>
      authApi.updateProfile({
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || undefined,
        // Only ever send a photo: an empty value here would wipe the saved one
        avatarUrl: avatarUrl ?? undefined,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['client-me'] });
      notifySuccess('Details saved', 'Your profile has been updated.');
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow picking the same file twice in a row
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image size must be less than 2MB.');
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    // Shown straight away, then saved on its own so it never depends on the
    // details form being submitted
    reader.onload = () => {
      const url = reader.result as string;
      setPickedAvatar(url);
      saveAvatar.mutate(url);
    };
    reader.readAsDataURL(file);
  };

  const signOut = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="relative isolate -mx-4 -mt-2 min-h-[100dvh] bg-black pb-10 text-white">

      {/* Back to the dashboard */}
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-white/15 bg-black px-4 pb-3 pt-[max(0.75rem,var(--sat))]">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex h-12 w-12 shrink-0 items-center justify-start text-[14px] font-medium text-white active:opacity-60"
          aria-label="Back"
        >
          Back
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-white">Personal Details</h1>
        <button
          type="button"
          onClick={() => document.getElementById('client-fullName')?.focus()}
          className="flex h-12 w-12 shrink-0 items-center justify-end text-white active:scale-90 active:opacity-60"
          aria-label="Edit personal details"
        >
          <Pencil className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="px-4 pt-5">
        {/* Identity */}
        <section className="flex flex-col items-center text-center">
          <ProfileRing
            size={132}
            percent={completion}
            label={`${completedCount} of 6`}
            avatarUrl={avatarUrl}
            initial={initials(name).slice(0, 1)}
            onEdit={() => fileInputRef.current?.click()}
            editLabel="Change profile photo"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <p className="mt-12 text-[14px] text-white/85">
            Fill out the details to complete your profile.
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            {saveAvatar.isPending ? 'Saving photo…' : 'PNG, JPG or WEBP · up to 2MB'}
          </p>
          {avatarError && <p className="mt-1 text-xs text-red-300">{avatarError}</p>}
          {saveAvatar.isError && (
            <p className="mt-1 text-xs text-red-300">{apiErrorMessage(saveAvatar.error)}</p>
          )}
        </section>

        {/* Editable details */}
        <section className="mt-8">
          <h3 className="sr-only">Personal details</h3>
          <form
            className="space-y-5"
            onSubmit={handleSubmit((values) => saveDetails.mutate(values))}
            noValidate
          >
            <div>
              <label htmlFor="client-fullName" className="mb-1 block text-[14px] font-medium text-white/85">
                Full name
              </label>
              <input
                id="client-fullName"
                className="w-full border-0 border-b border-white/25 !bg-[#121212] px-3 py-2 text-[16px] font-semibold text-[#8BC53F] outline-none focus:border-white/80 focus:ring-0 placeholder:text-white/45"
                {...register('fullName')}
              />
              {detailsErrors.fullName && (
                <p className="mt-1 text-xs text-red-300">{detailsErrors.fullName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="client-phone" className="mb-1 block text-[14px] font-medium text-white/85">
                Phone number
              </label>
              <input
                id="client-phone"
                type="tel"
                inputMode="tel"
                placeholder="0712 345 678"
                className="w-full border-0 border-b border-white/25 !bg-[#121212] px-3 py-2 text-[16px] font-semibold text-[#8BC53F] outline-none focus:border-white/80 focus:ring-0 placeholder:text-white/45"
                {...register('phone')}
              />
              {detailsErrors.phone && <p className="mt-1 text-xs text-red-300">{detailsErrors.phone.message}</p>}
            </div>

            <div className="border-b border-white/25 bg-[#121212] pb-2">
              <span className="mb-1 block text-[14px] font-medium text-white/85">Email address</span>
              <span className="block px-3 py-2 text-[16px] font-semibold text-[#8BC53F]">{email || 'Not provided'}</span>
              <span className="block px-3 text-[11px] text-white/55">Email cannot be changed here.</span>
            </div>

            {saveDetails.isError && (
              <p className="rounded-xl bg-red-500/15 px-4 py-3 text-[13px] text-red-200">
                {apiErrorMessage(saveDetails.error)}
              </p>
            )}

            <button
              type="submit"
              disabled={saveDetails.isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8BC53F] text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saveDetails.isPending ? 'Saving…' : 'Save details'}
            </button>
          </form>
          <p className="mt-3 text-[11px] text-white/60">
            {data?.business.name ?? 'Your provider'} may need to confirm changes to your account number.
          </p>
        </section>

        {/* Change password */}
        {user?.selfServicePasswordChangeUsed ? (
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-4">
            <h3 className="text-[15px] font-semibold text-white">Password</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/75">
              You’ve used your one password change. Contact your administrator if you need another reset.
            </p>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-4">
            <h3 className="text-[15px] font-semibold text-white">Change password</h3>
            <div className="mt-3">
              <ChangePasswordForm
                dark
                onDone={() => user && setUser({ ...user, selfServicePasswordChangeUsed: true })}
              />
            </div>
          </section>
        )}

        {/* Change PIN */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-4">
          <h3 className="text-[15px] font-semibold text-white">Change PIN</h3>
          <div className="mt-3">
            <ChangePinForm dark />
          </div>
        </section>

        {/* Appearance */}
        <section className="mt-4 rounded-[26px] border border-white/10 bg-[#1E1E1E] p-2">
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={() => setTheme(isDark ? 'brand' : 'dark')}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-transform active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              {isDark ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5 text-amber-300" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-white">Dark mode</span>
              <span className="block text-[12px] text-white/70">{isDark ? 'On' : 'Off'}</span>
            </span>
            <span
              className={cn('relative h-7 w-[52px] shrink-0 rounded-full transition-colors')}
              style={{ backgroundColor: isDark ? '#8BC53F' : 'rgba(255,255,255,0.25)' }}
              aria-hidden
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                  isDark ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </span>
          </button>
        </section>

        {/* Sign out */}
        <section className="mt-4">
          <button
            type="button"
            onClick={() => requestLogout()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full py-2 text-[12px] text-white/60 active:opacity-70"
          >
            Sign out without asking
          </button>
        </section>
      </div>
    </div>
  );
}
