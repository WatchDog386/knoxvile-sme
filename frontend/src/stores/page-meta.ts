import { useEffect } from 'react';
import { create } from 'zustand';

interface PageMetaState {
  /** Row count shown next to the page title in the desktop top bar ("Customers - 12"). */
  count: number | null;
  setCount: (count: number | null) => void;
}

export const usePageMetaStore = create<PageMetaState>((set) => ({
  count: null,
  setCount: (count) => set({ count }),
}));

/** Desktop list views publish their total to the top bar; cleared when the page closes. */
export function usePageCount(count: number | null | undefined) {
  const setCount = usePageMetaStore((s) => s.setCount);
  useEffect(() => {
    setCount(count ?? null);
  }, [count, setCount]);
  useEffect(() => () => setCount(null), [setCount]);
}
