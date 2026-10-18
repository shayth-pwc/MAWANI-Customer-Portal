import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import DateField from '../components/ui/DateField'
import { AttachmentSection, DrawerClose, FeaturedIcon } from '../components/common/InfoDrawer'
import {
  PERMIT_LICENSES,
  PERMIT_REQUESTS,
  PERMIT_TYPE_OPTIONS,
  PERMITS,
  PORT_OPTIONS,
  UNDERTAKING,
  UNDERTAKING_PREVIEW,
  UPLOAD_HINT,
} from '../constants/permits'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'
import { formatNamedDate } from '../utils/formatDate'

const emptyFilters = { start: '', end: '', type: '' }

const TEXT = {
  'License name here': 'reqLicenseNameHere',
  'Activity in port': 'vioActivity',
  'Activity In Port': 'vioActivity',
  'Port entry': 'reqPortEntry',
  'Port Entry': 'reqPortEntry',
  'Hot Work': 'reqHotWork',
  'King Abdulaziz In Dammam': 'reqPortDammam',
  'King Abdulaziz in Dammam': 'reqPortDammam',
  'Jubail Commercial': 'reqPortJubail',
  'Yanbu Commercial Port': 'visPortYanbu',
  'Routine Repair And Maintenance Of Ships': 'licNameValue',
  'Routine repair and maintenance of ships': 'licNameValue',
}

const STATUS_TEXT = {
  Open: 'open',
  'In Review': 'reqInReview',
  Canceled: 'perCanceled',
  Expired: 'invExpired',
  Active: 'crActive',
}

function showText(t, language, value) {
  if (language !== 'ar') return value
  const key = TEXT[value]
  return key ? t(key) : value
}

function showStatus(t, language, status) {
  if (language !== 'ar') return status
  const key = STATUS_TEXT[status]
  return key ? t(key) : status
}

function displayDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function statusClass(status) {
  if (status === 'Canceled' || status === 'No Paid') return 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
  if (status === 'Expired') return 'border-[#d5d9eb] bg-[#f8f9fc] text-[#515481]'
  if (status === 'In Review') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (status === 'Open' || status === 'Active') return 'border-success-200 bg-success-50 text-success-700'
  return 'border-border bg-bg-neutral text-text-secondary'
}

function inRange(iso, start, end) {
  if (start && iso < start) return false
  if (end && iso > end) return false
  return true
}

