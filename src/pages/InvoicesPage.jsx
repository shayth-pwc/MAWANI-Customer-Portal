import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import DateField from '../components/ui/DateField'
import LoadingCards from '../components/common/LoadingCards'
import { INVOICES, INVOICE_REQUESTS } from '../constants/invoices'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'

function countLabel(count) {
  return String(count).padStart(2, '0')
}

function FunnelIcon({ active }) {
  const color = active ? '#1b8354' : '#535862'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.75h15l-5.833 6.917v4.583L8.333 16.667V10.667L2.5 3.75Z"
        stroke={color}
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ExcelIcon() {
  return <img src={icons.excel} alt="" width={20} height={20} />
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.167v11.666M4.167 10h11.666" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 5.833V10l2.5 1.667M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        stroke="#414651"
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M23.333 14a9.333 9.333 0 0 1-15.89 6.61M4.667 14a9.333 9.333 0 0 1 15.89-6.61"
        stroke="#0e7490"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M18.667 4.667h2.666V7.333M6.667 23.333H4v-2.666" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const VALUE_KEYS = {
  Paid: 'paid',
  Expired: 'invExpired',
  Pending: 'invPending',
  Approved: 'approved',
  Yes: 'invYes',
  No: 'invNo',
  'Description of the invoice here': 'invDescription',
}

const INVOICE_COLUMNS = ['invDescriptionCode', 'invAmount', 'invVatApplication', 'invVatPercent', 'invVatAmount', 'invTotal']
const REQUEST_COLUMNS = ['invDescriptionCode', 'invInvoiceNumber', 'invSadadNumber', 'invAmount', 'invStatus', 'invVatApplicability', 'invVatPercent', 'invVatAmount']

function localizeValue(t, value) {
  const key = VALUE_KEYS[value]
  return key ? t(key) : value
}

function matchesQuery(row, query) {
  if (!query) return true
  const haystack = [row.code, row.description, row.invoiceNumber, row.sadad].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((cells) => cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function printInvoice(row, t) {
  const sheet = window.open('', '_blank', 'noopener,noreferrer')
  if (!sheet) return
  const dir = document.documentElement.dir || 'ltr'
  sheet.document.write(`<!DOCTYPE html><html dir="${dir}"><head><title>${t('invPrint')}</title></head><body style="font-family:sans-serif;padding:32px">
    <h1>${t('invoice')} ${row.code}</h1>
    <p>${localizeValue(t, row.description)}</p>
    <p>${t('invAmount')}: ${row.amount}</p>
    <p>${t('invVatApplication')}: ${localizeValue(t, row.vatApplication)}</p>
    <p>${t('invVatPercent')}: ${row.vatPercent}</p>
    <p>${t('invVatAmount')}: ${row.vatAmount}</p>
    <p>${t('invTotal')}: ${row.total}</p>
    </body></html>`)
  sheet.document.close()
  sheet.focus()
  sheet.print()
}

export default function InvoicesPage() {
  const { t } = useApp()
  const [tab, setTab] = useState('invoices')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [requests, setRequests] = useState(INVOICE_REQUESTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState({ date: '', paid: false, expired: false })
  const [filters, setFilters] = useState({ date: '', paid: false, expired: false })
  const [vatSort, setVatSort] = useState(null)
  const [amountWidth, setAmountWidth] = useState(196)
  const [resizing, setResizing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const filterRef = useRef(null)

  useClickOutside(filterRef, () => setFiltersOpen(false), filtersOpen)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 800)
    return () => window.clearTimeout(timer)
  }, [])

  const filtersActive = Boolean(filters.date || filters.paid || filters.expired)

  const invoiceRows = useMemo(() => {
    const statuses = [filters.paid ? 'Paid' : null, filters.expired ? 'Expired' : null].filter(Boolean)
    const rows = INVOICES.filter((row) => {
      if (!matchesQuery(row, query)) return false
      if (filters.date && row.issueDate !== filters.date) return false
      if (statuses.length && !statuses.includes(row.status)) return false
      return true
    })
    if (!vatSort) return rows
    return [...rows].sort((a, b) => {
      const order = a.vatApplication.localeCompare(b.vatApplication)
      return vatSort === 'asc' ? order : -order
    })
  }, [filters, query, vatSort])

  const requestRows = useMemo(
    () => requests.filter((row) => matchesQuery(row, query)),
    [query, requests],
  )

  const rows = tab === 'invoices' ? invoiceRows : requestRows
  const empty = !loading && rows.length === 0

  function exportRows() {
    if (tab === 'invoices') {
      downloadCsv(
        'invoices.csv',
        INVOICE_COLUMNS.map((key) => t(key)),
        invoiceRows.map((row) => [
          `${row.code} ${localizeValue(t, row.description)}`,
          row.amount,
          localizeValue(t, row.vatApplication),
          row.vatPercent,
          row.vatAmount,
          row.total,
        ]),
      )
      return
    }
    downloadCsv(
      'invoice-requests.csv',
      REQUEST_COLUMNS.map((key) => t(key)),
      requestRows.map((row) => [
        `${row.code} ${localizeValue(t, row.description)}`,
        row.invoiceNumber,
        row.sadad,
        row.amount,
        localizeValue(t, row.status),
        localizeValue(t, row.vat),
        row.vatPercent,
        row.vatAmount,
      ]),
    )
  }

  function startResize(event) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = amountWidth
    const direction = document.documentElement.dir === 'rtl' ? -1 : 1
    setResizing(true)
    const move = (moveEvent) => {
      setAmountWidth(Math.min(360, Math.max(140, startWidth + (moveEvent.clientX - startX) * direction)))
    }
    const stop = () => {
      setResizing(false)
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', stop)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', stop)
  }

  function createRequest(draft) {
    setRequests((current) => [
      {
        id: `req-${Date.now()}`,
        code: '331-501',
        description: draft.contractor || 'Description of the invoice here',
        invoiceNumber: draft.invoiceNumber,
        sadad: draft.sadad,
        amount: '20000',
        status: 'Pending',
        vat: 'Yes',
        vatPercent: '90%',
        vatAmount: '70000',
      },
      ...current,
    ])
    setTab('requests')
    setModalOpen(false)
  }

  return (
    <div className="px-4 pb-10 pt-4 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-6">
          <TabButton active={tab === 'invoices'} label={t('invoices')} count={INVOICES.length} onClick={() => setTab('invoices')} />
          <TabButton active={tab === 'requests'} label={t('requests')} count={requests.length} onClick={() => setTab('requests')} />
        </div>
        <div className="ms-auto flex items-center gap-3">
          <label className="flex h-10 items-center gap-2">
            <img src={icons.search} alt="" width={20} height={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('invSearch')}
              aria-label={t('invSearch')}
              className="w-16 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
            />
            {query ? (
              <button type="button" aria-label={t('invClearSearch')} onClick={() => setQuery('')}>
                <img src={icons.xClose} alt="" width={20} height={20} />
              </button>
            ) : null}
          </label>
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
          <button
            type="button"
            aria-label={t('invDownload')}
            onClick={exportRows}
            className="flex size-10 items-center justify-center"
          >
            <ExcelIcon />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-brand shadow-xs"
          >
            <PlusIcon />
            {t('invNewInvoice')}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingCards />
      ) : empty ? (
        <section className="overflow-hidden rounded-3xl border border-border bg-white">
          <EmptyInvoices requests={tab === 'requests'} onCreate={() => setModalOpen(true)} />
        </section>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-3xl border border-border bg-white lg:block">
            {tab === 'invoices' ? (
              <InvoiceTable
                rows={invoiceRows}
                amountWidth={amountWidth}
                resizing={resizing}
                vatSort={vatSort}
                onSort={() => setVatSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
                onResizeStart={startResize}
              />
            ) : (
              <RequestTable rows={requestRows} />
            )}
          </section>
          <div className="flex flex-col gap-3 lg:hidden">
            {tab === 'invoices'
              ? invoiceRows.map((row) => <InvoiceMobileCard key={row.id} row={row} />)
              : requestRows.map((row) => <InvoiceRequestMobileCard key={row.id} row={row} />)}
          </div>
        </>
      )}

      <NewInvoiceModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={createRequest} />
    </div>
  )
}

function TabButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
        active ? 'border-brand bg-brand-50 text-brand' : 'border-transparent text-text-tertiary'
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-white text-brand' : 'bg-bg-active text-text-placeholder'}`}>
        {countLabel(count)}
      </span>
    </button>
  )
}

const STATUS_OPTIONS = [
  ['paid', 'paid', 'border-success-200 bg-success-50 text-success-700'],
  ['expired', 'invExpired', 'border-[#d5d9eb] bg-[#f8f9fc] text-[#515481]'],
]

function FilterMenu({ draft, onChange, onCancel, onApply }) {
  const { t } = useApp()
  return (
    <div className="absolute end-0 top-12 z-30 w-[320px] rounded-xl border border-border bg-white shadow-lg">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">{t('invFilters')}</h2>
      <div className="flex flex-col gap-4 px-4 py-4">
        <DateField label={t('invIssueDate')} placeholder={t('invChooseDate')} value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
        <fieldset>
          <legend className="text-sm font-semibold text-text-secondary">{t('invStatus')}</legend>
          {STATUS_OPTIONS.map(([key, label, pill]) => (
            <label key={key} className="mt-3 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(event) => onChange({ ...draft, [key]: event.target.checked })}
                className="sr-only"
              />
              <span className={`flex size-5 items-center justify-center rounded-md border ${draft[key] ? 'border-brand bg-brand text-white' : 'border-[#d0d5dd] bg-white'}`}>
                {draft[key] ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.2 4.7 8.4 9.5 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill}`}>{t(label)}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="secondary" className="h-9" onClick={onCancel}>{t('cancel')}</Button>
        <Button className="h-9" onClick={onApply}>{t('invApply')}</Button>
      </div>
    </div>
  )
}

function InvoiceTable({ rows, amountWidth, resizing, vatSort, onSort, onResizeStart }) {
  const { t } = useApp()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-start">
        <colgroup>
          <col />
          <col style={{ width: amountWidth }} />
          <col />
          <col />
          <col />
          <col />
          <col style={{ width: 72 }} />
        </colgroup>
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('invDescriptionCode')}</th>
            <th className={`relative border-b border-border px-6 py-3 text-start font-semibold ${resizing ? 'bg-bg-active' : ''}`}>
              {t('invAmount')}
              <button
                type="button"
                aria-label={t('invResize')}
                onMouseDown={onResizeStart}
                className={`absolute inset-y-2 end-0 w-1 cursor-col-resize rounded-full ${resizing ? 'bg-text-primary' : 'bg-transparent hover:bg-text-placeholder'}`}
              />
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              <button type="button" onClick={onSort} className="inline-flex items-center gap-1">
                {t('invVatApplication')}
                <img src={icons.chevronDown} alt="" width={20} height={20} className={vatSort === 'desc' ? 'rotate-180' : ''} />
              </button>
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('invVatPercent')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('invVatAmount')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('invTotal')}</th>
            <th className="border-b border-border px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm font-normal text-text-placeholder hover:bg-bg-active">
              <td className="border-b border-border px-6 text-sm font-normal text-text-primary">
                {row.code} {localizeValue(t, row.description)}
              </td>
              <td className="border-b border-border px-6">{row.amount}</td>
              <td className="border-b border-border px-6">{localizeValue(t, row.vatApplication)}</td>
              <td className="border-b border-border px-6">{row.vatPercent}</td>
              <td className="border-b border-border px-6">{row.vatAmount}</td>
              <td className="border-b border-border px-6">{row.total}</td>
              <td className="border-b border-border px-4 text-end">
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-label={t('invPrint')}
                    onClick={() => printInvoice(row, t)}
                    className="rounded-md p-1.5 hover:bg-white"
                  >
                    <img src={icons.printer} alt="" width={20} height={20} />
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute end-full top-1/2 z-10 me-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-xs font-medium text-white group-hover:block group-focus-within:block"
                  >
                    {t('invPrint')}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RequestTable({ rows }) {
  const { t } = useApp()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            {REQUEST_COLUMNS.map((key) => (
              <th key={key} className="border-b border-border px-6 py-3 text-start font-semibold">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm font-normal text-text-placeholder">
              <td className="border-b border-border px-6 text-sm font-normal text-text-primary">
                {row.code} {localizeValue(t, row.description)}
              </td>
              <td className="border-b border-border px-6">{row.invoiceNumber}</td>
              <td className="border-b border-border px-6">{row.sadad}</td>
              <td className="border-b border-border px-6">{row.amount}</td>
              <td className="border-b border-border px-6">
                <StatusPill status={row.status} />
              </td>
              <td className="border-b border-border px-6">{localizeValue(t, row.vat)}</td>
              <td className="border-b border-border px-6">{row.vatPercent}</td>
              <td className="border-b border-border px-6">{row.vatAmount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function invoiceStatusClass(status) {
  if (status === 'Paid' || status === 'Approved') return 'border-success-200 bg-success-50 text-success-700'
  if (status === 'Expired') return 'border-[#d5d9eb] bg-[#f8f9fc] text-[#515481]'
  return 'border-[#d5d9eb] bg-[#f8f9fc] text-[#363f72]'
}

function StatusPill({ status }) {
  const { t } = useApp()
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${invoiceStatusClass(status)}`}>
      {localizeValue(t, status)}
    </span>
  )
}

function InvoiceMobileCard({ row }) {
  const { t } = useApp()
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{row.code}</p>
        <StatusPill status={row.status} />
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">{localizeValue(t, row.description)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{row.amount}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('invAmount')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{row.total}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('invTotal')}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-text-tertiary">
          {t('invVatApplication')}: <span className="font-medium text-text-primary">{localizeValue(t, row.vatApplication)}</span>
        </p>
        <button type="button" aria-label={t('invPrint')} onClick={() => printInvoice(row, t)} className="rounded-md p-1.5">
          <img src={icons.printer} alt="" width={20} height={20} />
        </button>
      </div>
    </article>
  )
}

function InvoiceRequestMobileCard({ row }) {
  const { t } = useApp()
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{row.code}</p>
        <StatusPill status={row.status} />
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">{localizeValue(t, row.description)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{row.invoiceNumber}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('invInvoiceNumber')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{row.amount}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('invAmount')}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-text-tertiary">
        {t('invSadadNumber')}: <span className="font-medium text-text-primary">{row.sadad}</span>
      </p>
    </article>
  )
}

