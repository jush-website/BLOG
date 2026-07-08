import { useEffect, useState } from 'react';

/**
 * These are measured against the MAIN COLUMN, not the viewport: react-grid-layout is
 * handed the content width, which is ~368px narrower than the window (240px sidebar
 * + 2x64px padding). Viewport-sized breakpoints put a 1280px laptop into the 2-column
 * band and, worse, below THREE_COL_MIN_WIDTH, which silently discards drag-mode edits.
 */
export const BREAKPOINTS = { lg: 1200, md: 880, sm: 640, xs: 460, xxs: 0 };
export const GRID_COLS = { lg: 3, md: 3, sm: 2, xs: 1, xxs: 1 };

/** Narrowest width that still lays out in 3 columns, i.e. matches a saved layout. */
export const THREE_COL_MIN_WIDTH = BREAKPOINTS.md;

const COLS = GRID_COLS.lg;
const widthFor = (size) => (size === 'large' ? 3 : size === 'medium' ? 2 : 1);

/**
 * Layout for a section's items. Items with a saved gridLayout keep it;
 * the rest are flowed left-to-right *below* everything already placed,
 * so a newly added card never lands on top of an existing one.
 */
export function getAutoLayout(items) {
  let x = 0;
  let y = items.reduce(
    (max, i) => (i.gridLayout ? Math.max(max, i.gridLayout.y + i.gridLayout.h) : max),
    0
  );

  return items.map((item) => {
    if (item.gridLayout) return item.gridLayout;

    const w = widthFor(item.size);
    if (x + w > COLS) {
      x = 0;
      y += 2;
    }
    const layout = { i: item.id, x, y, w, h: 2 };
    x += w;
    return layout;
  });
}

/** react-grid-layout needs an explicit pixel width; track the container's. */
export function useContainerWidth(ref, ready) {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, ready]);

  return width;
}
