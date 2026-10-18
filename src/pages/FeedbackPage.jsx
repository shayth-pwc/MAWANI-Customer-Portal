import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import StarRating from '../components/ui/StarRating'
import Textarea from '../components/ui/Textarea'
import { FEEDBACK_QUESTIONS } from '../constants/dashboard'
import { useApp } from '../hooks/useApp'
import { submitFeedback } from '../services'

export default function FeedbackPage() {
  const { t } = useApp()
  const navigate = useNavigate()
  const [ratings, setRatings] = useState(() =>
    Object.fromEntries(FEEDBACK_QUESTIONS.map((question) => [question.id, question.value])),
  )
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (Object.values(ratings).some((value) => value < 1)) {
      setError(t('feedbackRequired'))
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await submitFeedback({ ratings, comments })
      navigate('/feedback/success')
    } catch {
      setError(t('feedbackError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-16 pt-16 md:px-16 md:pt-24">
      <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center">
        <span className="flex size-14 items-center justify-center rounded-[14px] bg-teal-100">
          <Icon name="messageSmile" size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-display-xs font-semibold text-text-primary">{t('shareFeedback')}</h1>
          <p className="text-sm text-text-tertiary">{t('rateExperience')}</p>
        </div>
        <Button type="submit" disabled={submitting}>
          {t('submitFeedback')}
          <img src={icons.send} alt="" width={20} height={20} />
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {FEEDBACK_QUESTIONS.map((question) => (
          <section
            key={question.id}
            className="flex flex-col gap-4 rounded-2xl bg-bg-neutral px-6 py-8 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold text-text-primary">{t(question.titleKey)}</h2>
              <p className="text-md text-text-tertiary">{t(question.hintKey)}</p>
            </div>
            <StarRating
              value={ratings[question.id]}
              label={t(question.titleKey)}
              onChange={(value) => setRatings((current) => ({ ...current, [question.id]: value }))}
            />
          </section>
        ))}
        <section className="rounded-2xl bg-bg-neutral px-6 pb-6 pt-8">
          <Textarea
            label={t('comments')}
            hint={t('commentsHint')}
            placeholder={t('commentsPlaceholder')}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
        </section>
        {error ? (
          <p className="text-sm font-medium text-indigo-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  )
}
