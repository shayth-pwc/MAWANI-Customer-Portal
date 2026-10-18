import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

export default function NotificationItem({ item }) {
  const { t } = useApp()

  return (
    <article
      className={`flex items-center gap-3 border-b border-border px-4 py-3 ${item.unread ? 'bg-teal-25' : 'bg-white'}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50">
        <img src={icons.checkCircle} alt="" width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{t(item.titleKey)}</p>
        <p className="truncate text-xs text-text-tertiary">{t(item.detailKey)}</p>
      </div>
      <time className="text-xs text-text-placeholder">{t(item.timeKey)}</time>
    </article>
  )
}
