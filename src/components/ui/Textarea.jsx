import { useId } from 'react'

export default function Textarea({ id, label, hint, compact = false, className = '', ...props }) {
  const generatedId = useId()
  const fieldId = id || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label
          htmlFor={fieldId}
          className={compact ? 'text-sm font-medium text-text-secondary' : 'text-xl font-semibold text-text-primary'}
        >
          {label}
        </label>
      ) : null}
      {hint ? <p className="text-md text-text-tertiary">{hint}</p> : null}
      <textarea
        id={fieldId}
        className="min-h-40 w-full resize-y rounded-lg border border-border bg-white px-3 py-3 text-sm text-text-primary shadow-xs outline-none placeholder:text-text-placeholder focus:ring-2 focus:ring-brand/30"
        {...props}
      />
    </div>
  )
}
