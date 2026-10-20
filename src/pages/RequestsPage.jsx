import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import DateField from '../components/ui/DateField'
import { AttachmentSection, DetailLine, DrawerClose, FeaturedIcon } from '../components/common/InfoDrawer'
import {
  COMMERCIAL_REGISTRATIONS,
  INVESTOR_TYPES,
  LICENSE_TYPES,
} from '../constants/licenses'
import {
  LICENSE_REQUEST_ROWS,
  OBJECTION_REQUEST_ROWS,
  PERMIT_PORTS,
  PERMIT_REQUEST_ROWS,
  PERMIT_TYPES,
  RELATED_LICENSE,
  LICENSE_REQUEST_INFO,
} from '../constants/requests'
import { VIOLATION_DETAIL } from '../constants/violations'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'
import { formatNamedDate } from '../utils/formatDate'

const LICENSE_TEXT = {
  'Waste Recycling And Ship Waste Management': 'reqServiceWaste',
  'Al-Qutban Trading Company Limited': 'reqCompanyQutban',
  'The fifth shipping company': 'vioCompany',
  Saudi: 'licInvestorSaudi',
  'Non-Saudi': 'licInvestorOther',
  'Marine Agents': 'licMarineAgents',
  'Shipping Agent': 'licShippingAgent',
  'Port Operator': 'licPortOperator',
  '10,000 SAR': 'vioAmountSar',
  'King Abdulaziz In Dammam': 'reqPortDammam',
  'Jubail Commercial Port': 'reqPortJubail',
  'Yanbu Commercial Port': 'visPortYanbu',
  'Jeddah Islamic Port': 'visPortJeddah',
  'Activity in port': 'vioActivity',
  'Port entry': 'reqPortEntry',
  'Hot work': 'reqHotWork',
  'License name here': 'reqLicenseNameHere',
  'Routine repair and maintenance of ships': 'licNameValue',
  'Violation name here': 'vioRelatedName',
  'Reason here': 'reqReasonHere',
  'Company name here': 'vioCompanyHere',
  Fine: 'vioTypeFine',
  'Ships Supplier': 'reqShipsSupplier',
  'Article (6-First-Undertakings-1)': 'reqArticleTitle',
  RIYADH: 'reqCityRiyadh',
}

const STATUS_TEXT = {
  Open: 'open',
  Approved: 'approved',
  Rejected: 'vioRejected',
  'In Review': 'reqInReview',
  Expired: 'invExpired',
  'No Paid': 'vioNotPaid',
}

function showText(t, language, value) {
  if (language !== 'ar') return value
  const key = LICENSE_TEXT[value]
  return key ? t(key) : value
}

function showStatus(t, language, status) {
  if (language !== 'ar') return status
  const key = STATUS_TEXT[status]
  return key ? t(key) : status
}

function toastTitleKey(kind) {
  if (kind === 'license') return 'reqLicenseToastTitle'
  if (kind === 'objection') return 'reqObjectionToastTitle'
  return 'reqToastTitle'
}

function toastBodyKey(kind) {
  if (kind === 'license') return 'reqLicenseToastBody'
  if (kind === 'objection') return 'reqObjectionToastBody'
  return 'reqToastBody'
}

function toastViewKey(kind) {
  if (kind === 'license') return 'reqViewLicenseBtn'
  if (kind === 'objection') return 'reqViewRequestBtn'
  return 'reqViewPermitBtn'
}

function toastDrawerKind(kind) {
  if (kind === 'license' || kind === 'objection') return kind
  return 'permit'
}

const emptyFilters = { start: '', end: '', open: false, approved: false, rejected: false, inReview: false, canceled: false }

const blankLicense = {
  national: '',
  companyEn: '',
  number: '1010006817',
  nameAr: 'شركة العويضة للصناعات',
  investor: 'Saudi',
  licenseType: 'Marine Agents',
  amount: '30,000',
  fileName: '',
  address: '',
  cityCode: '',
  city: '',
  postal: '',
  district: '',
  street: '',
  building: '',
  secondary: '',
  shortAddress: '',
  accepted: false,
}

const blankObjection = {
  fineId: '1010006817',
  type: 'Fine',
  company: 'Company name here',
  subject: 'طلب اعتراض على فاتورة',
  fileName: '',
}

const blankPermit = {
  permitType: 'Activity in port',
  licenseNumber: '1010006817',
  national: '1010006817',
  number: '1010006817',
  nameAr: 'شركة العويضة للصناعات',
  ports: 'Jubail Commercial Port',
  license: 'License name here',
  fileName: '',
  accepted: false,
}

function displayDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB')
}

function chipDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}/${year}`
}

function currentAddress(language, form) {
  if (language !== 'ar' || !form.street) return form.address
  const city = form.city === 'RIYADH' ? 'الرياض' : form.city
  const area = form.shortAddress?.includes('السليمانية') ? 'السليمانية' : ''
  return [city, area, `${form.street} ${form.building}`.trim()].filter(Boolean).join('، ')
}

function statusClass(status) {
  if (status === 'Rejected' || status === 'Canceled' || status === 'No Paid') return 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
  if (status === 'Expired') return 'border-[#d5d9eb] bg-[#f8f9fc] text-[#515481]'
  if (status === 'Approved' || status === 'In Review') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (status === 'Open') return 'border-success-200 bg-success-50 text-success-700'
  return 'border-border bg-bg-neutral text-text-secondary'
}

function statusKey(status) {
  if (status === 'In Review') return 'inReview'
  return status.toLowerCase()
}

function tabStatuses(tab) {
  if (tab === 'permits') return ['Open', 'In Review', 'Canceled']
  return ['Open', 'Approved', 'Rejected']
}

export default function RequestsPage() {
  const { t, language } = useApp()
  const [tab, setTab] = useState('licenses')
  const [licenses, setLicenses] = useState(LICENSE_REQUEST_ROWS)
  const [permits, setPermits] = useState(PERMIT_REQUEST_ROWS)
  const [objections, setObjections] = useState(OBJECTION_REQUEST_ROWS)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [drawer, setDrawer] = useState(null)
  const [toast, setToast] = useState(null)
  const filterRef = useRef(null)
  const menuRef = useRef(null)

  useClickOutside(filterRef, () => setFiltersOpen(false), filtersOpen)
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  const filtersActive = Boolean(filters.start || filters.end || tabStatuses(tab).some((status) => filters[statusKey(status)]))

  const rows = useMemo(() => {
    const source = tab === 'permits' ? permits : tab === 'objections' ? objections : licenses
    const statuses = tabStatuses(tab).filter((status) => filters[statusKey(status)])
    return source.filter((row) => {
      if (filters.start && row.date < filters.start) return false
      if (filters.end && row.date > filters.end) return false
      if (statuses.length && !statuses.includes(row.status)) return false
      if (!query.trim()) return true
      return Object.values(row).join(' ').toLowerCase().includes(query.trim().toLowerCase())
    })
  }, [filters, licenses, objections, permits, query, tab])

  function exportRows() {
    const lines = rows.map((row) => Object.values(row).map((cell) => `"${cell ?? ''}"`).join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${tab}-requests.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openModal(kind) {
    setMenuOpen(false)
    setModal(kind)
    if (kind === 'license') setTab('licenses')
    if (kind === 'permit') setTab('permits')
    if (kind === 'objection') setTab('objections')
  }

  return (
    <div className="relative px-4 pb-10 pt-4 md:px-8">
      {toast ? (
        <div className="absolute end-4 top-4 z-30 w-[320px] rounded-xl border border-success-200 bg-success-50 p-4 shadow-lg md:end-8">
          <div className="flex gap-3">
            <img src={icons.checkCircle} alt="" width={20} height={20} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">{t(toastTitleKey(toast.kind), { number: toast.number })}</p>
                <button type="button" aria-label={t('close')} onClick={() => setToast(null)}>
                  <img src={icons.xClose} alt="" width={20} height={20} />
                </button>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{t(toastBodyKey(toast.kind), { number: toast.number })}</p>
              <div className="mt-3 flex gap-3 text-sm font-semibold">
                <button type="button" className="text-text-tertiary" onClick={() => setToast(null)}>{t('close')}</button>
                <button
                  type="button"
                  className="text-brand"
                  onClick={() => {
                    setDrawer({ kind: toastDrawerKind(toast.kind), row: toast.row })
                    setToast(null)
                  }}
                >
                  {t(toastViewKey(toast.kind))}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-6">
          <TabButton active={tab === 'licenses'} label={t('licenses')} count={licenses.length} onClick={() => setTab('licenses')} />
          <TabButton active={tab === 'permits'} label={t('permits')} count={permits.length} onClick={() => setTab('permits')} />
          <TabButton active={tab === 'objections'} label={t('reqObjections')} count={objections.length} onClick={() => setTab('objections')} />
        </div>
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
          <div className="relative" ref={menuRef}>
            <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-text-secondary shadow-xs">
              {t('reqRequestNew')}
              <img src={icons.chevronDown} alt="" width={20} height={20} className={menuOpen ? 'rotate-180' : ''} />
            </button>
            {menuOpen ? (
              <div className="absolute end-0 top-12 z-30 w-40 rounded-xl border border-border bg-white py-1 shadow-lg">
                {['license', 'permit', 'objection'].map((kind) => (
                  <button key={kind} type="button" onClick={() => openModal(kind)} className="block w-full px-3 py-2 text-start text-sm text-text-secondary hover:bg-bg-active">
                    {t(kind === 'license' ? 'reqLicense' : kind === 'permit' ? 'reqPermit' : 'reqObjection')}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {filtersActive ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filters.start ? <FilterChip label={t('reqFrom', { date: chipDate(filters.start) })} onRemove={() => setFilters({ ...filters, start: '' })} /> : null}
          {filters.end ? <FilterChip label={t('reqTo', { date: chipDate(filters.end) })} onRemove={() => setFilters({ ...filters, end: '' })} /> : null}
          {tabStatuses(tab).filter((status) => filters[statusKey(status)]).map((status) => (
            <FilterChip key={status} label={showStatus(t, language, status)} onRemove={() => setFilters({ ...filters, [statusKey(status)]: false })} />
          ))}
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setFilters(emptyFilters)}>{t('visRemoveAll')}</button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <section className="overflow-hidden rounded-3xl border border-border bg-white">
          <EmptyRequests tab={tab} onCreate={() => openModal(tab === 'objections' ? 'objection' : tab === 'permits' ? 'permit' : 'license')} />
        </section>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-3xl border border-border bg-white lg:block">
            {tab === 'permits' ? (
              <PermitTable
                rows={rows}
                onOpen={(row) => setDrawer({ kind: 'permit', row })}
                onOpenLicense={(row) => setDrawer({ kind: 'licenseDetail', row, fromList: true })}
              />
            ) : tab === 'objections' ? (
              <ObjectionTable
                rows={rows}
                onOpen={(row) => setDrawer({ kind: 'objection', row })}
                onOpenViolation={(row) => setDrawer({ kind: 'violation', row, fromList: true })}
              />
            ) : (
              <LicenseTable rows={rows} onOpen={(row) => setDrawer({ kind: 'license', row })} />
            )}
          </section>
          <div className="flex flex-col gap-3 lg:hidden">
            {tab === 'permits'
              ? rows.map((row) => (
                  <PermitRequestMobileCard
                    key={row.id}
                    row={row}
                    onOpen={() => setDrawer({ kind: 'permit', row })}
                    onOpenLicense={() => setDrawer({ kind: 'licenseDetail', row, fromList: true })}
                  />
                ))
              : tab === 'objections'
                ? rows.map((row) => (
                    <ObjectionRequestMobileCard
                      key={row.id}
                      row={row}
                      onOpen={() => setDrawer({ kind: 'objection', row })}
                      onOpenViolation={() => setDrawer({ kind: 'violation', row, fromList: true })}
                    />
                  ))
                : rows.map((row) => (
                    <LicenseRequestMobileCard key={row.id} row={row} onOpen={() => setDrawer({ kind: 'license', row })} />
                  ))}
          </div>
        </>
      )}

      <DetailsDrawer
        drawer={drawer}
        onClose={() => setDrawer(null)}
        onBack={() => {
          if (drawer?.fromList || !drawer?.row) {
            setDrawer(null)
            return
          }
          setDrawer(drawer.kind === 'violation' ? { kind: 'objection', row: drawer.row } : { kind: 'permit', row: drawer.row })
        }}
        onOpenLicense={() => setDrawer({ kind: 'licenseDetail', row: drawer.row })}
        onOpenViolation={() => setDrawer({ kind: 'violation', row: drawer.row })}
      />

      <LicenseModal
        open={modal === 'license'}
        onClose={() => setModal(null)}
        onSubmit={(draft) => {
          setLicenses((current) => [{
            id: `req-lic-${Date.now()}`,
            number: '2327',
            service: draft.licenseType,
            company: draft.companyEn,
            investor: draft.investor,
            date: '2028-12-21',
            requestDate: 'April 22, 2025',
            status: 'Open',
            amount: draft.amount,
          }, ...current])
          setTab('licenses')
          setModal(null)
          setToast({ kind: 'license', number: '2327', row: { number: '2327', requestDate: 'April 22, 2025', status: 'Open' } })
        }}
      />
      <PermitModal
        open={modal === 'permit'}
        onClose={() => setModal(null)}
        onSubmit={(draft) => {
          const row = {
            id: `req-permit-${Date.now()}`,
            number: '2327',
            permitType: draft.permitType,
            license: draft.license,
            date: '2028-12-21',
            requestDate: 'April 22, 2025',
            status: 'Open',
            ports: draft.ports,
          }
          setPermits((current) => [row, ...current])
          setTab('permits')
          setModal(null)
          setToast({ number: row.number, row })
        }}
      />
      <ObjectionModal
        open={modal === 'objection'}
        onClose={() => setModal(null)}
        onSubmit={(draft) => {
          const row = {
            id: `req-obj-${Date.now()}`,
            number: '2327',
            related: 'Violation name here',
            date: '2028-12-21',
            requestDate: 'April 22, 2025',
            status: 'Open',
            subject: draft.subject,
            reason: 'Reason here',
            objectionSubject: 'Activity in port',
            reasonDetail: 'طلب اعتراض على الفاتوره رقم 21321321321312',
          }
          setObjections((current) => [row, ...current])
          setTab('objections')
          setModal(null)
          setToast({ kind: 'objection', number: row.number, row })
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

function FilterChip({ label, onRemove }) {
  const { t } = useApp()
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-sm text-text-secondary">
      {label}
      <button type="button" aria-label={t('visRemoveNamed', { label })} onClick={onRemove}><img src={icons.xClose} alt="" width={20} height={20} /></button>
    </span>
  )
}

function TableShell({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-start">
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            {headers.map((header) => <th key={header || 'actions'} className="border-b border-border px-6 py-3 text-start font-semibold">{header}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Row({ children }) {
  return <tr className="h-14 text-sm text-text-tertiary hover:bg-bg-active">{children}</tr>
}

function Cell({ children, strong = false }) {
  return <td className={`border-b border-border px-6 ${strong ? 'font-medium text-text-primary' : ''}`}>{children}</td>
}

function StatusPill({ status, tone = status }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(tone)}`}>{status}</span>
}

