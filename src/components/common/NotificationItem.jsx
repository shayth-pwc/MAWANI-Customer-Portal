import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

export default function NotificationItem({ item, mobile = false }) {
  const { t } = useApp()
  const warning = item.tone === 'warning'

  return (
    <article
      className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
        mobile ? 'bg-white' : item.unread ? 'bg-teal-25' : 'bg-white'
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${warning ? 'bg-orange-50' : 'bg-brand-50'}`}>
        <img src={warning ? icons.flagViolation : icons.checkCircle} alt="" width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{t(item.titleKey)}</p>
        <p className="truncate text-xs text-text-tertiary">{t(item.detailKey)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <time className="text-xs text-text-placeholder">{t(item.timeKey)}</time>
        {item.unread ? <span className="size-2 rounded-full bg-brand" aria-hidden="true" /> : null}
      </div>
    </article>
  )
}
