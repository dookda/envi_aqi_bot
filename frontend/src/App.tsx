/**
 * Main App Component with Routing
 * Analytics and Settings pages require authentication
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard, Models, Chat, Claude, Admin, DataUpload, DataPreparation, CCTV, Stations, Info, ExecutiveSummary, Login, Register, Profile, Users, LiffProfile } from './pages'
import { LanguageProvider, ThemeProvider, ToastProvider, AuthProvider } from './contexts'
import { Layout } from './components/organisms'
import ProtectedRoute from './components/ProtectedRoute'

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Router>
              <Routes>
                {/* Public Auth Routes (No Sidebar) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* LINE LIFF Route (No Sidebar - opens in LINE app) */}
                <Route path="/liff" element={<LiffProfile />} />

                {/* Main App Routes (With Sidebar) */}
                <Route path="*" element={
                  <Layout>
                    <Routes>
                      {/* Public Routes - No authentication required */}
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/chat" element={
                        <ProtectedRoute>
                          <Chat />
                        </ProtectedRoute>
                      } />
                      <Route path="/chat/claude" element={
                        <ProtectedRoute>
                          <Claude />
                        </ProtectedRoute>
                      } />
                      <Route path="/cctv" element={<CCTV />} />
                      <Route path="/info" element={<Info />} />
                      <Route path="/profile" element={<Profile />} />

                      {/* Analytics Routes - Requires authentication */}
                      <Route path="/models" element={
                        <ProtectedRoute>
                          <Models />
                        </ProtectedRoute>
                      } />
                      <Route path="/executive-summary" element={
                        <ProtectedRoute>
                          <ExecutiveSummary />
                        </ProtectedRoute>
                      } />

                      {/* Settings/Admin Routes - Requires authentication */}
                      <Route path="/prepare-data" element={
                        <ProtectedRoute>
                          <DataPreparation />
                        </ProtectedRoute>
                      } />
                      <Route path="/upload" element={
                        <ProtectedRoute>
                          <DataUpload />
                        </ProtectedRoute>
                      } />
                      <Route path="/stations" element={
                        <ProtectedRoute>
                          <Stations />
                        </ProtectedRoute>
                      } />
                      <Route path="/users" element={
                        <ProtectedRoute requireAdmin>
                          <Users />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin" element={
                        <ProtectedRoute requireAdmin>
                          <Admin />
                        </ProtectedRoute>
                      } />
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

