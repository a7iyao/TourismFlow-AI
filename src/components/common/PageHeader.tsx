import { PrototypeBadge } from './PrototypeBadge'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="sd-page-header">
      <div>
        <div className="sd-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <PrototypeBadge />
    </div>
  )
}