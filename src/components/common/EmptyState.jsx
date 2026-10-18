import { Link } from 'react-router-dom'
import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

const actionIcons = {
  invoice: 'coinsLine',
  license: 'certificateLine',
  permit: 'folderLine',
}

export default function EmptyState({ title, description, actions = [] }) {
  const { t } = useApp()

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="text-md font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-text-tertiary">{description}</p>
      {actions.length ? (
        <div className="mt-8 flex w-full max-w-3xl flex-col gap-4 sm:flex-row rtl:flex-row-reverse">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-neutral text-sm font-semibold text-brand shadow-xs hover:bg-brand-25"
            >
              <img src={icons[actionIcons[action.icon]]} alt="" width={24} height={24} />
              {t(action.labelKey)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
