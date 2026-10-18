import { Link } from 'react-router-dom'
import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

const tones = {
  success: 'bg-brand-50',
  warning: 'bg-orange-50',
}

export default function ActivityFeedItem({ item }) {
  const { t } = useApp()

  return (
    <Link
      to={`/${item.service}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:bg-bg-neutral"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${tones[item.tone]}`}>
        <img src={icons[item.icon]} alt="" width={20} height={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-primary">
          <span className="text-text-placeholder">{item.ref}</span> {t(item.titleKey)}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
          <span className="truncate">{t(item.detailKey)}</span>
          <img src={icons.dotSm} alt="" width={4} height={4} />
          <span className="shrink-0">{t(item.dueKey)}</span>
        </span>
      </span>
      <img src={icons.chevronRight} alt="" width={16} height={16} className="rtl:rotate-180" />
    </Link>
  )
}
