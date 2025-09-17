import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LightGallery from 'lightgallery/react';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';

// Import LightGallery CSS
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-fullscreen.css';

import PhotoSwipeMetadataSidebar from './PhotoSwipeMetadataSidebar';
import type { Photo } from '../types';

interface LightGallerySimpleProps {
  photos: Photo[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
  onOpened?: () => void;
}

const LightGallerySimple: React.FC<LightGallerySimpleProps> = ({
  photos,
  isOpen,
  initialIndex,
  onClose,
  onOpened,
}) => {
  const lightGalleryRef = useRef<any>(null);
  const toolbarSetupRef = useRef<boolean>(false);
  const openedRef = useRef<boolean>(false);
  const isOpeningRef = useRef<boolean>(false);
  const initCountRef = useRef<number>(0);
  const frozenPropsRef = useRef<{ dynamicEl: any; startIndex: number } | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentPhoto = photos[currentPhotoIndex];

  // Update current photo index when initialIndex changes
  useEffect(() => {
    setCurrentPhotoIndex(initialIndex);
  }, [initialIndex]);

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const onInit = useCallback((detail: any) => {
    lightGalleryRef.current = detail.instance;
    initCountRef.current += 1;
    console.log('[LG] onInit called', {
      instance: !!detail?.instance,
      count: initCountRef.current,
    });

    // Monkey-patch closeGallery to capture unexpected closes
    try {
      const inst = detail.instance as any;
      if (inst && !inst.__closePatched) {
        const originalClose = inst.closeGallery?.bind(inst);
        inst.closeGallery = (...args: any[]) => {
          console.warn('[LG][patch] closeGallery invoked', { args, stack: new Error().stack });
          return originalClose?.(...args);
        };
        const originalDestroy = inst.destroy?.bind(inst);
        inst.destroy = (...args: any[]) => {
          console.warn('[LG][patch] destroy invoked', { args, stack: new Error().stack });
          return originalDestroy?.(...args);
        };
        inst.__closePatched = true;
      }
    } catch (e) {
      console.warn('[LG][patch] failed to patch closeGallery', e);
    }

    // Add Info (i) button to LG toolbar to toggle sidebar
    setTimeout(() => {
      const toolbar = document.querySelector('.lg-toolbar');
      if (!toolbar) return;
      if (!toolbarSetupRef.current && !toolbar.querySelector('.lg-custom-info-btn')) {
        const infoButton = document.createElement('button');
        // IMPORTANT: Do NOT use the reserved 'lg-icon' class which LG binds default actions to
        infoButton.className = 'lg-custom-info-btn';
        infoButton.setAttribute('type', 'button');
        infoButton.setAttribute('aria-label', 'Photo details');
        infoButton.style.cssText = `background:transparent;border:none;cursor:pointer;padding:6px;margin-left:8px;display:flex;align-items:center;justify-content:center;color:#fff;`;
        infoButton.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 17v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="7" r="1" fill="currentColor"/>
          </svg>`;
        const stopAll = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          (e as any).stopImmediatePropagation?.();
        };
        infoButton.addEventListener('mousedown', stopAll);
        infoButton.addEventListener('mouseup', stopAll);
        infoButton.addEventListener('touchstart', stopAll, { passive: false } as any);
        infoButton.addEventListener('click', e => {
          stopAll(e);
          console.log('[LG] Info button clicked - toggling sidebar');
          setIsSidebarOpen(prev => !prev);
        });
        toolbar.appendChild(infoButton);

        // Attach logging on toolbar and close button to catch unintended closes
        if (!(toolbar as HTMLElement).dataset.loggerAttached) {
          (toolbar as HTMLElement).dataset.loggerAttached = '1';
          toolbar.addEventListener(
            'click',
            e => {
              const t = e.target as HTMLElement | null;
              console.log('[LG][toolbar click]', t?.className || t?.tagName);
            },
            true
          );
        }
        const closeBtn = document.querySelector('.lg-close');
        if (closeBtn && !(closeBtn as HTMLElement).dataset.loggerAttached) {
          (closeBtn as HTMLElement).dataset.loggerAttached = '1';
          closeBtn.addEventListener(
            'click',
            e => {
              console.log('[LG][close click] close button clicked');
            },
            true
          );
        }

        toolbarSetupRef.current = true;
      }
    }, 0);
  }, []);

  const onAfterSlide = useCallback((detail: any) => {
    console.log('[LG] onAfterSlide', detail);
    setCurrentPhotoIndex(detail.index);
  }, []);

  const onBeforeSlide = useCallback((detail: any) => {
    console.log('[LG] onBeforeSlide', detail);
  }, []);

  const onBeforeClose = useCallback(() => {
    console.log('[LG] onBeforeClose fired');
    try {
      const active = document.activeElement as HTMLElement | null;
      console.log('[LG] activeElement at close:', active?.tagName, active?.className);
    } catch {}
    if (isOpeningRef.current) {
      console.warn('[LG] Suppressing close during opening sequence');
      return; // Do not notify parent; allow LG internal reopen
    }
    setIsSidebarOpen(false);
    onClose();
  }, [onClose]);

  // When sidebar visibility changes, shift LightGallery to make room on large screens
  useEffect(() => {
    console.log('[LG] isSidebarOpen changed:', isSidebarOpen);
    let attempts = 0;
    const apply = () => {
      const outer = document.querySelector('.lg-outer');
      if (!outer) return false;
      if (isSidebarOpen) {
        outer.classList.add('lg-with-sidebar');
        console.log('[LG] Applied lg-with-sidebar class to .lg-outer');
      } else {
        outer.classList.remove('lg-with-sidebar');
        console.log('[LG] Removed lg-with-sidebar class from .lg-outer');
      }
      return true;
    };
    // Apply immediately; if LG not yet mounted, retry briefly
    if (!apply()) {
      const interval = setInterval(() => {
        attempts += 1;
        if (apply() || attempts > 20) {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isSidebarOpen]);

  // Global event logging to trace unexpected closes/clicks
  useEffect(() => {
    const logClickCapture = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const classes = t?.className || '';
      const id = (t as HTMLElement)?.id || '';
      const tag = (t as HTMLElement)?.tagName || '';
      // Avoid spamming too much; group logs
      console.log('[LG][capture click]', { tag, id, classes });
      if (t) {
        const path = [] as string[];
        let el: HTMLElement | null = t;
        while (el && path.length < 10) {
          path.push(`${el.tagName}.${(el.className || '').toString()}`);
          el = el.parentElement;
        }
        console.log('[LG][capture click path]', path);
      }
    };
    const logKeydown = (e: KeyboardEvent) => {
      console.log('[LG][keydown]', e.key);
    };
    const outer = document.querySelector('.lg-outer');
    const backdrop = document.querySelector('.lg-backdrop');
    const container = document.querySelector('.lg-container');
    const logOuter = (e: Event) => {
      const t = e.target as HTMLElement | null;
      console.log('[LG][outer click]', t?.className);
    };
    const logBackdrop = (e: Event) => {
      console.log('[LG][backdrop click]', e.type);
    };
    const logContainer = (e: Event) => {
      const t = e.target as HTMLElement | null;
      console.log('[LG][container click]', t?.className);
    };

    document.addEventListener('click', logClickCapture, true);
    window.addEventListener('keydown', logKeydown);
    outer?.addEventListener('click', logOuter, true);
    backdrop?.addEventListener('click', logBackdrop, true);
    container?.addEventListener('click', logContainer, true);

    // Listen for LG custom events if dispatched on document
    const beforeClose = (e: Event) => console.log('[LG][event] lgBeforeClose', e);
    const afterClose = (e: Event) => console.log('[LG][event] lgAfterClose', e);
    const beforeOpen = (e: Event) => console.log('[LG][event] lgBeforeOpen', e);
    const afterOpen = (e: Event) => console.log('[LG][event] lgAfterOpen', e);
    document.addEventListener('lgBeforeClose', beforeClose as EventListener);
    document.addEventListener('lgAfterClose', afterClose as EventListener);
    document.addEventListener('lgBeforeOpen', beforeOpen as EventListener);
    document.addEventListener('lgAfterOpen', afterOpen as EventListener);

    // Observe overlay node removal to detect close
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.removedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.classList.contains('lg-outer')) {
            console.log('[LG][observer] .lg-outer removed from DOM');
          }
        });
      }
    });
    observer.observe(document.body, { childList: true });

    return () => {
      document.removeEventListener('click', logClickCapture, true);
      window.removeEventListener('keydown', logKeydown);
      outer?.removeEventListener('click', logOuter, true);
      backdrop?.removeEventListener('click', logBackdrop, true);
      container?.removeEventListener('click', logContainer, true);
      document.removeEventListener('lgBeforeClose', beforeClose as EventListener);
      document.removeEventListener('lgAfterClose', afterClose as EventListener);
      document.removeEventListener('lgBeforeOpen', beforeOpen as EventListener);
      document.removeEventListener('lgAfterOpen', afterOpen as EventListener);
      observer.disconnect();
    };
  }, []);

  // Programmatically open gallery once using dynamic mode
  useEffect(() => {
    if (!isOpen || photos.length === 0 || openedRef.current) return;
    let attempts = 0;
    const tryOpen = () => {
      const instance = lightGalleryRef.current;
      if (instance && typeof instance.openGallery === 'function') {
        console.log('[LG] dynamic openGallery', { initialIndex });
        openedRef.current = true;
        isOpeningRef.current = true;
        // Mark opening finished after LG reports open or after timeout fallback
        const afterOpenHandler = () => {
          console.log('[LG] lgAfterOpen received');
          isOpeningRef.current = false;
          document.removeEventListener('lgAfterOpen', afterOpenHandler as any);
          try {
            onOpened?.();
          } catch {}
        };
        document.addEventListener('lgAfterOpen', afterOpenHandler as any);
        setTimeout(() => {
          if (isOpeningRef.current) {
            console.log('[LG] opening timeout fallback ended');
            isOpeningRef.current = false;
            document.removeEventListener('lgAfterOpen', afterOpenHandler as any);
          }
        }, 800);
        setIsSidebarOpen(true);
        try {
          console.log('[LG] calling instance.openGallery now');
          instance.openGallery(initialIndex);
        } catch (e) {
          console.warn('[LG] dynamic openGallery failed', e);
          openedRef.current = false;
        }
        // Freeze props so LG doesn't reinitialize on re-renders while open
        if (!frozenPropsRef.current) {
          frozenPropsRef.current = { dynamicEl: dynamicItems, startIndex: initialIndex };
        }
        return true;
      }
      return false;
    };
    if (!tryOpen()) {
      const interval = setInterval(() => {
        attempts += 1;
        if (tryOpen() || attempts > 20) {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isOpen, initialIndex, photos.length]);

  // Memoize dynamic items to avoid reinit on rerenders
  const dynamicItems = useMemo(
    () =>
      photos.map(p => ({
        src: p.variants?.xlarge?.path || p.variants?.large?.path || p.original_path,
        thumb: p.variants?.thumbnail?.path || p.variants?.small?.path || p.original_path,
        subHtml: '',
      })),
    [photos]
  );

  // Clear frozen props when fully closed
  useEffect(() => {
    if (!isOpen) {
      frozenPropsRef.current = null;
      openedRef.current = false; // Reset to allow reopening
    }
  }, [isOpen]);

  if (!isOpen || photos.length === 0) {
    return null;
  }

  return (
    <>
      <LightGallery
        onInit={onInit}
        onBeforeSlide={onBeforeSlide}
        onAfterSlide={onAfterSlide}
        onBeforeClose={onBeforeClose}
        speed={500}
        plugins={[lgThumbnail, lgZoom, lgFullscreen]}
        mode="lg-slide"
        licenseKey="0000-0000-000-0000"
        thumbnail={true}
        animateThumb={true}
        showThumbByDefault={false}
        thumbWidth={100}
        thumbHeight={80}
        thumbMargin={5}
        zoom={true}
        scale={1}
        keyPress={true}
        controls={true}
        download={false}
        closable={false}
        closeOnTap={false as any}
        closeOnSlideClick={false as any}
        escKey={false}
        swipeToClose={false}
        addClass="lg-custom-toolbar"
        elementClassNames="lg-custom-gallery"
        dynamic={true as any}
        dynamicEl={(frozenPropsRef.current?.dynamicEl || dynamicItems) as any}
        ref={lightGalleryRef}
        startIndex={frozenPropsRef.current?.startIndex ?? initialIndex}
      >
        {/* dynamic mode - no children needed */}
      </LightGallery>

      {/* Metadata sidebar */}
      {currentPhoto && (
        <PhotoSwipeMetadataSidebar
          photo={currentPhoto}
          isVisible={isSidebarOpen}
          onSidebarClose={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Details toggle removed: the (i) toolbar button is the only trigger */}
      {/* CSS to shift LightGallery content when sidebar is open on large screens */}
      <style>
        {`
        @media (min-width: 1024px) {
          /* Shift the entire overlay left by the sidebar width */
          .lg-outer.lg-with-sidebar {
            width: calc(100% - 24rem) !important; /* matches w-96 sidebar width */
            left: 0 !important;
            right: auto !important;
          }
          /* Backdrop should also respect the reserved space */
          .lg-backdrop.lg-with-sidebar {
            width: calc(100% - 24rem) !important;
            left: 0 !important;
            right: auto !important;
          }
          /* Ensure thumbnails container also respects the offset if visible */
          .lg-outer.lg-with-sidebar .lg-thumb-outer {
            right: 24rem !important;
          }
          /* Toolbar and controls alignment */
          .lg-outer.lg-with-sidebar .lg-toolbar,
          .lg-outer.lg-with-sidebar .lg-progress-bar {
            right: 24rem !important;
          }
          /* Next/prev arrows may need spacing from right edge */
          .lg-outer.lg-with-sidebar .lg-next {
            right: calc(24rem + 12px) !important;
          }
          .lg-outer.lg-with-sidebar .lg-inner {
            padding-right: 24rem !important;
          }
        }
        `}
      </style>
    </>
  );
};

export default LightGallerySimple;
