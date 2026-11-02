import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { images } from '../assets'
import { useClickOutside } from '../hooks/useClickOutside'
import { useApp } from '../hooks/useApp'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ACCOUNT_TYPES = [
  { id: 'companies', label: 'regCompanies', icon: 'building' },
  { id: 'individual', label: 'regIndividual', icon: 'user' },
  { id: 'employee', label: 'regEmployee', icon: 'briefcase' },
]

const PROFILES = [
  { id: 'local', label: 'regLocal' },
  { id: 'international', label: 'regInternational' },
  { id: 'poa', label: 'regPoa' },
]

const INDIVIDUAL_PROFILES = [
  { id: 'visits', label: 'regVisits' },
  { id: 'label2', label: 'regLabel2' },
  { id: 'label3', label: 'regLabel3' },
]

const EMPLOYEE_PROFILES = [
  { id: 'label1', label: 'regLabel1' },
  { id: 'label2', label: 'regLabel2' },
  { id: 'label3', label: 'regLabel3' },
]

const COMPANY_TYPES = ['regCustomsBroker', 'regShippingAgent', 'regFreightForwarder']
const NATIONALITIES = ['regNatSaudi', 'regNatUae', 'regNatBahrain', 'regNatKuwait', 'regNatOman', 'regNatQatar']
const DOCUMENT_TYPES = ['regDocNationalId', 'regDocIqama', 'regDocPassport']

