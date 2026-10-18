import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { icons } from '../../assets'
import { PREVIOUS_PASSWORD } from '../../constants/profile'
import { useApp } from '../../hooks/useApp'

const GUESSABLE = ['password', 'mawani', 'loki', 'bright', '123456', 'qwerty']

function ruleState(password) {
  const lower = password.toLowerCase()
  return {
    length: password.length >= 8,
    special: /[^A-Za-z0-9]/.test(password),
    letters: /[a-z]/.test(password) && /[A-Z]/.test(password),
    guessable: password.length > 0 && !GUESSABLE.some((word) => lower.includes(word)),
    unique: password.length > 0 && password !== PREVIOUS_PASSWORD,
  }
}

const RULES = [
  ['length', 'pwdLength'],
  ['special', 'pwdSpecial'],
  ['letters', 'pwdLetters'],
  ['guessable', 'pwdGuessable'],
  ['unique', 'pwdUnique'],
]

export default function SetPasswordPage() {
  const { signedIn, t, leaveApp } = useApp()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [succeeded, setSucceeded] = useState(false)
  const rules = useMemo(() => ruleState(password), [password])
  const ready = Object.values(rules).every(Boolean) && password === confirm && confirm.length > 0
  const mismatch = confirm.length > 0 && password !== confirm

  if (!signedIn) return <Navigate to="/login" replace />

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-neutral px-4 py-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-[768px] -translate-x-1/2"
        style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 68%)' }}
      >
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute inset-0" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute inset-0" />
      </div>
      <div className="relative w-full max-w-[420px]">
        {succeeded ? (
          <div className="mx-auto flex max-w-[360px] flex-col items-center text-center">
            <span className="mb-6 flex size-14 items-center justify-center rounded-full border border-border bg-white shadow-xs">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M7 14.5 12 19.5 21 9.5" stroke="#414651" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="text-display-sm font-semibold tracking-[-0.02em] text-text-primary">{t('pwdSuccessTitle')}</h1>
            <p className="mt-2 text-md text-text-tertiary">{t('pwdSuccessBody')}</p>
            <button
              type="button"
              className="mt-8 h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white"
              onClick={() => {
                leaveApp()
                navigate('/login')
              }}
            >
              {t('signIn')}
            </button>
          </div>
        ) : (
          <>
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-teal-100">
          <img src={icons.lock} alt="" width={28} height={28} />
        </span>
        <h1 className="text-center text-display-sm font-semibold tracking-[-0.02em] text-text-primary">{t('pwdTitle')}</h1>
        <p className="mt-2 text-center text-md text-text-tertiary">{t('pwdBody')}</p>

        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (ready) setSucceeded(true)
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
            {t('password')}
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm shadow-xs outline-none focus:border-[#717bbc]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
            {t('confirmPassword')}
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm shadow-xs outline-none focus:border-[#717bbc]"
            />
            {mismatch ? <span className="font-normal text-[#d92d20]">{t('passwordMismatch')}</span> : null}
          </label>

          <ul className="flex flex-col gap-2">
            {RULES.map(([key, label]) => (
              <li key={key} className="flex items-center gap-2 text-sm text-text-tertiary">
                <img src={rules[key] ? icons.checkOn : icons.checkOff} alt="" width={20} height={20} />
                {t(label)}
              </li>
            ))}
          </ul>

          <button
            type="submit"
            disabled={!ready}
            className={`mt-2 h-11 rounded-lg text-sm font-semibold ${
              ready ? 'bg-brand text-white' : 'cursor-not-allowed bg-[#f2f4f7] text-text-placeholder'
            }`}
          >
            {t('pwdReset')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="mx-auto mt-8 inline-flex items-center gap-2 text-sm font-semibold text-text-tertiary rtl:flex-row-reverse"
        >
          <img src={icons.arrowLeft} alt="" width={20} height={20} />
          {t('pwdBack')}
        </button>
          </>
        )}
      </div>
    </div>
  )
}
