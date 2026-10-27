import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Theme = 'dark' | 'brand';

const STORAGE_KEY = 'biashara_theme';

const listeners = new Set<(theme: Theme) => void>();

/** Reads the saved theme from localStorage; defaults to dark. */
export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'brand') return stored as Theme;
  return 'dark';
}

/** Routes that must always render in light mode, even when user prefers dark. */
export const LIGHT_ONLY_ROUTES = [
  '/',
  '/welcome',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;

export function isLightOnlyRoute(pathname: string): boolean {
  return (LIGHT_ONLY_ROUTES as readonly string[]).includes(pathname);
}

/*
 * Phone status bar (theme-color). The opening splash keeps it white; after that it
 * matches the page at the top edge, unless a full-screen loader overrides it.
 */
const SPLASH_COLOR = '#FFFFFF';
let pageStatusBar = SPLASH_COLOR;
let overrideStatusBar: string | null = null;

function splashShowing(): boolean {
  const splash = document.getElementById('splash-screen');
  return Boolean(splash) && !splash?.classList.contains('hidden');
}

/** True when a #RRGGBB colour is dark enough to need light status bar icons. */
function isDarkColor(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return true;
  const [r, g, b] = m.slice(1).map((c) => parseInt(c, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

let nativeIconsLight: boolean | null = null;

/** The colour actually showing at the top of the open page, when it can be read. */
let sampledTop: string | null = null;

const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/**
 * Reads the colour at the very top of the screen, so the status bar continues
 * the page's own header (as on the admin dashboard) instead of a fixed guess.
 * Layers are blended front to back, so see-through headers come out right.
 * Gives up (null) on photos and gradients, where the per-page colour is used.
 */
function sampleTopColor(): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const el of document.elementsFromPoint(window.innerWidth / 2, 1)) {
    if (el.id === 'splash-screen') return null;
    if (el instanceof HTMLImageElement) {
      // A photo at the top: the bar takes the colour of the photo's top edge
      const photo = imageColorAt(el, window.innerWidth / 2, 1);
      if (photo) return blendOver(r, g, b, a, photo);
      return a > 0 ? blendOver(r, g, b, a, pageStatusBar) : null;
    }
    if (el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) return null;
    const style = getComputedStyle(el);
    // An element's gradient or picture paints over its own background colour, so it goes first
    if (style.backgroundImage !== 'none') {
      // The page glows are top-to-bottom gradients: their first colour is the
      // one at the top. Once the page scrolls past the glow, the plain colour
      // underneath shows instead.
      const scrolledPast = (el === document.body || el === document.documentElement) && window.scrollY > 40;
      const top = scrolledPast ? null : gradientTop(style.backgroundImage);
      const base = scrolledPast ? rgbToHex(style.backgroundColor) : top && top.alpha >= 0.98 ? top.hex : null;
      if (base) return blendOver(r, g, b, a, base);
      if (top) {
        // A see-through tint (e.g. over a cover photo): blend it in and look underneath
        const w = (1 - a) * top.alpha;
        r += w * top.r;
        g += w * top.g;
        b += w * top.b;
        a += w;
        continue;
      }
      // A picture set as a background: fall back to the page's own top colour
      return a > 0 ? blendOver(r, g, b, a, pageStatusBar) : null;
    }
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(style.backgroundColor);
    const alpha = m ? (m[4] === undefined ? 1 : Number(m[4])) : 0;
    if (alpha > 0 && m) {
      const w = (1 - a) * alpha;
      r += w * Number(m[1]);
      g += w * Number(m[2]);
      b += w * Number(m[3]);
      a += w;
    }
    if (a > 0.98) return `#${toHex(r / a)}${toHex(g / a)}${toHex(b / a)}`;
  }
  return a > 0 ? blendOver(r, g, b, a, pageStatusBar) : null;
}

const photoPixels = new Map<string, CanvasRenderingContext2D | null>();

/**
 * Colour of an on-screen photo at a screen point, allowing for object-fit
 * cover/contain cropping. Our own images only (same origin); null otherwise.
 */
function imageColorAt(img: HTMLImageElement, x: number, y: number): string | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!img.complete || !w || !h) return null;
  let ctx = photoPixels.get(img.currentSrc);
  if (ctx === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx?.drawImage(img, 0, 0);
      ctx?.getImageData(0, 0, 1, 1); // throws for images from other sites
    } catch {
      ctx = null;
    }
    photoPixels.set(img.currentSrc, ctx ?? null);
  }
  if (!ctx) return null;
  const box = img.getBoundingClientRect();
  const fit = getComputedStyle(img).objectFit;
  let sx = box.width / w;
  let sy = box.height / h;
  if (fit === 'cover') sx = sy = Math.max(sx, sy);
  else if (fit === 'contain') sx = sy = Math.min(sx, sy);
  const ix = Math.min(w - 3, Math.max(0, Math.round((x - box.left - (box.width - w * sx) / 2) / sx) - 1));
  const iy = Math.min(h - 3, Math.max(0, Math.round((y - box.top - (box.height - h * sy) / 2) / sy)));
  const d = ctx.getImageData(ix, iy, 3, 3).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  return `#${toHex(r / 9)}${toHex(g / 9)}${toHex(b / 9)}`;
}

