import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

interface PanelProps {
  title?: string
  description?: string
  icon?: LucideIcon
  note?: string
  children: ReactNode
  className?: string
}

export function Panel({
  title,
  description,
  icon: Icon,
  note,
  children,
  className,
}: PanelProps) {
  return (
    <section className={cn('sd-panel', className)}>
      {title ? (
        <div className="sd-panel-head">
          <h3 className="sd-panel-title">
            {Icon ? <Icon size={16} strokeWidth={2.2} /> : null}
            {title}
          </h3>
          {description ? <p className="sd-panel-desc">{description}</p> : null}
        </div>
      ) : null}
      {children}
      {note ? <p className="sd-panel-note">{note}</p> : null}
    </section>
  )
}