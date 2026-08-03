import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ToastProvider } from './components/ux'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataExplorerPage } from './pages/DataExplorerPage'
import { TrainingPage } from './pages/TrainingPage'
import { ModelComparisonPage } from './pages/ModelComparisonPage'
import { PredictionPage } from './pages/PredictionPage'
import { ExplainabilityPage } from './pages/ExplainabilityPage'
import { InsightsPage } from './pages/InsightsPage'
import { ExperimentsPage } from './pages/ExperimentsPage'
import { BacktestPage } from './pages/BacktestPage'
import { ReportPage } from './pages/ReportPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="data" element={<DataExplorerPage />} />
              <Route path="training" element={<TrainingPage />} />
              <Route path="models" element={<ModelComparisonPage />} />
              <Route path="predict" element={<PredictionPage />} />
              <Route path="explain" element={<ExplainabilityPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="experiments" element={<ExperimentsPage />} />
              <Route path="backtest" element={<BacktestPage />} />
              <Route path="report" element={<ReportPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
