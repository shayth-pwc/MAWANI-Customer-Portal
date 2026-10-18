import { useMemo, useState } from 'react'
import { icons, images } from '../assets'
import { SURVEY_RATINGS, SURVEYS } from '../constants/surveys'
import { useApp } from '../hooks/useApp'

const TABS = [
  { id: 'all', labelKey: 'surveyViewAll' },
  { id: 'Licenses', labelKey: 'licenses' },
  { id: 'Permits', labelKey: 'permits' },
  { id: 'Objections', labelKey: 'surveyObjections' },
]

const SERVICE_KEYS = {
  Objections: 'surveyObjections',
  Licenses: 'licenses',
  Permits: 'permits',
}

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

function formatStamp(iso, language) {
  const [datePart, timePart] = iso.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':')
  const hourNumber = Number(hour)
  const hour12 = hourNumber % 12 || 12
  if (language === 'ar') {
    const suffix = hourNumber >= 12 ? 'مساءً' : 'صباحًا'
    return `${day} ${AR_MONTHS[month - 1]} ${year}، الساعة ${hour12}:${minute} ${suffix}`
  }
  return `${EN_MONTHS[month - 1]} ${day}, ${year} at ${hour12}:${minute}:${second} ${hourNumber >= 12 ? 'PM' : 'AM'}`
}

export default function SurveysPage() {
  const { t, language } = useApp()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return SURVEYS.filter((survey) => {
      if (tab !== 'all' && survey.service !== tab) return false
      if (!needle) return true
      const haystack = [
        survey.name,
        survey.email,
        survey.phone,
        survey.location,
        survey.requestNo,
        survey.licensePermit,
        t(SERVICE_KEYS[survey.service]),
        t(survey.requestKey),
        t(survey.systemKey),
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, tab, t])

  function exportRows() {
    const headers = [t('surveyType'), t('surveyRequest'), t('surveyLicensePermit'), t('surveyRequestNo'), t('surveySystem'), 'Name', 'Email']
    const lines = [
      headers,
      ...rows.map((survey) => [
        t(SERVICE_KEYS[survey.service]),
        t(survey.requestKey),
        t('surveyShipSupplier'),
        survey.requestNo,
        t(survey.systemKey),
        survey.name,
        survey.email,
      ]),
    ]
    const url = URL.createObjectURL(new Blob([lines.map((cells) => cells.map((cell) => `"${cell}"`).join(',')).join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'surveys.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="px-4 pb-10 pt-4 md:px-8">

      <section className="rounded-2xl border border-border bg-white p-4 shadow-xs md:p-5">
        <div className="flex flex-col gap-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5 overflow-x-auto">
            {TABS.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${active ? 'border-brand text-brand' : 'border-transparent text-text-tertiary'}`}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 pb-3 lg:pb-0">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3">
              <img src={icons.search} alt="" width={20} height={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('invSearch')}
                aria-label={t('invSearch')}
                className="w-36 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder"
              />
            </label>
            <button
              type="button"
              dir="ltr"
              onClick={exportRows}
              className={language === 'ar'
                ? 'inline-flex h-10 items-center gap-2 rounded-lg border border-brand bg-white px-3.5 text-sm font-semibold text-brand'
                : 'inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white'}
            >
              {language === 'ar' ? <img src={icons.excel} alt="" width={20} height={20} /> : <DownloadIcon />}
              {t('surveyExport')}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-2 py-16 text-center text-sm text-text-tertiary">{t('surveyEmpty')}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {rows.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} language={language} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SurveyCard({ survey, language }) {
  const { t } = useApp()
  const facts = [
    [t('surveyType'), t(SERVICE_KEYS[survey.service])],
    [t('surveyRequest'), t(survey.requestKey)],
    [t('surveyLicensePermit'), survey.licensePermit === 'Ship Supplier' ? t('surveyShipSupplier') : survey.licensePermit],
    [t('surveyRequestNo'), survey.requestNo],
    [t('surveySystem'), t(survey.systemKey)],
  ]

  return (
    <article className="rounded-2xl border border-border p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 overflow-hidden rounded-full border border-black/10">
            <img src={images.avatar} alt="" width={40} height={40} className="size-10 object-cover" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{survey.name}</p>
            <p className="text-sm text-text-tertiary">{survey.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon />
                {survey.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PinIcon />
                {survey.location === 'Lebanon' ? t('surveyLebanon') : survey.location}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-text-tertiary">{formatStamp(survey.submittedAt, language)}</p>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-tertiary">
        {facts.map(([label, value], index) => (
          <span key={label} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="text-text-placeholder" aria-hidden="true">•</span> : null}
            <span>
              {label}: <span className="font-medium text-text-secondary">{value}</span>
            </span>
          </span>
        ))}
      </p>

      <div className="mt-4 rounded-xl border border-border bg-neutral px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {SURVEY_RATINGS.map((item) => (
            <div key={item.id} className="text-center">
              <p className="text-sm font-medium leading-5 text-text-secondary">{t(item.labelKey)}</p>
              <div className="mt-2 flex items-center justify-center gap-1" aria-label={`${t(item.labelKey)} ${survey.scores[item.id]}`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <img key={star} src={star <= survey.scores[item.id] ? icons.star : icons.starEmpty} alt="" width={16} height={16} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-start text-sm leading-6 text-text-tertiary">{t('surveyComment')}</p>
      </div>
    </article>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.2v7.2m0 0 2.4-2.4M8 9.4 5.6 7M3.2 12.8h9.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.2 2.4h.7c.4 0 .7.3.8.7l.4 1.6c.1.4 0 .8-.3 1.1L6.8 6.6a8.2 8.2 0 0 0 2.6 2.6l.8-1c.3-.3.7-.4 1.1-.3l1.6.4c.4.1.7.4.7.8v.7c0 2-1.8 3.4-3.7 2.8A10.2 10.2 0 0 1 3.4 6.1c-.6-1.9.8-3.7 2.8-3.7Z" stroke="#717680" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 8.7a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" stroke="#717680" strokeWidth="1.2" />
      <path d="M8 14s4.5-3.4 4.5-6.8A4.5 4.5 0 0 0 3.5 7.2C3.5 10.6 8 14 8 14Z" stroke="#717680" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
