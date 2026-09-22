import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  LayoutDashboard,
  Map,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/find-alternative', label: 'Find Alternative', icon: Search },
  {
    path: '/comparison',
    label: 'Destination Comparison',
    icon: ArrowLeftRight,
  },
  { path: '/map', label: 'Tourism Map', icon: Map },
  { path: '/economic-potential', label: 'Economic Potential', icon: TrendingUp },
  { path: '/ai-insights', label: 'AI Insights', icon: Sparkles },
]

export const PRODUCT_NAME = 'SMART DESTINATION AI'
export const PRODUCT_SUBTITLE =
  'AI-Powered Alternative Destination Recommender for Sustainable Tourism'