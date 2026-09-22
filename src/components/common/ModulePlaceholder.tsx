import type { LucideIcon } from 'lucide-react'
import { CircleCheck, Construction } from 'lucide-react'

interface ModulePlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
  status: string
  planned: string[]
}

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  status,
  planned,
}: ModulePlaceholderProps) {
  return (
    <div className="sd-module">
      <div className="sd-module-icon">
        <Icon size={24} strokeWidth={2} />
      </div>
      <h3>{title}</h3>
      <p className="sd-module-desc">{description}</p>
      <span className="sd-module-status">
        <Construction size={12} />
        {status}
      </span>
      <div className="sd-module-planned">
        {planned.map((item) => (
          <span className="sd-chip" key={item}>
            <CircleCheck size={13} />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}