export default function RegisterPage() {
  const { t, language, toggleLanguage, signedIn, boot, enterApp } = useApp()
  const [accountType, setAccountType] = useState('companies')
  const [profile, setProfile] = useState('local')
  const [identity, setIdentity] = useState('')
  const [companyType, setCompanyType] = useState(COMPANY_TYPES[0])
  const [nationality, setNationality] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [firstName, setFirstName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [grandfatherName, setGrandfatherName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [registrationUnavailable, setRegistrationUnavailable] = useState(false)

  if (signedIn && boot === 'idle') return <Navigate to="/" replace />

  const personal = accountType === 'individual' || accountType === 'employee'
  const named = personal || profile === 'poa'
  const profiles = accountType === 'employee' ? EMPLOYEE_PROFILES : accountType === 'individual' ? INDIVIDUAL_PROFILES : PROFILES

  const openAccount = () => {
    setSubmitting(true)
    enterApp()
  }

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    const personal = accountType === 'individual' || accountType === 'employee'
    const poa = profile === 'poa'
    if (personal) {
      if (!companyType) next.companyType = t('fieldRequired')
      if (!nationality) next.nationality = t('fieldRequired')
      if (!documentType) next.documentType = t('fieldRequired')
      if (!identity.trim()) next.identity = t('fieldRequired')
      if (email.trim() && !EMAIL.test(email.trim())) next.email = t('invalidEmail')
    } else {
      if (poa && !nationality) next.nationality = t('fieldRequired')
      if (poa && !documentType) next.documentType = t('fieldRequired')
      if ((poa || profile === 'local') && !identity.trim()) next.identity = t('fieldRequired')
      if (!EMAIL.test(email.trim())) next.email = email.trim() ? t('invalidEmail') : t('fieldRequired')
      if (!poa && password.length < 8) next.password = t('passwordRule')
      if (!poa && password !== confirm) next.confirm = t('passwordMismatch')
    }
    setErrors(next)
    if (Object.keys(next).length || submitting) return
    // The v0.7.4 backend exposes admin-only user creation, not public signup.
    setRegistrationUnavailable(true)
  }

  return (
    <div className="min-h-screen bg-white lg:bg-[#eef1f4] lg:p-3 xl:p-5">
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col overflow-hidden bg-white lg:min-h-[calc(100vh-1.5rem)] lg:rounded-[28px] xl:min-h-[calc(100vh-2.5rem)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, #e6edf3 1px, transparent 1px), linear-gradient(to bottom, #e6edf3 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
          }}
        />

        <div className="relative mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-5 py-6 sm:px-8 sm:py-10 lg:px-10">
          <div className="relative flex w-full items-center justify-center">
            <Link
              to="/login"
              aria-label={t('backToSignIn')}
              className="absolute start-0 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-active"
            >
              <BackArrow />
            </Link>
            <img src={images.logo} alt="Mawani" className="h-10 w-auto max-w-[180px] object-contain sm:h-12 sm:max-w-[200px]" />
            <button
              type="button"
              className="absolute end-0 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-tertiary lg:hidden"
              onClick={toggleLanguage}
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
          <h1 className="mt-6 text-center text-display-sm font-semibold tracking-[-0.02em] text-text-primary">{t('signUpTitle')}</h1>
          <p className="mt-3 max-w-xl text-center text-sm text-text-secondary">{language === 'ar' ? 'التسجيل الذاتي غير متاح حالياً. يرجى التواصل مع مسؤول البوابة لإنشاء حساب SAP IAS.' : 'Self-registration is not yet enabled. Contact the portal administrator to create an SAP IAS account.'}</p>
          {registrationUnavailable ? <p role="alert" className="mt-2 text-center text-sm text-[#b42318]">{language === 'ar' ? 'لم يتم إنشاء حساب.' : 'No account was created.'}</p> : null}
          <p className="mt-2 text-center text-md text-text-tertiary">{t('signUpBody')}</p>

          <div className="mt-6 flex w-full gap-1 rounded-xl bg-[#f2f4f7] p-1">
            {ACCOUNT_TYPES.map((item) => {
              const active = accountType === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setErrors({})
                    setAccountType(item.id)
                    if (item.id === 'individual') setProfile('visits')
                    else if (item.id === 'employee') setProfile('label1')
                    else if (profile === 'visits' || profile === 'label1' || profile === 'label2' || profile === 'label3') setProfile('local')
                  }}
                  className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-semibold sm:gap-2 sm:text-sm ${
                    active ? 'bg-white text-brand shadow-xs' : 'text-text-tertiary'
                  }`}
                >
                  <TypeIcon name={item.icon} />
                  <span className="truncate">{t(item.label)}</span>
                </button>
              )
            })}
          </div>

          <form className="mt-6 w-full" onSubmit={submit} noValidate>
            <fieldset>
              <legend className="text-sm font-medium text-text-secondary">
                {t('regProfile')}
                <Required />
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {profiles.map((item) => {
                  const active = profile === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProfile(item.id)}
                      className={`h-8 rounded-full px-3 text-sm font-semibold ${
                        active ? 'bg-brand text-white' : 'border border-border bg-white text-text-secondary'
                      }`}
                    >
                      {t(item.label)}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {personal ? (
              <div className="mt-5 grid gap-x-6 sm:grid-cols-2" style={{ rowGap: '1.25rem' }}>
                <TypeField
                  label={t('regType')}
                  value={companyType}
                  onChange={setCompanyType}
                  options={COMPANY_TYPES}
                  error={errors.companyType}
                  t={t}
                />
                <TypeField
                  label={t('regNationality')}
                  value={nationality}
                  onChange={setNationality}
                  options={NATIONALITIES}
                  placeholder={t('regSelectNationality')}
                  error={errors.nationality}
                  t={t}
                />
                <TypeField
                  label={t('regDocumentType')}
                  value={documentType}
                  onChange={setDocumentType}
                  options={DOCUMENT_TYPES}
                  placeholder={t('regSelectDocument')}
                  error={errors.documentType}
                  t={t}
                />
                <DocumentRow
                  label={t('regDocumentNumber')}
                  value={identity}
                  onChange={setIdentity}
                  placeholder={t('regDocNumberPlaceholder')}
                  error={errors.identity}
                  t={t}
                />
              </div>
            ) : profile === 'poa' ? (
              <>
                <div className="mt-5 grid gap-x-6 sm:grid-cols-2" style={{ rowGap: '1.25rem' }}>
                  <TypeField
                    label={t('regNationality')}
                    value={nationality}
                    onChange={setNationality}
                    options={NATIONALITIES}
                    placeholder={t('regSelectNationality')}
                    error={errors.nationality}
                    t={t}
                  />
                  <TypeField
                    label={t('regDocumentType')}
                    value={documentType}
                    onChange={setDocumentType}
                    options={DOCUMENT_TYPES}
                    placeholder={t('regSelectDocument')}
                    error={errors.documentType}
                    t={t}
                  />
                </div>
                <div className="mt-5">
                  <DocumentRow
                    label={t('regDocumentNumber')}
                    value={identity}
                    onChange={setIdentity}
                    placeholder={t('regDocNumberPlaceholder')}
                    error={errors.identity}
                    t={t}
                  />
                </div>
              </>
            ) : profile === 'local' ? (
              <div className="mt-5 grid gap-x-6 sm:grid-cols-2" style={{ rowGap: '1.25rem' }}>
                <DocumentRow
                  label={t('regNationalId')}
                  value={identity}
                  onChange={setIdentity}
                  placeholder={t('regIdPlaceholder')}
                  error={errors.identity}
                  t={t}
                />
                <TypeField label={t('regType')} value={companyType} onChange={setCompanyType} options={COMPANY_TYPES} t={t} />
              </div>
            ) : (
              <div className="mt-5" style={{ maxWidth: 280 }}>
                <TypeField label={t('regType')} value={companyType} onChange={setCompanyType} options={COMPANY_TYPES} t={t} />
              </div>
            )}

            <div className="mt-5 grid gap-x-6 sm:grid-cols-2" style={{ rowGap: '1.25rem' }}>

              <Field label={t('regFirstName')}>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  className="h-11 w-full bg-transparent text-sm text-text-primary outline-none"
                />
              </Field>

              {named ? (
                <Field label={t('regFatherName')}>
                  <input
                    value={fatherName}
                    onChange={(event) => setFatherName(event.target.value)}
                    autoComplete="additional-name"
                    placeholder={t('regEnterName')}
                    className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                </Field>
              ) : null}

              {named ? (
                <Field label={t('regGrandfatherName')}>
                  <input
                    value={grandfatherName}
                    onChange={(event) => setGrandfatherName(event.target.value)}
                    placeholder={t('regEnterName')}
                    className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                </Field>
              ) : null}

              <Field label={t('regLastName')}>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  placeholder={t(named ? 'regEnterName' : 'regLastPlaceholder')}
                  className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                />
              </Field>

              <Field label={t('regPhone')}>
                <span className="flex h-11 items-center">
                  <span dir="ltr" className="flex shrink-0 items-center gap-1.5">
                    <img src={images.flagSa} alt="" width={20} height={14} className="h-3.5 w-5 rounded-sm object-cover" />
                    <span className="text-sm font-medium text-text-primary">+966</span>
                    <Chevron className="text-text-placeholder" />
                  </span>
                  <span className="mx-3 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                  <input
                    dir="ltr"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder={t('regPhonePlaceholder')}
                    aria-label={t('regPhone')}
                    className="h-11 min-w-0 flex-1 bg-transparent text-start text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                </span>
              </Field>

              <Field label={t(named ? 'regEmail' : 'regBusinessEmail')} error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder={t('regBusinessEmailPlaceholder')}
                  className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                />
              </Field>

              {named ? null : <Field label={t('password')} error={errors.password}>
                <span className="flex h-11 items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button type="button" aria-label={t(showPassword ? 'hidePassword' : 'showPassword')} onClick={() => setShowPassword((value) => !value)}>
                    <Eye open={showPassword} />
                  </button>
                </span>
              </Field>}

              {named ? null : <Field label={t('regReenter')} error={errors.confirm}>
                <span className="flex h-11 items-center">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button type="button" aria-label={t(showConfirm ? 'hidePassword' : 'showPassword')} onClick={() => setShowConfirm((value) => !value)}>
                    <Eye open={showConfirm} />
                  </button>
                </span>
              </Field>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-xs hover:bg-brand-400 disabled:opacity-60"
            >
              {t('register')}
              <Arrow />
            </button>
          </form>

          <div className="my-6 h-px w-full bg-border" />
          <button type="button" className="inline-flex items-center gap-2 text-center text-sm font-semibold text-brand" onClick={openAccount} disabled={submitting}>
            {language === 'ar' ? 'المتابعة عبر SAP IAS' : 'Continue with SAP IAS'}
            <InfoMark />
          </button>
          <p className="mt-3 text-center text-sm text-text-tertiary">
            {t('haveAccount')}{' '}
            <Link to="/login" className="font-semibold text-brand">
              {t('regSignIn')}
            </Link>
          </p>
        </div>

        <div className="relative flex items-center justify-center gap-4 px-5 pb-6 sm:px-8 lg:justify-between">
          <p className="text-xs text-text-placeholder">{t('rightsReserved')}</p>
          <button type="button" className="hidden text-xs font-semibold text-text-tertiary lg:inline" onClick={toggleLanguage}>
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, error, bare, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      <span>
        {label}
        {required ? <Required /> : null}
      </span>
      {bare ? (
        children
      ) : (
        <span className={`rounded-lg border bg-white px-3.5 shadow-xs focus-within:border-[#717bbc] ${error ? 'border-red-400' : 'border-border'}`}>
          {children}
        </span>
      )}
      {error ? <span className="text-xs font-medium text-[#b42318]">{error}</span> : null}
    </label>
  )
}

