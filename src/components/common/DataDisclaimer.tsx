import { ShieldAlert } from 'lucide-react'
import { DEMONSTRATION_DISCLAIMER, DEMONSTRATION_LABEL } from '../../data'

export function DataDisclaimer() {
  return (
    <div className="sd-disclaimer">
      <span className="sd-disclaimer-title">
        <ShieldAlert size={13} strokeWidth={2.2} />
        {DEMONSTRATION_LABEL}
      </span>
      <p className="sd-disclaimer-body">{DEMONSTRATION_DISCLAIMER}</p>
    </div>
  )
}