import type { LucideIcon } from 'lucide-react'
import { Clock } from 'lucide-react'
import type { KpiCardData } from '../../types'
import { cn } from '../../utils/cn'

interface KpiCardProps {
  data: KpiCardData
  icon: LucideIcon
}

export function KpiCard({ data, icon: Icon }: KpiCardProps) {
  const toneClass = `sd-kpi--${data.tone}`

  return (
    <article className={cn('sd-kpi', toneClass)}>
      <div className="sd-kpi-top">
        <span className="sd-kpi-label">{data.label}</span>
        <span className="sd-kpi-icon">
          <Icon size={17} strokeWidth={2.1} />
        </span>
      </div>
      <div className="sd-kpi-value">{data.value}</div>
      <p className="sd-kpi-caption">{data.caption}</p>
      {data.pending ? (
        <span className="sd-kpi-pending">
          <Clock size={11} />
          Awaiting dataset
        </span>
      ) : null}
    </article>
  )
}