/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat, Claude, Admin, DataUpload, CCTV } from './pages'
import { LanguageProvider, ThemeProvider, ToastProvider } from './contexts'
import { Layout } from './components/organisms'

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <Router basename="/ebot">
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/models" element={<Models />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/chat/claude" element={<Claude />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/upload" element={<DataUpload />} />
                <Route path="/cctv" element={<CCTV />} />
              </Routes>
            </Layout>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App