export default function PermitsPage() {
  const { t, language } = useApp()
  const [tab, setTab] = useState('permits')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [licenses, setLicenses] = useState(PERMIT_LICENSES)
  const [permits] = useState(PERMITS)
  const [requests, setRequests] = useState(PERMIT_REQUESTS)
  const [openLicense, setOpenLicense] = useState(PERMIT_LICENSES[1].id)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)
  const [toast, setToast] = useState(null)
  const filterRef = useRef(null)

  useClickOutside(filterRef, () => setFiltersOpen(false), filtersOpen)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 800)
    return () => window.clearTimeout(timer)
  }, [])

  const filtersActive = Boolean(filters.start || filters.end || filters.type)
  const needle = query.trim().toLowerCase()

  const permitRows = useMemo(() => permits.filter((row) => {
    if (!inRange(row.start, filters.start, filters.end)) return false
    if (filters.type && row.type !== filters.type) return false
    if (!needle) return true
    return [row.number, row.company, row.license, row.type].join(' ').toLowerCase().includes(needle)
  }), [filters, needle, permits])

  const licenseRows = useMemo(() => licenses.map((license) => ({
    ...license,
    permits: license.permits.filter((row) => {
      if (!inRange(row.start, filters.start, filters.end)) return false
      if (filters.type && row.type !== filters.type) return false
      if (!needle) return true
      return [license.code, license.name, row.number, row.permitNumber, row.type, row.ports].join(' ').toLowerCase().includes(needle)
    }),
  })).filter((license) => license.permits.length || (!filtersActive && !needle)), [filters, filtersActive, licenses, needle])

  const requestRows = useMemo(() => requests.filter((row) => {
    if (!inRange(row.date, filters.start, filters.end)) return false
    if (filters.type && row.permitType !== filters.type) return false
    if (!needle) return true
    return [row.number, row.permitType, row.license, row.ports, row.status].join(' ').toLowerCase().includes(needle)
  }), [filters, needle, requests])

  const visible = tab === 'licenses' ? licenseRows : tab === 'requests' ? requestRows : permitRows

  function exportRows() {
    const source = tab === 'licenses'
      ? licenseRows.flatMap((license) => license.permits)
      : tab === 'requests'
        ? requestRows
        : permitRows
    const lines = source.map((row) => Object.values(row).map((cell) => `"${cell ?? ''}"`).join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${tab}-permits.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openLicenseDrawer(from) {
    setDrawer({ kind: 'license', from })
  }

  return (
    <div className="relative px-4 pb-10 pt-4 md:px-8">
      {toast ? (
        <div className="absolute end-4 top-4 z-30 w-[320px] rounded-xl border border-success-200 bg-success-50 p-4 shadow-lg md:end-8">
          <div className="flex gap-3">
            <img src={icons.checkCircle} alt="" width={20} height={20} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">{t('reqToastTitle', { number: toast.number })}</p>
                <button type="button" aria-label={language === 'ar' ? t('close') : 'Dismiss'} onClick={() => setToast(null)}><img src={icons.xClose} alt="" width={20} height={20} /></button>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{t('reqToastBody', { number: toast.number })}</p>
              <div className="mt-3 flex gap-3 text-sm font-semibold">
                <button type="button" className="text-text-tertiary" onClick={() => setToast(null)}>{language === 'ar' ? t('close') : 'Dismiss'}</button>
                <button type="button" className="text-brand" onClick={() => { setDrawer({ kind: 'request', row: toast.row }); setToast(null) }}>{t('reqViewPermitBtn')}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-6">
          <TabButton active={tab === 'licenses'} label={t('licenses')} count={licenses.length} onClick={() => setTab('licenses')} />
          <TabButton active={tab === 'permits'} label={t('permits')} count={permits.length} onClick={() => setTab('permits')} />
          <TabButton active={tab === 'requests'} label={t('requests')} count={requests.length} onClick={() => setTab('requests')} />
        </div>
        {loading ? (
          <div className="ms-auto flex justify-end gap-3">
            <span className="h-8 w-24 animate-pulse rounded-lg bg-[#f2f4f7]" />
            <span className="h-8 w-10 animate-pulse rounded-lg bg-[#f2f4f7]" />
            <span className="h-8 w-28 animate-pulse rounded-lg bg-[#f2f4f7]" />
          </div>
        ) : (
          <div className="ms-auto flex items-center gap-3">
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
                  tab={tab}
                  draft={draftFilters}
                  onChange={setDraftFilters}
                  onCancel={() => setFiltersOpen(false)}
                  onApply={() => { setFilters(draftFilters); setFiltersOpen(false) }}
                />
              ) : null}
            </div>
            <button type="button" aria-label={t('invDownload')} onClick={exportRows} className="flex size-10 items-center justify-center">
              <img src={icons.excel} alt="" width={20} height={20} />
            </button>
            <span className="h-6 w-px bg-border" aria-hidden="true" />
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-10 items-center gap-1 px-1 text-sm font-semibold text-brand">
              <PlusIcon /> {t('perNewPermit')}
            </button>
          </div>
        )}
      </div>

      <section className={tab === 'licenses' && !loading && visible.length ? 'flex flex-col gap-4' : 'overflow-hidden rounded-3xl border border-border bg-white'}>
        {loading ? <LoadingTable /> : visible.length === 0 ? (
          <EmptyPermits onCreate={() => setModalOpen(true)} />
        ) : tab === 'licenses' ? (
          licenseRows.map((license) => (
            <LicenseCard
              key={license.id}
              license={license}
              open={openLicense === license.id}
              onToggle={() => setOpenLicense((current) => (current === license.id ? null : license.id))}
              onOpenLicense={() => openLicenseDrawer('list')}
            />
          ))
        ) : tab === 'requests' ? (
          <RequestTable
            rows={requestRows}
            onOpen={(row) => setDrawer({ kind: 'request', row })}
            onOpenLicense={(row) => setDrawer({ kind: 'license', from: 'request', row })}
          />
        ) : (
          <PermitTable rows={permitRows} onOpenLicense={() => openLicenseDrawer('list')} />
        )}
      </section>

      <DetailsDrawer
        drawer={drawer}
        licenseStatus={licenses[0].drawerStatus}
        onClose={() => setDrawer(null)}
        onBack={() => setDrawer(drawer?.row ? { kind: 'request', row: drawer.row } : null)}
        onOpenLicense={() => setDrawer({ kind: 'license', from: 'request', row: drawer.row })}
        onRenew={() => {
          setLicenses((current) => current.map((license) => ({ ...license, drawerStatus: 'Active' })))
          setDrawer(null)
        }}
      />
      <PermitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(draft) => {
          const row = {
            id: `permit-req-${Date.now()}`,
            number: '2327',
            permitType: draft.permitType,
            license: 'License name here',
            date: '2028-12-21',
            requestDate: 'April 22, 2025',
            status: 'Open',
            ports: draft.ports,
          }
          setRequests((current) => [row, ...current])
          setModalOpen(false)
          setToast({ number: row.number, row })
        }}
      />
    </div>
  )
}

