import { useEffect, useRef } from 'react'

/** Reusable in-page confirmation; never native window.confirm/alert. */
export default function ConfirmDialog({ title, message, busy, onCancel, onConfirm, language = 'en' }) {
  const confirmRef = useRef(null)
  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="mawani-confirm-title" aria-describedby="mawani-confirm-desc"
        dir={language === 'ar' ? 'rtl' : 'ltr'} className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl">
        <h2 id="mawani-confirm-title" className="text-xl font-semibold text-text-primary">{title}</h2>
        <p id="mawani-confirm-desc" className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-neutral disabled:opacity-50">
            {language === 'ar' ? '\u0625\u0644\u063a\u0627\u0621' : 'Cancel'}
          </button>
          <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? (language === 'ar' ? '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u0646\u0641\u064a\u0630' : 'Working...') : (language === 'ar' ? '\u062a\u0623\u0643\u064a\u062f' : 'Confirm')}
          </button>
        </div>
      </section>
    </div>
  )
}
