/**
 * The picture on the "Invalid Details" popup: the details did not match, and the
 * dog pulled the plug. The PNG is drawn on a transparent background, so it sits
 * straight on the popup card.
 */
export function InvalidDetailsArt({ className }: { className?: string }) {
  return <img src="/invalid.png" alt="Details not found" className={className ?? 'h-auto w-full object-contain'} />;
}