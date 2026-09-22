import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { AiInsightsPage } from './pages/AiInsightsPage'
import { DestinationComparisonPage } from './pages/DestinationComparisonPage'
import { EconomicPotentialPage } from './pages/EconomicPotentialPage'
import { FindAlternativePage } from './pages/FindAlternativePage'
import { OverviewPage } from './pages/OverviewPage'
import { TourismMapPage } from './pages/TourismMapPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'find-alternative', element: <FindAlternativePage /> },
      { path: 'comparison', element: <DestinationComparisonPage /> },
      { path: 'map', element: <TourismMapPage /> },
      { path: 'economic-potential', element: <EconomicPotentialPage /> },
      { path: 'ai-insights', element: <AiInsightsPage /> },
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}