function InfoButton({ label, onClick }) {
  return (
    <button type="button" aria-label={label} className="rounded-md p-1" onClick={onClick}>
      <img src={icons.info} alt="" width={16} height={16} />
    </button>
  )
}

function LicenseTable({ rows, onOpen }) {
  const { t, language } = useApp()
  return (
    <TableShell headers={[t('reqRequestNumber'), t('reqServiceType'), t('reqCompanyName'), t('reqInvestorType'), t('reqRequestDate'), t('invStatus'), t('reqAmountSar'), '']}>
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell strong>{row.number}</Cell>
          <Cell>{showText(t, language, row.service)}</Cell>
          <Cell>{showText(t, language, row.company)}</Cell>
          <Cell>{showText(t, language, row.investor)}</Cell>
          <Cell>{displayDate(row.date)}</Cell>
          <Cell><StatusPill status={showStatus(t, language, row.status)} tone={row.status} /></Cell>
          <Cell>{row.amount}</Cell>
          <Cell><InfoButton label={t('reqViewRequest', { number: row.number })} onClick={() => onOpen(row)} /></Cell>
        </Row>
      ))}
    </TableShell>
  )
}

function LicenseRequestMobileCard({ row, onOpen }) {
  const { t, language } = useApp()
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{t('reqRequestNumber')}: {row.number}</p>
        <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">{showText(t, language, row.service)}</h2>
      <p className="mt-1 text-sm text-text-tertiary">{showText(t, language, row.company)}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{displayDate(row.date)}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('reqRequestDate')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{row.amount}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('reqAmountSar')}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <InfoButton label={t('reqViewRequest', { number: row.number })} onClick={onOpen} />
      </div>
    </article>
  )
}

