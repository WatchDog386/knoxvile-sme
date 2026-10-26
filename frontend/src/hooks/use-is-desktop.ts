import { useEffect, useState } from 'react';

/** Matches Tailwind's `lg` breakpoint, where the desktop layouts take over. */
const DESKTOP_QUERY = '(min-width: 1024px)';

function matches(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches;
}

/** True on desktop-width screens; updates when the window is resized. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(matches);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}
