/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat } from './pages'
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
            </Routes>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App

