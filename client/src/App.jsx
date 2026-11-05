
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom'

import Login from './pages/Login.jsx'
import Jobs from './pages/Jobs.jsx'
import JobSetup from './pages/JobSetup.jsx'
import Recipients from './pages/Recipients.jsx'
import Templates from './pages/Templates.jsx'
import RunHistory from './pages/RunHistory.jsx'

import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { api } from './api.js'

function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [testMode, setTestMode] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    let active = true

    async function loadHealth() {
      try {
        const response = await api('/health')
        if (active) setTestMode(response.testMode)
      } catch {
        if (active) setTestMode(null)
      }
    }

    loadHealth()

    return () => {
      active = false
    }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <header className="app-header">
        <div className="header-brand">
          <button
  type="button"
  className="menu-toggle"
  onClick={() => setSidebarOpen((previous) => !previous)}
  aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
  aria-expanded={sidebarOpen}
>
  ☰
</button>
          <strong>Notification Engine</strong>
        </div>

        <div className="header-account">
          {testMode === true && (
            <span className="test-mode-badge">TEST MODE: ON</span>
          )}

          {testMode === false && (
            <span className="test-mode-badge test-mode-off">
              TEST MODE: OFF
            </span>
          )}

          <span className="account-name">
            {user?.name || 'User'} ({user?.role || 'user'})
          </span>

          <button className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <aside className="app-sidebar">
        <nav className="sidebar-navigation">
          <NavLink to="/" end>
            Job Dashboard
          </NavLink>

          <NavLink to="/recipients">
            Recipient Lists
          </NavLink>

          <NavLink to="/templates">
            Templates
          </NavLink>

          <NavLink to="/history">
            Run History
          </NavLink>

          <div className="sidebar-divider" />

          <p className="sidebar-section-label">Batch 2</p>

          <span className="sidebar-disabled">Connections</span>
          <span className="sidebar-disabled">Queries</span>
        </nav>
      </aside>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobSetup />} />
          <Route path="/jobs/:id" element={<JobSetup />} />
          <Route path="/recipients" element={<Recipients />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/history" element={<RunHistory />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<DashboardLayout />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
