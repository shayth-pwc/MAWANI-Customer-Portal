import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { images } from '../assets'
import Button from '../components/ui/Button'
import { useApp } from '../hooks/useApp'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthPage({ mode = 'login' }) {
  const { t, language, toggleLanguage, signedIn, boot, enterApp } = useApp()
  const navigate = useNavigate()
  const signup = mode === 'signup'
  const forgot = mode === 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (signedIn && boot === 'idle') return <Navigate to="/" replace />

  const validate = () => {
    const next = {}
    if (signup && name.trim().length < 2) next.name = t('nameRequired')
    if (!EMAIL.test(email.trim())) next.email = t('invalidEmail')
    if (!forgot && password.length < 8) next.password = t('passwordRule')
    if (signup && password !== confirm) next.confirm = t('passwordMismatch')
    return next
  }

  const openAccount = async () => {
    setSubmitting(true)
    const pending = enterApp()
    navigate('/', { replace: true })
    await pending
  }

  const submit = async (event) => {
    event.preventDefault()
    if (mode === 'login' && (!EMAIL.test(email.trim()) || password.length < 8)) {
      setFormError(true)
      setErrors({})
      return
    }
    setFormError(false)
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length || submitting) return
    if (forgot) {
      setResetSent(true)
      return
    }
    await openAccount()
  }

  const title = forgot ? 'forgotTitle' : signup ? 'signUpTitle' : 'signInTitle'
  const body = forgot ? 'forgotBody' : signup ? 'signUpBody' : 'signInBody'

  return (
    <div className="min-h-screen bg-[#eef1f4] p-3 sm:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1440px] bg-white sm:min-h-[calc(100vh-2.5rem)]">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-s-[28px] bg-gradient-to-b from-brand-25 to-white px-6 py-7 sm:px-10 lg:px-14">
          <img src={images.logo} alt="Mawani" className="h-10 w-auto max-w-[180px] self-start object-contain object-start" />

          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-center py-10">
              <h1 className="text-display-sm font-semibold tracking-[-0.02em] text-text-primary">{t(title)}</h1>
              <p className="mt-2 text-md text-text-tertiary">{t(body)}</p>

              <form className="mt-8 flex flex-col gap-5" onSubmit={submit} noValidate>
                {formError ? <p className="text-center text-sm font-medium text-[#d92d20]">{t('loginError')}</p> : null}
                {signup ? (
                  <Field label={t('fullName')} error={errors.name}>
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder={t('namePlaceholder')}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                    />
                  </Field>
                ) : null}

                <Field label={t('email')} error={formError ? ' ' : errors.email} hideMessage={formError}>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setFormError(false)
                    }}
                    className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                  />
                </Field>

                {forgot ? null : (
                  <Field label={t('password')} error={formError ? ' ' : errors.password} hideMessage={formError}>
                    <input
                      type="password"
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setFormError(false)
                      }}
                      className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                    />
                  </Field>
                )}

                {signup ? (
                  <Field label={t('confirmPassword')} error={errors.confirm}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('confirmPlaceholder')}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
                    />
                  </Field>
                ) : null}

                {mode === 'login' ? (
                  <Link to="/forgot-password" className="-mt-2 self-start text-sm font-semibold text-brand">
                    {t('forgotPassword')}
                  </Link>
                ) : null}

                {resetSent ? <p className="text-sm text-text-secondary">{t('resetSent')}</p> : null}

                {mode === 'login' && (!email.trim() || !password) ? (
                  <button
                    type="submit"
                    disabled
                    className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-[#f2f4f7] text-sm font-semibold text-[#98a2b3]"
                  >
                    {t('signIn')}
                    <Arrow />
                  </button>
                ) : (
                  <Button type="submit" className="h-11 w-full" disabled={submitting || resetSent}>
                    {t(forgot ? 'sendReset' : signup ? 'createAccount' : 'signIn')}
                    <Arrow />
                  </Button>
                )}
              </form>

              {mode === 'login' ? (
                <>
                  <div className="my-6 h-px bg-border" />
                  <button
                    type="button"
                    className="mx-auto flex items-center gap-2 text-sm font-semibold text-brand"
                    onClick={openAccount}
                    disabled={submitting}
                  >
                    {t('nafathSignIn')}
                    <InfoMark />
                  </button>
                  <p className="mt-5 text-center text-sm text-text-tertiary">
                    {t('needAccount')}{' '}
                    <Link to="/signup" className="font-semibold text-brand">
                      {t('register')}
                    </Link>
                  </p>
                </>
              ) : (
                <p className="mt-6 text-sm text-text-tertiary">
                  {forgot ? null : `${t('haveAccount')} `}
                  <Link to="/login" className="font-semibold text-brand">
                    {t(forgot ? 'backToSignIn' : 'signIn')}
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-text-placeholder">{t('rightsReserved')}</p>
            <button type="button" className="text-xs font-semibold text-text-tertiary" onClick={toggleLanguage}>
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </section>

        <aside className="relative hidden w-[46%] shrink-0 lg:block">
          <div className="relative h-full min-h-[640px] overflow-hidden rounded-e-none rounded-s-[28px]">
            <img src={images.loginPort} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <p className="max-w-[280px] text-[28px] font-semibold leading-[36px]">{t('loginHero')}</p>
              <span className="mt-4 block h-1 w-10 rounded-full bg-brand" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, error, hideMessage, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      {label}
      <span className={`rounded-lg border bg-white px-3.5 shadow-xs focus-within:border-brand ${error ? 'border-[#f04438]' : 'border-border'}`}>
        {children}
      </span>
      {error && !hideMessage ? <span className="text-xs font-medium text-[#b42318]">{error}</span> : null}
    </label>
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
