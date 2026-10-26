/** The photo behind the home and login pages: public/images/hero.jpeg. */
const FEATURED_PHOTO = '/images/hero.jpeg';
/** The sunrise photo, used for home and login until hero.jpeg is there. */
const FEATURED_FALLBACK = '/images/home-sunrise.jpg';
/** The HD photo for the other pages, once it is added to public/images. */
const HD_PHOTO = '/images/home-hd.jpg';
/** The original photo, used when nothing else loads. */
const FALLBACK_PHOTO = '/images/splash-savanna.jpg';

/**
 * Full-screen photo behind the home, login, help and client pages.
 *
 * - `featured` (home and login): hero.jpeg, else the sunrise photo.
 * - Otherwise: public/images/home-hd.jpg when it exists, else the original.
 *
 * A missing file comes back as the app page, which fails to load as an
 * image, so each photo steps down to the next one.
 */
export function HomePhoto({ className, featured = false }: { className: string; featured?: boolean }) {
  return (
    <img
      src={featured ? FEATURED_PHOTO : HD_PHOTO}
      alt=""
      aria-hidden
      decoding="async"
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src.endsWith(FEATURED_PHOTO)) img.src = FEATURED_FALLBACK;
        else if (!img.src.endsWith(FALLBACK_PHOTO)) img.src = FALLBACK_PHOTO;
      }}
    />
  );
}