function TabButton({ active, label, count, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active ? 'border-brand bg-brand-50 text-brand' : 'border-transparent text-text-tertiary'}`}>
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-white text-brand' : 'bg-bg-active text-text-placeholder'}`}>{count}</span>
    </button>
  )
}

function SearchField({ value, onChange }) {
  const { t } = useApp()
  return (
    <label className="flex h-10 items-center gap-2">
      <img src={icons.search} alt="" width={20} height={20} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={t('invSearch')} aria-label={t('invSearch')} className="w-16 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder" />
      {value ? <button type="button" aria-label={t('invClearSearch')} onClick={() => onChange('')}><img src={icons.xClose} alt="" width={20} height={20} /></button> : null}
    </label>
  )
}

function LicenseCard({ license, open, onToggle, onOpenLicense }) {
  const { t, language } = useApp()
  const headers = [t('reqRequestNumber'), t('perPermitNumber'), t('reqPermitType'), t('perStartDate'), t('perExpiryDate'), t('invStatus'), 'Ports', '']
  const amount = language === 'ar' ? `${license.amount.replace(' SAR', '')} ر.س` : license.amount
  const dates = language === 'ar'
    ? `${t('licStartChip', { date: formatNamedDate(license.start, 'ar') })} • ${t('licEndChip', { date: formatNamedDate(license.expiry, 'ar') })}`
    : `Start date: ${license.startLabel} • Expiry date: ${license.expiryLabel}`
  return (
    <article className="rounded-2xl border border-border bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">{license.code} {showText(t, language, license.name)}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(license.status)}`}>{showStatus(t, language, license.status)}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-secondary">{amount}</span>
          </div>
          <p className="mt-1 text-sm text-text-tertiary">{dates}</p>
        </div>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary">
          {t('perDetails')}
          <img src={icons.chevronDown} alt="" width={20} height={20} className={open ? 'rotate-180' : ''} />
        </button>
      </div>
      {open ? (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[900px] border-collapse text-start">
            <thead>
              <tr className="text-xs font-semibold text-text-tertiary">
                {headers.map((header) => (
                  <th key={header || 'info'} className="px-5 py-3 text-start font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {license.permits.map((row) => (
                <tr key={row.id} className="h-14 text-sm text-text-tertiary">
                  <td className="border-t border-border px-5 font-medium text-text-primary">{row.number}</td>
                  <td className="border-t border-border px-5">{row.permitNumber}</td>
                  <td className="border-t border-border px-5">{row.type}</td>
                  <td className="border-t border-border px-5">{displayDate(row.start)}</td>
                  <td className="border-t border-border px-5">{displayDate(row.expiry)}</td>
                  <td className="border-t border-border px-5"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{showStatus(t, language, row.status)}</span></td>
                  <td className="border-t border-border px-5">{showText(t, language, row.ports)}</td>
                  <td className="border-t border-border px-5"><InfoButton label={t('reqViewNamed', { name: license.code })} onClick={onOpenLicense} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  )
}

function PermitTable({ rows, onOpenLicense }) {
  const { t, language } = useApp()
  const headers = [t('perPermitNumber'), t('reqCompanyName'), t('reqRelatedLicense'), t('reqPermitType'), t('perStartDate'), t('perExpiryDate'), t('perCancelDate'), '']
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            {headers.map((header) => (
              <th key={header || 'info'} className="border-b border-border px-6 py-3 text-start font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm text-text-tertiary hover:bg-bg-active">
              <td className="border-b border-border px-6 font-medium text-text-primary">{row.number}</td>
              <td className="border-b border-border px-6">{row.company}</td>
              <td className="border-b border-border px-6">
                <span className="inline-flex items-center gap-2">{showText(t, language, row.license)}<InfoButton label={t('reqViewNamed', { name: row.license })} onClick={onOpenLicense} /></span>
              </td>
              <td className="border-b border-border px-6">{showText(t, language, row.type)}</td>
              <td className="border-b border-border px-6">{displayDate(row.start)}</td>
              <td className="border-b border-border px-6">{displayDate(row.expiry)}</td>
              <td className="border-b border-border px-6">{displayDate(row.cancellation)}</td>
              <td className="border-b border-border px-6"><InfoButton label={t('reqViewPermit', { number: row.number })} onClick={onOpenLicense} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RequestTable({ rows, onOpen, onOpenLicense }) {
  const { t, language } = useApp()
  const headers = [t('reqRequestNumber'), t('reqPermitType'), t('reqRelatedLicense'), t('reqRequestDate'), t('invStatus'), t('reqPorts'), '']
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            {headers.map((header) => (
              <th key={header || 'info'} className="border-b border-border px-6 py-3 text-start font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm text-text-tertiary hover:bg-bg-active">
              <td className="border-b border-border px-6 font-medium text-text-primary">{row.number}</td>
              <td className="border-b border-border px-6">{showText(t, language, row.permitType)}</td>
              <td className="border-b border-border px-6">
                <span className="inline-flex items-center gap-2">{showText(t, language, row.license)}<InfoButton label={t('reqViewNamed', { name: row.license })} onClick={() => onOpenLicense(row)} /></span>
              </td>
              <td className="border-b border-border px-6">{displayDate(row.date)}</td>
              <td className="border-b border-border px-6"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{showStatus(t, language, row.status)}</span></td>
              <td className="border-b border-border px-6">{showText(t, language, row.ports)}</td>
              <td className="border-b border-border px-6"><InfoButton label={t('reqViewRequest', { number: row.number })} onClick={() => onOpen(row)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InfoButton({ label, onClick }) {
  return (
    <button type="button" aria-label={label} className="rounded-md p-1" onClick={onClick}>
      <img src={icons.info} alt="" width={16} height={16} />
    </button>
  )
}

function LoadingTable() {
  const { t } = useApp()
  const headings = [t('perPermitNumber'), t('reqCompanyName'), t('reqPermitType'), t('perStartDate'), t('perExpiryDate'), t('perCancelDate'), t('reqRelatedLicense')]
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

function EmptyPermits({ onCreate }) {
  const { t } = useApp()
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2" style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)' }}>
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
      </div>
      <span className="relative mb-4 flex size-24 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        <img src={icons.folderCheck} alt="" width={64} height={64} />
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">{t('perNoPermits')}</h2>
      <p className="relative mt-1 text-sm text-text-tertiary">{t('perNoPermitsHint')}</p>
      <Button className="relative mt-6" onClick={onCreate}><PlusIcon /> {t('perRequestPermit')}</Button>
    </div>
  )
}

function DetailsDrawer({ drawer, licenseStatus, onClose, onBack, onOpenLicense, onRenew }) {
  const { t } = useApp()
  if (!drawer) return null
  const fromRequest = drawer.from === 'request'
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col bg-white shadow-lg">
        {drawer.kind === 'request' ? <RequestDetail row={drawer.row} onClose={onClose} onOpenLicense={onOpenLicense} /> : (
          <LicenseDetail fromRequest={fromRequest} status={licenseStatus} onClose={onClose} onBack={onBack} onRenew={onRenew} />
        )}
      </aside>
    </div>
  )
}

function LicenseDetail({ fromRequest, status, onClose, onBack, onRenew }) {
  const { t, language } = useApp()
  const license = PERMIT_LICENSES[0]
  const expiry = language === 'ar' ? formatNamedDate('2025-04-22', 'ar') : license.drawerExpiry
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        {fromRequest ? (
          <button type="button" aria-label={t('reqBack')} onClick={onBack} className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"><BackIcon /></button>
        ) : (
          <FeaturedIcon type="license" />
        )}
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-4">
        <p className="text-sm text-text-tertiary">{license.code}</p>
        <h2 className="text-lg font-semibold text-text-primary">{showText(t, language, license.title)}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqExpiry', { date: expiry })}</span>
          <span className="h-3 w-px bg-border" />
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>{showStatus(t, language, status)}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder"><img src={icons.homeLine} alt="" width={16} height={16} /> {t('reqCrAddress')}</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {[[t('reqCurrentAddress'), 'Title here'], [t('reqCity'), 'city name'], [t('reqCityCode'), '001200'], [t('reqPostal'), '1220']].map(([label, value]) => (
              <div key={label} className="flex gap-4"><p className="w-36 text-text-placeholder">{label}</p><p className="font-medium text-text-primary">{value}</p></div>
            ))}
          </div>
        </section>
        <AttachmentSection files={[{ name: 'File title here.xls', kind: 'XLS' }]} />
      </div>
      {fromRequest || status !== 'Expired' ? null : (
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button onClick={onRenew}>{t('licRenewBtn')}</Button>
        </div>
      )}
    </>
  )
}

function RequestDetail({ row, onClose, onOpenLicense }) {
  const { t, language } = useApp()
  const requestDate = language === 'ar' && row.requestDate === 'April 22, 2025' ? formatNamedDate('2025-04-22', 'ar') : row.requestDate
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        <FeaturedIcon type="permit" />
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-4">
        <p className="text-sm text-text-tertiary">{t('reqPermitInfo')}</p>
        <h2 className="text-lg font-semibold text-text-primary">{row.number}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqRequestDateLine', { date: requestDate })}</span>
          <span className="h-3 w-px bg-border" />
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{showStatus(t, language, row.status)}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex gap-4"><p className="w-40 text-text-placeholder">{t('reqPermitTypeLabel')}</p><p className="font-medium text-text-primary">{showText(t, language, row.permitType)}</p></div>
            <div className="flex gap-4"><p className="w-40 text-text-placeholder">{t('reqPorts')}</p><p className="font-medium text-text-primary">{showText(t, language, row.ports)}</p></div>
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('reqRelatedLicense')}</p>
              <button type="button" onClick={onOpenLicense} className="inline-flex items-center gap-1 font-semibold text-brand">{showText(t, language, row.license)} <ArrowIcon /></button>
            </div>
          </div>
        </section>
        <AttachmentSection files={[{ name: 'File title here.png', kind: 'PNG' }, { name: 'File title here.png', kind: 'PNG' }]} />
      </div>
    </>
  )
}

function FilterMenu({ tab, draft, onChange, onCancel, onApply }) {
  const { t, language } = useApp()
  const typeLabel = language === 'ar' && tab === 'permits' ? 'Permit Type' : t('reqPermitType')
  return (
    <div className="absolute end-0 top-12 z-30 w-[300px] rounded-xl border border-border bg-white p-4 shadow-lg">
      <h2 className="text-sm font-semibold text-text-primary">{t('invFilters')}</h2>
      <div className="mt-4">
        <PeriodField start={draft.start} end={draft.end} onChange={(range) => onChange({ ...draft, ...range })} />
      </div>
      <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
        {typeLabel}
        <span className="relative">
          <select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value })} className="h-10 w-full appearance-none rounded-lg border border-border bg-white px-3 pe-9 text-sm font-semibold text-text-primary shadow-xs outline-none">
            <option value="">{t('perSelectType')}</option>
            {PERMIT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{showText(t, language, type)}</option>)}
          </select>
          <img src={icons.chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
        </span>
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" className="h-9" onClick={onCancel}>{t('cancel')}</Button>
        <Button className="h-9" onClick={onApply}>{t('invApply')}</Button>
      </div>
    </div>
  )
}

function PeriodField({ start, end, onChange }) {
  const { t, language } = useApp()
  const [open, setOpen] = useState(false)
  const text = start && end
    ? `${formatNamedDate(start, language, { month: 'long' })} – ${formatNamedDate(end, language, { month: 'long' })}`
    : start
      ? formatNamedDate(start, language, { month: 'long' })
      : t('invSelectDates')
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-text-secondary">{t('visPeriod')}</span>
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-white px-3 text-start shadow-xs">
        <img src={icons.calendar} alt="" width={20} height={20} />
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${start ? 'text-text-primary' : 'text-text-placeholder'}`}>{text}</span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <DateField format="long" value={start} max={end} onChange={(value) => onChange({ start: value })} />
          <DateField format="long" value={end} min={start} onChange={(value) => onChange({ end: value })} />
        </div>
      ) : null}
    </div>
  )
}

