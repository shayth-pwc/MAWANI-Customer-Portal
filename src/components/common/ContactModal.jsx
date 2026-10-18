import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { submitSupportMessage } from '../../services'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'

export default function ContactModal() {
  const { contactOpen, setContactOpen, t, user } = useApp()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    setContactOpen(false)
    setSent(false)
    setError('')
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await submitSupportMessage({ email: user.email, subject, message })
      setSent(true)
      setSubject('')
      setMessage('')
    } catch {
      setError(t('feedbackError'))
    }
  }

  return (
    <Modal open={contactOpen} title={t('contactTitle')} onClose={close}>
      {sent ? (
        <p className="text-sm text-text-tertiary">{t('messageSent')}</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Input label={t('email')} type="email" value={user.email} readOnly />
          <Input
            label={t('subject')}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t('subjectPlaceholder')}
            required
          />
          <Textarea
            compact
            label={t('message')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('messagePlaceholder')}
            required
          />
          {error ? <p className="text-sm text-indigo-700">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={close}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('sendMessage')}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
