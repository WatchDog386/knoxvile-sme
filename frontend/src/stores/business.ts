import { create } from 'zustand';
import type { Business } from '@/api/types';

interface BusinessState {
  businesses: Business[];
  activeBusinessId: string | null;
  setBusinesses: (businesses: Business[]) => void;
  setActiveBusinessId: (id: string) => void;
  selectBusiness: (business: Business) => void;
  clear: () => void;
}

function readActive(): string | null {
  return localStorage.getItem('ksa_business_id');
}

export const useBusinessStore = create<BusinessState>((set) => ({
  businesses: [],
  activeBusinessId: readActive(),
  setBusinesses: (businesses) => {
    let active = readActive();
    if (!active && businesses.length > 0) {
      active = businesses[0].id;
      localStorage.setItem('ksa_business_id', active);
    }
    set({ businesses, activeBusinessId: active });
  },
  setActiveBusinessId: (id) => {
    localStorage.setItem('ksa_business_id', id);
    set({ activeBusinessId: id });
  },
  selectBusiness: (business) => {
    localStorage.setItem('ksa_business_id', business.id);
    set({ activeBusinessId: business.id });
  },
  clear: () => {
    localStorage.removeItem('ksa_business_id');
    set({ businesses: [], activeBusinessId: null });
  },
}));

export const useActiveBusiness = (): Business | null =>
  useBusinessStore((state) => {
    if (!state.activeBusinessId) return null;
    return (
      state.businesses.find((b) => b.id === state.activeBusinessId) ?? null
    );
  });