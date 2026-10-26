import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { SpeedWheel } from '@/components/ui/workspace-loader';

/**
 * Full-screen in-app preview of a generated invoice/receipt. Pages are drawn
 * with PDF.js (phones and the Android app can't show PDFs inline), so staff
 * can check the document before saving or sending it.
 */
export function PdfPreview({
  file,
  title,
  onClose,
  onDownload,
  onWhatsApp,
}: {
  file: { blob: Blob; filename: string } | null;
  title: string;
  onClose: () => void;
  onDownload: () => void;
  onWhatsApp?: () => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setState('loading');

    (async () => {
      try {
        // Loaded on first use so PDF.js stays out of the main bundle. The
        // legacy build: the Android app's WebView is often older than what
        // the modern build needs, and the preview then failed on phones.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const pdf = await pdfjs.getDocument({ data: await file.blob.arrayBuffer() }).promise;
        if (cancelled) return;
        const host = pagesRef.current;
        if (!host) return;
        host.innerHTML = '';
        setPageCount(pdf.numPages);

        const cssWidth = Math.min(host.clientWidth, 720);
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / ratio}px`;
          canvas.style.height = `${viewport.height / ratio}px`;
          canvas.className = 'mx-auto block rounded-lg bg-white shadow-2xl';
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
          if (cancelled) return;
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Lock page scroll behind the viewer
  useEffect(() => {
    if (!file) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [file, onClose]);

  return createPortal(
    <AnimatePresence>
      {file && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col bg-slate-900/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.9rem,var(--sat))] text-white">
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-90" aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[14px] font-semibold">{title}</p>
              <p className="truncate text-[11px] text-white/60">
                {file.filename}
                {pageCount > 1 ? ` · ${pageCount} pages` : ''}
              </p>
            </div>
            <span className="h-10 w-10" aria-hidden />
          </div>

          {/* Pages */}
          <motion.div
            className="relative flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div ref={pagesRef} className="mx-auto max-w-[720px] space-y-4" />
            {state === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span role="status" aria-label="Loading document"><SpeedWheel /></span>
              </div>
            )}
            {state === 'error' && (
              <p className="mt-10 text-center text-[13px] text-white/80">
                Couldn’t show a preview on this device. You can still download it below.
              </p>
            )}
          </motion.div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-[max(1rem,var(--sab))] pt-2">
            {onWhatsApp ? (
              <button
                type="button"
                onClick={onWhatsApp}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] text-[14px] font-semibold text-white active:scale-[0.98]"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" />
                WhatsApp
              </button>
            ) : (
              <button type="button" onClick={onClose} className="h-12 rounded-full bg-white/10 text-[14px] font-semibold text-white">
                Close
              </button>
            )}
            <button
              type="button"
              onClick={onDownload}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-slate-900 active:scale-[0.98]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
