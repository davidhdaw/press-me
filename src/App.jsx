import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import './helpers.js'
import Mission from './Mission'
import Login from './Login'
import Dashboard from './Dashboard'
import AdminDashboard from './AdminDashboard'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  // Check if user is logged in on app start
  useEffect(() => {
    const loggedInUser = localStorage.getItem('spyUser')
    if (loggedInUser) {
      setCurrentUser(JSON.parse(loggedInUser))
      setIsLoggedIn(true)
    }
  }, [])

  const handleLogin = (userData) => {
    setCurrentUser(userData)
    setIsLoggedIn(true)
    localStorage.setItem('spyUser', JSON.stringify(userData))
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
              <Navigate to="/mission" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/login/:alias" 
          element={
            isLoggedIn ? (
              <Navigate to="/mission" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        <Route 
          path="/mission" 
          element={
            isLoggedIn ? (
              <Mission 
                alias1={currentUser?.alias_1} 
                alias2={currentUser?.alias_2}
                realName={currentUser?.firstname}
                team={currentUser?.team}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isLoggedIn ? (
              <Dashboard 
                agentName={currentUser?.codename}
                agentId={currentUser?.id}
                firstName={currentUser?.firstname}
                lastName={currentUser?.lastname}
                alias1={currentUser?.alias_1}
                alias2={currentUser?.alias_2}
                team={currentUser?.team}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/admin" 
          element={
            isLoggedIn ? (
              (currentUser?.alias_1 === 'Swift' && currentUser?.alias_2 === 'Spider') || 
              (currentUser?.firstname === 'David' && currentUser?.lastname === 'Daw') ? (
                <AdminDashboard 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
