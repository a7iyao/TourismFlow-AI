import { Menu } from 'lucide-react'
import { PrototypeBadge } from '../common/PrototypeBadge'
import { PRODUCT_NAME } from './navigation'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sd-header">
      <button
        className="sd-menu-button"
        type="button"
        aria-label="Toggle navigation menu"
        onClick={onMenuClick}
      >
        <Menu size={18} />
      </button>
      <div className="sd-header-tagline">
        <strong>{PRODUCT_NAME}</strong>
        <span>
          Redirect tourism demand. Discover less crowded destinations.
        </span>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <PrototypeBadge />
      </div>
    </header>
  )
}