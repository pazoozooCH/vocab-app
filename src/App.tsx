import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './ui/context/AppContext'
import { ProtectedRoute } from './ui/components/ProtectedRoute'
import { Layout } from './ui/components/Layout'
import { LoginPage } from './ui/pages/LoginPage'
import { AddWordPage } from './ui/pages/AddWordPage'
import { WordListPage } from './ui/pages/WordListPage'
import { ExportPage } from './ui/pages/ExportPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<AddWordPage />} />
              <Route path="/words" element={<WordListPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
