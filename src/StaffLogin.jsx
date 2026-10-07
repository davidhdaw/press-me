import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { neonApi } from './neonApi'
import { getStaffToken, setStaffToken } from './staffSession'
import './AdminDashboard.css'

// Where a staff member lands after signing in: the staff page they were sent
// here from, if their role allows it, otherwise their home page. (Never send
// them back to a page they can't open, or the gate would bounce them here.)
function destinationFor(staff, next) {
  const allowed = next === '/admin' ? staff.is_admin : next === '/bank' ? staff.is_banker : false
  if (allowed) return next
  return staff.is_admin ? '/admin' : '/bank'
}

function StaffLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Already signed in on this device? Skip the form.
  useEffect(() => {
    neonApi.getStaffSession(getStaffToken())
      .then(staff => { if (staff) navigate(destinationFor(staff, next), { replace: true }) })
      .catch(() => {})
  }, [navigate, next])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await neonApi.staffLogin(name, pin, navigator.userAgent)
      if (!result.success) {
        setError(result.message)
        setPin('')
        return
      }
      setStaffToken(result.token)
      navigate(destinationFor(result.staff, next), { replace: true })
    } catch (err) {
      console.error('Staff login error:', err)
      setError('Could not reach the database. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-container">
      <div className="admin-logo">
        <h1>Staff Access</h1>
        <p>Hosts and bankers</p>
      </div>
      <form onSubmit={handleSubmit} className="admin-login-form">
        <div className="form-group">
          <label htmlFor="staff-name">Full name</label>
          <input
            type="text"
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            autoComplete="username"
            required
            autoFocus
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="staff-pin">Staff PIN</label>
          <input
            type="password"
            id="staff-pin"
            inputMode="numeric"
            pattern="\d{4,8}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="4–8 digits"
            autoComplete="current-password"
            required
            disabled={loading}
          />
          {error && <div className="helper-error">{error}</div>}
        </div>
        <button type="submit" className="admin-login-button" disabled={loading}>
          {loading ? 'Checking...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

export default StaffLogin