function Required() {
  return <span className="text-[#b42318]"> *</span>
}

function DocumentRow({ label, value, onChange, placeholder, error, t }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-secondary">
        {label}
        <Required />
      </span>
      <span className="flex">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 min-w-0 flex-1 rounded-s-lg border border-e-0 bg-white px-3.5 text-sm text-text-primary outline-none placeholder:text-text-placeholder focus:border-[#717bbc] ${
            error ? 'border-red-400' : 'border-border'
          }`}
        />
        <button
          type="button"
          className="h-11 shrink-0 rounded-e-lg border border-[#8fbfa4] bg-white px-4 text-sm font-semibold text-brand"
        >
          {t('regVerify')}
        </button>
      </span>
      {error ? <span className="text-xs font-medium text-[#b42318]">{error}</span> : null}
    </label>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="rtl:scale-x-[-1]">
      <path d="M15.833 10H4.167m0 0L10 4.167M4.167 10 10 15.833" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TypeField({ label, value, onChange, options, t, placeholder, error }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => setOpen(false), open)

  return (
    <Field label={label} required error={error}>
      <span className="relative flex h-11 items-center" ref={menuRef}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`flex h-11 w-full items-center justify-between gap-2 bg-transparent text-start text-sm outline-none ${
            value ? 'font-medium text-text-primary' : 'font-normal text-text-placeholder'
          }`}
        >
          <span className="min-w-0 truncate">{value ? t(value) : placeholder}</span>
          <Chevron className="shrink-0 text-text-placeholder" />
        </button>
        {open ? (
          <ul
            role="listbox"
            aria-label={label}
            className="absolute -start-3.5 top-[calc(100%+5px)] z-30 w-[calc(100%+28px)] overflow-hidden rounded-md border border-[#d0d5dd] bg-white py-1 shadow-lg"
          >
            {options.map((key) => {
              const selected = value === key
              return (
                <li key={key} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(key)
                      setOpen(false)
                    }}
                    className={`flex w-full px-3 py-1.5 text-start text-sm ${
                      selected ? 'bg-[#0078d4] font-medium text-white' : 'text-text-primary hover:bg-[#e8f1fb]'
                    }`}
                  >
                    {t(key)}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </span>
    </Field>
  )
}

function Chevron({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="rtl:-scale-x-100">
      <path d="M4 10H16M12 6L16 10L12 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InfoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 10.667V8M8 5.333h.007M14.667 8A6.667 6.667 0 1 1 1.333 8a6.667 6.667 0 0 1 13.334 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Eye({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 3l14 14M8.1 8.2A2.5 2.5 0 0 0 11.8 12M8.6 4.7A8.2 8.2 0 0 1 10 4.5c3.7 0 6.5 2.8 7.8 5.5a12 12 0 0 1-2.2 3.2M6.1 6.3C4.4 7.4 3.2 9 2.2 10c1.3 2.7 4.1 5.5 7.8 5.5 1 0 1.9-.2 2.8-.6" stroke="#717680" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.2 10C3.5 7.3 6.3 4.5 10 4.5s6.5 2.8 7.8 5.5c-1.3 2.7-4.1 5.5-7.8 5.5S3.5 12.7 2.2 10Z" stroke="#717680" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="#717680" strokeWidth="1.5" />
    </svg>
  )
}

function TypeIcon({ name }) {
  if (name === 'building') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 14h12M3.5 14V4.2c0-.5.2-.7.5-.9.2-.1.5-.2.9-.2h2.2c.4 0 .7.1.9.2.3.2.5.4.5.9V14M9 14V7.2c0-.4.2-.6.4-.8.2-.1.4-.2.8-.2h1.5c.4 0 .6.1.8.2.2.2.4.4.4.8V14M5 6h1.5M5 8.5h1.5M5 11h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'user') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.5 13.2c1.2-1.3 2.9-2.1 5.5-2.1s4.3.8 5.5 2.1M11 5.2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5.3 4.7V3.6c0-.5.2-.8.5-1 .2-.1.5-.2.8-.2h2.8c.3 0 .6.1.8.2.3.2.5.5.5 1v1.1M2.7 13.5h10.6c.5 0 .8-.1 1-.3.2-.2.4-.4.4-.8V6.6c0-.4-.2-.6-.4-.8-.2-.2-.5-.3-1-.3H2.7c-.5 0-.8.1-1 .3-.2.2-.4.4-.4.8v5.8c0 .4.2.6.4.8.2.2.5.3 1 .3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
