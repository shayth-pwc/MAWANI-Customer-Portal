import { useState } from 'react'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import { useApp } from '../hooks/useApp'

export default function SettingsPage() {
  const { t, language, setLanguage } = useApp()
  const [saved, setSaved] = useState(false)

  return (
    <PageContainer>
      <Card className="max-w-xl p-6">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSaved(true)
          }}
        >
          <Select label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">{t('english')}</option>
            <option value="ar">{t('arabic')}</option>
          </Select>
          <Button type="submit" className="w-fit">
            {t('save')}
          </Button>
          {saved ? <p className="text-sm text-brand">{t('saved')}</p> : null}
        </form>
      </Card>
    </PageContainer>
  )
}
