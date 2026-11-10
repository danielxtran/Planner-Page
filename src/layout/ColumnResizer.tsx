import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { GRID_COLUMNS } from '../storage/pages'
import { clampResize, MIN_COLUMN_WIDTH } from './operations'

interface ColumnResizerProps {
  leftWidth: number
  rightWidth: number
  /** The row's grid element, measured to turn pixels into twelfths. */
  gridRef: RefObject<HTMLDivElement | null>
  label: string
  onPreview: (delta: number | null) => void
  onCommit: (delta: number) => void
}

/**
 * The divider between two columns. Drag it (snaps to twelfths) or focus it and
 * use the arrow keys. While dragging only a preview changes; letting go saves
 * once, so a whole drag is a single undo step.
 */
export function ColumnResizer(props: ColumnResizerProps) {
  const { leftWidth, rightWidth, gridRef, label, onPreview, onCommit } = props
  // Widths are remembered from the start of the drag, because the props update
  // with the live preview while the delta is measured from where it started.
  const drag = useRef<{ startX: number; step: number; left: number; right: number; delta: number }>(
    null,
  )

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    const grid = gridRef.current
    if (!grid) return
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0
    // 12 tracks plus 11 gaps: one twelfth step is (width + gap) / 12 pixels.
    const step = (grid.getBoundingClientRect().width + gap) / GRID_COLUMNS
    drag.current = { startX: e.clientX, step, left: leftWidth, right: rightWidth, delta: 0 }
    // Keep receiving pointer moves even when the pointer leaves the thin divider.
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const delta = clampResize(d.left, d.right, Math.round((e.clientX - d.startX) / d.step))
    if (delta !== d.delta) {
      d.delta = delta
      onPreview(delta)
    }
  }

  function handlePointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.delta === 0) onPreview(null)
    else onCommit(d.delta)
  }

  function handlePointerCancel() {
    drag.current = null
    onPreview(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return
    e.preventDefault()
    if (clampResize(leftWidth, rightWidth, step) !== 0) onCommit(step)
  }

  return (
    <div
      // A focusable separator is the standard accessible pattern for resizable splits.
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_COLUMN_WIDTH}
      aria-valuemax={leftWidth + rightWidth - MIN_COLUMN_WIDTH}
      aria-valuenow={leftWidth}
      aria-valuetext={`${leftWidth} and ${rightWidth} twelfths`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      // Sits in the 1rem gap between columns. Hidden on narrow screens, where columns stack.
      className="group absolute top-0 -right-4 z-10 hidden h-full w-4 cursor-col-resize touch-none justify-center focus-visible:outline-none md:flex"
    >
      <span className="h-full w-1 rounded-full bg-ink/15 group-hover:bg-ink/40 group-focus-visible:bg-ink/60" />
    </div>
  )
}
