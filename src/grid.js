import { useEffect, useState } from 'react';

/**
 * Breakpoints are measured against the MAIN COLUMN, not the viewport: react-grid-layout
 * is handed the content width, which is narrower than the window by the chrome around it.
 *
 * Column bands are chosen so a card is never cramped:
 *   main >= 1040 -> 3 columns   (>=305px cards)
 *   660..1040    -> 2 columns   (wide cards; where most laptops land)
 *   < 660        -> 1 column
 * Three narrow columns in a ~1000px container gave ~264px cards; a 2-column mid band
 * roughly doubles that. The canonical arrangement is the 3-column (lg) layout; RGL
 * reflows it down deterministically for the narrower bands.
 */
export const BREAKPOINTS = { lg: 1040, md: 660, sm: 400, xs: 200, xxs: 0 };
export const GRID_COLS = { lg: 3, md: 2, sm: 1, xs: 1, xxs: 1 };

/** Narrowest content width that still lays out in 3 columns (the canonical arrangement). */
export const THREE_COL_MIN_WIDTH = BREAKPOINTS.lg;

const COLS = GRID_COLS.lg;
const widthFor = (size) => (size === 'large' ? 3 : size === 'medium' ? 2 : 1);

/**
 * Keep only geometry from a stored layout.
 *
 * An earlier version of the editor persisted react-grid-layout's whole layout item,
 * flags included. react-grid-layout resolves dragging as
 *   `typeof l.isDraggable === "boolean" ? l.isDraggable : !l.static && isDraggable`
 * so a stored `isDraggable: true` OVERRIDES `isDraggable={false}` on the public page:
 * visitors could drag the cards, and because react-draggable preventDefaults
 * touchstart, a tap on a link card never became a click on mobile.
 *
 * Sanitising on read heals those documents the moment they render. No migration.
 */
const geometryOnly = ({ i, x, y, w, h }) => ({ i, x, y, w, h });

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
    if (item.gridLayout) return geometryOnly(item.gridLayout);

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
