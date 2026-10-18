import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import {
  FINE_STATUS_OPTIONS,
  LICENSE_TYPE_OPTIONS,
  OBJECTION_REQUESTS,
  PORT_OPTIONS,
  UNPAID_FINES,
  VIOLATIONS,
} from '../constants/violations'
import DateField from '../components/ui/DateField'
import { AttachmentSection, DrawerClose, FeaturedIcon } from '../components/common/InfoDrawer'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'
import { formatNamedDate } from '../utils/formatDate'

const AR_VALUES = {
  'The fifth shipping company': 'vioCompany',
  Fine: 'vioTypeFine',
  'Ships Supplier': 'vioLicenseShips',
  'Marine Agents': 'licMarineAgents',
  'Shipping Agent': 'licShippingAgent',
  'Article (6-First-Undertakings-1)': 'vioTitle',
  'Description of objection request': 'vioDescription',
  '10,000 SAR': 'vioAmountSar',
  'Violation name here': 'vioRelatedName',
  'Reason here': 'vioReasonHere',
  'Activity in port': 'vioActivity',
  'Company name here': 'vioCompanyHere',
}

const PORT_KEYS = {
  'Yanbu Commercial Port': 'visPortYanbu',
  'Jeddah Islamic Port': 'visPortJeddah',
  'King Abdulaziz Port': 'visPortKing',
}

const STATUS_KEYS = {
  'Not Paid': 'vioNotPaid',
  Paid: 'paid',
  'Not Applicable': 'vioNotApplicable',
  Cancelled: 'vioCancelled',
  Open: 'open',
  Approved: 'approved',
  Rejected: 'vioRejected',
}

const emptyFilters = { start: '', end: '', licenseType: '', port: '', notPaid: false, paid: false, notApplicable: false, cancelled: false }

const blankObjection = {
  fineId: '1010006817',
  type: 'Fine',
  company: 'Company name here',
  subject: 'طلب اعتراض على فاتورة',
  fileName: '',
}

function countLabel(count) {
  return String(count).padStart(2, '0')
}

function displayDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function chipDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}/${year}`
}

function statusClass(status) {
  if (status === 'Not Paid' || status === 'No Paid' || status === 'Rejected') return 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
  if (status === 'Not Applicable' || status === 'Approved') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (status === 'Open' || status === 'Paid') return 'border-success-200 bg-success-50 text-success-700'
  return 'border-border bg-bg-neutral text-text-secondary'
}

function statusLabel(t, status, drawer = false) {
  if (drawer && status === 'Not Paid') return t('vioUnpaid')
  const key = STATUS_KEYS[status]
  return key ? t(key) : status
}

function displayValue(t, language, value) {
  if (language !== 'ar') return value
  const key = AR_VALUES[value]
  return key ? t(key) : value
}

function namedDate(language, iso, fallback) {
  if (language !== 'ar' || !iso) return fallback
  return formatNamedDate(iso, 'ar')
}

function selectedStatuses(filters) {
  return [
    filters.notPaid && 'Not Paid',
    filters.paid && 'Paid',
    filters.notApplicable && 'Not Applicable',
    filters.cancelled && 'Cancelled',
  ].filter(Boolean)
}

function matchesQuery(row, query) {
  if (!query) return true
  return [row.fineId, row.description, row.subject, row.company, row.type, row.number, row.related, row.reason]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query.trim().toLowerCase())
}

export default function ViolationsPage() {
  const { t } = useApp()
  const [tab, setTab] = useState('violations')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [violations] = useState(VIOLATIONS)
  const [unpaid] = useState(UNPAID_FINES)
  const [requests, setRequests] = useState(OBJECTION_REQUESTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFromRow, setModalFromRow] = useState(false)
  const [drawer, setDrawer] = useState(null)
  const filterRef = useRef(null)

  useClickOutside(filterRef, () => setFiltersOpen(false), filtersOpen)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 800)
    return () => window.clearTimeout(timer)
  }, [])

  const filtersActive = Boolean(
    filters.start || filters.end || filters.licenseType || filters.port || selectedStatuses(filters).length,
  )

  const violationRows = useMemo(() => {
    const statuses = selectedStatuses(filters)
    return violations.filter((row) => {
      if (!matchesQuery(row, query)) return false
      if (filters.start && row.expiry < filters.start) return false
      if (filters.end && row.expiry > filters.end) return false
      if (filters.licenseType && row.licenseType !== filters.licenseType) return false
      if (filters.port && row.port !== filters.port) return false
      if (statuses.length && !statuses.includes(row.status)) return false
      return true
    })
  }, [filters, query, violations])

  const unpaidRows = useMemo(() => unpaid.filter((row) => matchesQuery(row, query)), [query, unpaid])
  const requestRows = useMemo(() => requests.filter((row) => matchesQuery(row, query)), [query, requests])
  const rows = tab === 'unpaid' ? unpaidRows : tab === 'requests' ? requestRows : violationRows

  function openObjection(fromRow) {
    setModalFromRow(Boolean(fromRow))
    setModalOpen(true)
  }

  function exportRows() {
    const source = rows
    const headers =
      tab === 'requests'
        ? [t('reqRequestNumber'), t('reqRelatedViolation'), t('reqRequestDate'), t('invStatus'), t('reqObjectionSubject'), t('reqReason')]
        : [t('vioFineIdDesc'), t('vioSubject'), t('reqType'), t('vioFineAmountSar'), t('reqCompanyName'), t('licExpiryDate'), t('vioFineStatus')]
    const lines =
      tab === 'requests'
        ? source.map((row) => [row.number, row.related, displayDate(row.date), row.status, row.subject, row.reason])
        : source.map((row) => [`${row.fineId} ${row.description}`, row.subject, row.type, row.amount, row.company, row.expiryLabel, row.status])
    const url = URL.createObjectURL(new Blob([[headers, ...lines].map((cells) => cells.map((cell) => `"${cell ?? ''}"`).join(',')).join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = tab === 'requests' ? 'objection-requests.csv' : tab === 'unpaid' ? 'unpaid-fines.csv' : 'violations.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 pb-10 pt-4 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-6">
          <TabButton active={tab === 'violations'} label={t('violations')} count={violations.length} onClick={() => setTab('violations')} />
          <TabButton active={tab === 'unpaid'} label={t('unpaidFines')} count={unpaid.length} onClick={() => setTab('unpaid')} />
          <TabButton active={tab === 'requests'} label={t('objectionRequests')} count={requests.length} onClick={() => setTab('requests')} />
        </div>
        {loading ? (
          <div className="ms-auto flex items-center gap-3">
            <span className="h-8 w-24 animate-pulse rounded-lg bg-[#f2f4f7]" />
            <span className="size-8 animate-pulse rounded-lg bg-[#f2f4f7]" />
            <span className="size-8 animate-pulse rounded-lg bg-[#f2f4f7]" />
            <span className="h-8 w-36 animate-pulse rounded-lg bg-[#f2f4f7]" />
          </div>
        ) : (
          <div className="ms-auto flex items-center gap-3">
            <SearchField value={query} onChange={setQuery} t={t} />
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-label={t('invFilters')}
                onClick={() => {
                  setDraftFilters(filters)
                  setFiltersOpen((open) => !open)
                }}
                className={`relative flex size-10 items-center justify-center rounded-lg ${filtersOpen ? 'border border-border bg-white shadow-xs' : ''}`}
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
            <button type="button" onClick={() => openObjection(false)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-[#d92d20] shadow-xs">
              <img src={icons.fileX02Red} alt="" />
              {t('vioRequestObjection')}
            </button>
          </div>
        )}
      </div>

      {tab === 'violations' && filtersActive && !loading ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filters.start ? <FilterChip label={t('vioStartChip', { date: chipDate(filters.start) })} onRemove={() => setFilters({ ...filters, start: '' })} /> : null}
          {filters.end ? <FilterChip label={t('vioEndChip', { date: chipDate(filters.end) })} onRemove={() => setFilters({ ...filters, end: '' })} /> : null}
          {filters.licenseType ? <FilterChip label={filters.licenseType} onRemove={() => setFilters({ ...filters, licenseType: '' })} /> : null}
          {filters.port ? <FilterChip label={filters.port} onRemove={() => setFilters({ ...filters, port: '' })} /> : null}
          {selectedStatuses(filters).map((status) => (
            <FilterChip
              key={status}
              label={status}
              onRemove={() => setFilters({ ...filters, [statusKey(status)]: false })}
            />
          ))}
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setFilters(emptyFilters)}>
            {t('visRemoveAll')}
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border bg-white">
        {loading ? (
          <LoadingTable />
        ) : rows.length === 0 ? (
          <EmptyViolations tab={tab} />
        ) : tab === 'requests' ? (
          <RequestTable rows={rows} onOpenObjection={setDrawer} onOpenViolation={(row) => setDrawer({ kind: 'related', violation: violations[0], request: row, fromList: true })} />
        ) : (
          <FineTable
            rows={rows}
            unpaid={tab === 'unpaid'}
            onOpen={(row) => setDrawer({ kind: 'violation', violation: row })}
            onObject={() => openObjection(true)}
          />
        )}
      </section>

      <ViolationDrawer
        drawer={drawer}
        onClose={() => setDrawer(null)}
        onBack={() => setDrawer(drawer?.fromList || !drawer?.request ? null : { kind: 'objection', request: drawer.request })}
        onObject={() => openObjection(true)}
        onOpenRelated={(request) => setDrawer({ kind: 'related', violation: violations[0], request })}
      />
      <ObjectionModal
        open={modalOpen}
        fromRow={modalFromRow}
        onClose={() => setModalOpen(false)}
        onSubmit={(draft) => {
          setRequests((current) => [
            {
              id: `obj-${Date.now()}`,
              number: '2327',
              related: 'Violation name here',
              date: '2028-12-21',
              requestDate: 'April 22, 2025',
              status: 'Open',
              subject: draft.subject,
              reason: 'Reason here',
              objectionSubject: draft.subject,
              reasonDetail: draft.subject,
            },
            ...current,
          ])
          setTab('requests')
          setModalOpen(false)
          setDrawer(null)
        }}
      />
    </div>
  )
}

function statusKey(status) {
  if (status === 'Not Paid') return 'notPaid'
  if (status === 'Not Applicable') return 'notApplicable'
  return status.toLowerCase()
}

function TabButton({ active, label, count, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active ? 'border-brand bg-brand-50 text-brand' : 'border-transparent text-text-tertiary'}`}>
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-white text-brand' : 'bg-bg-active text-text-placeholder'}`}>{countLabel(count)}</span>
    </button>
  )
}

