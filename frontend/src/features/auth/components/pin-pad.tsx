import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PIN_LENGTH = 4;

/**
 * Four dots and a number pad, as on a banking app. Calls `onComplete` once the
 * fourth digit is in; the parent clears it by changing `resetKey` (for example
 * after a wrong PIN). A physical keyboard works too.
 */
export function PinPad({
  onComplete,
  disabled = false,
  dark = false,
  resetKey,
  footer,
}: {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  dark?: boolean;
  /** Change this to empty the dots. */
  resetKey?: unknown;
  /** Shown in the bottom-left key, e.g. a "Forgot PIN?" button. */
  footer?: React.ReactNode;
}) {
  const [pin, setPin] = useState('');

  useEffect(() => setPin(''), [resetKey]);

  const press = (digit: string) => {
    if (disabled || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    // A beat so the fourth dot shows filled before the screen moves on
    if (next.length === PIN_LENGTH) window.setTimeout(() => onComplete(next), 120);
  };
  const back = () => !disabled && setPin(pin.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const key = cn(
    'flex h-16 items-center justify-center rounded-2xl text-2xl font-medium transition-colors disabled:opacity-40',
    // The login form's wrapper recolours its buttons, except data-keep-color ones
    dark ? '!text-white hover:bg-white/10 active:bg-white/20' : '!text-slate-900 hover:bg-slate-100 active:bg-slate-200',
  );

  return (
    <div className="w-full">
      <div className="flex justify-center gap-5" role="status" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              dark ? 'border-white/70' : 'border-slate-400',
              i < pin.length && (dark ? 'border-white bg-white' : 'border-[#3A8F91] bg-[#3A8F91]'),
            )}
          />
        ))}
      </div>

      <div className="mx-auto mt-8 grid max-w-[280px] grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button data-keep-color key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        <div className="flex items-center justify-center">{footer}</div>
        <button data-keep-color type="button" className={key} onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button data-keep-color type="button" className={key} onClick={back} disabled={disabled} aria-label="Delete last digit">
          <Delete className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
