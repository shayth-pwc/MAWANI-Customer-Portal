import { Link } from 'react-router-dom'
import { icons } from '../../assets'
import { STATUS_STYLES } from '../../constants/dashboard'
import { useApp } from '../../hooks/useApp'
import Badge from '../ui/Badge'

export default function ActivityRow({ activity }) {
  const { t } = useApp()

  return (
    <Link
      to={`/${activity.service}`}
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border px-4 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-3 sm:px-6 ${activity.highlighted ? 'bg-bg-active' : 'bg-white hover:bg-bg-neutral'}`}
    >
      <span className="min-w-0 py-1">
        <span className="block truncate text-sm font-medium text-text-primary">
          <span className="font-semibold text-text-placeholder">{activity.ref}</span> {t(activity.titleKey)}
        </span>
        <span className="block truncate text-xs text-text-tertiary">{t(activity.detailKey)}</span>
      </span>
      <span className="flex flex-col items-end gap-1 sm:contents">
        <span className="text-xs text-text-tertiary sm:text-sm">{t(activity.timeKey)}</span>
        <Badge className={STATUS_STYLES[activity.status]}>{t(activity.status)}</Badge>
      </span>
      <img src={icons.chevronRight} alt="" width={16} height={16} className="rtl:rotate-180" />
    </Link>
  )
}
