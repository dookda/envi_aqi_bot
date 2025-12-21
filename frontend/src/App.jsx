/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Dashboard, Models } from './pages'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/models" element={<Models />} />
      </Routes>
    </Router>
  )
}

export default App
