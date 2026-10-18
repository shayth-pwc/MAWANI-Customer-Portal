import { useEffect, useId } from 'react'
import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

export default function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  width = 'max-w-[400px]',
  icon,
  iconPlacement = 'above',
}) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${width} rounded-2xl bg-white shadow-lg`}
      >
        <div className="px-6 pt-6">
          {icon && iconPlacement === 'above' ? <div className="mb-4">{icon}</div> : null}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && iconPlacement === 'inline' ? icon : null}
              <h2 id={titleId} className="text-lg font-semibold text-text-primary">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"
            >
              <img src={icons.xClose} alt="" width={20} height={20} />
            </button>
          </div>
          {description ? <p className="mt-1 text-sm text-text-tertiary">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
