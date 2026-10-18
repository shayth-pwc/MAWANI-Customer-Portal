import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { icons } from '../../assets'
import RecordDrawer from '../../components/profile/RecordDrawer'
import { COMPANY, COMPANY_AR, CR_RECORDS, INITIAL_ADDRESS, INITIAL_CONTACTS } from '../../constants/profile'
import { useApp } from '../../hooks/useApp'

const inputClass =
  'flex h-10 w-full max-w-[400px] items-center gap-2 rounded-lg border bg-white px-3 shadow-xs focus-within:border-2 focus-within:border-[#717bbc]'

function Segment({ value, onChange }) {
  const { t } = useApp()
  const items = [
    { id: 'all', label: t('crViewAll') },
    { id: 'active', label: t('crActiveApis') },
  ]
  return (
    <div className="flex overflow-hidden rounded-sm border border-border">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-h-10 border-e border-border px-4 text-sm font-semibold last:border-e-0 ${
            value === item.id ? 'bg-bg-active text-text-secondary' : 'bg-white text-text-tertiary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function SearchField({ value, onChange, label }) {
  const { t } = useApp()
  return (
    <label className={`${inputClass} ${value ? 'border-[#717bbc]' : 'border-border'}`}>
      <img src={icons.search} alt="" width={20} height={20} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={t('crSearchHere')}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-placeholder"
      />
      {value ? (
        <button type="button" aria-label={t('crClear')} onClick={() => onChange('')}>
          <img src={icons.xClose} alt="" width={20} height={20} />
        </button>
      ) : null}
    </label>
  )
}

function ApiBadge({ value }) {
  const { t } = useApp()
  if (value === 'Active') {
    return (
      <span className="inline-flex rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
        {t('crActive')}
      </span>
    )
  }
  return <span className="text-sm text-text-tertiary">{value}</span>
}

function PoaStatus({ value }) {
  const { t } = useApp()
  const color = value === 'Yes' ? 'text-brand' : value === 'No' ? 'text-[#d92d20]' : 'text-text-tertiary'
  const label = value === 'Yes' ? t('crYes') : value === 'No' ? t('crNo') : value
  return <span className={`text-sm font-medium ${color}`}>{label}</span>
}

function EmptySearch({ query, onClear }) {
  const { t } = useApp()
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <img src={icons.cloud} alt="" width={152} height={104} />
      <h3 className="mt-4 text-md font-semibold text-text-primary">{t('crNoData')}</h3>
      <p className="mt-1 max-w-md text-sm text-text-tertiary">{t('crNoMatch', { query })}</p>
      <button
        type="button"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white"
        onClick={onClear}
      >
        {t('crClear')}
      </button>
    </div>
  )
}

function EmptyRecords() {
  const { t } = useApp()
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-bg-active">
        <img src={icons.fileX} alt="" width={24} height={24} />
      </span>
      <h3 className="text-md font-semibold text-text-primary">{t('crNoRecords')}</h3>
      <p className="mt-1 text-sm text-text-tertiary">{t('crNoRecordsBody')}</p>
    </div>
  )
}

function RegistrationTable({ rows, loading, onOpen }) {
  const { t, language } = useApp()
  const headings = [t('crColCr'), t('crColNational'), t('crColDesc'), t('crColFrom'), t('crColTo'), t('crColApi'), t('crColPoa'), '']
  const skeletonWidths = ['72px', '88px', '180px', '72px', '72px', '48px', '40px', '16px']
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-start">
        <thead>
          <tr className="bg-[#fdfdfd] text-xs font-semibold text-text-tertiary">
            {headings.map((heading) => (
              <th key={heading || 'info'} className="border-b border-border px-6 py-3 text-start font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="h-14">
                  {skeletonWidths.map((width, column) => (
                    <td key={column} className="border-b border-border px-6">
                      <span className="block h-2 animate-pulse rounded-full bg-[#f2f4f7]" style={{ width }} />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="h-14 text-sm text-text-tertiary">
              <td className="border-b border-border px-6 font-medium text-text-primary">{row.cr}</td>
              <td className="border-b border-border px-6">{row.national}</td>
              <td className="border-b border-border px-6">{language === 'ar' && row.description === COMPANY ? COMPANY_AR : row.description}</td>
              <td className="border-b border-border px-6">{row.from}</td>
              <td className="border-b border-border px-6">{row.to}</td>
              <td className="border-b border-border px-6">
                <ApiBadge value={row.api} />
              </td>
              <td className="border-b border-border px-6">
                <PoaStatus value={row.poa} />
              </td>
              <td className="border-b border-border px-6 text-end">
                <button
                  type="button"
                  aria-label={t('crViewRecord', { cr: row.cr })}
                  className="inline-flex rounded-md p-1.5 hover:bg-bg-active"
                  onClick={() => onOpen(row)}
                >
                  <img src={icons.info} alt="" width={16} height={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Card({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function CommercialRegistrationPage() {
  const { t } = useApp()
  const { setValidating } = useOutletContext()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')
  const [loading, setLoading] = useState(false)
  const [apiQuery, setApiQuery] = useState('')
  const [apiSegment, setApiSegment] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [address, setAddress] = useState(INITIAL_ADDRESS)
  const [contacts, setContacts] = useState(INITIAL_CONTACTS)

  const rows = useMemo(
    () =>
      CR_RECORDS.filter((row) => {
        const matchesQuery = !query || row.cr.includes(query)
        const matchesSegment = segment === 'all' || row.api === 'Active'
        return matchesQuery && matchesSegment
      }),
    [query, segment],
  )

  useEffect(() => () => setValidating(false), [setValidating])

  function validate() {
    if (loading) return
    setLoading(true)
    setValidating(true)
    window.setTimeout(() => {
      setLoading(false)
      setValidating(false)
    }, 900)
  }

  return (
    <div className="flex flex-col gap-8">
      <Card
        title={t('crList')}
        action={
          <button
            type="button"
            onClick={validate}
            className="inline-flex h-9 items-center rounded-lg border border-[#79b893] bg-white px-3 text-sm font-semibold text-brand"
          >
            {loading ? t('crValidating') : t('crValidate')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 border-b border-border px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Segment value={segment} onChange={setSegment} />
          <SearchField value={query} onChange={setQuery} label={t('crSearch')} />
        </div>
        {rows.length === 0 && !loading ? (
          <EmptySearch query={query} onClear={() => setQuery('')} />
        ) : (
          <RegistrationTable rows={rows} loading={loading} onOpen={() => setDrawerOpen(true)} />
        )}
      </Card>

      <Card
        title={t('crApiList')}
        action={
          <button
            type="button"
            disabled
            className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-[#e9eaeb] bg-white px-3 text-sm font-semibold text-[#a4a7ae]"
          >
            {t('crSaveBtp')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 border-b border-border px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Segment value={apiSegment} onChange={setApiSegment} />
          <SearchField value={apiQuery} onChange={setApiQuery} label={t('crSearchApi')} />
        </div>
        {apiQuery ? <EmptySearch query={apiQuery} onClear={() => setApiQuery('')} /> : <EmptyRecords />}
      </Card>

      <RecordDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        address={address}
        setAddress={setAddress}
        contacts={contacts}
        setContacts={setContacts}
      />
    </div>
  )
}
