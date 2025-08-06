import { useState } from 'react'
import './App.css'
import Mission from './Mission'

function App() {
  const [screenname, setScreenname] = useState('HONEYDEW')
  const [password, setPassword] = useState('')
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const correctPassword = 'unknown'
    const sanitizedPassword = password.toLowerCase().trim()
    console.log('Access attempt:', { screenname, password })
    if (sanitizedPassword === correctPassword) {
      // Here you would typically handle the authentication logic
      setShowUnauthorizedMessage(false)
      setIsLoggedIn(true)
    } else {
      setShowUnauthorizedMessage(true)
      alert('Invalid password')
    }
  }

  if (isLoggedIn) {
    return <Mission agentName={screenname} />
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
            opacity: 0.5,
            textAlign: 'center',
            fontFamily: 'Courier New, monospace'
          }}>
            ⚠️ INCORRECT ACCESS CODEUNAUTHORIZED ACCESS WILL BE TRACED ⚠️
          </div>
        )}
      </div>
    </div>
  )
}

export default App
