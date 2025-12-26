/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat, Claude, Admin } from './pages'
import { LanguageProvider, ThemeProvider, ToastProvider } from './contexts'

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <Router basename="/ebot">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/models" element={<Models />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/claude" element={<Claude />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App

