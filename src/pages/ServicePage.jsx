import ActivityRow from '../components/common/ActivityRow'
import EmptyState from '../components/common/EmptyState'
import PageContainer from '../components/layout/PageContainer'
import Card from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { SERVICES } from '../constants/navigation'
import { useApp } from '../hooks/useApp'
import { useDashboard } from '../hooks/useDashboard'

export default function ServicePage({ service }) {
  const { t } = useApp()
  const { data, loading } = useDashboard()
  const meta = SERVICES[service]

  if (loading || !data) {
    return (
      <PageContainer>
        <Loader label={t('loading')} />
      </PageContainer>
    )
  }

  const rows = data.activities.filter((item) => item.service === service)
  const metric = data.metrics.find((item) => item.id === service)
  const count = metric?.value ?? 0

  return (
    <PageContainer>
      <Card>
        {rows.length ? (
          rows.map((activity) => <ActivityRow key={activity.id} activity={activity} />)
        ) : (
          <EmptyState
            title={count ? t(meta.labelKey) : t(meta.emptyKey)}
            description={count ? t('recordSummary', { count }) : t('emptyBody')}
          />
        )}
      </Card>
    </PageContainer>
  )
}
