export function isUndoShortcut(e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}) {
  return e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey
}

/** True while typing somewhere, where Ctrl+Z should keep doing normal text undo. */
export function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}