function PermitRequestMobileCard({ row, onOpen, onOpenLicense }) {
  const { t, language } = useApp()
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{t('reqRequestNumber')}: {row.number}</p>
        <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">{showText(t, language, row.permitType)}</h2>
      <div className="mt-2 flex items-center gap-2 text-sm text-text-tertiary">
        <span className="min-w-0 truncate">{showText(t, language, row.license)}</span>
        <InfoButton label={t('reqViewNamed', { name: row.license })} onClick={onOpenLicense} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{displayDate(row.date)}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('reqRequestDate')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{showText(t, language, row.ports)}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('reqPorts')}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <InfoButton label={t('reqViewPermit', { number: row.number })} onClick={onOpen} />
      </div>
    </article>
  )
}

function ObjectionRequestMobileCard({ row, onOpen, onOpenViolation }) {
  const { t, language } = useApp()
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{t('reqRequestNumber')}: {row.number}</p>
        <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">{row.subject}</h2>
      <div className="mt-2 flex items-center gap-2 text-sm text-text-tertiary">
        <span className="min-w-0 truncate">{showText(t, language, row.related)}</span>
        <InfoButton label={t('reqViewNamed', { name: row.related })} onClick={onOpenViolation} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{displayDate(row.date)}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{t('reqRequestDate')}</p>
        </div>
        <div className="flex items-end justify-end">
          <InfoButton label={t('reqViewRequest', { number: row.number })} onClick={onOpen} />
        </div>
      </div>
    </article>
  )
}

function namedRequestDate(language, value) {
  if (language === 'ar' && value === 'April 22, 2025') return formatNamedDate('2025-04-22', 'ar')
  return value
}

function PermitTable({ rows, onOpen, onOpenLicense }) {
  const { t, language } = useApp()
  return (
    <TableShell headers={[t('reqRequestNumber'), t('reqPermitType'), t('reqRelatedLicense'), t('reqRequestDate'), t('invStatus'), t('reqPorts'), '']}>
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell strong>{row.number}</Cell>
          <Cell>{showText(t, language, row.permitType)}</Cell>
          <Cell>
            <span className="inline-flex items-center gap-2">
              {showText(t, language, row.license)}
              <InfoButton label={t('reqViewNamed', { name: row.license })} onClick={() => onOpenLicense(row)} />
            </span>
          </Cell>
          <Cell>{displayDate(row.date)}</Cell>
          <Cell><StatusPill status={showStatus(t, language, row.status)} tone={row.status} /></Cell>
          <Cell>{showText(t, language, row.ports)}</Cell>
          <Cell><InfoButton label={t('reqViewPermit', { number: row.number })} onClick={() => onOpen(row)} /></Cell>
        </Row>
      ))}
    </TableShell>
  )
}

function ObjectionTable({ rows, onOpen, onOpenViolation }) {
  const { t, language } = useApp()
  return (
    <TableShell headers={[t('reqRequestNumber'), t('reqRelatedViolation'), t('reqRequestDate'), t('invStatus'), t('reqObjectionSubject'), t('reqReason')]}>
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell strong>{row.number}</Cell>
          <Cell>
            <span className="inline-flex items-center gap-2">
              {showText(t, language, row.related)}
              <InfoButton label={t('reqViewNamed', { name: row.related })} onClick={() => onOpenViolation(row)} />
            </span>
          </Cell>
          <Cell>{displayDate(row.date)}</Cell>
          <Cell><StatusPill status={showStatus(t, language, row.status)} tone={row.status} /></Cell>
          <Cell>{row.subject}</Cell>
          <Cell>
            <span className="inline-flex items-center gap-2">
              {showText(t, language, row.reason)}
              <InfoButton label={t('reqViewRequest', { number: row.number })} onClick={() => onOpen(row)} />
            </span>
          </Cell>
        </Row>
      ))}
    </TableShell>
  )
}

function EmptyRequests({ tab, onCreate }) {
  const { t } = useApp()
  const copy = {
    licenses: [t('reqNoLicense'), t('reqNoLicenseHint'), t('reqNewLicense')],
    permits: [t('reqNoPermit'), t('reqNoPermitHint'), t('reqNewPermit')],
    objections: [t('reqNoObjection'), t('reqNoObjectionHint'), t('reqNewObjection')],
  }[tab]
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2" style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)' }}>
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute left-1/2 top-0 -translate-x-1/2" />
      </div>
      <span className={`relative mb-4 flex items-center justify-center rounded-2xl border border-border bg-white shadow-xs ${tab === 'permits' ? 'size-24' : 'size-16'}`}>
        {tab === 'permits' ? <img src={icons.folderCheck} alt="" width={64} height={64} /> : tab === 'objections' ? <FileXIcon /> : <img src={icons.certificateLine} alt="" width={24} height={24} />}
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">{copy[0]}</h2>
      <p className="relative mt-1 text-sm text-text-tertiary">{copy[1]}</p>
      <Button className="relative mt-6" onClick={onCreate}><PlusIcon /> {copy[2]}</Button>
    </div>
  )
}

