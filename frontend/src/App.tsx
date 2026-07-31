import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ToastProvider } from './components/ux'
import { WatchlistProvider } from './lib/watchlist'

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const DataExplorerPage = lazy(() =>
  import('./pages/DataExplorerPage').then((module) => ({ default: module.DataExplorerPage })),
)
const ScannerPage = lazy(() =>
  import('./pages/ScannerPage').then((module) => ({ default: module.ScannerPage })),
)
const TrackRecordPage = lazy(() =>
  import('./pages/TrackRecordPage').then((module) => ({ default: module.TrackRecordPage })),
)
const MarketPulsePage = lazy(() =>
  import('./pages/MarketPulsePage').then((module) => ({ default: module.MarketPulsePage })),
)
const ComparePage = lazy(() =>
  import('./pages/ComparePage').then((module) => ({ default: module.ComparePage })),
)
const ForecastLabPage = lazy(() =>
  import('./pages/ForecastLabPage').then((module) => ({ default: module.ForecastLabPage })),
)
const WatchlistPage = lazy(() =>
  import('./pages/WatchlistPage').then((module) => ({ default: module.WatchlistPage })),
)

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WatchlistProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="route-loader">Loading workspace…</div>}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/app" element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="pulse" element={<MarketPulsePage />} />
                  <Route path="scanner" element={<ScannerPage />} />
                  <Route path="compare" element={<ComparePage />} />
                  <Route path="lab" element={<ForecastLabPage />} />
                  <Route path="market" element={<DataExplorerPage />} />
                  <Route path="watchlist" element={<WatchlistPage />} />
                  <Route path="track-record" element={<TrackRecordPage />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </WatchlistProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
