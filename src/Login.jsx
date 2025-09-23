import { useState, useEffect } from 'react'

function Login({ onLogin }) {
  const [screenname, setScreenname] = useState('')
  const [alias1, setAlias1] = useState('')
  const [alias2, setAlias2] = useState('')
  const [password, setPassword] = useState('')
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Initialize agent name from database
  useEffect(() => {
    fetchRandomAgent()
  }, [])

  const fetchRandomAgent = async () => {
    console.log('fetchRandomAgent called - making network request')
    try {
      const response = await fetch('http://localhost:3001/api/users/random')
      if (response.ok) {
        const data = await response.json()
        const agentName = data.codename
        setScreenname(agentName)
        setAlias1(data.alias_1)
        setAlias2(data.alias_2)
      } else {
        console.error('Failed to fetch random agent, status:', response.status)
        setScreenname('AGENT')
        setAlias1('Unknown')
        setAlias2('Agent')
      }
    } catch (error) {
      console.error('Error fetching random agent:', error)
      setScreenname('AGENT')
      setAlias1('Unknown')
      setAlias2('Agent')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Access attempt:', { alias1, alias2, password })
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alias: alias1, // Send the first alias part
          passphrase: password
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Authentication successful
          setShowUnauthorizedMessage(false)
          onLogin(data.user)
        } else {
          // Authentication failed
          setFailedAttempts(prev => prev + 1)
          setShowUnauthorizedMessage(true)
          setPassword('')
        }
      } else {
        // Server error
        setFailedAttempts(prev => prev + 1)
        setShowUnauthorizedMessage(true)
        setPassword('')
      }
    } catch (error) {
      console.error('Login error:', error)
      setFailedAttempts(prev => prev + 1)
      setShowUnauthorizedMessage(true)
      setPassword('')
    }
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
          <h2>WELCOME, AGENT {screenname?.toUpperCase()}</h2>

          </div>
          <div className="form-group">
            <label htmlFor="username" style={{ display: 'none' }}>Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={screenname}
              readOnly
              style={{ display: 'none' }}
              autoComplete="username"
            />
            <label htmlFor="password">PASSPHRASE</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ENTER YOUR PASSPHRASE"
              autoComplete="current-password"
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

export default Login