function DetailsDrawer({ drawer, onClose, onBack, onOpenLicense, onOpenViolation }) {
  const { t } = useApp()
  if (!drawer) return null
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col bg-white shadow-lg">
        {drawer.kind === 'licenseDetail' ? <LicenseDetail onClose={onClose} onBack={onBack} /> : null}
        {drawer.kind === 'violation' ? <ViolationDetail onClose={onClose} onBack={onBack} /> : null}
        {drawer.kind === 'permit' ? <PermitDetail row={drawer.row} onClose={onClose} onOpenLicense={onOpenLicense} /> : null}
        {drawer.kind === 'objection' ? <ObjectionDetail row={drawer.row} onClose={onClose} onOpenViolation={onOpenViolation} /> : null}
        {drawer.kind === 'license' ? <LicenseRequestDetail row={drawer.row} onClose={onClose} /> : null}
      </aside>
    </div>
  )
}

function LicenseDetail({ onClose, onBack }) {
  const { t, language } = useApp()
  return (
    <>
      <div className="flex items-center justify-between px-6 pt-5">
        <button type="button" aria-label={t('reqBack')} onClick={onBack} className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"><BackIcon /></button>
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-3">
        <p className="text-sm text-text-tertiary">{RELATED_LICENSE.code}</p>
        <h2 className="text-lg font-semibold text-text-primary">{showText(t, language, RELATED_LICENSE.title)}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqExpiry', { date: namedRequestDate(language, RELATED_LICENSE.expiry) })}</span>
          <span className="h-3 w-px bg-border" />
          <StatusPill status={showStatus(t, language, RELATED_LICENSE.status)} tone={RELATED_LICENSE.status} />
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
    </>
  )
}

function PermitDetail({ row, onClose, onOpenLicense }) {
  const { t, language } = useApp()
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
          <span>{t('reqRequestDateLine', { date: namedRequestDate(language, row.requestDate) })}</span>
          <span className="h-3 w-px bg-border" />
          <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <div className="flex flex-col gap-4 text-sm">
            <DetailLine label={t('reqPermitTypeLabel')} value={showText(t, language, row.permitType)} />
            <DetailLine label={t('reqPorts')} value={showText(t, language, row.ports)} />
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('reqRelatedLicense')}</p>
              <button type="button" onClick={onOpenLicense} className="inline-flex items-center gap-1 font-semibold text-brand">{showText(t, language, row.license)} <ArrowIcon /></button>
            </div>
          </div>
        </section>
        <AttachmentSection
          files={[{ name: 'File title here.png', kind: 'PNG' }, { name: 'File title here.png', kind: 'PNG' }]}
        />
      </div>
    </>
  )
}

function ObjectionDetail({ row, onClose, onOpenViolation }) {
  const { t, language } = useApp()
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        <FeaturedIcon type="objection" />
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-4">
        <p className="text-sm text-text-tertiary">{t('reqObjectionInfo')}</p>
        <h2 className="text-lg font-semibold text-text-primary">{row.number}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqRequestDateLine', { date: namedRequestDate(language, row.requestDate) })}</span>
          <span className="h-3 w-px bg-border" />
          <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <div className="flex flex-col gap-4 text-sm">
            <DetailLine label={t('reqObjectionSubject')} value={showText(t, language, row.objectionSubject)} />
            <DetailLine label={t('reqReason')} value={row.reasonDetail} />
            <div className="flex gap-4">
              <p className="w-40 text-text-placeholder">{t('reqRelatedViolation')}</p>
              <button type="button" onClick={onOpenViolation} className="inline-flex items-center gap-1 font-semibold text-brand">{showText(t, language, row.related)} <ArrowIcon /></button>
            </div>
          </div>
        </section>
        <AttachmentSection
          files={[{ name: 'File title here.png', kind: 'PNG' }, { name: 'File title here.png', kind: 'PNG' }]}
        />
      </div>
    </>
  )
}

function LicenseRequestDetail({ row, onClose }) {
  const { t, language } = useApp()
  const info = LICENSE_REQUEST_INFO
  const requestDate = language === 'ar' && row.requestDate === 'April 22, 2025' ? formatNamedDate('2025-04-22', 'ar') : row.requestDate
  return (
    <>
      <div className="flex items-start justify-between px-6 pt-6">
        <FeaturedIcon type="license" />
        <div className="flex items-center">
          <span className="flex size-9 items-center justify-center text-text-placeholder" aria-hidden="true">
            <DotsIcon />
          </span>
          <DrawerClose onClose={onClose} />
        </div>
      </div>
      <div className="px-6 pb-5 pt-4">
        <p className="text-sm text-text-tertiary">{t('reqLicenseInfo')}</p>
        <h2 className="mt-1 text-display-xs font-semibold text-text-primary">{row.number}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqRequestDateLine', { date: requestDate })}</span>
          <span className="h-3 w-px bg-border" />
          <StatusPill status={showStatus(t, language, row.status)} tone={row.status} />
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder">
            <img src={icons.info} alt="" width={20} height={20} />
            {t('reqGeneralInfo')}
          </h3>
          <div className="mt-4 flex flex-col gap-4 text-sm">
            <DetailLine label={t('reqCompanyName')} value={showText(t, language, info.company)} />
            <DetailLine label={t('reqInvestorType')} value={showText(t, language, info.investor)} />
            <DetailLine label={t('reqLicenseType')} value={showText(t, language, info.licenseType)} />
            <DetailLine label={t('reqAmountLabel')} value={showText(t, language, info.amount)} />
            <DetailLine label={t('reqCrNational')} value={info.crNational} />
            <DetailLine label={t('reqCrNumber')} value={info.crNumber} />
            <DetailLine label={t('reqSadad')} value={info.sadad} />
            <DetailLine label={t('reqPorts')} value={showText(t, language, info.ports)} />
          </div>
        </section>
        <AttachmentSection
          downloadColor="#717680"
          files={[{ name: 'File title here.png', kind: 'PNG' }, { name: 'File title here.png', kind: 'PNG' }]}
        />
      </div>
    </>
  )
}