function PermitModal({ open, onClose, onSubmit }) {
  const { t, language } = useApp()
  const titleId = useId()
  const fileRef = useRef(null)
  const [form, setForm] = useState({ permitType: 'Activity In Port', licenseNumber: '1010006817', ports: 'Jubail Commercial', fileName: '', accepted: false })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setForm({ permitType: 'Activity In Port', licenseNumber: '1010006817', ports: 'Jubail Commercial', fileName: '', accepted: false })
    setExpanded(false)
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const ready = form.accepted && form.permitType && form.ports
  const undertaking = language === 'ar'
    ? (expanded ? t('perAck') : t('perAckPreview'))
    : (expanded ? UNDERTAKING : UNDERTAKING_PREVIEW)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(form) }}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border"><img src={icons.file} alt="" width={20} height={20} /></span>
          <h2 id={titleId} className="pt-2 text-lg font-semibold text-text-primary">{t('reqNewPermitTitle')}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="ms-auto flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"><img src={icons.xClose} alt="" width={20} height={20} /></button>
        </div>
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('reqPermitType')} required>
              <select value={form.permitType} onChange={(event) => setForm({ ...form, permitType: event.target.value })} className={inputClass}>
                {['Activity In Port', 'Port Entry', 'Hot Work'].map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
              </select>
            </Field>
            <Field label={t('reqLicenseNumber')}>
              <select value={form.licenseNumber} onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })} className={inputClass}>
                <option value="1010006817">1010006817</option>
              </select>
            </Field>
            <Field label={t('reqCrUnified')}><input value="1010006817" readOnly className={`${inputClass} bg-bg-neutral`} /></Field>
            <Field label={t('reqCrNumber')}><input value="1010006817" readOnly className={`${inputClass} bg-bg-neutral`} /></Field>
            <Field label={t('reqPorts')} required>
              <select value={form.ports} onChange={(event) => setForm({ ...form, ports: event.target.value })} className={inputClass}>
                {PORT_OPTIONS.map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
              </select>
            </Field>
            <Field label={t('reqCrName')}><input value="شركة العويضة للصناعات" readOnly className={`${inputClass} bg-bg-neutral`} /></Field>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">{t('reqAttachments')}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) setForm({ ...form, fileName: file.name })
              }}
              className="mt-2 flex w-full flex-col items-center rounded-xl border border-border px-4 py-8 text-center"
            >
              <UploadIcon />
              <span className="text-sm text-text-tertiary"><span className="font-semibold text-brand">{t('reqClickUpload')}</span> {t('reqDragDrop')}</span>
              {form.fileName ? <span className="mt-2 text-sm text-text-primary">{form.fileName}</span> : null}
            </button>
            <input ref={fileRef} type="file" className="sr-only" onChange={(event) => setForm({ ...form, fileName: event.target.files?.[0]?.name || '' })} />
            <p className="mt-2 text-center text-sm leading-6 text-text-tertiary">{language === 'ar' ? t('reqUploadHint') : UPLOAD_HINT}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
          <label className={`flex flex-1 items-start gap-2 text-sm ${language === 'ar' ? 'text-brand' : 'text-text-tertiary'}`}>
            <input type="checkbox" checked={form.accepted} onChange={(event) => setForm({ ...form, accepted: event.target.checked })} className="mt-0.5 size-4 accent-[#1b8354]" />
            <span>
              {undertaking}{' '}
              {expanded ? null : (
                <button type="button" className="font-semibold text-brand" onClick={(event) => { event.preventDefault(); setExpanded(true) }}>{language === 'ar' ? t('reqReadMore') : 'Read More'}</button>
              )}
            </span>
          </label>
          <div className="flex shrink-0 justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
            <button type="submit" disabled={!ready} className={`h-10 rounded-lg px-4 text-sm font-semibold ${ready ? 'bg-brand text-white' : 'cursor-not-allowed bg-[#f2f4f7] text-text-placeholder'}`}>{t('reqSubmit')}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required = false, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      <span>{label}{required ? <span className="text-[#d92d20]"> *</span> : null}</span>
      {children}
    </label>
  )
}

const inputClass = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary shadow-xs outline-none'

function FunnelIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 3.75h15l-5.833 6.917v4.583L8.333 16.667V10.667L2.5 3.75Z" stroke={active ? '#1b8354' : '#535862'} strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.167v11.666M4.167 10h11.666" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" />
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
