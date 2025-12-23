/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat } from './pages'
import { LanguageProvider, ThemeProvider } from './contexts'

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Router basename="/ebot">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/models" element={<Models />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App

