import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { neonApi } from './neonApi'

function Login({ onLogin }) {
  const { alias: urlAlias } = useParams()
  const navigate = useNavigate()
  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [screenname, setScreenname] = useState('')
  const [passphraseHint, setPassphraseHint] = useState('')
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [aliasError, setAliasError] = useState(false)

  // If we're on the passphrase step, decode alias and validate
  useEffect(() => {
    if (urlAlias) {
      try {
        // Decode URL-encoded base64 string first, then decode base64
        const base64Alias = decodeURIComponent(urlAlias)
        const decodedAlias = decodeURIComponent(escape(atob(base64Alias)))
        setAlias(decodedAlias)
        // Validate alias and get codename
        validateAliasForPassphrase(decodedAlias)
      } catch (error) {
        // If decoding fails, redirect back to home
        console.error('Error decoding alias from URL:', error)
        navigate('/', { replace: true })
      }
    }
  }, [urlAlias])

  const validateAliasForPassphrase = async (aliasToValidate) => {
    try {
      const data = await neonApi.validateAlias(aliasToValidate)
      if (data.valid) {
        setScreenname(data.user.codename)
        setPassphraseHint(data.passphraseHint || '')
        setAliasError(false)
      } else {
        // Invalid alias in URL, redirect back to home
        navigate('/', { replace: true })
      }
    } catch (error) {
      console.error('Error validating alias:', error)
      navigate('/', { replace: true })
    }
  }

  const handleAliasSubmit = async (e) => {
    e.preventDefault()
    setAliasError(false)
    
    try {
      const data = await neonApi.validateAlias(alias)
      
      if (data.valid) {
        // Generate unique login URL from alias (base64 encoded to obscure the alias)
        const base64Alias = btoa(unescape(encodeURIComponent(alias)))
        // URL-encode the base64 string to handle special characters in URLs
        const encodedAlias = encodeURIComponent(base64Alias)
        navigate(`/login/${encodedAlias}`, { replace: true })
      } else {
        setAliasError(true)
        setAlias('')
      }
    } catch (error) {
      console.error('Error validating alias:', error)
      setAliasError(true)
      setAlias('')
    }
  }

  const handlePassphraseSubmit = async (e) => {
    e.preventDefault()
    console.log('Access attempt:', { alias, password })
    
    try {
      const data = await neonApi.authenticate(alias, password, null, navigator.userAgent)
      
      if (data.success) {
        // Authentication successful
        setShowUnauthorizedMessage(false)
        onLogin(data.user)
        navigate('/dashboard', { replace: true })
      } else {
        // Authentication failed
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

  // If we're on the passphrase step (has URL alias)
  if (urlAlias) {
    return (
      <div className="login-container">
        <div className="logo">
          <h1>Press me, I talk!</h1>
          <p>A Daw Industries game product</p>
        </div>
        <form onSubmit={handlePassphraseSubmit} className="login-form">
          <h2 className="welcome-agent">WELCOME AGENT</h2>
          <div className="form-group">
            <label htmlFor="password">Prove it's really you.</label>
            <input
              type="text"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passphraseHint}
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

  // Alias entry step (home page)
  return (
    <div className="login-container">
      <div className="logo">
        <h1>Press me, I talk!</h1>
        <p>A Daw Industries game product</p>
      </div>
      <form onSubmit={handleAliasSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="alias">Enter your alias</label>
          <input
            type="text"
            id="alias"
            name="alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Your alias"
            autoComplete="username"
            required
            autoFocus
          />
          {aliasError && (
            <div className="helper-error">
              Invalid alias.
            </div>
          )}
        </div>
        <button type="submit" className="login-button">
          Continue
        </button>
      </form>
    </div>
  )
}

export default Login
