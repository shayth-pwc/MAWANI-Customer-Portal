import { useNavigate } from 'react-router-dom'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useApp } from '../hooks/useApp'

export default function NotFoundPage() {
  const { t } = useApp()
  const navigate = useNavigate()

  return (
    <PageContainer>
      <Card className="p-10 text-center">
        <h2 className="text-lg font-semibold">{t('notFoundTitle')}</h2>
        <p className="mt-2 text-sm text-text-tertiary">{t('notFoundBody')}</p>
        <Button variant="tertiary-color" className="mt-6" onClick={() => navigate('/')}>
          {t('goHome')}
        </Button>
      </Card>
    </PageContainer>
  )
}
