import { useEffect } from 'react'

export function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return undefined

    const handlePointer = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return
      onOutside()
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') onOutside()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [ref, onOutside, active])
}
