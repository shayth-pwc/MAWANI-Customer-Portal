import { useEffect, useId } from 'react'
import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'
import Button from './Button'

export default function Modal({ open, title, onClose, children }) {
  const { t } = useApp()
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <Button variant="ghost" className="size-10 px-0" onClick={onClose} aria-label={t('close')}>
            <img src={icons.arrowLeft} alt="" width={16} height={16} className="rotate-180 rtl:rotate-0" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
