import { Database } from 'lucide-react'
import { DEMONSTRATION_DISCLAIMER, DEMONSTRATION_LABEL } from '../../data'

export function PrototypeBadge() {
  return (
    <span className="sd-badge" title={DEMONSTRATION_DISCLAIMER}>
      <Database size={12} strokeWidth={2.4} />
      {DEMONSTRATION_LABEL}
    </span>
  )
}