/** "rgb(22, 32, 47)" as #16202f; null when see-through or not a colour. */
function rgbToHex(css: string): string | null {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(css);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.98)) return null;
  return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`;
}

/** Top colour of a top-to-bottom linear gradient, as the browser reports it; null for anything else. */
function gradientTop(image: string): { r: number; g: number; b: number; alpha: number; hex: string } | null {
  const m = /^linear-gradient\((?:180deg|to bottom)?,?\s*rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(image.trim());
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { r, g, b, alpha: m[4] === undefined ? 1 : Number(m[4]), hex: `#${toHex(r)}${toHex(g)}${toHex(b)}` };
}

/** Finishes a front-to-back blend over a solid #RRGGBB base. */
function blendOver(r: number, g: number, b: number, a: number, base: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(base);
  const [br, bg, bb] = m ? m.slice(1).map((c) => parseInt(c, 16)) : [0, 0, 0];
  return `#${toHex(r + (1 - a) * br)}${toHex(g + (1 - a) * bg)}${toHex(b + (1 - a) * bb)}`;
}

let sampleTimer = 0;
/** Re-reads the top colour shortly after the page changes, scrolls or switches theme. */
export function scheduleSample(): void {
  if (sampleTimer) return;
  sampleTimer = window.setTimeout(() => {
    sampleTimer = 0;
    const next = sampleTopColor();
    if (next !== sampledTop) {
      sampledTop = next;
      paintStatusBar();
    }
  }, 120);
}

function paintStatusBar(): void {
  const color = splashShowing() ? SPLASH_COLOR : (overrideStatusBar ?? sampledTop ?? pageStatusBar);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;
  // The Android app draws the page behind the status bar: keep its clock and
  // battery icons readable against whatever colour is at the top
  if (Capacitor.isNativePlatform()) {
    const light = isDarkColor(color);
    if (light !== nativeIconsLight) {
      nativeIconsLight = light;
      void StatusBar.setStyle({ style: light ? Style.Dark : Style.Light }).catch(() => undefined);
    }
  }
}

function setStatusBarColor(color: string): void {
  pageStatusBar = color;
  paintStatusBar();
}

/** Paints the status bar a given colour while a full-screen loader is shown. Returns a restore function. */
export function overrideStatusBarColor(color: string): () => void {
  overrideStatusBar = color;
  paintStatusBar();
  return () => {
    overrideStatusBar = null;
    paintStatusBar();
  };
}

if (typeof window !== 'undefined') {
  // index.html fires this once the opening splash has faded out
  window.addEventListener('splash-hidden', paintStatusBar);
  // Keep the status bar matched to whatever page and header are on screen
  const watch = () => {
    new MutationObserver(scheduleSample).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    window.addEventListener('scroll', scheduleSample, { passive: true });
    // A photo that finishes loading changes the top colour
    document.addEventListener('load', scheduleSample, true);
    window.addEventListener('resize', scheduleSample);
    scheduleSample();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
}

export function applyTheme(theme: Theme): void {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const docEl = document.documentElement;
  // Remove backdrops left in the DOM by older dashboard theme code. Theme
  // selection should only switch colors; route-specific photos live in-page.
  docEl.classList.remove('page-white', 'dash-glow-body');
  for (const child of Array.from(docEl.children)) {
    if (child instanceof HTMLImageElement && child.getAttribute('src') === '/images/splash-savanna.jpg') {
      child.remove();
    } else if (
      child instanceof HTMLDivElement &&
      child.className.includes('bg-gradient-to-b') &&
      child.className.includes('from-black/70') &&
      child.className.includes('via-black/45') &&
      child.className.includes('to-black/75')
    ) {
      child.remove();
    }
  }
  delete docEl.dataset.brandBackdrop;

  // Force light on home / auth / success pages — dark mode never applies there.
  if (isLightOnlyRoute(path)) {
    document.documentElement.classList.remove('dark');
    setStatusBarColor('#FFFFFF');
    return;
  }
  const dark = theme === 'dark';
  docEl.classList.toggle('dark', dark);
  // Dashboard top is the sky glow (light) or the dark glow (dark); other pages use the plain page colour
  if (dark) setStatusBarColor(path === '/dashboard' ? '#16202F' : '#121212');
  else setStatusBarColor(path === '/dashboard' ? '#D7E7FF' : '#F8FAFC');
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  listeners.forEach((fn) => fn(theme));
}

export function initTheme(): void {
  applyTheme(getTheme());
}

/** Reactive theme state — stays in sync across every toggle in the app. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    listeners.add(setThemeState);
    return () => {
      listeners.delete(setThemeState);
    };
  }, []);

  return [theme, setTheme];
}