function ViolationDetail({ onClose, onBack }) {
  const { t, language } = useApp()
  const violation = VIOLATION_DETAIL
  const rows = [
    [t('reqCompanyName'), showText(t, language, violation.company)],
    [t('reqLicenseType'), showText(t, language, violation.licenseType)],
    [t('reqCrNational'), violation.crNational],
    [t('reqCrNumber'), violation.crNumber],
    [t('reqType'), showText(t, language, violation.type)],
    [t('reqFineAmount'), showText(t, language, violation.fineAmount)],
    [t('vioObjectionDeadline'), namedRequestDate(language, violation.objectionExpiry)],
    [t('reqSadad'), violation.sadad],
    [t('reqPort'), showText(t, language, violation.port)],
  ]
  return (
    <>
      <div className="flex items-center justify-between px-6 pt-5">
        <button type="button" aria-label={t('reqBack')} onClick={onBack} className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"><BackIcon /></button>
        <DrawerClose onClose={onClose} />
      </div>
      <div className="px-6 pb-4 pt-3">
        <p className="text-sm text-text-tertiary">{t('reqFineId', { id: violation.fineId })}</p>
        <h2 className="text-lg font-semibold text-text-primary">{showText(t, language, violation.title)}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-tertiary">
          <span>{t('reqViolationDate', { date: namedRequestDate(language, violation.violationDate) })}</span>
          <span className="h-3 w-px bg-border" />
          <StatusPill status={showStatus(t, language, 'No Paid')} tone="No Paid" />
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder"><img src={icons.info} alt="" width={16} height={16} /> {t('reqGeneralInfo')}</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {rows.map(([label, value]) => <DetailLine key={label} label={label} value={value} />)}
          </div>
        </section>
        <section className="border-t border-border px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder"><img src={icons.file} alt="" width={20} height={20} /> {t('reqDescription')}</h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{language === 'ar' ? t('reqVioBody') : violation.body}</p>
        </section>
        <AttachmentSection files={[{ name: 'Image1.jpg', kind: 'JPG' }]} />
      </div>
    </>
  )
}

function FilterMenu({ tab, draft, onChange, onCancel, onApply }) {
  const { t, language } = useApp()
  return (
    <div className="absolute end-0 top-12 z-30 w-[280px] rounded-xl border border-border bg-white p-4 shadow-lg">
      <h2 className="text-sm font-semibold text-text-primary">{t('invFilters')}</h2>
      <div className="mt-4 flex flex-col gap-4">
        <DateField label={t('reqStartDate')} value={draft.start} max={draft.end} onChange={(start) => onChange({ ...draft, start })} />
        <DateField label={t('reqEndDate')} value={draft.end} min={draft.start} onChange={(end) => onChange({ ...draft, end })} />
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-text-secondary">{t('invStatus')}</legend>
        {tabStatuses(tab).map((status) => (
          <label key={status} className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={draft[statusKey(status)]} onChange={(event) => onChange({ ...draft, [statusKey(status)]: event.target.checked })} className="size-4 accent-[#1b8354]" />
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>{showStatus(t, language, status)}</span>
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

function LicenseModal({ open, onClose, onSubmit }) {
  const { t, language } = useApp()
  const titleId = useId()
  const fileRef = useRef(null)
  const [form, setForm] = useState(blankLicense)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return undefined
    setForm(blankLicense)
    setErrors({})
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function chooseRegistration(national) {
    const record = COMMERCIAL_REGISTRATIONS.find((item) => item.national === national)
    setForm((current) => ({
      ...current,
      national,
      number: record?.number || current.number,
      nameAr: record?.nameAr || current.nameAr,
      address: record?.address || '',
      cityCode: record?.cityCode || '',
      city: record?.city || '',
      postal: record?.postal || '',
      district: record?.district || '',
      street: record?.street || '',
      building: record?.building || '',
      secondary: record?.secondary || '',
      shortAddress: record?.shortAddress || '',
    }))
  }

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.national) next.national = t('invRequired')
    if (!form.companyEn.trim()) next.companyEn = t('invRequired')
    if (!form.amount.trim()) next.amount = t('invRequired')
    if (!form.accepted) next.accepted = t('reqAcceptTerms')
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(form)
  }

  const ready = form.national && form.companyEn.trim() && form.amount.trim() && form.accepted

  return (
    <ModalShell title={t('reqNewLicenseTitle')} titleId={titleId} onClose={onClose} onSubmit={submit}>
      <div className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm text-[#b54708]">
        <AlertIcon />
        <p>{t('reqCrHintValid')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('reqCrNationalField')} required error={errors.national}>
          <select value={form.national} onChange={(event) => chooseRegistration(event.target.value)} className={inputClass(errors.national)}>
            <option value="">{t('reqSelect')}</option>
            {COMMERCIAL_REGISTRATIONS.map((item) => <option key={item.national} value={item.national}>{item.national}</option>)}
          </select>
        </Field>
        <Field label={t('reqCompanyEn')} required error={errors.companyEn}>
          <input value={form.companyEn} onChange={(event) => setForm({ ...form, companyEn: event.target.value })} placeholder={t('reqEnterNameEn')} className={inputClass(errors.companyEn)} />
        </Field>
        <Field label={t('reqCrNumber')}><input value={form.number} readOnly className={`${inputClass()} bg-bg-neutral`} /></Field>
        <Field label={t('reqCrName')}><input value={form.nameAr} readOnly className={`${inputClass()} bg-bg-neutral`} /></Field>
        <Field label={t('reqInvestorType')} required>
          <select value={form.investor} onChange={(event) => setForm({ ...form, investor: event.target.value })} className={inputClass()}>
            {INVESTOR_TYPES.map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
          </select>
        </Field>
        <Field label={t('reqLicenseType')} required>
          <select value={form.licenseType} onChange={(event) => setForm({ ...form, licenseType: event.target.value })} className={inputClass()}>
            {LICENSE_TYPES.map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('reqAmountSar')} required error={errors.amount}>
        <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={`${inputClass(errors.amount)} max-w-[240px]`} />
      </Field>
      <Dropzone fileRef={fileRef} fileName={form.fileName} onFile={(fileName) => setForm({ ...form, fileName })} hint={t('reqUploadHint')} />
      <Field label={t('reqCurrentAddress')}><input value={currentAddress(language, form)} onChange={(event) => setForm({ ...form, address: event.target.value })} className={inputClass()} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('reqCityCode')}><input value={form.cityCode} onChange={(event) => setForm({ ...form, cityCode: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqCity')}><input value={showText(t, language, form.city)} onChange={(event) => setForm({ ...form, city: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqPostalField')}><input value={form.postal} onChange={(event) => setForm({ ...form, postal: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqDistrict')}><input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqStreet')}><input value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqBuilding')}><input value={form.building} onChange={(event) => setForm({ ...form, building: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqSecondary')}><input value={form.secondary} onChange={(event) => setForm({ ...form, secondary: event.target.value })} className={inputClass()} /></Field>
        <Field label={t('reqShortAddress')}><input value={form.shortAddress} onChange={(event) => setForm({ ...form, shortAddress: event.target.value })} className={inputClass()} /></Field>
      </div>
      <ModalFooter
        ready={ready}
        onClose={onClose}
        extra={
          <label className="flex flex-1 items-start gap-2 text-sm text-text-tertiary">
            <input type="checkbox" checked={form.accepted} onChange={(event) => setForm({ ...form, accepted: event.target.checked })} className="mt-0.5 size-4 accent-[#1b8354]" />
            {t('reqTerms')}
          </label>
        }
      />
      {errors.accepted ? <p className="px-6 pb-3 text-sm text-[#d92d20]">{errors.accepted}</p> : null}
    </ModalShell>
  )
}

function PermitModal({ open, onClose, onSubmit }) {
  const { t, language } = useApp()
  const titleId = useId()
  const fileRef = useRef(null)
  const [form, setForm] = useState(blankPermit)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    setForm(blankPermit)
    setExpanded(false)
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const ready = Boolean(form.permitType && form.ports && form.licenseNumber && form.accepted)
  return (
    <ModalShell title={t('reqNewPermitTitle')} titleId={titleId} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(form) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('reqPermitType')} required>
          <select value={form.permitType} onChange={(event) => setForm({ ...form, permitType: event.target.value })} className={inputClass()}>
            {PERMIT_TYPES.map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
          </select>
        </Field>
        <Field label={t('reqLicenseNumber')}>
          <select value={form.licenseNumber} onChange={(event) => setForm({ ...form, licenseNumber: event.target.value, national: event.target.value, number: event.target.value })} className={inputClass()}>
            <option value="1010006817">1010006817</option>
          </select>
        </Field>
        <Field label={t('reqCrUnified')}>
          <input value={form.national} readOnly className={`${inputClass()} bg-bg-neutral`} />
        </Field>
        <Field label={t('reqCrNumber')}>
          <input value={form.number} readOnly className={`${inputClass()} bg-bg-neutral`} />
        </Field>
        <Field label={t('reqPorts')} required>
          <select value={form.ports} onChange={(event) => setForm({ ...form, ports: event.target.value })} className={inputClass()}>
            {PERMIT_PORTS.map((item) => <option key={item} value={item}>{showText(t, language, item)}</option>)}
          </select>
        </Field>
        <Field label={t('reqCrName')}>
          <input value={form.nameAr} readOnly className={`${inputClass()} bg-bg-neutral`} />
        </Field>
      </div>
      <Dropzone fileRef={fileRef} fileName={form.fileName} onFile={(fileName) => setForm({ ...form, fileName })} hint={t('reqUploadHint')} />
      <ModalFooter
        ready={ready}
        onClose={onClose}
        extra={
          <label className="flex flex-1 items-start gap-2 text-sm text-brand">
            <input type="checkbox" checked={form.accepted} onChange={(event) => setForm({ ...form, accepted: event.target.checked })} className="mt-0.5 size-4 accent-[#1b8354]" />
            <span>
              {expanded ? t('reqUndertaking') : t('reqUndertakingPreview')}{' '}
              {expanded ? null : (
                <button type="button" className="font-semibold" onClick={(event) => { event.preventDefault(); setExpanded(true) }}>{t('reqReadMore')}</button>
              )}
            </span>
          </label>
        }
      />
    </ModalShell>
  )
}

function ObjectionModal({ open, onClose, onSubmit }) {
  const { t, language } = useApp()
  const titleId = useId()
  const fileRef = useRef(null)
  const [form, setForm] = useState(blankObjection)
  useEffect(() => {
    if (!open) return undefined
    setForm(blankObjection)
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const ready = Boolean(form.subject.trim() && form.fileName)
  return (
    <ModalShell title={t('reqObjectionTitle')} titleId={titleId} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(form) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('reqFineIdLabel')}><input value={form.fineId} readOnly className={`${inputClass()} bg-bg-neutral`} /></Field>
        <Field label={t('reqType')}><input value={showText(t, language, form.type)} readOnly className={`${inputClass()} bg-bg-neutral`} /></Field>
      </div>
      <Field label={t('reqCompanyName')}><input value={showText(t, language, form.company)} readOnly className={`${inputClass()} bg-bg-neutral`} /></Field>
      <Field label={t('subject')}>
        <textarea value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} rows={3} className={`${inputClass()} h-auto py-3`} />
      </Field>
      <Dropzone fileRef={fileRef} fileName={form.fileName} onFile={(fileName) => setForm({ ...form, fileName })} hint={t('reqObjectionHint')} />
      {form.fileName ? (
        <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
          <img src={icons.fileTypePdf} alt="" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text-primary">{form.fileName}</span>
            <span className="text-sm text-text-tertiary">200 KB</span>
          </span>
          <button type="button" aria-label={t('visDownloadNamed', { name: form.fileName })} onClick={() => downloadFile(form.fileName)}><DownloadIcon /></button>
          <button type="button" aria-label={t('reqRemoveFile')} onClick={() => setForm({ ...form, fileName: '' })}><TrashIcon /></button>
        </div>
      ) : null}
      <ModalFooter ready={ready} onClose={onClose} />
    </ModalShell>
  )
}

function ModalShell({ title, titleId, onClose, onSubmit, children }) {
  const { t } = useApp()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={onSubmit} className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border"><img src={icons.file} alt="" width={20} height={20} /></span>
          <h2 id={titleId} className="pt-2 text-lg font-semibold text-text-primary">{title}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="ms-auto flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"><img src={icons.xClose} alt="" width={20} height={20} /></button>
        </div>
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6 pb-2">{children}</div>
      </form>
    </div>
  )
}

function ModalFooter({ ready, onClose, extra }) {
  const { t } = useApp()
  return (
    <div className="sticky bottom-0 -mx-6 flex flex-col gap-3 border-t border-border bg-white px-6 py-4 sm:flex-row sm:items-center">
      {extra}
      <div className="ms-auto flex shrink-0 gap-3">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <button type="submit" disabled={!ready} className={`h-10 rounded-lg px-4 text-sm font-semibold ${ready ? 'bg-brand text-white' : 'cursor-not-allowed bg-[#f2f4f7] text-text-placeholder'}`}>{t('reqSubmit')}</button>
      </div>
    </div>
  )
}

function Dropzone({ fileRef, fileName, onFile, hint }) {
  const { t } = useApp()
  return (
    <div>
      <p className="text-sm font-medium text-text-secondary">{t('reqAttachments')}</p>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file) onFile(file.name)
        }}
        className="mt-2 flex w-full flex-col items-center rounded-xl border border-border px-4 py-8 text-center"
      >
        <UploadIcon />
        <span className="text-sm text-text-tertiary"><span className="font-semibold text-brand">{t('reqClickUpload')}</span> {t('reqDragDrop')}</span>
      </button>
      <input ref={fileRef} type="file" className="sr-only" onChange={(event) => onFile(event.target.files?.[0]?.name || fileName)} />
      {hint ? <p className="mt-2 text-center text-sm leading-6 text-text-tertiary">{hint}</p> : null}
    </div>
  )
}

