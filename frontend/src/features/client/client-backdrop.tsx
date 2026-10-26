import { createPortal } from 'react-dom';
import { HomePhoto } from '@/components/brand/home-photo';

/**
 * The savanna photo behind the subscriber pages. It is mounted on the body rather
 * than inside the page: the route transition wraps pages in a transformed element,
 * and a transform makes `position: fixed` measure against that element instead of
 * the viewport, so the photo would scroll away with the content.
 */
export function ClientBackdrop() {
  return createPortal(
    <>
      <HomePhoto className="fixed inset-0 z-[-1] h-full w-full object-cover" />
      <div
        aria-hidden
        className="fixed inset-0 z-[-1] bg-gradient-to-b from-black/70 via-black/45 to-black/75"
      />
    </>,
    document.body,
  );
}