import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider } from './ui/context/AppContext'
import { ProtectedRoute } from './ui/components/ProtectedRoute'
import { Layout } from './ui/components/Layout'
import { LoginPage } from './ui/pages/LoginPage'
import { AddWordPage } from './ui/pages/AddWordPage'
import { WordListPage } from './ui/pages/WordListPage'
import { ExportPage } from './ui/pages/ExportPage'
import { StatsPage } from './ui/pages/StatsPage'
import { ImportPage } from './ui/pages/ImportPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<AddWordPage />} />
                <Route path="/words" element={<WordListPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/stats" element={<StatsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  )
}
