import type { LucideIcon } from 'lucide-react'

interface LabelValueProps {
  icon: LucideIcon
  label: string
  value: string
}

export function LabelValue({ icon: Icon, label, value }: LabelValueProps) {
  return (
    <div className="sd-lv">
      <Icon size={14} strokeWidth={2.2} />
      <span className="sd-lv-label">{label}</span>
      <span className="sd-lv-value">{value}</span>
    </div>
  )
}