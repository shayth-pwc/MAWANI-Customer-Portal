import { useEffect, useRef, useState } from 'react'
import { icons } from '../../assets'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useApp } from '../../hooks/useApp'
import { calendarMonthTitle, formatNamedDate } from '../../utils/formatDate'

const WEEKDAYS = {
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  ar: ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'],
}

function chipDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}/${year}`
}

function monthCells(year, month) {
  const leading = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
}

function toIso(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DateField({
  label,
  value = '',
  onChange,
  placeholder,
  min,
  max,
  format = 'chip',
  className = '',
  buttonClassName = 'flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-white px-3 text-start shadow-xs',
}) {
  const { t, language } = useApp()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState(null)
  const hint = placeholder || t('invSelectDates')
  const text = value ? (format === 'long' ? formatNamedDate(value, language, { month: 'long' }) : chipDate(value)) : hint

  useClickOutside(rootRef, () => setOpen(false), open)

  useEffect(() => {
    if (!open) return undefined
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(rect.width, 280)
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
      const estimated = 312
      const below = rect.bottom + 6
      const top = below + estimated > window.innerHeight && rect.top > estimated ? rect.top - estimated - 6 : below
      setBox({ top, left, width })
    }
    place()
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className={className} onMouseDown={(event) => event.stopPropagation()}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-text-secondary">{label}</span> : null}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={label || hint}
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName}
      >
        <img src={icons.calendar} alt="" width={20} height={20} />
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${value ? 'text-text-primary' : 'text-text-placeholder'}`}>{text}</span>
      </button>
      {open && box ? (
        <Calendar
          value={value}
          min={min}
          max={max}
          language={language}
          style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex: 80 }}
          onChange={(iso) => {
            onChange(iso)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function Calendar({ value, min, max, language, style, onChange }) {
  const selected = value ? value.split('-').map(Number) : null
  const initial = selected ? new Date(selected[0], selected[1] - 1, 1) : new Date()
  const [cursor, setCursor] = useState(initial)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  return (
    <div style={style} className="rounded-xl border border-border bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={language === 'ar' ? 'الشهر السابق' : 'Previous month'} onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex size-7 items-center justify-center rounded-md hover:bg-bg-active">
          <img src={icons.chevronLeft} alt="" width={16} height={16} className="rtl:scale-x-[-1]" />
        </button>
        <span className="text-sm font-semibold text-text-primary">{calendarMonthTitle(year, month, language)}</span>
        <button type="button" aria-label={language === 'ar' ? 'الشهر التالي' : 'Next month'} onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex size-7 items-center justify-center rounded-md hover:bg-bg-active">
          <img src={icons.chevronRight} alt="" width={16} height={16} className="rtl:scale-x-[-1]" />
        </button>
      </div>
      <div className="text-center" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: '2px' }}>
        {WEEKDAYS[language === 'ar' ? 'ar' : 'en'].map((day) => (
          <span key={day} className="py-1 text-[11px] font-medium text-text-placeholder">{day}</span>
        ))}
        {monthCells(year, month).map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />
          const iso = toIso(year, month, day)
          const disabled = Boolean((min && iso < min) || (max && iso > max))
          const active = value === iso
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`mx-auto flex size-8 items-center justify-center rounded-full text-sm ${active ? 'bg-brand font-semibold text-white' : disabled ? 'cursor-not-allowed text-[#d0d5dd]' : 'text-text-secondary hover:bg-brand-50'}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
