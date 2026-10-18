import { Link } from 'react-router-dom'
import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

export default function MetricCard({ metric, value }) {
  const { t } = useApp()

  return (
    <Link
      to={metric.to}
      className="overflow-hidden rounded-3xl border border-border bg-metric shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative flex h-[104px] items-center justify-center overflow-hidden">
        <img
          src={metric.flip ? icons.patternAlt : icons.pattern}
          alt=""
          width={209}
          height={50}
          className={`pointer-events-none absolute bottom-0 start-0 h-[50px] w-[209px] max-w-none ${metric.flip ? 'origin-center rotate-180 -scale-y-100' : ''}`}
        />
        <IconImage name={metric.icon} />
      </div>
      <div className="bg-white px-5 pb-4 pt-3">
        <p className="text-sm font-medium text-text-tertiary">{t(metric.labelKey)}</p>
        <p className="text-display-sm font-semibold text-text-primary">{value}</p>
      </div>
    </Link>
  )
}

function IconImage({ name }) {
  return <img src={icons[name]} alt="" width={64} height={64} style={{ width: 64, height: 64 }} />
}
