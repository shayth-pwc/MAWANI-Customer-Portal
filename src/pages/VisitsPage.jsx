import { useEffect, useMemo, useRef, useState } from 'react'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import DateField from '../components/ui/DateField'
import { PORT_OPTIONS, VISIT_RANGES, VISIT_TODAY, VISIT_TYPES, VISITS } from '../constants/visits'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'

const RANGE_KEYS = { week: 'visThisWeek', days30: 'visNext30', days90: 'visNext90' }
const TYPE_KEYS = { Sudden: 'visSudden', Periodic: 'visPeriodic', 'Follow-Up': 'visFollowUp' }
const PORT_KEYS = {
  'Yanbu Commercial Port': 'visPortYanbu',
  'Jeddah Islamic Port': 'visPortJeddah',
  'King Abdulaziz Port': 'visPortKing',
}
const TITLE_KEYS = {
  'The fifth shipping company for system installation': 'visCompanyFull',
  'The fifth shipping company for system': 'visCompanyShort',
}

const emptyFilters = { start: '', end: '', port: '', sudden: false, periodic: false, followUp: false }

function parseIso(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIso(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(iso, days) {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return formatIso(date)
}

function displayDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function shortFileName(name) {
  const dot = name.lastIndexOf('.')
  if (dot < 1) return name
  const base = name.slice(0, dot)
  if (base.length <= 7) return name
  return `${base.slice(0, 7)}...${name.slice(dot + 1)}`
}

function chipDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}/${year}`
}

function rangeBounds(range) {
  const today = parseIso(VISIT_TODAY)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  if (range === 'week') return { start: formatIso(weekStart), end: formatIso(weekEnd) }
  if (range === 'days30') return { start: VISIT_TODAY, end: addDays(VISIT_TODAY, 30) }
  return { start: VISIT_TODAY, end: addDays(VISIT_TODAY, 90) }
}

function typeKey(type) {
  if (type === 'Follow-Up') return 'followUp'
  return type.toLowerCase()
}

function typeLabel(t, type) {
  return TYPE_KEYS[type] ? t(TYPE_KEYS[type]) : type
}

function portLabel(t, port) {
  return PORT_KEYS[port] ? t(PORT_KEYS[port]) : port
}

function titleLabel(t, title) {
  return TITLE_KEYS[title] ? t(TITLE_KEYS[title]) : title
}

function selectedTypes(filters) {
  return VISIT_TYPES.filter((type) => filters[typeKey(type)])
}

export default function VisitsPage() {
  const { t } = useApp()
  const [range, setRange] = useState('week')
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [openAttachments, setOpenAttachments] = useState(null)
  const filterRef = useRef(null)

  useClickOutside(filterRef, () => setFiltersOpen(false), filtersOpen)

  useEffect(() => {
    if (!openAttachments) return undefined
    const close = (event) => {
      if (event.target.closest('[data-attachments]')) return
      setOpenAttachments(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openAttachments])

  const filtersActive = Boolean(filters.start || filters.end || filters.port || selectedTypes(filters).length)

  const rows = useMemo(() => {
    const bounds = rangeBounds(range)
    const types = selectedTypes(filters)
    return VISITS.filter((visit) => {
      if (visit.date < bounds.start || visit.date > bounds.end) return false
      if (filters.start && visit.date < filters.start) return false
      if (filters.end && visit.date > filters.end) return false
      if (filters.port && visit.port !== filters.port) return false
      if (types.length && !types.includes(visit.type)) return false
      if (!query.trim()) return true
      const haystack = [visit.code, visit.title, titleLabel(t, visit.title), visit.type, typeLabel(t, visit.type), visit.port, portLabel(t, visit.port), displayDate(visit.date)].join(' ').toLowerCase()
      return haystack.includes(query.trim().toLowerCase())
    })
  }, [filters, query, range, t])

  function exportRows() {
    const headers = ['ID', t('visVisitDate'), 'Title', t('visTypeLabel'), t('visPortLabel')]
    const lines = [headers, ...rows.map((visit) => [visit.code, displayDate(visit.date), titleLabel(t, visit.title), typeLabel(t, visit.type), portLabel(t, visit.port)])]
    const url = URL.createObjectURL(new Blob([lines.map((cells) => cells.map((cell) => `"${cell}"`).join(',')).join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'visits.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 pb-10 pt-4 md:px-8">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {VISIT_RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`h-9 rounded-full px-3.5 text-sm font-semibold ${range === item.id ? 'bg-brand-50 text-brand' : 'border border-border bg-white text-text-secondary'}`}
            >
              {t(RANGE_KEYS[item.id])}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={setQuery} />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-label={t('invFilters')}
              onClick={() => {
                setDraftFilters(filters)
                setFiltersOpen((open) => !open)
              }}
              className="relative flex size-10 items-center justify-center"
            >
              <FunnelIcon active={filtersOpen || filtersActive} />
              {filtersActive ? <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-brand" /> : null}
            </button>
            {filtersOpen ? (
              <FilterMenu
                draft={draftFilters}
                onChange={setDraftFilters}
                onCancel={() => setFiltersOpen(false)}
                onApply={() => {
                  setFilters(draftFilters)
                  setFiltersOpen(false)
                }}
              />
            ) : null}
          </div>
          <button type="button" aria-label={t('invDownload')} onClick={exportRows} className="flex size-10 items-center justify-center">
            <img src={icons.excel} alt="" width={20} height={20} />
          </button>
        </div>
      </div>

      {filtersActive ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.start || filters.end ? (
            <FilterChip
              label={t('visFromTo', { start: filters.start ? chipDate(filters.start) : '…', end: filters.end ? chipDate(filters.end) : '…' })}
              onRemove={() => setFilters({ ...filters, start: '', end: '' })}
            />
          ) : null}
          {filters.port ? <FilterChip label={portLabel(t, filters.port)} onRemove={() => setFilters({ ...filters, port: '' })} /> : null}
          {selectedTypes(filters).map((type) => (
            <FilterChip key={type} label={typeLabel(t, type)} onRemove={() => setFilters({ ...filters, [typeKey(type)]: false })} />
          ))}
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setFilters(emptyFilters)}>
            {t('visRemoveAll')}
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyVisits />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              attachmentsOpen={openAttachments === visit.id}
              onToggleAttachments={() => setOpenAttachments((current) => (current === visit.id ? null : visit.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function VisitCard({ visit, attachmentsOpen, onToggleAttachments }) {
  const { t } = useApp()
  const preview = visit.files.slice(0, visit.files.length > 2 ? 2 : visit.files.length)
  const extra = visit.files.length - preview.length

  return (
    <article className={`flex min-h-[220px] flex-col rounded-2xl border border-border bg-white p-5 shadow-xs ${attachmentsOpen ? 'relative z-20' : ''}`}>
      <div className="flex items-start justify-between gap-3 text-sm text-text-placeholder">
        <span>{t('visId', { code: visit.code })}</span>
        <span className="inline-flex items-center gap-1.5">
          <img src={icons.calendar} alt="" width={16} height={16} />
          {t('visVisitDate')}{' '}
          <span className={visit.urgency === 'today' ? 'font-medium text-[#7616e8]' : visit.urgency === 'due' ? 'font-medium text-[#d92d20]' : 'text-text-secondary'}>
            {displayDate(visit.date)}
            {visit.urgency === 'today' ? ` ${t('visDueToday')}` : visit.urgency === 'due' ? ` ${t('visDue')}` : ''}
          </span>
        </span>
      </div>
      <h2 className="mt-6 text-start text-lg font-semibold leading-7 text-text-primary">{titleLabel(t, visit.title)}</h2>
      <p className="mt-3 text-start text-sm text-text-placeholder">
        {t('visTypeLabel')} <span className="font-semibold text-text-primary">{typeLabel(t, visit.type)}</span>
      </p>
      <p className="mt-0.5 text-start text-sm text-text-placeholder">
        {t('visPortLabel')} <span className="font-semibold text-text-primary">{portLabel(t, visit.port)}</span>
      </p>
      <div className="relative mt-auto flex items-center gap-2 pt-6" dir="ltr" data-attachments>
        {preview.map((file, index) => (
          <FileChip key={`${file.name}-${index}`} file={file} />
        ))}
        {extra > 0 ? (
          <button type="button" onClick={onToggleAttachments} className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-brand bg-white px-2.5 text-sm font-semibold text-brand">
            +{extra}
          </button>
        ) : null}
        {attachmentsOpen ? <AttachmentsMenu files={visit.files} /> : null}
      </div>
    </article>
  )
}

function FileChip({ file }) {
  const { t } = useApp()
  return (
    <button
      type="button"
      dir="ltr"
      aria-label={t('visDownloadNamed', { name: file.name })}
      onClick={() => downloadFile(file.name)}
      className="inline-flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[#e9eaeb] bg-[#f9fafb] px-2.5"
    >
      <FileMark kind={file.kind} />
      <span className="truncate text-sm font-medium text-text-secondary">{shortFileName(file.name)}</span>
      <DownloadIcon />
    </button>
  )
}

function AttachmentsMenu({ files }) {
  const { t } = useApp()
  return (
    <div className="absolute start-0 top-full z-20 mt-2 w-[320px] rounded-xl border border-border bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-3 whitespace-nowrap">
        <p className="text-sm font-semibold text-text-primary">
          {t('visAllAttachments')} <span className="font-normal text-text-placeholder">{t('visFileCount', { count: files.length })}</span>
        </p>
        <button type="button" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand" onClick={() => files.forEach((file) => downloadFile(file.name))}>
          <DownloadIcon color="#1b8354" />
          {t('visDownloadAll')}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {files.map((file, index) => (
          <button key={`${file.name}-${index}`} type="button" aria-label={t('visDownloadNamed', { name: file.name })} onClick={() => downloadFile(file.name)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-2 text-start">
            <FileMark kind={file.kind} />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{file.name}</span>
            <DownloadIcon />
          </button>
        ))}
      </div>
    </div>
  )
}

function downloadFile(name) {
  const url = URL.createObjectURL(new Blob(['Visit attachment'], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function SearchField({ value, onChange }) {
  const { t } = useApp()
  return (
    <label className="flex h-10 items-center gap-2">
      <img src={icons.search} alt="" width={20} height={20} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={t('invSearch')} aria-label={t('invSearch')} className="w-16 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder" />
      {value ? (
        <button type="button" aria-label={t('invClearSearch')} onClick={() => onChange('')}>
          <img src={icons.xClose} alt="" width={20} height={20} />
        </button>
      ) : null}
    </label>
  )
}

function FilterChip({ label, onRemove }) {
  const { t } = useApp()
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-sm text-text-secondary">
      {label}
      <button type="button" aria-label={t('visRemoveNamed', { label })} onClick={onRemove}>
        <img src={icons.xClose} alt="" width={20} height={20} />
      </button>
    </span>
  )
}

function FilterMenu({ draft, onChange, onCancel, onApply }) {
  const { t } = useApp()
  return (
    <div className="absolute end-0 top-12 z-30 w-[300px] rounded-xl border border-border bg-white p-4 shadow-lg">
      <h2 className="text-sm font-semibold text-text-primary">{t('invFilters')}</h2>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text-secondary">{t('visPeriod')}</span>
          <DateField format="long" value={draft.start} max={draft.end} onChange={(start) => onChange({ ...draft, start })} />
          <DateField format="long" value={draft.end} min={draft.start} onChange={(end) => onChange({ ...draft, end })} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
          {t('visPortLabel')}
          <span className="relative">
            <select value={draft.port} onChange={(event) => onChange({ ...draft, port: event.target.value })} className="h-10 w-full appearance-none rounded-lg border border-border bg-white px-3 pe-9 text-sm font-semibold text-text-primary shadow-xs outline-none">
              <option value="">{t('visSelectPort')}</option>
              {PORT_OPTIONS.map((port) => <option key={port} value={port}>{portLabel(t, port)}</option>)}
            </select>
            <img src={icons.chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
          </span>
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-text-secondary">{t('visVisitType')}</legend>
        {VISIT_TYPES.map((type) => (
          <label key={type} className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={draft[typeKey(type)]}
              onChange={(event) => onChange({ ...draft, [typeKey(type)]: event.target.checked })}
              className="size-4 accent-[#1b8354]"
            />
            {typeLabel(t, type)}
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" className="h-9" onClick={onCancel}>{t('cancel')}</Button>
        <Button className="h-9" onClick={onApply}>{t('invApply')}</Button>
      </div>
    </div>
  )
}

function EmptyVisits() {
  const { t } = useApp()
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2" style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)' }}>
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
      </div>
      <span className="relative mb-4 flex size-20 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        <img src={icons.users} alt="" width={64} height={64} />
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">{t('visEmptyTitle')}</h2>
      <p className="relative mt-1 text-sm text-text-tertiary">{t('visEmptyBody')}</p>
    </div>
  )
}

function FileMark({ kind }) {
  const src = kind === 'PDF' ? icons.fileTypePdf : icons.fileTypeJpg
  return <img src={src} alt="" />
}

function FunnelIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 3.75h15l-5.833 6.917v4.583L8.333 16.667V10.667L2.5 3.75Z" stroke={active ? '#1b8354' : '#535862'} strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon({ color = '#717680' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.667v7.333m0 0 2.667-2.666M8 10 5.333 7.334M3.333 13.333h9.334" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