function EmptyInvoices({ onCreate, requests = false }) {
  const { t } = useApp()
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2"
        style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)' }}
      >
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
      </div>
      <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        <RefreshIcon />
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">{t(requests ? 'invNoRequests' : 'invNoInvoices')}</h2>
      <p className="relative mt-1 text-sm text-text-tertiary">
        {t(requests ? 'invRequestsHint' : 'invInvoicesHint')}
      </p>
      <Button className="relative mt-6" onClick={onCreate}>
        <PlusIcon />
        {t('invNewInvoice')}
      </Button>
    </div>
  )
}

function NewInvoiceModal({ open, onClose, onConfirm }) {
  const { t } = useApp()
  const titleId = useId()
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const set = (key) => (event) => {
    setDraft((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (!draft.sadad.trim()) next.sadad = t('invRequired')
    if (!draft.invoiceNumber.trim()) next.invoiceNumber = t('invRequired')
    setErrors(next)
    if (Object.keys(next).length) return
    onConfirm(draft)
    setDraft(emptyDraft)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border">
            <ClockIcon />
          </span>
          <h2 id={titleId} className="pt-2 text-lg font-semibold text-text-primary">
            {t('invNewRequest')}
          </h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="ms-auto flex size-9 items-center justify-center rounded-lg hover:bg-bg-active">
            <img src={icons.xClose} alt="" width={20} height={20} />
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-4">
          <Field label={t('invSadadNumber')} required error={errors.sadad}>
            <input value={draft.sadad} onChange={set('sadad')} placeholder={t('invEnterSadad')} className={inputClass(errors.sadad)} />
          </Field>
          <Field label={t('invInvoiceNumber')} required error={errors.invoiceNumber}>
            <input value={draft.invoiceNumber} onChange={set('invoiceNumber')} placeholder={t('invEnterNumber')} className={inputClass(errors.invoiceNumber)} />
          </Field>
          <Field label={t('invContractor')}>
            <input value={draft.contractor} onChange={set('contractor')} placeholder={t('invEnterName')} className={inputClass()} />
          </Field>
          <DateField label={t('invDate')} value={draft.date} placeholder={t('invSelectDate')} onChange={(date) => setDraft((current) => ({ ...current, date }))} />
          <Field label={t('invNotes')}>
            <textarea
              value={draft.notes}
              onChange={set('notes')}
              placeholder={t('invNotesPlaceholder')}
              className="min-h-28 w-full resize-y rounded-lg border border-border px-3 py-3 text-sm text-text-primary shadow-xs outline-none placeholder:text-text-placeholder focus:border-[#717bbc]"
            />
          </Field>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(emptyDraft)
              setErrors({})
              onClose()
            }}
          >
            {t('invDiscard')}
          </Button>
          <Button type="submit">{t('invConfirm')}</Button>
        </div>
      </form>
    </div>
  )
}

const emptyDraft = { sadad: '', invoiceNumber: '', contractor: '', date: '', notes: '' }

function inputClass(error) {
  return `h-11 w-full rounded-lg border bg-white px-3 text-sm text-text-primary shadow-xs outline-none placeholder:text-text-placeholder focus:border-[#717bbc] ${
    error ? 'border-[#d92d20]' : 'border-border'
  }`
}

function Field({ label, required = false, error, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      <span>
        {label}
        {required ? <span className="text-[#d92d20]">*</span> : null}
      </span>
      {children}
      {error ? <span className="font-normal text-[#d92d20]">{error}</span> : null}
    </label>
  )
}
