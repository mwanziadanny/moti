import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

let lockCount = 0
function lockScroll() {
  if (lockCount++ === 0) {
    const w = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (w > 0) document.body.style.paddingRight = `${w}px`
  }
  return () => {
    if (--lockCount === 0) {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }
}

/** Focus trap + Escape + scroll lock + focus restore for any overlay. */
export function useOverlay(open, onClose, ref) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const unlock = lockScroll()
    const node = ref.current
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE)
    ;(first || node)?.focus({ preventScroll: true })
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
        if (!items.length) return
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [open, ref])
}
