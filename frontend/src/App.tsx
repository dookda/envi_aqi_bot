/**
 * Main App Component with Routing
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat, Claude, Admin, DataUpload, DataPreparation, CCTV, Stations, Info, ExecutiveSummary, Login, Register, Profile } from './pages'
import { LanguageProvider, ThemeProvider, ToastProvider, AuthProvider } from './contexts'
import { Layout } from './components/organisms'

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Router basename="/ebot">
              <Routes>
                {/* Public Auth Routes (No Sidebar) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Main App Routes (With Sidebar) */}
                <Route path="*" element={
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/executive-summary" element={<ExecutiveSummary />} />
                      <Route path="/models" element={<Models />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/chat/claude" element={<Claude />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/prepare-data" element={<DataPreparation />} />
                      <Route path="/upload" element={<DataUpload />} />
                      <Route path="/stations" element={<Stations />} />
                      <Route path="/cctv" element={<CCTV />} />
                      <Route path="/info" element={<Info />} />
                      <Route path="/profile" element={<Profile />} />
                    </Routes>
                  </Layout>
                } />
              </Routes>
            </Router>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App

