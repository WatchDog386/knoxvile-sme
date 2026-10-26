import { useEffect, useState } from 'react';
import { PopupMessage, type PopupKind } from './popup-message';

export type { PopupKind };

/** How long a popup of each kind stays on screen before it closes itself. */
const AUTO_CLOSE_MS: Record<PopupKind, number> = {
  success: 3200,
  info: 4000,
  warning: 5000,
  error: 6000,
  loading: 0,
};

/** How many popups fit on screen; an older one is dropped when a new one arrives. */
const MAX_VISIBLE = 3;

/** How one popup looks and how long it stays. */
export interface PopupOptions {
  /** Dark card with a dashed rule: the "Invalid Details" look. */
  tone?: 'light' | 'dark';
  illustration?: React.ReactNode;
  actionLabel?: string;
  /** Milliseconds, or null to stay until the person closes it. */
  duration?: number | null;
}

interface Popup extends PopupOptions {
  id: number;
  kind: PopupKind;
  title: string;
  message?: string;
}

let nextId = 0;
let queue: Popup[] = [];
const listeners = new Set<(popups: Popup[]) => void>();

function publish() {
  const snapshot = queue;
  listeners.forEach((fn) => fn(snapshot));
}

function drop(id: number) {
  if (!queue.some((p) => p.id === id)) return;
  queue = queue.filter((p) => p.id !== id);
  publish();
}

/**
 * Raises a popup in the Log Out confirmation's style. Repeats of a message
 * already on screen are ignored, so a re-render never doubles it up.
 * Returns the popup's id, for `dismissPopup`.
 */
export function notify(kind: PopupKind, title: string, message?: string, options?: PopupOptions): number {
  const same = queue.find((p) => p.kind === kind && p.title === title && p.message === message);
  if (same) return same.id;
  const popup: Popup = { id: ++nextId, kind, title, message, ...options };
  queue = [...queue, popup].slice(-MAX_VISIBLE);
  publish();
  return popup.id;
}

/** Takes a popup off the screen early, before it closes itself. */
export function dismissPopup(id: number) {
  drop(id);
}

/** Shows a success popup, styled like the Log Out confirmation. */
export function notifySuccess(title: string, message?: string, options?: PopupOptions) {
  return notify('success', title, message, options);
}

/** Shows an error popup, styled like the Log Out confirmation. */
export function notifyError(title: string, message?: string, options?: PopupOptions) {
  return notify('error', title, message, options);
}

/** Shows an information popup. */
export function notifyInfo(title: string, message?: string, options?: PopupOptions) {
  return notify('info', title, message, options);
}

/** Shows a warning popup. */
export function notifyWarning(title: string, message?: string, options?: PopupOptions) {
  return notify('warning', title, message, options);
}

/**
 * Mounted once in App. Holds the popups on screen and closes each after a few
 * seconds. Call notifySuccess / notifyError / notifyInfo / notifyWarning from
 * anywhere to raise one; render <Alert> anywhere to raise one from state.
 */
export function PopupHost() {
  const [popups, setPopups] = useState<Popup[]>([]);

  useEffect(() => {
    const onPopups = (next: Popup[]) => setPopups(next);
    listeners.add(onPopups);
    onPopups(queue);
    return () => {
      listeners.delete(onPopups);
    };
  }, []);

  // Each popup closes itself; the timers restart if the queue changes
  useEffect(() => {
    if (!popups.length) return;
    const timers = popups.map((p) => {
      const ms = p.duration === null ? 0 : (p.duration ?? AUTO_CLOSE_MS[p.kind] ?? 0);
      return ms > 0 ? window.setTimeout(() => drop(p.id), ms) : 0;
    });
    return () => timers.forEach((t) => t && window.clearTimeout(t));
  }, [popups]);

  if (!popups.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-black/50 px-5 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label={popups[popups.length - 1].title}
    >
      {popups.map((p) => (
        <div key={p.id} className="pointer-events-auto w-full max-w-[340px]">
          <PopupMessage
            isOpen
            type={p.kind}
            title={p.title}
            message={p.message}
            tone={p.tone}
            illustration={p.illustration}
            actionLabel={p.actionLabel}
            onClose={() => drop(p.id)}
          />
        </div>
      ))}
    </div>
  );
}
