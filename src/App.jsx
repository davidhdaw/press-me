import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './Login'
import Dashboard from './Dashboard'
import AdminDashboard from './AdminDashboard'
import AdminLogin from './AdminLogin'
import { isAdmin } from './utils/admin.js'

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
        <Route 
          path="/admin/login" 
          element={
            isLoggedIn && isAdmin(currentUser) ? (
              <Navigate to="/admin" replace />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/admin/login/:name" 
          element={
            isLoggedIn && isAdmin(currentUser) ? (
              <Navigate to="/admin" replace />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/admin" 
          element={
            isLoggedIn ? (
              isAdmin(currentUser) ? (
                <AdminDashboard 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/admin/login" replace />
              )
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
