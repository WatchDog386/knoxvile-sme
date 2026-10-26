import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  LogOut,
  Mail,
  Moon,
  Phone,
  Save,
  Sun,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { ChangePinForm } from '@/features/auth/components/change-pin-form';
import { notifySuccess } from '@/components/ui/popup-host';
import { requestLogout } from '@/components/layout/session-timeout';
import { PROFILE_GREEN, ProfileRing, profileCompletion } from '@/components/layout/profile-visuals';
import { authApi } from '@/api/endpoints';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface FormValues {
  fullName: string;
  phone: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] font-medium tracking-tight text-foreground">
      {children}
    </p>
  );
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';
  // Ring shows the photo being edited, before it's saved
  const completion = profileCompletion(user ? { ...user, avatarUrl } : user);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.updateProfile({
        fullName: values.fullName,
        phone: values.phone || undefined,
        avatarUrl: avatarUrl,
      }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      notifySuccess('Profile updated', 'Your changes have been saved.');
      setError(null);
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <AppBar title="My Profile" onBack={() => navigate('/dashboard')} />

      {error && (
        <Alert variant="error" title="Could not update profile">
          {error}
        </Alert>
      )}

      <section className="flex flex-col items-center p-1 pt-4 text-center">
        {/* Centred ring avatar: green arc shows how complete the profile is, pencil changes the photo */}
        <div className="relative">
          <ProfileRing
            percent={completion}
            label={`${completion}%`}
            avatarUrl={avatarUrl}
            initial={user?.fullName?.charAt(0).toUpperCase()}
            onEdit={() => fileInputRef.current?.click()}
            editLabel="Upload photo"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        <div className="mt-7 flex items-center gap-1.5">
          <h2 className="text-base font-medium tracking-tight text-foreground">
            {user?.fullName ?? 'Your name'}
          </h2>
          {user?.emailVerified && (
            <BadgeCheck className="h-4 w-4 text-accent" aria-label="Verified" />
          )}
        </div>

        <div className="mt-1.5 space-y-0.5">
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-foreground-3">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {user?.email}
          </p>
          {(avatarUrl ?? user?.phone) && (
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-foreground-3">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {user?.phone || 'Add your phone number below'}
            </p>
          )}
        </div>

        {avatarUrl && (
          <button
            type="button"
            onClick={() => setAvatarUrl(null)}
            className="mt-3 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove photo
          </button>
        )}
        <p className="mt-2 text-[10px] text-foreground-5">PNG, JPG or WEBP · up to 2MB</p>
      </section>

      <section className="px-1">
        <SectionLabel>Personal details</SectionLabel>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="mt-4 space-y-4"
        >
          <div>
            <Label htmlFor="fullName" className="text-xs">
              Full Name
            </Label>
            <Input
              id="fullName"
              placeholder="Enter your full name"
              className="mt-1.5"
              {...register('fullName', { required: 'Full name is required.' })}
            />
            {errors.fullName && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs">
              Phone Number
            </Label>
            <Input
              id="phone"
              placeholder="e.g. +254712345678"
              className="mt-1.5"
              {...register('phone')}
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-xs">
              Email Address
            </Label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
              <Input
                id="email"
                type="email"
                disabled
                value={user?.email ?? ''}
                className="cursor-not-allowed bg-surface-2 pl-9 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-4">
                Locked
              </span>
            </div>
            <p className="mt-1 text-[10px] text-foreground-5">
              Email address cannot be changed.
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-strong active:scale-[0.99] disabled:opacity-60"
          >
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden />
                Save changes
              </>
            )}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="px-1">
        <SectionLabel>Password</SectionLabel>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      {/* Change PIN */}
      <section className="px-1">
        <SectionLabel>PIN</SectionLabel>
        <div className="mt-4">
          <ChangePinForm />
        </div>
      </section>

      {/* Appearance: light / dark theme (moved here from Settings) */}
      <section className="px-1">
        <SectionLabel>Appearance</SectionLabel>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => setTheme(isDark ? 'brand' : 'dark')}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 [.dark_&]:bg-[#1E1E1E]">
            {isDark ? (
              <Moon className="h-[18px] w-[18px]" style={{ color: PROFILE_GREEN }} aria-hidden />
            ) : (
              <Sun className="h-[18px] w-[18px] text-amber-500" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Dark mode</span>
            <span className="block text-xs text-foreground-3">{isDark ? 'On' : 'Off'}</span>
          </span>
          <span
            className="relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200"
            style={{ backgroundColor: isDark ? PROFILE_GREEN : undefined }}
            aria-hidden
          >
            {!isDark && <span className="absolute inset-0 rounded-full bg-edge-2" />}
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${isDark ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </span>
        </button>
      </section>

      {/* Log out (moved here from Settings) */}
      <section className="px-1 pb-8">
        <button
          type="button"
          onClick={() => requestLogout()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger text-sm font-medium text-white shadow-sm transition-transform active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </section>
    </div>
  );
}
