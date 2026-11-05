import { NavLink, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Jobs from './pages/Jobs.jsx'
import JobSetup from './pages/JobSetup.jsx'
import Recipients from './pages/Recipients.jsx'
import Templates from './pages/Templates.jsx'
import RunHistory from './pages/RunHistory.jsx'

export default function App() {
  return (
    <div className="layout">
      <header>
        <strong>Notification Engine</strong>
        {/* TEST MODE badge and signed-in user go here (FR-14, FR-01) */}
      </header>
      <nav>
        <NavLink to="/" end>Job Dashboard</NavLink>
        <NavLink to="/recipients">Recipient Lists</NavLink>
        <NavLink to="/templates">Templates</NavLink>
        <NavLink to="/history">Run History</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
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
