import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  const showSidebar = isMobile && sidebarOpen

  return (
    <div className="sd-shell">
      <Sidebar open={showSidebar} onClose={() => setSidebarOpen(false)} />
      {showSidebar ? (
        <div
          className="sd-overlay"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="sd-main">
        <Header onMenuClick={() => setSidebarOpen((value) => !value)} />
        <main className="sd-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}