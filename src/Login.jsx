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
      <div>
        <div>
          <h1>
            SECURITY LOCKOUT
          </h1>
          <div>
            MULTIPLE UNAUTHORIZED ACCESS ATTEMPTS DETECTED<br />
            <br />
            SECURITY PROTOCOLS ACTIVATED<br />
            <br />
            <span>
              FIND HANDLER "DAVID DAW" BEFORE CLEANUP SQUAD ARRIVES
            </span>
          </div>
          <div>
            ALL FURTHER ATTEMPTS WILL BE LOGGED AND TRACED<br />
            SYSTEM ACCESS TEMPORARILY SUSPENDED
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
        <div className="logo">
          <h1>Press me, I talk!</h1>
          <p>A Daw Industries game product</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
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
            <label htmlFor="password">Prove it's really you.</label>
            <input
              type="text"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={screenname}
              autoComplete="current-password"
              required
            />
              {showUnauthorizedMessage && (
                <div className="helper-error">
                  That ain't it, chief.
                </div>
              )}
          </div>
          <button type="submit" className="login-button">
            Let the games begin!
          </button>
        </form>
    </div>
  )
}

export default Login
