import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './Login'
import Dashboard from './Dashboard'
import AdminDashboard from './AdminDashboard'
import BankPage from './BankPage'
import AwardsPage from './AwardsPage'
import RevealPage from './RevealPage'
import StaffLogin from './StaffLogin'
import StaffGate from './StaffGate'

function App() {
  const savedUser = localStorage.getItem('spyUser')
  const [isLoggedIn, setIsLoggedIn] = useState(!!savedUser)
  const [currentUser, setCurrentUser] = useState(savedUser ? JSON.parse(savedUser) : null)

  const handleLogin = (userData) => {
    setCurrentUser(userData)
    setIsLoggedIn(true)
    localStorage.setItem('spyUser', JSON.stringify(userData))
  }

  // Merge fresh fields (e.g. a passphrase a host changed mid-game) into the session
  const handleUserUpdate = (fields) => {
    setCurrentUser(prev => {
      const next = { ...prev, ...fields }
      localStorage.setItem('spyUser', JSON.stringify(next))
      return next
    })
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setIsLoggedIn(false)
    localStorage.removeItem('spyUser')
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/login/:alias" 
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isLoggedIn ? (
              <Dashboard 
                agentId={currentUser?.id}
                firstName={currentUser?.firstname}
                lastName={currentUser?.lastname}
                currentUser={currentUser}
                onLogout={handleLogout}
                onUserUpdate={handleUserUpdate}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        {/* Staff pages: separate sign-in (name + staff PIN), never via player login */}
        <Route path="/staff" element={<StaffLogin />} />
        <Route path="/admin/login/*" element={<Navigate to="/staff" replace />} />
        <Route
          path="/admin"
          element={
            <StaffGate role="host">
              {(staff, logout) => <AdminDashboard staff={staff} onLogout={logout} />}
            </StaffGate>
          }
        />
        <Route
          path="/bank"
          element={
            <StaffGate role="banker">
              {(staff, logout) => <BankPage staff={staff} onLogout={logout} />}
            </StaffGate>
          }
        />
        <Route
          path="/awards"
          element={
            <StaffGate role="host">
              {() => <AwardsPage />}
            </StaffGate>
          }
        />
        {/* Hidden message found via an NFC tag at the party; no login needed */}
        <Route path="/reveal" element={<RevealPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
