import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useApp } from '../hooks/useApp'
import { submitSupportMessage } from '../services'

export default function SupportPage() {
  const { t, user, setContactOpen } = useApp()
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    try {
      await submitSupportMessage({ email: user.email, subject, message })
    } catch {
      return
    }
    setSent(true)
  }

  return (
    <PageContainer>
      <Card className="p-6">
        {sent ? (
          <p className="text-sm text-text-tertiary">{t('messageSent')}</p>
        ) : (
          <form className="grid max-w-xl gap-4" onSubmit={onSubmit}>
            <Input label={t('email')} type="email" value={user.email} readOnly />
            <Input label={t('subject')} value={subject} onChange={(event) => setSubject(event.target.value)} required />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
              {t('message')}
              <textarea
                required
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-32 rounded-lg border border-border px-3 py-3 text-sm font-normal shadow-xs outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">{t('sendMessage')}</Button>
              <Button variant="secondary" onClick={() => setContactOpen(true)}>
                {t('contactSupport')}
              </Button>
              <Button variant="tertiary-color" onClick={() => navigate('/feedback')}>
                {t('hearFeedback')}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </PageContainer>
  )
}
