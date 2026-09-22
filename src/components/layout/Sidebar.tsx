import { Compass } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { DataDisclaimer } from '../common/DataDisclaimer'
import { cn } from '../../utils/cn'
import { NAV_ITEMS, PRODUCT_NAME, PRODUCT_SUBTITLE } from './navigation'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside
      className={cn('sd-sidebar', open && 'sd-sidebar--open')}
      aria-label="Primary navigation"
    >
      <div className="sd-brand">
        <span className="sd-brand-mark">
          <Compass size={22} strokeWidth={2} />
        </span>
        <div>
          <div className="sd-brand-name">{PRODUCT_NAME}</div>
          <div className="sd-brand-sub">{PRODUCT_SUBTITLE}</div>
        </div>
      </div>

      <nav className="sd-nav">
        <div className="sd-nav-label">Platform</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn('sd-nav-link', isActive && 'is-active')
            }
          >
            <item.icon size={17} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sd-sidebar-footer">
        <DataDisclaimer />
        <span className="sd-version">v0.4.0 — rail model + diversion engine connected</span>
      </div>
    </aside>
  )
}