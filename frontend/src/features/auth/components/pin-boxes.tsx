import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIN_LENGTH } from './pin-pad';

/**
 * Four PIN boxes typed with the phone's own number keyboard, with an eye to
 * show the digits, as on the Co-op Bank app. One hidden field holds the value
 * so paste, autofill and backspace behave normally; the boxes only draw it.
 */
export function PinBoxes({
  value,
  onChange,
  onSubmit,
  dark = false,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (pin: string) => void;
  /** Enter on the keyboard. */
  onSubmit?: () => void;
  dark?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="relative flex gap-3" onClick={() => input.current?.focus()}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const digit = value[i];
          const current = focused && i === Math.min(value.length, PIN_LENGTH - 1);
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl font-semibold transition-colors',
                dark ? 'text-white' : 'text-slate-900',
                current
                  ? 'border-[#8BC53F]'
                  : dark
                    ? 'border-white/80'
                    : 'border-slate-400',
              )}
            >
              {digit ? (show ? digit : '•') : ''}
            </span>
          );
        })}
        <input
          ref={input}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label="M-PIN"
          data-pin-field
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <button
        type="button"
        data-keep-color
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide PIN' : 'Show PIN'}
        className={cn('p-2', dark ? '!text-[#8BC53F]' : '!text-[#3A8F91]')}
      >
        {show ? <Eye className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}