function SearchField({ value, onChange, t }) {
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

function FineTable({ rows, unpaid, onOpen, onObject }) {
  const { t, language } = useApp()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('vioFineIdDesc')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('vioSubject')}</th>
            {unpaid ? null : <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqType')}</th>}
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('vioFineAmountSar')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqCompanyName')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('licExpiryDate')}</th>
            {unpaid ? null : <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('vioFineStatus')}</th>}
            <th className="border-b border-border px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm text-text-tertiary hover:bg-bg-active">
              <td className="border-b border-border px-6 text-text-primary">
                <span className="font-medium">{row.fineId}</span> {displayValue(t, language, row.description)}
              </td>
              <td className="border-b border-border px-6">{row.subject}</td>
              {unpaid ? null : <td className="border-b border-border px-6">{displayValue(t, language, row.type)}</td>}
              <td className="border-b border-border px-6">{row.amount}</td>
              <td className="border-b border-border px-6">{displayValue(t, language, row.company)}</td>
              <td className="border-b border-border px-6">{namedDate(language, row.expiry, row.expiryLabel)}</td>
              {unpaid ? null : (
                <td className="border-b border-border px-6">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{statusLabel(t, row.status)}</span>
                </td>
              )}
              <td className="border-b border-border px-4">
                <div className="flex items-center justify-end gap-1">
                  <Hint label={t('vioRequestObjection')}>
                    <button type="button" aria-label={t('vioRequestObjection')} className="rounded-md p-1.5" onClick={onObject}>
                      <img src={icons.fileX02} alt="" />
                    </button>
                  </Hint>
                  <button type="button" aria-label={t('reqViewNamed', { name: row.fineId })} className="rounded-md p-1.5" onClick={() => onOpen(row)}>
                    <img src={icons.info} alt="" width={16} height={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RequestTable({ rows, onOpenObjection, onOpenViolation }) {
  const { t, language } = useApp()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqRequestNumber')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('vioRelated')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqRequestDate')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('invStatus')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqObjectionSubject')}</th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">{t('reqReason')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm text-text-tertiary hover:bg-bg-active">
              <td className="border-b border-border px-6 font-medium text-text-primary">{row.number}</td>
              <td className="border-b border-border px-6">
                <span className="inline-flex items-center gap-2">
                  {displayValue(t, language, row.related)}
                  <button type="button" aria-label={t('reqViewNamed', { name: row.related })} className="rounded-md p-1" onClick={() => onOpenViolation(row)}>
                    <img src={icons.info} alt="" width={16} height={16} />
                  </button>
                </span>
              </td>
              <td className="border-b border-border px-6">{displayDate(row.date)}</td>
              <td className="border-b border-border px-6">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{statusLabel(t, row.status)}</span>
              </td>
              <td className="border-b border-border px-6">{row.subject}</td>
              <td className="border-b border-border px-6">
                <span className="inline-flex items-center gap-2">
                  {displayValue(t, language, row.reason)}
                  <button type="button" aria-label={t('reqViewRequest', { number: row.number })} className="rounded-md p-1" onClick={() => onOpenObjection({ kind: 'objection', request: row })}>
                    <img src={icons.info} alt="" width={16} height={16} />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Hint({ label, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute end-full top-1/2 z-10 me-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-text-primary px-3 py-2 text-xs font-semibold text-white group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  )
}

function LoadingTable() {
  const { t } = useApp()
  const headings = [t('vioFineIdDesc'), t('reqObjectionSubject'), t('reqType'), t('reqFineAmount'), t('reqCompanyName'), t('reqObjectionExpiry'), t('invStatus')]
  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-7 gap-4 border-b border-border pb-3 text-xs font-semibold text-text-tertiary">
        {headings.map((heading) => <span key={heading}>{heading}</span>)}
      </div>
      <div className="flex flex-col gap-5 py-4">
        {Array.from({ length: 11 }, (_, index) => (
          <div key={index} className="grid grid-cols-7 gap-4">
            {headings.map((heading) => <span key={heading} className="h-3 animate-pulse rounded-full bg-[#f2f4f7]" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyViolations({ tab }) {
  const { t } = useApp()
  const title = tab === 'unpaid' ? t('vioNoUnpaid') : tab === 'requests' ? t('reqNoObjection') : t('vioNoViolations')
  const body = tab === 'violations' ? t('vioNoViolationsBody') : t('vioNoMatch')
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2" style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)' }}>
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
      </div>
      <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        <SmileIcon />
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">{title}</h2>
      <p className="relative mt-1 max-w-sm text-sm text-text-tertiary">{body}</p>
    </div>
  )
}

function ViolationDrawer({ drawer, onClose, onBack, onObject, onOpenRelated }) {
  const { t } = useApp()
  if (!drawer) return null
  const related = drawer.kind === 'related'
  const objection = drawer.kind === 'objection'
  const violation = drawer.violation

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col bg-white shadow-lg">
        {objection ? (
          <ObjectionPanel request={drawer.request} onClose={onClose} onOpenRelated={() => onOpenRelated(drawer.request)} />
        ) : (
          <ViolationPanel violation={violation} related={related} onClose={onClose} onBack={onBack} onObject={onObject} />
        )}
      </aside>
    </div>
  )
}

function ViolationPanel({ violation, related, onClose, onBack, onObject }) {
  const { t, language } = useApp()
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        {related ? (
          <button type="button" aria-label={t('reqBack')} onClick={onBack} className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active">
            <BackIcon />
          </button>
        ) : (
          <FeaturedIcon type="violation" />
        )}
        <div className="flex items-center gap-2">
          {related ? null : (
            <button type="button" onClick={onObject} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d92d20]">
              <ObjectionIcon />
              {t('vioRequestObjection')}
            </button>
          )}
          <DrawerClose onClose={onClose} />
        </div>
      </div>
      <div className="px-6 pb-4 pt-4">
        <p className="text-sm text-text-tertiary">{t('reqFineId', { id: violation.fineId })}</p>
        <h2 className="text-lg font-semibold text-text-primary">{displayValue(t, language, violation.title)}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqViolationDate', { date: namedDate(language, violation.expiry, violation.violationDate) })}</span>
          <span className="h-3 w-px bg-border" />
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(violation.status)}`}>{statusLabel(t, violation.status, true)}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder">
            <img src={icons.info} alt="" width={16} height={16} />
            {t('reqGeneralInfo')}
          </h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {[
              [t('reqCompanyName'), displayValue(t, language, violation.company)],
              [t('reqLicenseNumber'), violation.licenseNumber],
              [t('reqLicenseType'), displayValue(t, language, violation.licenseType)],
              [t('reqCrNational'), violation.crNational],
              [t('reqCrNumber'), violation.crNumber],
              [t('reqType'), displayValue(t, language, violation.type)],
              [t('reqFineAmount'), displayValue(t, language, violation.fineAmount)],
              [t('vioObjectionDeadline'), namedDate(language, violation.expiry, violation.objectionExpiry)],
              [t('reqSadad'), violation.sadad],
              [t('reqPorts'), violation.port],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4">
                <p className="w-40 text-text-placeholder">{label}</p>
                <p className="font-medium text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder">
            <img src={icons.file} alt="" width={20} height={20} />
            {t('reqDescription')}
          </h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{language === 'ar' ? t('vioBody') : violation.body}</p>
        </section>
        <AttachmentSection files={[{ name: 'Image1.jpg', kind: 'JPG' }]} />
      </div>
    </>
  )
}

function ObjectionPanel({ request, onClose, onOpenRelated }) {
  const { t, language } = useApp()
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        <FeaturedIcon type="objection" />
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-4">
        <p className="text-sm text-text-tertiary">{t('vioObjectionAbout')}</p>
        <h2 className="text-lg font-semibold text-text-primary">{request.number}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqRequestDateLine', { date: namedDate(language, '2025-04-22', request.requestDate) })}</span>
          <span className="h-3 w-px bg-border" />
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(request.status)}`}>{statusLabel(t, request.status)}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('reqObjectionSubject')}</p>
              <p className="font-medium text-text-primary">{displayValue(t, language, request.objectionSubject)}</p>
            </div>
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('reqReason')}</p>
              <p className="font-medium text-text-primary">{language === 'ar' ? t('vioReasonDetail') : request.reasonDetail}</p>
            </div>
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('vioRelated')}</p>
              <button type="button" onClick={onOpenRelated} className="inline-flex items-center gap-1 font-semibold text-brand">
                {displayValue(t, language, request.related)}
                <ArrowIcon />
              </button>
            </div>
          </div>
        </section>
        <AttachmentSection files={[{ name: 'File title here.png', kind: 'PNG' }, { name: 'File title here.png', kind: 'PNG' }]} />
      </div>
    </>
  )
}

