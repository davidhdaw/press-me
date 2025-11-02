import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'

function AdminDashboard({ currentUser, onLogout }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [sessionName, setSessionName] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  
  // Check if user is admin
  const isAdmin = (currentUser?.alias_1 === 'Swift' && currentUser?.alias_2 === 'Spider') || 
                  (currentUser?.firstname === 'David' && currentUser?.lastname === 'Daw')

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    // Load sessions data
    loadSessions()
  }, [isAdmin, navigate])

  const loadSessions = async () => {
    try {
      const allSessions = await neonApi.getAllSessions()
      setSessions(allSessions)
      setLoading(false)
    } catch (error) {
      console.error('Error loading sessions:', error)
      setLoading(false)
    }
  }

  const handleStartSession = async (sessionId) => {
    if (!window.confirm('Start this session? Missions will be assigned to selected players.')) {
      return
    }
    
    try {
      await neonApi.startSession(sessionId)
      loadSessions()
      alert('Session started and missions assigned!')
    } catch (error) {
      alert(`Error starting session: ${error.message || 'Please try again.'}`)
    }
  }

  const handlePauseSession = async (sessionId) => {
    try {
      await neonApi.pauseSession(sessionId)
      loadSessions()
      alert('Session paused')
    } catch (error) {
      alert(`Error pausing session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleResumeSession = async (sessionId) => {
    try {
      await neonApi.resumeSession(sessionId)
      loadSessions()
      alert('Session resumed')
    } catch (error) {
      alert(`Error resuming session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleEndSession = async (sessionId) => {
    if (!window.confirm('End this session? This cannot be undone.')) {
      return
    }
    
    try {
      await neonApi.endSession(sessionId)
      loadSessions()
      alert('Session ended')
    } catch (error) {
      alert(`Error ending session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleOpenCreateModal = async () => {
    try {
      // Fetch all users for selection
      const users = await neonApi.getUsers()
      setAllUsers(users.filter(user => user.ishere)) // Only show active users
      setSelectedUsers(new Set())
      setSessionName('')
      setShowCreateModal(true)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleToggleUser = (userId) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === allUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(allUsers.map(user => user.id)))
    }
  }

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name')
      return
    }
    if (selectedUsers.size === 0) {
      alert('Please select at least one player')
      return
    }

    setCreatingSession(true)
    try {
      // Create session (draft status - missions not assigned yet)
      await neonApi.createSession({
        name: sessionName.trim(),
        userIds: Array.from(selectedUsers),
        createdBy: currentUser?.id
      })
      
      // Close modal and refresh sessions
      setShowCreateModal(false)
      setSessionName('')
      setSelectedUsers(new Set())
      loadSessions()
      alert('Session created successfully! Start the session to assign missions.')
    } catch (error) {
      console.error('Error creating session:', error)
      alert(`Error creating session: ${error.message || 'Please try again.'}`)
    } finally {
      setCreatingSession(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-actions">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            Back to Dashboard
          </button>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-section">
          <h2>Session Management</h2>
          <div className="session-controls">
            <button onClick={handleOpenCreateModal} className="button-primary">
              Create New Session
            </button>
            <button className="button-secondary">
              Load Existing Session
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--unit-base)' }}>
              <p>Loading sessions...</p>
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 'var(--unit-base)', fontStyle: 'italic' }}>
                  No sessions found. Create a new session to get started.
                </p>
              ) : (
                <ul>
                  {sessions.map(session => (
                    <li key={session.id}>
                      <div className="session-item">
                        <h3>{session.name}</h3>
                        <div className="session-info">
                          <p className={`session-status status-${session.status}`}>Status: {session.status}</p>
                          <p>Players: {session.participant_user_ids?.length || 0}</p>
                          {session.created_at && (
                            <p>Created: {new Date(session.created_at).toLocaleString()}</p>
                          )}
                          {session.started_at && (
                            <p>Started: {new Date(session.started_at).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="session-actions">
                          {session.status === 'draft' && (
                            <button onClick={() => handleStartSession(session.id)} className="button-primary">
                              Start Session
                            </button>
                          )}
                          {session.status === 'active' && (
                            <>
                              <button onClick={() => handlePauseSession(session.id)} className="button-secondary">
                                Pause
                              </button>
                              <button onClick={() => handleEndSession(session.id)} className="logout-button">
                                End Session
                              </button>
                            </>
                          )}
                          {session.status === 'paused' && (
                            <>
                              <button onClick={() => handleResumeSession(session.id)} className="button-primary">
                                Resume
                              </button>
                              <button onClick={() => handleEndSession(session.id)} className="logout-button">
                                End Session
                              </button>
                            </>
                          )}
                          {session.status === 'ended' && (
                            <p className="session-ended">Session Ended</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {activeSession && (
          <div className="admin-section">
            <h2>Active Session: {activeSession.name}</h2>
            <div className="session-details">
              {/* Session management UI will go here */}
              <p>Session management features coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="admin-modal-overlay" onClick={() => !creatingSession && setShowCreateModal(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Create New Session</h2>
              <button 
                className="admin-modal-close" 
                onClick={() => setShowCreateModal(false)}
                disabled={creatingSession}
              >
                ×
              </button>
            </div>
            
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label htmlFor="session-name">Session Name</label>
                <input
                  id="session-name"
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Enter session name"
                  disabled={creatingSession}
                />
              </div>

              <div className="admin-form-group">
                <div className="admin-form-header">
                  <label>Select Players ({selectedUsers.size} selected)</label>
                  <button 
                    type="button" 
                    onClick={handleSelectAll}
                    className="select-all-button"
                    disabled={creatingSession}
                  >
                    {selectedUsers.size === allUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="users-selection-list">
                  {allUsers.map(user => (
                    <label key={user.id} className="user-selection-item">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        disabled={creatingSession}
                      />
                      <span className="user-info">
                        <strong>{user.firstname} {user.lastname}</strong>
                        <span className="user-codename">{user.alias_1} {user.alias_2}</span>
                        <span className={`user-team team-${user.team}`}>{user.team}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="button-secondary"
                disabled={creatingSession}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateSession}
                className="button-primary"
                disabled={creatingSession || !sessionName.trim() || selectedUsers.size === 0}
              >
                {creatingSession ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard

