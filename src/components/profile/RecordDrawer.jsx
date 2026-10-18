import { useState } from 'react'
import { icons, images } from '../../assets'
import {
  ADDRESS_ROWS,
  CITY_CODES,
  EDIT_ADDRESS,
  INITIAL_ACTIVITIES,
  INITIAL_OWNERS,
  RECORD,
  RECORD_PHONES,
} from '../../constants/profile'
import { useApp } from '../../hooks/useApp'
import { formatNamedDate } from '../../utils/formatDate'
import Button from '../ui/Button'
import Dialog from './Dialog'

const fieldClass =
  'h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary shadow-xs outline-none focus:border-[#717bbc]'

const ROW_LABELS = {
  'CR National No': 'crColNational',
  Type: 'crType',
  Status: 'crStatus',
  'Status Reason': 'crStatusReason',
  'Status Date': 'crStatusDate',
  'Company Period': 'crCompanyPeriod',
  Nationality: 'crNationality',
  'Legal type': 'crLegalType',
  'Fiscal start date': 'crFiscalStart',
  'Fiscal end date': 'crFiscalEnd',
  'Transition date': 'crTransition',
}

function Rows({ rows }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2 pb-1">
          <p className="w-[175px] shrink-0 text-sm text-text-placeholder">{label}</p>
          <p className="text-sm font-semibold text-text-primary">{value}</p>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-medium text-text-placeholder">{children}</h3>
    </div>
  )
}

function UserPlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 16.2a5.5 5.5 0 0 1 9.2-4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.5 12.5v4M13.5 14.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function UnsavedMark() {
  return (
    <span className="relative flex size-12 items-center justify-center">
      <span className="absolute size-12 rounded-full bg-[#FEF0C7]/50" />
      <span className="absolute size-9 rounded-full bg-[#FEF0C7]" />
      <svg className="relative" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M6 2.5h5.5L16 7v10.5H6V2.5Z" stroke="#DC6803" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11.5 2.5V7H16" stroke="#DC6803" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 11h4M8 14h4" stroke="#DC6803" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 2h3a1 1 0 0 1 1 1v1h-5V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 4l.5 9.2A1.2 1.2 0 0 0 5.2 14.4h5.6a1.2 1.2 0 0 0 1.2-1.2L12.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EmptyBlock({ title }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <img src={icons.fileX} alt="" width={24} height={24} />
      <p className="mt-2 text-sm font-semibold text-text-primary">{title}</p>
    </div>
  )
}

function FieldLabel({ children, required }) {
  return (
    <span className="text-sm font-medium text-text-secondary">
      {required ? <span className="text-[#d92d20]">*</span> : null}
      {required ? ' ' : null}
      {children}
    </span>
  )
}

function StackedField({ label, value, onChange, error, type = 'text', required = false }) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`${fieldClass} ${error ? 'border-[#d92d20]' : ''}`}
      />
      {error ? <span className="text-sm font-normal text-[#d92d20]">{error}</span> : null}
    </label>
  )
}

function SelectInput({ label, value, onChange, options, required = false, placeholder }) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <span className="relative">
        <select value={value} onChange={onChange} className={`${fieldClass} appearance-none pe-10`}>
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <img src={icons.chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute end-3 top-3" />
      </span>
    </label>
  )
}

function PhoneField({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <span className={`${fieldClass} flex items-center px-0 rtl:flex-row-reverse`}>
        <span dir="ltr" className="flex shrink-0 items-center gap-1.5 px-3">
          <img src={icons.chevronDown} alt="" width={16} height={16} />
          <span className="text-sm font-medium text-text-primary">+966</span>
          <img src={images.flagSa} alt="" width={20} height={14} className="h-3.5 w-5 rounded-sm object-cover" />
        </span>
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <input
          dir="ltr"
          value={value}
          onChange={onChange}
          inputMode="tel"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-start text-sm text-text-primary outline-none rtl:text-end"
        />
      </span>
    </label>
  )
}

export default function RecordDrawer({ open, onClose, address, setAddress, contacts, setContacts }) {
  const { t, language } = useApp()
  const [tab, setTab] = useState('address')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  const [addressDraft, setAddressDraft] = useState(EDIT_ADDRESS)
  const [addressBaseline, setAddressBaseline] = useState(EDIT_ADDRESS)
  const [addressError, setAddressError] = useState('')
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [contactMode, setContactMode] = useState(null)
  const [contactDraft, setContactDraft] = useState({ name: '', email: '', phone: '' })
  const [contactError, setContactError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [owners] = useState(INITIAL_OWNERS)
  const [activities] = useState(INITIAL_ACTIVITIES)
  const [confirmed, setConfirmed] = useState(true)

  if (!open) return null

  const issued = formatNamedDate('2025-04-22', language, { month: 'long' })
  const yesNo = (value) => (value === 'Yes' ? t('crYes') : value === 'No' ? t('crNo') : value)

  function requestCloseAddress() {
    if (JSON.stringify(addressDraft) !== JSON.stringify(addressBaseline)) {
      setUnsavedOpen(true)
      return
    }
    setAddressOpen(false)
    setAddressError('')
  }

  function saveAddress() {
    if (!/^\d{15}$/.test(addressDraft.taxNumber.trim())) {
      setAddressError(t('crTaxInvalid'))
      setUnsavedOpen(false)
      return false
    }
    setAddress((current) => ({
      ...current,
      taxNumber: addressDraft.taxNumber,
      vat: addressDraft.vat,
      postal: addressDraft.postal,
      cityCode: addressDraft.cityCode,
      street: addressDraft.street,
      district: addressDraft.district,
      building: addressDraft.building,
      shortAddress: addressDraft.shortAddress,
    }))
    setAddressError('')
    setAddressOpen(false)
    setUnsavedOpen(false)
    return true
  }

  function openContact(mode, contact) {
    setContactMode(mode)
    setContactError('')
    setContactDraft(
      contact
        ? { ...contact, phone: String(contact.phone || '').replace(/^\+966\s*/, '') }
        : { name: '', email: '', phone: '' },
    )
  }

  function saveContact() {
    if (!contactDraft.name.trim()) {
      setContactError(t('fieldRequired'))
      return
    }
    const next = { ...contactDraft, phone: contactDraft.phone.startsWith('+') ? contactDraft.phone : `+966 ${contactDraft.phone}` }
    if (contactMode === 'new') {
      setContacts((items) => [...items, { ...next, id: `c${Date.now()}` }])
    } else {
      setContacts((items) => items.map((item) => (item.id === next.id ? next : item)))
    }
    setContactMode(null)
  }

  const addressRows = ADDRESS_ROWS.map(([key, label]) => [t(label), key === 'vat' ? yesNo(address[key]) : address[key]])

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={t('crCloseRecord')} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex h-full w-full max-w-[510px] flex-col bg-white shadow-lg">
        <div className="flex h-full w-full flex-col">
          <div className="relative px-6 pb-4 pt-6">
            <span className="relative mb-3 block size-10">
              <span className="absolute -top-1 start-0 size-10 rotate-[15deg] rounded-lg bg-brand-400" />
              <span className="absolute inset-0 flex items-center justify-center rounded-lg border border-white/80 bg-white/80 backdrop-blur-sm">
                <img src={icons.file} alt="" width={20} height={20} />
              </span>
            </span>
            <h2 className="text-xl font-semibold text-text-primary">{RECORD.number}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
              <p>
                <span className="text-text-placeholder">{t('crIssue')}:</span> {issued}
              </p>
              <span className="h-3 w-px bg-border" />
              <p>
                <span className="text-text-placeholder">{t('crExpiry')}:</span> {issued}
              </p>
              <span className="h-3 w-px bg-border" />
              <span className="rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                {t('crApiActive')}
              </span>
            </div>
            <div className="mt-4 flex rounded-lg border border-border bg-[#fafafa] p-1">
              {[
                ['general', t('crGeneral')],
                ['address', t('crAddressTab')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`h-9 flex-1 rounded-sm text-sm ${
                    tab === id ? 'bg-white font-bold text-brand shadow-xs' : 'font-medium text-text-placeholder'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={t('close')}
              onClick={onClose}
              className="absolute left-4 top-3 flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"
            >
              <img src={icons.xClose} alt="" width={20} height={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'general' ? (
              <>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.homeLine} alt="" width={16} height={16} />}>{t('crInfo')}</SectionTitle>
                  <div className="mt-3">
                    <Rows rows={RECORD.cr.map(([label, value]) => [t(ROW_LABELS[label] || label), value])} />
                    <div className="flex gap-2 pb-1">
                      <p className="w-[175px] shrink-0 text-sm text-text-placeholder">{t('crWebsite')}</p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
                        onClick={() => {
                          navigator.clipboard?.writeText(RECORD.website)
                          setCopied(true)
                          window.setTimeout(() => setCopied(false), 1200)
                        }}
                      >
                        {copied ? t('crCopied') : RECORD.website}
                        <img src={icons.copy} alt="" width={20} height={20} />
                      </button>
                    </div>
                  </div>
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.calendar} alt="" width={20} height={20} />}>{t('crLegal')}</SectionTitle>
                  <div className="mt-3">
                    <Rows rows={RECORD.legal.map(([label, value]) => [t(ROW_LABELS[label] || label), value])} />
                  </div>
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<span className="text-sm font-semibold text-text-placeholder">@</span>}>{t('crExtra')}</SectionTitle>
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-brand-50 bg-gradient-to-r from-white to-brand-50 px-4 pb-2 pt-3 text-brand shadow-xs">
                      <span className="text-sm">{t('crCapital')}</span>
                      <span className="text-md font-semibold">{RECORD.capital}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-[#f6fafb] bg-gradient-to-r from-white to-[#f6fafb] px-4 pb-2 pt-3 text-[#008ba1] shadow-xs">
                      <span className="text-sm">{t('crShares')}</span>
                      <span className="text-md font-semibold">{RECORD.shares}</span>
                    </div>
                  </div>
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.messageCircle} alt="" width={20} height={20} />}>{t('crDescription')}</SectionTitle>
                  <p className={`mt-3 text-sm leading-6 text-text-primary ${language === 'ar' || expanded ? '' : 'line-clamp-2'}`}>
                    {language === 'ar' ? RECORD.descriptionAr : RECORD.description}
                  </p>
                  {language === 'ar' ? null : (
                    <button type="button" className="mt-1 text-sm font-medium text-[#0086c9]" onClick={() => setExpanded((value) => !value)}>
                      {expanded ? t('crShowLess') : t('crShowMore')}
                    </button>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="border-t border-border px-6 py-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <SectionTitle icon={<img src={icons.user} alt="" width={16} height={16} />}>{t('crAddress')}</SectionTitle>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-50 px-3 text-sm font-semibold text-brand"
                      onClick={() => {
                        setAddressDraft(EDIT_ADDRESS)
                        setAddressBaseline(EDIT_ADDRESS)
                        setAddressError('')
                        setAddressOpen(true)
                      }}
                    >
                      {t('crEditAddress')}
                    </button>
                  </div>
                  <Rows rows={addressRows} />
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.mail} alt="" width={16} height={16} />}>{t('crContacts')}</SectionTitle>
                  <div className="mt-3">
                    <Rows rows={RECORD_PHONES.map(([label, value]) => [t(label), value])} />
                  </div>
                </section>
                <section className="border-t border-border px-6 py-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <SectionTitle icon={<img src={icons.mail} alt="" width={16} height={16} />}>{t('crAdditionalContacts')}</SectionTitle>
                    <button type="button" className="text-sm font-semibold text-brand" onClick={() => openContact('new')}>
                      {t('crNewContact')}
                    </button>
                  </div>
                  {contacts.length === 0 ? (
                    <EmptyBlock title={t('crNoContacts')} />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs font-semibold text-text-tertiary">
                            {[t('crName'), t('crMobile'), t('crEmail'), ''].map((heading) => (
                              <th key={heading || 'actions'} className="border-b border-border px-4 py-3 text-start font-semibold">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map((contact) => (
                            <tr key={contact.id}>
                              <td className="border-b border-border px-4 py-3 font-medium text-text-primary">{contact.name}</td>
                              <td className="border-b border-border px-4 py-3 text-text-tertiary">{contact.phone}</td>
                              <td className="border-b border-border px-4 py-3 text-text-tertiary">{contact.email}</td>
                              <td className="border-b border-border px-4 py-3 text-end">
                                <span className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    aria-label={t('crEditNamed', { name: contact.name })}
                                    className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-active"
                                    onClick={() => openContact('edit', contact)}
                                  >
                                    <img src={icons.edit} alt="" width={16} height={16} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t('crDeleteNamed', { name: contact.name })}
                                    className="rounded-md p-1.5 text-[#d92d20] hover:bg-bg-active"
                                    onClick={() => setDeleteId(contact.id)}
                                  >
                                    <TrashIcon />
                                  </button>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.building} alt="" width={16} height={16} />}>{t('crOwners')}</SectionTitle>
                  <div className="mt-3">
                    {owners.length === 0 ? (
                      <EmptyBlock title={t('crNoContacts')} />
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs font-semibold text-text-tertiary">
                              {[t('crOwnerName'), t('crNationality'), t('crRelation'), t('crMobile')].map((heading) => (
                                <th key={heading} className="border-b border-border px-4 py-3 text-start font-semibold">
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {owners.map((owner) => (
                              <tr key={owner.id}>
                                <td className="border-b border-border px-4 py-3 font-medium text-text-primary">{owner.name}</td>
                                <td className="border-b border-border px-4 py-3 text-text-tertiary">{owner.nationality}</td>
                                <td className="border-b border-border px-4 py-3 text-text-tertiary">{owner.relation}</td>
                                <td className="border-b border-border px-4 py-3 text-text-tertiary">{owner.phone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
                <section className="border-t border-border px-6 py-5">
                  <SectionTitle icon={<img src={icons.grid} alt="" width={16} height={16} />}>{t('crIsic')}</SectionTitle>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-semibold text-text-tertiary">
                          {[t('crCode'), t('crName')].map((heading) => (
                            <th key={heading} className="border-b border-border px-4 py-3 text-start font-semibold">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((activity) => (
                          <tr key={activity.id}>
                            <td className="border-b border-border px-4 py-3 text-text-primary">{activity.code}</td>
                            <td className="border-b border-border px-4 py-3 text-text-tertiary">{activity.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>

          {tab === 'address' ? (
            <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
              <label className="flex items-center gap-2 text-sm text-text-tertiary">
                <button type="button" onClick={() => setConfirmed((value) => !value)} aria-pressed={confirmed}>
                  <img src={confirmed ? icons.checkOn : icons.checkOff} alt="" width={20} height={20} />
                </button>
                {t('crConfirmData')}
              </label>
              <Button disabled={!confirmed} onClick={onClose}>
                {t('save')}
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      <Dialog
        open={addressOpen}
        title={t('crEditAddress')}
        onClose={requestCloseAddress}
        width="max-w-[720px]"
        iconPlacement="inline"
        icon={
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-white">
            <img src={icons.user} alt="" width={20} height={20} />
          </span>
        }
      >
        <form
          className="grid gap-5 px-6 py-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            saveAddress()
          }}
        >
          <StackedField
            label={t('crTaxNumber')}
            required
            value={addressDraft.taxNumber}
            error={addressError}
            onChange={(event) => {
              setAddressError('')
              setAddressDraft((current) => ({ ...current, taxNumber: event.target.value }))
            }}
          />
          <SelectInput
            label={t('crVat')}
            required
            value={addressDraft.vat}
            options={[
              { value: 'Yes', label: t('crYes') },
              { value: 'No', label: t('crNo') },
            ]}
            onChange={(event) => setAddressDraft((current) => ({ ...current, vat: event.target.value }))}
          />
          <StackedField
            label={t('crPostal')}
            value={addressDraft.postal}
            onChange={(event) => setAddressDraft((current) => ({ ...current, postal: event.target.value }))}
          />
          <SelectInput
            label={t('crCityCode')}
            required
            placeholder={t('crSelect')}
            value={addressDraft.cityCode}
            options={CITY_CODES.map((code) => ({ value: code, label: code }))}
            onChange={(event) => {
              setAddressError('')
              setAddressDraft((current) => ({ ...current, cityCode: event.target.value }))
            }}
          />
          <StackedField
            label={t('crStreet')}
            value={addressDraft.street}
            onChange={(event) => setAddressDraft((current) => ({ ...current, street: event.target.value }))}
          />
          <StackedField
            label={t('crDistrict')}
            value={addressDraft.district}
            onChange={(event) => setAddressDraft((current) => ({ ...current, district: event.target.value }))}
          />
          <PhoneField
            label={t('crAdditional')}
            value={addressDraft.additionalPhone}
            onChange={(event) => setAddressDraft((current) => ({ ...current, additionalPhone: event.target.value }))}
          />
          <StackedField
            label={t('crBuilding')}
            value={addressDraft.building}
            onChange={(event) => setAddressDraft((current) => ({ ...current, building: event.target.value }))}
          />
          <StackedField
            label={t('reqShortAddress')}
            value={addressDraft.shortAddress}
            onChange={(event) => setAddressDraft((current) => ({ ...current, shortAddress: event.target.value }))}
          />
        </form>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={requestCloseAddress}>
            {t('cancel')}
          </Button>
          <Button className="flex-1" onClick={saveAddress}>
            {t('crConfirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={unsavedOpen}
        title={t('crUnsaved')}
        description={t('crUnsavedBody')}
        onClose={() => setUnsavedOpen(false)}
        icon={<UnsavedMark />}
      >
        <div className="mt-6 flex gap-3 border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setUnsavedOpen(false)
              setAddressOpen(false)
              setAddressError('')
            }}
          >
            {t('crDiscard')}
          </Button>
          <Button className="flex-1" onClick={saveAddress}>
            {t('crConfirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(contactMode)}
        title={contactMode === 'edit' ? t('crUpdateContact') : t('crNewContact')}
        onClose={() => setContactMode(null)}
        width="max-w-[520px]"
        iconPlacement="inline"
        icon={
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-white text-text-secondary">
            {contactMode === 'edit' ? <img src={icons.user} alt="" width={20} height={20} /> : <UserPlusIcon />}
          </span>
        }
      >
        <form
          className="flex flex-col gap-4 px-6 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveContact()
          }}
        >
          <StackedField
            label={t('crContactName')}
            value={contactDraft.name}
            error={contactError}
            onChange={(event) => {
              setContactError('')
              setContactDraft((current) => ({ ...current, name: event.target.value }))
            }}
          />
          <PhoneField
            label={t('crMobile')}
            value={contactDraft.phone}
            onChange={(event) => setContactDraft((current) => ({ ...current, phone: event.target.value }))}
          />
          <StackedField
            label={t('crEmail')}
            type="email"
            value={contactDraft.email}
            onChange={(event) => setContactDraft((current) => ({ ...current, email: event.target.value }))}
          />
        </form>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={() => setContactMode(null)}>
            {t('cancel')}
          </Button>
          <Button className="flex-1" onClick={saveContact}>
            {t('crConfirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteId)}
        title={t('crDeleteContact')}
        description={t('crDeleteBody')}
        onClose={() => setDeleteId(null)}
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-[#fef3f2] text-[#d92d20]">
            <TrashIcon />
          </span>
        }
      >
        <div className="mt-6 flex gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)}>
            {t('cancel')}
          </Button>
          <Button
            className="flex-1 border-transparent bg-[#d92d20] hover:bg-[#b42318]"
            onClick={() => {
              setContacts((items) => items.filter((item) => item.id !== deleteId))
              setDeleteId(null)
            }}
          >
            {t('crDelete')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