function Field({ label, required = false, error, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      <span>{label}{required ? <span className="text-[#d92d20]"> *</span> : null}</span>
      {children}
      {error ? <span className="font-normal text-[#d92d20]">{error}</span> : null}
    </label>
  )
}

function inputClass(error) {
  return `h-11 w-full rounded-lg border bg-white px-3 text-sm text-text-primary shadow-xs outline-none ${error ? 'border-[#d92d20]' : 'border-border'}`
}

function downloadFile(name) {
  const url = URL.createObjectURL(new Blob(['Request attachment'], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.25" fill="#717680" />
      <circle cx="10" cy="10" r="1.25" fill="#717680" />
      <circle cx="10" cy="15.5" r="1.25" fill="#717680" />
    </svg>
  )
}

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

function DownloadIcon({ color = '#1b8354' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3.333v9.167m0 0 3.333-3.333M10 12.5 6.667 9.167M4.167 16.667h11.666" stroke={color} strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
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

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 7.5v3.333M10 13.333h.008M8.575 3.383 1.517 15.5A1.667 1.667 0 0 0 2.942 18h14.116a1.667 1.667 0 0 0 1.425-2.5L11.425 3.383a1.667 1.667 0 0 0-2.85 0Z" stroke="#b54708" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.333 5.833h13.334M8.333 9.167v5M11.667 9.167v5M4.167 5.833l.833 10c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667l.833-10M7.5 5.833V3.333h5v2.5" stroke="#d92d20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileXIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H7.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C4 3.52 4 4.08 4 5.2v13.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C5.52 22 6.08 22 7.2 22H12" stroke="#006E80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16 16 5 5m0-5-5 5" stroke="#006E80" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
