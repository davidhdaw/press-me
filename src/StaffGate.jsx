import { useState, useEffect, useCallback } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'
import { getStaffToken, setStaffToken } from './staffSession'

// Renders children(staff, logout) only for a signed-in staff member with the
// required role ('host' or 'banker'). The session is re-checked against the
// database on load and every minute, so removing someone's role or PIN takes
// effect on their open screens too.
function StaffGate({ role, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState({ checking: true, staff: null })

  const check = useCallback(async () => {
    try {
      const staff = await neonApi.getStaffSession(getStaffToken())
      if (!staff) setStaffToken(null)
      setState({ checking: false, staff })
    } catch {
      // Network blip: keep whoever was already verified rather than kicking them out
      setState(prev => ({ ...prev, checking: false }))
    }
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [check])

  const logout = useCallback(async () => {
    const token = getStaffToken()
    setStaffToken(null)
    try {
      await neonApi.staffLogout(token)
    } finally {
      navigate('/staff', { replace: true })
    }
  }, [navigate])

  if (state.checking) {
    return <div className="admin-placeholder"><p>Checking staff access...</p></div>
  }

  const allowed = state.staff && (role === 'host' ? state.staff.is_admin : state.staff.is_banker)
  if (!allowed) {
    return <Navigate to={`/staff?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children(state.staff, logout)
}

export default StaffGate
