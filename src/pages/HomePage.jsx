import { useNavigate } from 'react-router-dom'
import ActivityFeedItem from '../components/common/ActivityFeedItem'
import ActivityRow from '../components/common/ActivityRow'
import EmptyState from '../components/common/EmptyState'
import MetricCard from '../components/common/MetricCard'
import PageContainer from '../components/layout/PageContainer'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Icon from '../components/ui/Icon'
import Loader from '../components/ui/Loader'
import { icons } from '../assets'
import { useApp } from '../hooks/useApp'
import { useDashboard } from '../hooks/useDashboard'

const emptyActions = [
  { to: '/invoices', icon: 'invoice', labelKey: 'createInvoice' },
  { to: '/licenses', icon: 'license', labelKey: 'requestLicense' },
  { to: '/permits', icon: 'permit', labelKey: 'requestPermit' },
]

export default function HomePage({ empty = false }) {
  const { t, language } = useApp()
  const navigate = useNavigate()
  const { data, loading } = useDashboard()

  if (loading || !data) {
    return (
      <PageContainer alignStart className="pt-4">
        <Loader label={t('loading')} />
      </PageContainer>
    )
  }

  const metrics = data.metrics.map((metric) => ({ ...metric, value: empty ? 0 : metric.value }))
  const glance = empty && language === 'ar' ? [...metrics].reverse() : metrics
  const activities = empty ? [] : data.activities
  const upcoming = empty ? [] : data.upcoming

  return (
    <PageContainer alignStart className="pt-4">
      <section>
        <h2 className="mb-4 text-lg font-semibold leading-7 text-text-secondary">{t('glance')}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 xl:gap-6">
          {glance.map((metric) => (
            <MetricCard key={metric.id} metric={metric} value={metric.value} />
          ))}
        </div>
      </section>

      {activities.length === 0 ? (
        <Card>
          <div className="px-6 pt-5">
            <h2 className="text-lg font-semibold text-text-primary">{t('recentActivities')}</h2>
          </div>
          <EmptyState title={t('emptyTitle')} description={t('emptyBody')} actions={emptyActions} />
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card className="relative">
            <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('recentActivities')}</h2>
                <p className="text-sm text-text-tertiary">{t('latestUpdates')}</p>
              </div>
              <Button variant="secondary" className="shrink-0 px-2.5 sm:px-3.5" onClick={() => navigate('/activities')}>
                <Icon name="grid" size={20} className="hidden sm:inline" />
                <span className="whitespace-nowrap text-xs sm:text-sm">{t('allActivities')}</span>
              </Button>
            </div>
            <div className="relative max-h-[416px] overflow-hidden">
              {activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
            </div>
          </Card>
          <Card>
            <div className="px-6 pb-2 pt-5">
              <h2 className="text-lg font-semibold text-text-primary">{t('upcoming')}</h2>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-text-primary">
                  <img src={icons.dot} alt="" width={8} height={8} />
                  {t('next30')}
                </span>
                <span className="text-sm text-text-tertiary">{t('updated')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-6">
              {upcoming.map((item) => (
                <ActivityFeedItem key={item.id} item={item} />
              ))}
            </div>
          </Card>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-text-placeholder lg:hidden">{t('rightsReserved')}</p>
    </PageContainer>
  )
}
