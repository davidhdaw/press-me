import { useState, useEffect } from 'react'
import './App.css'
import Mission from './Mission'
import agentNamesData from '../agentnames.json'

function App() {
  const [screenname, setScreenname] = useState('')
  const [password, setPassword] = useState('')
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Initialize agent name from localStorage or pick a random one
  useEffect(() => {
    const savedAgentName = localStorage.getItem('agentName')
    if (savedAgentName) {
      setScreenname(savedAgentName)
    } else {
      const randomAgentName = agentNamesData.agentNames[Math.floor(Math.random() * agentNamesData.agentNames.length)]
      setScreenname(randomAgentName)
      localStorage.setItem('agentName', randomAgentName)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Access attempt:', { screenname, password })
    const sanitizedPassword = password.toLowerCase()
    const correctPassword = 'unknown'
    if (sanitizedPassword == correctPassword) {
      // Here you would typically handle the authentication logic
      setShowUnauthorizedMessage(false)
      setIsLoggedIn(true)
    } else {
      setFailedAttempts(prev => prev + 1)
      setShowUnauthorizedMessage(true)
      setPassword('') // Clear password field after failed attempt
    }
  }

  if (isLoggedIn) {
    return <Mission agentName={screenname} />
  }

  // Full screen lockout after 5 failed attempts
  if (failedAttempts >= 5) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #4d5051 0%, #51565b 50%, #313233 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          textAlign: 'center',
          color: '#e74c3c',
          fontFamily: 'Courier New, monospace',
          maxWidth: '600px',
          padding: '2rem'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            marginBottom: '2rem',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            textShadow: '0 0 10px rgba(231, 76, 60, 0.5)'
          }}>
            ⚠️ SECURITY LOCKOUT ⚠️
          </h1>
          <div style={{
            fontSize: '1.2rem',
            lineHeight: '1.8',
            marginBottom: '2rem'
          }}>
            MULTIPLE UNAUTHORIZED ACCESS ATTEMPTS DETECTED<br />
            <br />
            SECURITY PROTOCOLS ACTIVATED<br />
            <br />
            <span style={{
              fontSize: '1rem',
              color: '#ecf0f1',
              backgroundColor: 'rgba(231, 76, 60, 0.2)',
              padding: '1rem',
              borderRadius: '8px',
              display: 'inline-block',
              marginTop: '1rem'
            }}>
              FIND HANDLER "DAVID DAW" BEFORE CLEANUP SQUAD ARRIVES
            </span>
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#bdc3c7',
            opacity: 0.8
          }}>
            ALL FURTHER ATTEMPTS WILL BE LOGGED AND TRACED<br />
            SYSTEM ACCESS TEMPORARILY SUSPENDED
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>SECURE ACCESS</h1>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem', 
          fontSize: '0.8rem', 
          color: '#3498db', 
          opacity: 0.7,
          letterSpacing: '1px'
        }}>
          CLASSIFIED DATABASE - LEVEL 1 CLEARANCE REQUIRED
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
          <h2>WELCOME, AGENT {screenname}</h2>

          </div>
          <div className="form-group">
            <label htmlFor="password">ACCESS CODE</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ENTER LAST WORD OF CODE PHRASE"
              required
            />
          </div>
          <button type="submit" className="login-button">
            INITIALIZE ACCESS
          </button>
        </form>
        {showUnauthorizedMessage && (
          <div style={{ 
            marginTop: '2rem', 
            fontSize: '0.7rem', 
            color: '#3498db', 
            opacity: 0.8,
            textAlign: 'center',
            fontFamily: 'Courier New, monospace'
          }}>
            ⚠️ INCORRECT ACCESS CODE - UNAUTHORIZED ACCESS WILL BE TRACED ⚠️
          </div>
        )}
      </div>
    </div>
  )
}

export default App