function ObjectionModal({ open, fromRow, onClose, onSubmit }) {
  const { t, language } = useApp()
  const titleId = useId()
  const fileRef = useRef(null)
  const [form, setForm] = useState(blankObjection)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setForm(blankObjection)
    setDirty(false)
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const ready = Boolean(form.subject.trim()) && (fromRow || dirty)

  function submit(event) {
    event.preventDefault()
    if (!ready) return
    onSubmit(form)
    setForm(blankObjection)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border">
            <img src={icons.file} alt="" width={20} height={20} />
          </span>
          <h2 id={titleId} className="pt-2 text-lg font-semibold text-text-primary">{t('reqObjectionTitle')}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="ms-auto flex size-9 items-center justify-center rounded-lg hover:bg-bg-active">
            <img src={icons.xClose} alt="" width={20} height={20} />
          </button>
        </div>
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fromRow && language === 'ar' ? 'Fine ID' : t('reqFineIdLabel')}>
              <input value={form.fineId} readOnly className={`${inputClass} bg-bg-neutral`} />
            </Field>
            <Field label={t('reqType')}>
              <input value={displayValue(t, language, form.type)} readOnly className={`${inputClass} bg-bg-neutral`} />
            </Field>
          </div>
          <Field label={t('reqCompanyName')}>
            <input value={displayValue(t, language, form.company)} readOnly className={`${inputClass} bg-bg-neutral`} />
          </Field>
          <Field label={t('vioSubject')}>
            <textarea value={form.subject} onChange={(event) => { setDirty(true); setForm({ ...form, subject: event.target.value }) }} rows={3} className={`${inputClass} h-auto py-3`} />
          </Field>
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-text-secondary">{t('reqAttachments')}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) {
                  setDirty(true)
                  setForm({ ...form, fileName: file.name })
                }
              }}
              className="mt-2 flex w-full flex-col items-center rounded-xl border border-border px-4 py-8 text-center"
            >
              <UploadIcon />
              <span className="text-sm text-text-tertiary">
                <span className="font-semibold text-brand">{t('reqClickUpload')}</span> {t('reqDragDrop')}
              </span>
              {form.fileName ? <span className="mt-2 text-sm text-text-primary">{form.fileName}</span> : null}
            </button>
            <input ref={fileRef} type="file" className="sr-only" onChange={(event) => { setDirty(true); setForm({ ...form, fileName: event.target.files?.[0]?.name || '' }) }} />
            <p className="mt-2 text-center text-sm leading-6 text-text-tertiary">{t('vioObjectionHint')}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <button type="submit" disabled={!ready} className={`h-10 rounded-lg px-4 text-sm font-semibold ${ready ? 'bg-brand text-white' : 'cursor-not-allowed bg-[#f2f4f7] text-text-placeholder'}`}>
            {t('reqSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}

function FilterMenu({ draft, onChange, onCancel, onApply }) {
  const { t, language } = useApp()
  return (
    <div className="absolute end-0 top-12 z-30 w-[320px] rounded-xl border border-border bg-white shadow-lg">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">{t('invFilters')}</h2>
      <div className="flex flex-col gap-4 px-4 py-4">
        <DateField label={t('licStartDateCol')} placeholder={t('invChooseDate')} value={draft.start} max={draft.end} onChange={(start) => onChange({ ...draft, start })} />
        <DateField label={t('licEndDate')} placeholder={t('invChooseDate')} value={draft.end} min={draft.start} onChange={(end) => onChange({ ...draft, end })} />
        <SelectControl
          label={t('reqLicenseType')}
          value={draft.licenseType}
          placeholder={t('vioSelectType')}
          options={LICENSE_TYPE_OPTIONS}
          labelFor={(option) => displayValue(t, language, option)}
          onChange={(licenseType) => onChange({ ...draft, licenseType })}
        />
        <SelectControl
          label={t('reqPorts')}
          value={draft.port}
          placeholder={t('vioSelectPort')}
          options={PORT_OPTIONS}
          labelFor={(option) => (language === 'ar' && PORT_KEYS[option] ? t(PORT_KEYS[option]) : option)}
          onChange={(port) => onChange({ ...draft, port })}
        />
        <fieldset>
          <legend className="text-sm font-semibold text-text-secondary">{t('vioFineStatus')}</legend>
          {FINE_STATUS_OPTIONS.map((status) => (
            <label key={status} className="mt-3 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft[statusKey(status)]}
                onChange={(event) => onChange({ ...draft, [statusKey(status)]: event.target.checked })}
                className="sr-only"
              />
              <span className={`flex size-5 items-center justify-center rounded-md border ${draft[statusKey(status)] ? 'border-brand bg-brand text-white' : 'border-[#d0d5dd] bg-white'}`}>
                {draft[statusKey(status)] ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.2 4.7 8.4 9.5 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>{statusLabel(t, status)}</span>
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

function SelectControl({ label, value, placeholder, options, onChange, labelFor = (option) => option }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-text-secondary">{label}</span>
      <span className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full appearance-none rounded-lg border border-border bg-white px-3 pe-9 text-sm font-semibold shadow-xs outline-none ${value ? 'text-text-primary' : 'text-text-placeholder'}`}>
          <option value="">{placeholder}</option>
          {options.map((option) => <option key={option} value={option}>{labelFor(option)}</option>)}
        </select>
        <img src={icons.chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
      </span>
    </label>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      {label}
      {children}
    </label>
  )
}

const inputClass = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary shadow-xs outline-none'

function FunnelIcon({ active }) {
  const color = active ? '#1b8354' : '#535862'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 3.75h15l-5.833 6.917v4.583L8.333 16.667V10.667L2.5 3.75Z" fill={active ? color : 'none'} stroke={color} strokeWidth="1.67" strokeLinejoin="round" />
    </svg>
  )
}

function ObjectionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.667 2.5H6.667c-.92 0-1.667.747-1.667 1.667v11.666c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667V7.5L11.667 2.5Z" stroke="#d92d20" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.25 2.917V7.5h4.583" stroke="#d92d20" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function SmileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="#006E80" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1" fill="#006E80" />
      <circle cx="15" cy="10" r="1" fill="#006E80" />
      <path d="M8.5 14.2c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2" stroke="#006E80" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mb-2">
      <path d="M6.667 10 10 6.667 13.333 10M10 6.667V14.5M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="#1b8354" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="rtl:scale-x-[-1]">
      <path d="M15.833 10H4.167m0 0L10 4.167M4.167 10 10 15.833" stroke="#535862" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="rtl:scale-x-[-1]">
      <path d="M3.333 8h9.334m0 0L8.667 4M12.667 8 8.667 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
