'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../../lib/dungeon';
import { WIDTH, HEIGHT, SIZE, PAD, PAPER_MARGIN } from './model';

export function useMapViewport() {
  const [zoom, setZoomValue] = useState(0.8);
  const [space, setSpace] = useState(false);
  const [ctrlPan, setCtrlPan] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const zoomValue = useRef(0.8);
  const setZoom = useCallback(
    (next: number | ((previous: number) => number)) => {
      const previous = zoomValue.current;
      const value = Math.min(
        1.6,
        Math.max(0.4, typeof next === 'function' ? next(previous) : next),
      );
      const el = viewport.current;
      const cx = el ? (el.scrollLeft + el.clientWidth / 2) / previous : 0,
        cy = el ? (el.scrollTop + el.clientHeight / 2) / previous : 0;
      zoomValue.current = value;
      setZoomValue(value);
      if (el)
        requestAnimationFrame(() => {
          if (viewport.current === el)
            el.scrollTo({
              left: cx * value - el.clientWidth / 2,
              top: cy * value - el.clientHeight / 2,
            });
        });
    },
    [],
  );
  const fitPaper = useCallback(
    (limit = 1.2) => {
      const el = viewport.current;
      if (!el) return;
      const top = Math.max(
        80,
        (overlay.current?.getBoundingClientRect().bottom || 0) -
          el.getBoundingClientRect().top +
          24,
      );
      const available = Math.max(200, el.clientHeight - top - 65);
      const value = Math.max(
        0.4,
        Math.min(limit, (el.clientWidth - 90) / WIDTH, available / HEIGHT),
      );
      setZoom(value);
      requestAnimationFrame(() => {
        if (viewport.current === el)
          el.scrollTo({
            left: (PAPER_MARGIN + WIDTH / 2) * value - el.clientWidth / 2,
            top: (PAPER_MARGIN + HEIGHT / 2) * value - (top + available / 2),
          });
      });
    },
    [setZoom],
  );
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => fitPaper());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitPaper]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) =>
        Math.min(
          1.6,
          Math.max(
            0.4,
            Math.round((z + (e.deltaY < 0 ? 0.1 : -0.1)) * 100) / 100,
          ),
        ),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [setZoom]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPan(true);
      if (
        e.code === 'Space' &&
        !(e.target as HTMLElement)?.closest(
          'input,textarea,select,button,[role="dialog"]',
        )
      ) {
        setSpace(true);
        if (e.target === svg.current) e.preventDefault();
      }
    };
    const up = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.code === 'Space') setSpace(false);
        setCtrlPan(e.ctrlKey);
      } else {
        setSpace(false);
        setCtrlPan(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', up);
    };
  }, []);

  const centerOnPoint = useCallback(
    (point: Point, behavior?: ScrollBehavior) => {
      const el = viewport.current;
      if (!el) return;
      el.scrollTo({
        left:
          (PAPER_MARGIN + PAD + (point[0] + 0.5) * SIZE) * zoomValue.current -
          el.clientWidth / 2,
        top:
          (PAPER_MARGIN + PAD + (point[1] + 0.5) * SIZE) * zoomValue.current -
          el.clientHeight / 2,
        behavior,
      });
    },
    [],
  );

  return {
    overlay,
    viewport,
    svg,
    zoom,
    space,
    ctrlPan,
    setZoom,
    fitPaper,
    centerOnPoint,
  };
}
