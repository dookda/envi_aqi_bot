/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Dashboard, Models, Chat } from './pages'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/models" element={<Models />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  )
}

export default App
