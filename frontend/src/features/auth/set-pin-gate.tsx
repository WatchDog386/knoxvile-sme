import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Grid3x3, Smartphone } from 'lucide-react';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { PinDeviceResult } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/lib/theme';
import { notifySuccess } from '@/components/ui/popup-host';
import { deviceLabel, lastLogin, savePinDevice, skipPinDeviceForNow } from '@/lib/pin-device';
import { PinPad } from './components/pin-pad';

/** Keeps the device secret so this phone opens with the PIN next time. */
function useRememberDevice() {
  const setUser = useAuthStore((s) => s.setUser);
  return (result: PinDeviceResult) => {
    savePinDevice({
      ...result.device,
      userId: result.user.id,
      fullName: result.user.fullName,
      // Clients sign in with a username; their account email is internal
      login: lastLogin() || result.user.email,
    });
    setUser(result.user);
  };
}

function GateFrame({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">{icon}</span>
          <h1 className="mt-4 text-lg font-medium text-foreground">{title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-foreground-4">{text}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Shown instead of the app until the person has a PIN, right after they set
 * their own password. They type it twice; this device then opens with it.
 */
export function SetPinGate() {
  const [theme] = useTheme();
  const dark = theme === 'dark';
  const user = useAuthStore((s) => s.user);
  const remember = useRememberDevice();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const mutation = useMutation({
    mutationFn: (pin: string) => authApi.pinSetup(pin, deviceLabel()),
    onSuccess: (result) => {
      remember(result);
      notifySuccess('PIN set', 'Next time, open the app with your PIN.');
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setFirst(null);
      setRound((r) => r + 1);
    },
  });

  const onComplete = (pin: string) => {
    setError(null);
    if (first === null) {
      setFirst(pin);
      setRound((r) => r + 1);
      return;
    }
    if (pin !== first) {
      setError("The PINs didn't match. Start again.");
      setFirst(null);
      setRound((r) => r + 1);
      return;
    }
    mutation.mutate(pin);
  };

  const name = user?.fullName.split(' ')[0];
  return (
    <GateFrame
      icon={<Grid3x3 className="h-7 w-7" aria-hidden />}
      title={first === null ? (name ? `${name}, set your PIN` : 'Set your PIN') : 'Confirm your PIN'}
      text={
        first === null
          ? 'Choose 4 digits you will remember. You will use this PIN to open the app on this device.'
          : 'Enter the same 4 digits again.'
      }
    >
      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-center text-[13px] text-danger-text">{error}</p>}
      <PinPad dark={dark} onComplete={onComplete} disabled={mutation.isPending} resetKey={round} />
    </GateFrame>
  );
}

/**
 * The person has a PIN but signed in with their password on a phone that
 * doesn't know it yet: one PIN entry turns PIN sign-in on here. Optional.
 */
export function TrustDevicePrompt({ onDone }: { onDone: () => void }) {
  const [theme] = useTheme();
  const dark = theme === 'dark';
  const remember = useRememberDevice();
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const mutation = useMutation({
    mutationFn: (pin: string) => authApi.pinTrustDevice(pin, deviceLabel()),
    onSuccess: (result) => {
      remember(result);
      notifySuccess('PIN sign-in on', 'Next time, open the app with your PIN.');
      onDone();
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setRound((r) => r + 1);
    },
  });

  return (
    <GateFrame
      icon={<Smartphone className="h-7 w-7" aria-hidden />}
      title="Use your PIN on this device?"
      text="Enter your PIN once, and this device will open with it from now on."
    >
      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-center text-[13px] text-danger-text">{error}</p>}
      <PinPad dark={dark} onComplete={(pin) => mutation.mutate(pin)} disabled={mutation.isPending} resetKey={round} />
      <button
        type="button"
        onClick={() => {
          skipPinDeviceForNow();
          onDone();
        }}
        className="mx-auto block text-sm font-medium text-foreground-4 hover:text-foreground"
      >
        Not now
      </button>
    </GateFrame>
  );
}
