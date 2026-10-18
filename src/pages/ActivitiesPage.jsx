import ActivityFeedItem from '../components/common/ActivityFeedItem'
import ActivityRow from '../components/common/ActivityRow'
import PageContainer from '../components/layout/PageContainer'
import Card from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { useApp } from '../hooks/useApp'
import { useDashboard } from '../hooks/useDashboard'

export default function ActivitiesPage() {
  const { t } = useApp()
  const { data, loading } = useDashboard()

  if (loading || !data) {
    return (
      <PageContainer>
        <Loader label={t('loading')} />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Card>
        {data.activities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))}
      </Card>
      <Card>
        <div className="flex flex-col gap-4 p-6">
          {data.upcoming.map((item) => (
            <ActivityFeedItem key={item.id} item={item} />
          ))}
        </div>
      </Card>
    </PageContainer>
  )
}
