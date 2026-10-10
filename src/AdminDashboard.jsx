import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'
import { isValidPin } from './api/pin.js'
import './AdminDashboard.css'

const PRODUCTION_URL = 'https://press-me-iota.vercel.app'

function getPlayerLoginUrl(user) {
  const alias = `${user.alias_1} ${user.alias_2}`
  const base64Alias = btoa(unescape(encodeURIComponent(alias)))
  return `${PRODUCTION_URL}/login/${encodeURIComponent(base64Alias)}`
}

const EMPTY_PLAYER_FORM = {
  firstname: '', lastname: '', alias_1: '', alias_2: '', passphrase: '',
  is_admin: false, is_banker: false, ishere: true, staffPin: ''
}

// Timestamps arrive as Dates already in the right instant (see api/timestamps.js)
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return String(timestamp)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  })
}

// Only rendered for a verified host (see StaffGate)
function AdminDashboard({ staff, onLogout }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [sessionName, setSessionName] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [editingSession, setEditingSession] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [sessionUsers, setSessionUsers] = useState([])
  const [playerMissions, setPlayerMissions] = useState([]) // flat list from getAllPlayerMissionsForSession
  const [loadingSessionData, setLoadingSessionData] = useState(false)
  const [completingMission, setCompletingMission] = useState(null) // { playerMissionId, userId }
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [advancingPhase, setAdvancingPhase] = useState(false)

  // Mission manager state
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [editingMission, setEditingMission] = useState(null)
  const [missionForm, setMissionForm] = useState({
    phase: 1,
    title: '',
    missionBody: '',
    completionType: 'phrase',
    successKey: '',
    signoffPromptTemplate: '',
    variablePool: '',
    variableSource: 'pool',
    signerConstraint: 'any',
    sameSignerMissionId: null,
    sortOrder: 0,
    bounty: 0,
    isCulminating: false,
    firstOnly: false,
    paymentType: '',
    paymentMin: 0
  })
  const [phaseMissions, setPhaseMissions] = useState([])
  const [loadingPhaseMissions, setLoadingPhaseMissions] = useState(false)

  // Add/edit player modal state
  const [playerModal, setPlayerModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', user }
  const [playerForm, setPlayerForm] = useState(EMPTY_PLAYER_FORM)
  const [addSource, setAddSource] = useState('new') // 'new' | 'existing'
  const [existingUserId, setExistingUserId] = useState('')
  const [addToSession, setAddToSession] = useState(true)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [playerResult, setPlayerResult] = useState(null) // { user, message } shown after a save

  // Users tab state
  const [usersTabList, setUsersTabList] = useState([])
  const [showPassphrases, setShowPassphrases] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState(new Set())

  // Push missions state
  const [pushMissionForm, setPushMissionForm] = useState({ targetUserId: '', title: '', missionBody: '', bounty: '' })
  const [sendingPushMission, setSendingPushMission] = useState(false)
  const [pushMissionHistory, setPushMissionHistory] = useState([])
  const [loadingPushHistory, setLoadingPushHistory] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState('sessions')

  useEffect(() => {
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'missions' && phaseMissions.length === 0) {
      loadPhaseMissions()
    }
    if (activeTab === 'users' && usersTabList.length === 0) {
      loadUsersTab()
    }
    if (activeTab === 'push') {
      loadPushMissionHistory()
      if (activeSession && sessionUsers.length === 0) {
        loadActiveSessionData(activeSession)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const loadSessions = async () => {
    try {
      const allSessions = await neonApi.getAllSessions()
      setSessions(Array.isArray(allSessions) ? allSessions : [])
      
      // Find and set active session
      const active = allSessions.find(s => s.status === 'active')
      setActiveSession(active || null)
      
      // If there's an active session, load its user data
      if (active) {
        loadActiveSessionData(active)
      } else {
        setSessionUsers([])
        setPlayerMissions([])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
      setLoading(false)
    }
  }

  // silent: background refresh, so no loading placeholder and keep the current
  // data if it fails
  const loadActiveSessionData = async (session, { silent = false } = {}) => {
    if (!session || !session.participant_user_ids || session.participant_user_ids.length === 0) {
      setSessionUsers([])
      setPlayerMissions([])
      return
    }

    try {
      if (!silent) setLoadingSessionData(true)

      const allUsersResult = await neonApi.getUsers()
      const sessionUserIds = new Set(session.participant_user_ids.map(id => Number(id)))
      const usersInSession = allUsersResult.filter(user => sessionUserIds.has(user.id))
      setSessionUsers(usersInSession)

      const missions = await neonApi.getAllPlayerMissionsForSession(session.id)
      setPlayerMissions(missions || [])
    } catch (error) {
      console.error('Error loading active session data:', error)
      if (!silent) {
        setSessionUsers([])
        setPlayerMissions([])
      }
    } finally {
      if (!silent) setLoadingSessionData(false)
    }
  }

  const loadPushMissionHistory = async ({ silent = false } = {}) => {
    if (!activeSession) return
    try {
      if (!silent) setLoadingPushHistory(true)
      const history = await neonApi.getAllPushMissionsForSession(activeSession.id)
      setPushMissionHistory(history || [])
    } catch (error) {
      console.error('Error loading push mission history:', error)
    } finally {
      if (!silent) setLoadingPushHistory(false)
    }
  }

  // Keep the live views current without anyone pressing Refresh: players
  // finish missions, unlock culminating missions (the handler queue) and
  // complete push missions from their own phones
  useEffect(() => {
    if (!activeSession || (activeTab !== 'users' && activeTab !== 'push')) return
    const interval = setInterval(() => {
      if (activeTab === 'users') loadActiveSessionData(activeSession, { silent: true })
      if (activeTab === 'push') loadPushMissionHistory({ silent: true })
    }, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSession])

  const handleSendPushMission = async () => {
    setSendingPushMission(true)
    try {
      await neonApi.createPushMission({
        sessionId: activeSession.id,
        targetUserId: parseInt(pushMissionForm.targetUserId),
        sentByUserId: staff.id,
        title: pushMissionForm.title.trim(),
        missionBody: pushMissionForm.missionBody.trim(),
        bounty: parseInt(pushMissionForm.bounty) || 0
      })
      setPushMissionForm({ targetUserId: '', title: '', missionBody: '', bounty: '' })
      await loadPushMissionHistory()
    } catch (error) {
      alert(`Error sending push mission: ${error.message}`)
    } finally {
      setSendingPushMission(false)
    }
  }

  const handleCompletePushMission = async (pushMissionId) => {
    try {
      await neonApi.completePushMission(pushMissionId)
      await loadPushMissionHistory()
    } catch (error) {
      alert(`Error completing push mission: ${error.message}`)
    }
  }

  const handleStartSession = async (sessionId) => {
    if (!window.confirm('Start this session? Missions will be assigned to selected players.')) {
      return
    }
    
    try {
      await neonApi.startSession(sessionId)
      await loadSessions()
      // loadSessions will automatically load the active session data
      alert('Session started and missions assigned!')
    } catch (error) {
      alert(`Error starting session: ${error.message || 'Please try again.'}`)
    }
  }

  const handlePauseSession = async (sessionId) => {
    try {
      await neonApi.pauseSession(sessionId)
      await loadSessions()
      alert('Session paused')
    } catch (error) {
      alert(`Error pausing session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleResumeSession = async (sessionId) => {
    try {
      await neonApi.resumeSession(sessionId)
      await loadSessions()
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
      await loadSessions()
      alert('Session ended')
    } catch (error) {
      alert(`Error ending session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleResetSession = async (sessionId) => {
    if (!window.confirm('Reset this session? This will clear all mission assignments, completions, and intel for all participants. This cannot be undone.')) {
      return
    }
    
    try {
      await neonApi.resetSession(sessionId)
      await loadSessions()
      alert('Session reset successfully. All missions and intel cleared for participants.')
    } catch (error) {
      alert(`Error resetting session: ${error.message || 'Please try again.'}`)
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
        createdBy: staff.id
      })

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

  const handleOpenEditModal = async (session) => {
    // Only allow editing draft, paused, or ended sessions
    if (session.status === 'active') {
      alert('Cannot edit an active session. Pause or end it first.')
      return
    }

    try {
      // Fetch all users for selection
      const users = await neonApi.getUsers()
      setAllUsers(users.filter(user => user.ishere)) // Only show active users
      
      // Set current session data
      setEditingSessionId(session.id)
      setSessionName(session.name || '')
      setSelectedUsers(new Set(session.participant_user_ids || []))
      setShowEditModal(true)
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('Error loading session data')
    }
  }

  const handleUpdateSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name')
      return
    }
    if (selectedUsers.size === 0) {
      alert('Please select at least one player')
      return
    }

    setEditingSession(true)
    try {
      await neonApi.updateSession(editingSessionId, {
        name: sessionName.trim(),
        userIds: Array.from(selectedUsers)
      })

      setShowEditModal(false)
      setEditingSessionId(null)
      setSessionName('')
      setSelectedUsers(new Set())
      loadSessions()
      alert('Session updated successfully!')
    } catch (error) {
      console.error('Error updating session:', error)
      alert(`Error updating session: ${error.message || 'Please try again.'}`)
    } finally {
      setEditingSession(false)
    }
  }


  const handleRequestCompleteMission = (playerMissionId, userId) => {
    setCompletingMission({ playerMissionId, userId })
    setShowCompleteConfirm(true)
  }

  const handleConfirmCompleteMission = async () => {
    if (!completingMission) return

    try {
      const result = await neonApi.adminCompletePhaseMission(completingMission.playerMissionId)

      if (activeSession) {
        await loadActiveSessionData(activeSession)
      }

      setShowCompleteConfirm(false)
      setCompletingMission(null)
      alert(result.message || 'Mission completed successfully!')
    } catch (error) {
      console.error('Error completing mission:', error)
      alert(`Error completing mission: ${error.message || 'Please try again.'}`)
    }
  }

  const handleCancelCompleteMission = () => {
    setShowCompleteConfirm(false)
    setCompletingMission(null)
  }

  const handleAdvancePhase = async () => {
    if (!activeSession) return
    const currentPhase = activeSession.current_phase || 0
    if (currentPhase >= 3) return

    if (!window.confirm(`Advance to Phase ${currentPhase + 1}? This will lock Phase ${currentPhase} missions.`)) {
      return
    }

    setAdvancingPhase(true)
    try {
      await neonApi.advancePhase(activeSession.id)
      await loadSessions()
      alert(`Advanced to Phase ${currentPhase + 1}!`)
    } catch (error) {
      alert(`Error advancing phase: ${error.message || 'Please try again.'}`)
    } finally {
      setAdvancingPhase(false)
    }
  }

  // Global mission manager handlers
  const loadPhaseMissions = async () => {
    try {
      setLoadingPhaseMissions(true)
      const missions = await neonApi.getPhaseMissions()
      setPhaseMissions(missions || [])
    } catch (error) {
      console.error('Error loading phase missions:', error)
      setPhaseMissions([])
    } finally {
      setLoadingPhaseMissions(false)
    }
  }

  const handleOpenMissionModal = (mission = null) => {
    setEditingMission(mission)
    if (mission) {
      setMissionForm({
        phase: mission.phase,
        title: mission.title,
        missionBody: mission.mission_body,
        completionType: mission.completion_type,
        successKey: mission.success_key || '',
        signoffPromptTemplate: mission.signoff_prompt_template || '',
        variablePool: mission.variable_pool ? mission.variable_pool.join(', ') : '',
        variableSource: mission.variable_source || 'pool',
        signerConstraint: mission.signer_constraint || 'any',
        sameSignerMissionId: mission.same_signer_mission_id || null,
        sortOrder: mission.sort_order || 0,
        bounty: mission.bounty || 0,
        isCulminating: !!mission.is_culminating,
        firstOnly: !!mission.culminating_first_only,
        paymentType: mission.payment_type || '',
        paymentMin: mission.payment_min || 0
      })
    } else {
      setMissionForm({
        phase: 1,
        title: '',
        missionBody: '',
        completionType: 'phrase',
        successKey: '',
        signoffPromptTemplate: '',
        variablePool: '',
        variableSource: 'pool',
        signerConstraint: 'any',
        sameSignerMissionId: null,
        sortOrder: 0,
        bounty: 0,
        isCulminating: false,
        firstOnly: false,
        paymentType: '',
        paymentMin: 0
      })
    }
    setShowMissionModal(true)
  }

  const handleSaveMission = async () => {
    if (!missionForm.title.trim() || !missionForm.missionBody.trim()) {
      alert('Title and mission body are required')
      return
    }

    const poolArray = missionForm.variablePool
      ? missionForm.variablePool.split(',').map(v => v.trim()).filter(Boolean)
      : null

    const data = {
      phase: missionForm.phase,
      title: missionForm.title.trim(),
      missionBody: missionForm.missionBody.trim(),
      completionType: missionForm.completionType,
      successKey: missionForm.completionType === 'phrase' ? missionForm.successKey : null,
      signoffPromptTemplate: missionForm.completionType === 'signoff' ? missionForm.signoffPromptTemplate : null,
      variablePool: poolArray && poolArray.length > 0 ? poolArray : null,
      variableSource: missionForm.variableSource,
      signerConstraint: missionForm.completionType === 'signoff' ? missionForm.signerConstraint : null,
      sameSignerMissionId: missionForm.signerConstraint === 'same_signer' ? missionForm.sameSignerMissionId : null,
      sortOrder: missionForm.sortOrder,
      bounty: parseInt(missionForm.bounty) || 0,
      isCulminating: missionForm.isCulminating,
      firstOnly: missionForm.isCulminating && missionForm.firstOnly,
      paymentType: missionForm.completionType === 'signoff' && missionForm.paymentType ? missionForm.paymentType : null,
      paymentMin: parseInt(missionForm.paymentMin) || 0
    }

    try {
      if (editingMission) {
        await neonApi.updatePhaseMission(editingMission.id, data)
      } else {
        await neonApi.createPhaseMission(data)
      }
      setShowMissionModal(false)
      await loadPhaseMissions()
    } catch (error) {
      alert(`Error saving mission: ${error.message}`)
    }
  }

  const handleDeleteMission = async (missionId) => {
    if (!window.confirm('Delete this mission?')) return
    try {
      await neonApi.deletePhaseMission(missionId)
      await loadPhaseMissions()
    } catch (error) {
      alert(`Error deleting mission: ${error.message}`)
    }
  }

  const loadUsersTab = async () => {
    try {
      const users = await neonApi.getUsers()
      setUsersTabList(users || [])
    } catch (error) {
      console.error('Error loading users:', error)
      setUsersTabList([])
    }
  }

  const openAddPlayer = () => {
    setPlayerForm(EMPTY_PLAYER_FORM)
    setAddSource('new')
    setExistingUserId('')
    setAddToSession(true)
    setPlayerResult(null)
    setPlayerModal({ mode: 'add' })
    if (usersTabList.length === 0) loadUsersTab()
  }

  const openEditPlayer = (user) => {
    setPlayerForm({
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      alias_1: user.alias_1 || '',
      alias_2: user.alias_2 || '',
      passphrase: user.passphrase || '',
      is_admin: !!user.is_admin,
      is_banker: !!user.is_banker,
      ishere: user.ishere !== false,
      staffPin: ''
    })
    setPlayerResult(null)
    setPlayerModal({ mode: 'edit', user })
  }

  const closePlayerModal = () => {
    if (savingPlayer) return
    setPlayerModal(null)
    setPlayerResult(null)
  }

  const handleSavePlayer = async () => {
    const { staffPin, ...userFields } = playerForm
    if (staffPin && !isValidPin(staffPin)) {
      alert('Staff PIN must be 4 to 8 digits')
      return
    }
    setSavingPlayer(true)
    try {
      let user
      let message
      if (playerModal.mode === 'edit') {
        user = await neonApi.updateUser(playerModal.user.id, userFields)
        const aliasChanged = user.alias_1 !== playerModal.user.alias_1 || user.alias_2 !== playerModal.user.alias_2
        message = aliasChanged
          ? 'Saved. Their alias changed, so their login link has changed too — give them the new one below.'
          : 'Saved.'
      } else {
        if (addSource === 'existing') {
          if (!existingUserId) throw new Error('Choose a player')
          user = usersTabList.find(u => u.id === Number(existingUserId))
          if (!user.ishere) user = await neonApi.updateUser(user.id, { ishere: true })
        } else {
          user = await neonApi.createUser(userFields)
        }
        message = `${user.firstname} ${user.lastname} is ready.`
        if (activeSession && addToSession) {
          try {
            const result = await neonApi.addPlayerToSession(activeSession.id, user.id)
            message = `${user.firstname} ${user.lastname} joined ${activeSession.name} with ${result.missionCount} Phase ${result.phase} mission${result.missionCount === 1 ? '' : 's'}.`
          } catch (error) {
            message = `${user.firstname} ${user.lastname} was saved but NOT added to ${activeSession.name}: ${error.message} Retry with Add Player → Existing player.`
          }
        }
      }
      if (staffPin && (user.is_admin || user.is_banker)) {
        await neonApi.setStaffPin(user.id, staffPin)
        message += ' Staff PIN set.'
      }
      setPlayerResult({ user, message })
      await loadUsersTab()
      if (activeSession) {
        await loadSessions()
      }
    } catch (error) {
      alert(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSavingPlayer(false)
    }
  }

  const copyLoginUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this login link:', url)
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-actions">
          <span className="staff-signed-in">{staff.firstname} {staff.lastname}</span>
          <button onClick={() => navigate('/bank')} className="back-button">
            Bank
          </button>
          <button onClick={() => navigate('/awards')} className="back-button">
            Awards
          </button>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab${activeTab === 'sessions' ? ' active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
        <button
          className={`admin-tab${activeTab === 'missions' ? ' active' : ''}`}
          onClick={() => setActiveTab('missions')}
        >
          Missions
        </button>
        <button
          className={`admin-tab${activeTab === 'users' ? ' active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-tab${activeTab === 'push' ? ' active' : ''}`}
          onClick={() => setActiveTab('push')}
        >
          Push
        </button>
      </div>

      <div className="admin-content">

        {/* ===== SESSIONS TAB ===== */}
        {activeTab === 'sessions' && (
          <>
            <div className="admin-section">
              <h2>Session Management</h2>
              <div className="session-controls">
                <button onClick={handleOpenCreateModal} className="button-primary">
                  Create New Session
                </button>
              </div>

              {loading ? (
                <div className="admin-placeholder">
                  <p>Loading sessions...</p>
                </div>
              ) : (
                <div className="sessions-list">
                  {!sessions || sessions.length === 0 ? (
                    <p className="admin-empty-message">
                      No sessions found. Create a new session to get started.
                    </p>
                  ) : (
                    <ul>
                      {Array.isArray(sessions) && sessions.map(session => {
                        const isActive = session.status === 'active'
                        const isExpanded = isActive || expandedSessions.has(session.id)
                        const toggleExpand = () => {
                          if (isActive) return
                          const next = new Set(expandedSessions)
                          if (next.has(session.id)) next.delete(session.id)
                          else next.add(session.id)
                          setExpandedSessions(next)
                        }

                        return (
                          <li key={session.id}>
                            <div className={`session-item${isActive ? ' active' : ' collapsed'}`}>
                              <div className="session-item-header" onClick={!isActive ? toggleExpand : undefined}>
                                <h3>{session.name}</h3>
                                <span className={`session-status status-${session.status}`}>{session.status}</span>
                                {!isActive && (
                                  <span className="session-expand-icon">{isExpanded ? '▾' : '▸'}</span>
                                )}
                              </div>
                              {isExpanded && (
                                <>
                                  <div className="session-info">
                                    <p>Players: {session.participant_user_ids?.length || 0}</p>
                                    {session.created_at && <p>Created: {formatTimestamp(session.created_at)}</p>}
                                    {session.started_at && <p>Started: {formatTimestamp(session.started_at)}</p>}
                                    {session.paused_at && <p>Paused: {formatTimestamp(session.paused_at)}</p>}
                                    {session.ended_at && <p>Ended: {formatTimestamp(session.ended_at)}</p>}
                                  </div>
                                  <div className="session-actions">
                                    {session.status === 'draft' && (
                                      <>
                                        <button onClick={() => handleOpenEditModal(session)} className="button-secondary">Edit</button>
                                        <button onClick={() => handleStartSession(session.id)} className="button-primary">Start Session</button>
                                      </>
                                    )}
                                    {session.status === 'active' && (
                                      <>
                                        {(session.current_phase || 0) < 3 && (
                                          <button onClick={() => handleAdvancePhase()} className="button-primary" disabled={advancingPhase}>
                                            {advancingPhase ? 'Advancing...' : `Advance to Phase ${(session.current_phase || 0) + 1}`}
                                          </button>
                                        )}
                                        <button onClick={() => handlePauseSession(session.id)} className="button-secondary">Pause</button>
                                        <button onClick={() => handleEndSession(session.id)} className="logout-button">End Session</button>
                                      </>
                                    )}
                                    {session.status === 'paused' && (
                                      <>
                                        <button onClick={() => handleOpenEditModal(session)} className="button-secondary">Edit</button>
                                        <button onClick={() => handleResumeSession(session.id)} className="button-primary">Resume</button>
                                        <button onClick={() => handleEndSession(session.id)} className="logout-button">End Session</button>
                                        <button onClick={() => handleResetSession(session.id)} className="logout-button" style={{ backgroundColor: '#d32f2f' }}>Reset</button>
                                      </>
                                    )}
                                    {session.status === 'ended' && (
                                      <>
                                        <button onClick={() => handleOpenEditModal(session)} className="button-secondary">Edit</button>
                                        <button onClick={() => handleResetSession(session.id)} className="logout-button" style={{ backgroundColor: '#d32f2f' }}>Reset</button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== MISSIONS TAB ===== */}
        {activeTab === 'missions' && (
          <div className="admin-section">
            <div className="admin-section-header-row">
              <h2>Phase Missions</h2>
              <div className="session-controls">
                <button onClick={() => handleOpenMissionModal()} className="button-primary">
                  Add Mission
                </button>
                <button onClick={loadPhaseMissions} className="button-secondary" disabled={loadingPhaseMissions}>
                  {loadingPhaseMissions ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            {loadingPhaseMissions ? (
              <div className="admin-placeholder"><p>Loading missions...</p></div>
            ) : phaseMissions.length === 0 ? (
              <p className="admin-empty-message">No missions defined yet.</p>
            ) : (
              [0, 1, 2, 3].map(phase => {
                const missions = phaseMissions.filter(m => m.phase === phase)
                if (missions.length === 0) return null
                return (
                  <div key={phase} className="mission-phase-group">
                    <h3>Phase {phase} ({missions.length} missions)</h3>
                    {missions.map(m => (
                      <div key={m.id} className="mission-list-item">
                        <div className="mission-list-item-header">
                          <strong>{m.title}</strong>
                          <div className="mission-list-item-actions">
                            <button onClick={() => handleOpenMissionModal(m)} className="mission-icon-btn" title="Edit">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteMission(m.id)} className="mission-icon-btn mission-icon-btn-danger" title="Delete">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <span className="mission-meta">
                          {m.is_culminating && <span className="mission-tag tag-culminating">{m.culminating_first_only ? 'culminating · first only' : 'culminating'}</span>}
                          <span className="mission-tag tag-completion">{m.completion_type}</span>
                          {m.bounty ? <span className="mission-tag tag-bounty">{`$${m.bounty}`}</span> : null}
                          {m.payment_type ? <span className="mission-tag tag-variable">{`witness pays ${m.payment_type === 'witness_to_player' ? 'player' : 'CEO'} $${m.payment_min}+`}</span> : null}
                          {m.signer_constraint && m.signer_constraint !== 'any' ? <span className="mission-tag tag-constraint">{m.signer_constraint.replace(/_/g, ' ')}</span> : null}
                          {m.variable_pool ? <span className="mission-tag tag-variable">variables</span> : null}
                          {m.variable_source === 'participants' ? <span className="mission-tag tag-variable">player var</span> : null}
                        </span>
                        <div className="mission-body-preview">
                          {m.mission_body.length > 100 ? m.mission_body.substring(0, 100) + '...' : m.mission_body}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <>
            {activeSession && (
              <div className="admin-section">
                <div className="admin-section-header-row">
                  <h2>Active: {activeSession.name} — Phase {activeSession.current_phase || 0}/3</h2>
                  <div className="session-controls">
                    <button onClick={openAddPlayer} className="button-primary">
                      Add Player
                    </button>
                    <button
                      onClick={() => setShowPassphrases(p => !p)}
                      className={`button-secondary${showPassphrases ? ' active' : ''}`}
                    >
                      {showPassphrases ? 'Hide PW' : 'Show PW'}
                    </button>
                    <button
                      onClick={() => loadActiveSessionData(activeSession)}
                      className="button-secondary"
                      disabled={loadingSessionData}
                    >
                      {loadingSessionData ? '...' : 'Refresh'}
                    </button>
                    <button
                      className="button-icon"
                      title="Download Player URLs as CSV"
                      onClick={() => {
                        const rows = [['Name', 'URL']]
                        sessionUsers.forEach(user => {
                          const name = `${user.firstname} ${user.lastname}`
                          const url = getPlayerLoginUrl(user)
                          rows.push([name, url])
                        })
                        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `${activeSession.name}-player-urls.csv`
                        a.click()
                        URL.revokeObjectURL(a.href)
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2v8M4 7l4 4 4-4M2 14h12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {(() => {
                  const currentPhase = activeSession.current_phase || 0
                  const waiting = playerMissions.filter(m =>
                    m.culminatingUnlocked && !m.completed && m.phase >= currentPhase
                  )
                  if (waiting.length === 0) return null
                  return (
                    <div className="handler-queue">
                      <strong>Waiting for a handler:</strong>
                      <ul>
                        {waiting.map(m => (
                          <li key={m.playerMissionId}>{m.playerName} — {m.title}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })()}
                {loadingSessionData ? (
                  <div className="admin-placeholder">
                    <p>Loading session data...</p>
                  </div>
                ) : sessionUsers.length === 0 ? (
                  <p className="admin-empty-message">No users in this session.</p>
                ) : (
                  <div className="session-users-view">
                    {sessionUsers.map(user => {
                      const missions = playerMissions.filter(m => m.userId === user.id)
                      const phases = [0, 1, 2, 3].filter(p => missions.some(m => m.phase === p))
                      const currentPhase = activeSession.current_phase || 0

                      return (
                        <div key={user.id} className="participant-card">
                          <div className="participant-header">
                            <span>{user.firstname} {user.lastname}</span>
                            <button onClick={() => openEditPlayer(user)} className="button-small">Edit</button>
                          </div>
                          {showPassphrases && user.passphrase && (
                            <div className="participant-passphrase">{user.passphrase}</div>
                          )}
                          {phases.length === 0 ? (
                            <span className="admin-empty-message">No missions assigned</span>
                          ) : (
                            phases.map(phase => {
                              const phaseMissions = missions.filter(m => m.phase === phase)
                              const isLocked = phase < currentPhase
                              return (
                                <div key={phase} className="participant-phase">
                                  <div className={`phase-label${isLocked ? ' locked' : ''}`}>
                                    Phase {phase} {isLocked ? '(Locked)' : phase === currentPhase ? '(Current)' : ''}
                                  </div>
                                  <div className="phase-missions">
                                    {phaseMissions.map(m => (
                                      <div
                                        key={m.playerMissionId}
                                        className={`phase-mission-row${m.completed ? ' completed' : ''}${isLocked && !m.completed ? ' locked' : ''}${m.culminatingUnlocked && !m.completed && !isLocked ? ' culminating-ready' : ''}`}
                                      >
                                        <div>
                                          {m.isCulminating && <span className="mission-tag tag-culminating">culminating</span>}
                                          <strong>{m.title}</strong>
                                          {m.isCulminating && !m.completed && !isLocked && (
                                            <span className="mission-type">
                                              {m.culminatingUnlocked
                                                ? ' — unlocked, see handler'
                                                : m.culminatingClaimed
                                                  ? ' — another agent finished first'
                                                  : ` — hidden until ${phaseMissions.filter(x => !x.isCulminating && x.completed).length}/${phaseMissions.filter(x => !x.isCulminating).length} done${m.firstOnly ? ' (first agent only)' : ''}`}
                                            </span>
                                          )}
                                          {m.variableValue && (
                                            <span className="mission-variable"> [{m.variableValue}]</span>
                                          )}
                                          <span className="mission-type"> ({m.completionType})</span>
                                          {m.completed && (
                                            <span className="mission-done">
                                              Done{m.signerName ? ` (signed by ${m.signerName})` : ''}
                                            </span>
                                          )}
                                        </div>
                                        {!m.completed && !isLocked && !m.culminatingClaimed && (
                                          <button
                                            onClick={() => handleRequestCompleteMission(m.playerMissionId, m.userId)}
                                            className="button-complete"
                                          >
                                            Complete
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {!activeSession && (
              <div className="admin-section">
                <p className="admin-empty-message">No active session. Start a session from the Sessions tab to see participants here.</p>
              </div>
            )}

            <div className="admin-section">
              <div className="admin-section-header-row">
                <h2>All Users ({usersTabList.length})</h2>
                <div className="session-controls">
                  {!activeSession && (
                    <button onClick={openAddPlayer} className="button-primary">Add Player</button>
                  )}
                  <button onClick={loadUsersTab} className="button-secondary">Refresh</button>
                </div>
              </div>
              <ul className="user-list">
                {usersTabList.map(user => (
                  <li key={user.id} className={`user-row${user.ishere ? '' : ' away'}`}>
                    <div>
                      <strong>{user.firstname} {user.lastname}</strong>
                      <span className="user-row-meta">
                        {user.alias_1} {user.alias_2}
                        {user.is_admin && ' · host'}
                        {user.is_banker && ' · banker'}
                        {(user.is_admin || user.is_banker) && !user.has_staff_pin && ' (no staff PIN)'}
                        {!user.ishere && ' · not checked in'}
                      </span>
                    </div>
                    <button onClick={() => openEditPlayer(user)} className="button-small">Edit</button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ===== PUSH TAB ===== */}
        {activeTab === 'push' && (
          <>
            {!activeSession ? (
              <div className="admin-section">
                <p className="admin-empty-message">No active session. Start a session first to send push missions.</p>
              </div>
            ) : (
              <div className="admin-section">
                <h2>Send Push Mission</h2>
                <div className="admin-form-group">
                  <label>Target Player</label>
                  <select
                    value={pushMissionForm.targetUserId}
                    onChange={(e) => setPushMissionForm(f => ({ ...f, targetUserId: e.target.value }))}
                  >
                    <option value="">-- Select player --</option>
                    {sessionUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.firstname} {user.lastname}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={pushMissionForm.title}
                    onChange={(e) => setPushMissionForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Mission title"
                  />
                </div>
                <div className="admin-form-group">
                  <label>Mission Body</label>
                  <textarea
                    value={pushMissionForm.missionBody}
                    onChange={(e) => setPushMissionForm(f => ({ ...f, missionBody: e.target.value }))}
                    rows={4}
                    placeholder="Write the mission details..."
                  />
                </div>
                <div className="admin-form-group">
                  <label>Bounty ($)</label>
                  <input
                    type="number"
                    value={pushMissionForm.bounty}
                    onChange={(e) => setPushMissionForm(f => ({ ...f, bounty: e.target.value }))}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <button
                  onClick={handleSendPushMission}
                  disabled={sendingPushMission || !pushMissionForm.targetUserId || !pushMissionForm.title.trim()}
                  className="button-primary"
                >
                  {sendingPushMission ? 'Sending...' : 'Send Push Mission'}
                </button>

                <h2 style={{ marginTop: '2rem' }}>Sent Push Missions</h2>
                {loadingPushHistory ? (
                  <p>Loading...</p>
                ) : pushMissionHistory.length === 0 ? (
                  <p className="admin-empty-message">No push missions sent yet.</p>
                ) : (
                  <div className="push-mission-history">
                    {pushMissionHistory.map(pm => (
                      <div key={pm.id} className="push-mission-history-item">
                        <div className="push-mission-history-header">
                          <strong>{pm.title}</strong>
                          <span className="push-mission-history-target">→ {pm.target_firstname} {pm.target_lastname}</span>
                          {pm.bounty > 0 && <span className="push-mission-history-bounty">${pm.bounty}</span>}
                        </div>
                        <div className="push-mission-history-status">
                          {pm.completed ? (
                            <span className="push-status-badge push-status-badge--completed">Completed</span>
                          ) : pm.acknowledged ? (
                            <>
                              <span className="push-status-badge push-status-badge--acknowledged">Acknowledged</span>
                              <button
                                onClick={() => handleCompletePushMission(pm.id)}
                                className="button-complete"
                              >
                                Mark Complete
                              </button>
                            </>
                          ) : (
                            <span className="push-status-badge push-status-badge--pending">Pending</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
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
                        {user.passphrase && <span className="user-codename">{user.passphrase}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="button-secondary" disabled={creatingSession}>
                Cancel
              </button>
              <button onClick={handleCreateSession} className="button-primary" disabled={creatingSession || !sessionName.trim() || selectedUsers.size === 0}>
                {creatingSession ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && (
        <div className="admin-modal-overlay" onClick={() => !editingSession && setShowEditModal(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Edit Session</h2>
              <button
                className="admin-modal-close"
                onClick={() => setShowEditModal(false)}
                disabled={editingSession}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label htmlFor="edit-session-name">Session Name</label>
                <input
                  id="edit-session-name"
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Enter session name"
                  disabled={editingSession}
                />
              </div>
              <div className="admin-form-group">
                <div className="admin-form-header">
                  <label>Select Players ({selectedUsers.size} selected)</label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="select-all-button"
                    disabled={editingSession}
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
                        disabled={editingSession}
                      />
                      <span className="user-info">
                        <strong>{user.firstname} {user.lastname}</strong>
                        {user.passphrase && <span className="user-codename">{user.passphrase}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button onClick={() => setShowEditModal(false)} className="button-secondary" disabled={editingSession}>
                Cancel
              </button>
              <button onClick={handleUpdateSession} className="button-primary" disabled={editingSession || !sessionName.trim() || selectedUsers.size === 0}>
                {editingSession ? 'Updating...' : 'Update Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mission Create/Edit Modal */}
      {showMissionModal && (
        <div className="admin-modal-overlay" onClick={() => setShowMissionModal(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h2>{editingMission ? 'Edit Mission' : 'Add Mission'}</h2>
              <button className="admin-modal-close" onClick={() => setShowMissionModal(false)}>x</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label>Phase</label>
                <select
                  value={missionForm.phase}
                  onChange={(e) => setMissionForm({ ...missionForm, phase: parseInt(e.target.value) })}
                >
                  <option value={0}>Phase 0 (Icebreaker)</option>
                  <option value={1}>Phase 1 (Act I)</option>
                  <option value={2}>Phase 2 (Act II)</option>
                  <option value={3}>Phase 3 (Act III)</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={missionForm.isCulminating}
                    onChange={(e) => {
                      const isCulminating = e.target.checked
                      // Culminating missions are run by a handler, so default to a host sign-off
                      setMissionForm(isCulminating ? {
                        ...missionForm,
                        isCulminating,
                        completionType: 'signoff',
                        signerConstraint: 'admin_only',
                        missionBody: missionForm.missionBody || 'See your handler for more information.'
                      } : { ...missionForm, isCulminating })
                    }}
                  />
                  Culminating mission
                </label>
                <p className="admin-form-hint">Hidden from each player until they've completed every other mission in this phase.</p>
                {missionForm.isCulminating && (
                  <>
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={missionForm.firstOnly}
                        onChange={(e) => setMissionForm({ ...missionForm, firstOnly: e.target.checked })}
                      />
                      First agent only
                    </label>
                    <p className="admin-form-hint">Only the first agent to finish this phase gets it; nobody else ever sees it.</p>
                  </>
                )}
              </div>
              <div className="admin-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={missionForm.title}
                  onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
                  placeholder="Mission title"
                />
              </div>
              <div className="admin-form-group">
                <label>Mission Body</label>
                <textarea
                  value={missionForm.missionBody}
                  onChange={(e) => setMissionForm({ ...missionForm, missionBody: e.target.value })}
                  placeholder="Use {variable} for the individualized element"
                  rows={3}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 'inherit', padding: '8px' }}
                />
              </div>
              <div className="admin-form-group">
                <label>Completion Type</label>
                <select
                  value={missionForm.completionType}
                  onChange={(e) => setMissionForm({ ...missionForm, completionType: e.target.value })}
                >
                  <option value="phrase">Phrase (player types an answer)</option>
                  <option value="signoff">Sign-off (another player confirms)</option>
                </select>
              </div>
              {missionForm.completionType === 'phrase' && (
                <div className="admin-form-group">
                  <label>Success Key (correct answer)</label>
                  <input
                    type="text"
                    value={missionForm.successKey}
                    onChange={(e) => setMissionForm({ ...missionForm, successKey: e.target.value })}
                    placeholder="The answer to validate against"
                  />
                </div>
              )}
              {missionForm.completionType === 'signoff' && (
                <>
                  <div className="admin-form-group">
                    <label>Sign-off Prompt Template</label>
                    <textarea
                      value={missionForm.signoffPromptTemplate}
                      onChange={(e) => setMissionForm({ ...missionForm, signoffPromptTemplate: e.target.value })}
                      placeholder="{player_name} did the thing I asked them to do."
                      rows={2}
                      style={{ width: '100%', fontFamily: 'inherit', fontSize: 'inherit', padding: '8px' }}
                    />
                    <small style={{ color: '#888' }}>
                      Placeholders: {'{player_name}'}, {'{variable}'}
                    </small>
                  </div>
                  <div className="admin-form-group">
                    <label>Signer Constraint</label>
                    <select
                      value={missionForm.signerConstraint}
                      onChange={(e) => setMissionForm({ ...missionForm, signerConstraint: e.target.value })}
                    >
                      <option value="any">Any other player</option>
                      <option value="new_signer">Must be a new signer</option>
                      <option value="same_signer">Must be the same signer as another mission</option>
                      <option value="admin_only">Admin only (hosts)</option>
                      <option value="ceo">The CEO (a host's passphrase, even if they aren't playing)</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Payment at sign-off</label>
                    <select
                      value={missionForm.paymentType}
                      onChange={(e) => setMissionForm({ ...missionForm, paymentType: e.target.value })}
                    >
                      <option value="">None</option>
                      <option value="witness_to_player">Witness pays the player (e.g. buys their art)</option>
                      <option value="witness_to_house">Witness pays MacGuffin Toys (e.g. invests)</option>
                    </select>
                    {missionForm.paymentType && (
                      <>
                        <label style={{ marginTop: 'var(--unit-sm)' }}>Minimum payment ($)</label>
                        <input
                          type="number"
                          min="1"
                          value={missionForm.paymentMin}
                          onChange={(e) => setMissionForm({ ...missionForm, paymentMin: e.target.value })}
                        />
                      </>
                    )}
                    <p className="admin-form-hint">Taken from the witness's bank account when they sign off; the sign-off fails if they can't afford it.</p>
                  </div>
                  {missionForm.signerConstraint === 'same_signer' && (
                    <div className="admin-form-group">
                      <label>Same Signer As Mission</label>
                      <select
                        value={missionForm.sameSignerMissionId || ''}
                        onChange={(e) => setMissionForm({ ...missionForm, sameSignerMissionId: e.target.value ? parseInt(e.target.value) : null })}
                      >
                        <option value="">-- Select mission --</option>
                        {phaseMissions
                          .filter(m => m.completion_type === 'signoff' && m.id !== editingMission?.id)
                          .map(m => (
                            <option key={m.id} value={m.id}>Phase {m.phase}: {m.title}</option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="admin-form-group">
                <label>Variable Source</label>
                <select
                  value={missionForm.variableSource}
                  onChange={(e) => setMissionForm({ ...missionForm, variableSource: e.target.value })}
                >
                  <option value="pool">Static pool (comma-separated list below)</option>
                  <option value="participants">Session participants (assigns a random other player)</option>
                </select>
              </div>
              {missionForm.variableSource === 'pool' && (
                <div className="admin-form-group">
                  <label>Variable Pool (comma-separated, leave blank for none)</label>
                  <input
                    type="text"
                    value={missionForm.variablePool}
                    onChange={(e) => setMissionForm({ ...missionForm, variablePool: e.target.value })}
                    placeholder="French, Italian, Spanish, German"
                  />
                </div>
              )}
              <div className="admin-form-group">
                <label>Bounty (dollars awarded on completion)</label>
                <input
                  type="number"
                  min="0"
                  value={missionForm.bounty}
                  onChange={(e) => setMissionForm({ ...missionForm, bounty: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="admin-form-group">
                <label>Sort Order</label>
                <input
                  type="number"
                  value={missionForm.sortOrder}
                  onChange={(e) => setMissionForm({ ...missionForm, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button onClick={() => setShowMissionModal(false)} className="button-secondary">
                Cancel
              </button>
              <button onClick={handleSaveMission} className="button-primary">
                {editingMission ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Mission Confirmation Modal */}
      {showCompleteConfirm && completingMission && (
        <div className="admin-modal-overlay" onClick={handleCancelCompleteMission}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Complete Mission</h2>
              <button className="admin-modal-close" onClick={handleCancelCompleteMission}>x</button>
            </div>
            <div className="admin-modal-body">
              <p>Are you sure you want to manually complete this mission?</p>
              <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                This will mark the mission as completed and award intel to the user (if applicable).
              </p>
            </div>
            <div className="admin-modal-footer">
              <button onClick={handleCancelCompleteMission} className="button-secondary">Cancel</button>
              <button onClick={handleConfirmCompleteMission} className="button-primary" style={{ backgroundColor: '#4CAF50' }}>
                Complete Mission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Player Modal */}
      {playerModal && (
        <div className="admin-modal-overlay" onClick={closePlayerModal}>
          <div className="admin-modal-content player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{playerModal.mode === 'edit' ? `Edit ${playerModal.user.firstname} ${playerModal.user.lastname}` : 'Add Player'}</h2>
              <button className="admin-modal-close" onClick={closePlayerModal} disabled={savingPlayer}>x</button>
            </div>

            {playerResult ? (
              <>
                <div className="admin-modal-body">
                  <p>{playerResult.message}</p>
                  <div className="admin-form-group">
                    <label>Login link (for their QR code / NFC tag)</label>
                    <div className="login-url-row">
                      <input type="text" readOnly value={getPlayerLoginUrl(playerResult.user)} onFocus={(e) => e.target.select()} />
                      <button className="button-secondary" onClick={() => copyLoginUrl(getPlayerLoginUrl(playerResult.user))}>Copy</button>
                    </div>
                  </div>
                  <p className="user-row-meta">Passphrase: {playerResult.user.passphrase}</p>
                </div>
                <div className="admin-modal-footer">
                  {playerModal.mode === 'add' && (
                    <button className="button-secondary" onClick={openAddPlayer}>Add Another</button>
                  )}
                  <button className="button-primary" onClick={closePlayerModal}>Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="admin-modal-body">
                  {playerModal.mode === 'add' && (
                    <div className="admin-form-group">
                      <label>Player</label>
                      <select value={addSource} onChange={(e) => setAddSource(e.target.value)} disabled={savingPlayer}>
                        <option value="new">New player</option>
                        <option value="existing">Existing player (returning guest)</option>
                      </select>
                    </div>
                  )}

                  {playerModal.mode === 'add' && addSource === 'existing' ? (
                    <div className="admin-form-group">
                      <label>Choose Player</label>
                      <select value={existingUserId} onChange={(e) => setExistingUserId(e.target.value)} disabled={savingPlayer}>
                        <option value="">Select…</option>
                        {usersTabList.filter(u => !activeSession?.participant_user_ids?.includes(u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.firstname} {u.lastname} ({u.alias_1} {u.alias_2})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="admin-form-group">
                        <label>First Name</label>
                        <input type="text" value={playerForm.firstname} onChange={(e) => setPlayerForm({ ...playerForm, firstname: e.target.value })} disabled={savingPlayer} />
                      </div>
                      <div className="admin-form-group">
                        <label>Last Name</label>
                        <input type="text" value={playerForm.lastname} onChange={(e) => setPlayerForm({ ...playerForm, lastname: e.target.value })} disabled={savingPlayer} />
                      </div>
                      <div className="admin-form-group">
                        <label>Alias 1</label>
                        <input type="text" value={playerForm.alias_1} onChange={(e) => setPlayerForm({ ...playerForm, alias_1: e.target.value })} placeholder="e.g. Swift" disabled={savingPlayer} />
                      </div>
                      <div className="admin-form-group">
                        <label>Alias 2</label>
                        <input type="text" value={playerForm.alias_2} onChange={(e) => setPlayerForm({ ...playerForm, alias_2: e.target.value })} placeholder="e.g. Spider" disabled={savingPlayer} />
                        {playerModal.mode === 'edit' && <p className="user-row-meta">Changing the alias changes their login link.</p>}
                      </div>
                      <div className="admin-form-group">
                        <label>Passphrase</label>
                        <input type="text" value={playerForm.passphrase} onChange={(e) => setPlayerForm({ ...playerForm, passphrase: e.target.value })} placeholder="One memorable word" disabled={savingPlayer} />
                      </div>
                      {playerModal.mode === 'edit' && (
                        <div className="admin-form-group">
                          <label className="admin-checkbox-label">
                            <input type="checkbox" checked={playerForm.ishere} onChange={(e) => setPlayerForm({ ...playerForm, ishere: e.target.checked })} disabled={savingPlayer} />
                            Checked in (can sign in and sign off missions)
                          </label>
                        </div>
                      )}
                      <div className="admin-form-group">
                        <label className="admin-checkbox-label">
                          <input type="checkbox" checked={playerForm.is_admin} onChange={(e) => setPlayerForm({ ...playerForm, is_admin: e.target.checked })} disabled={savingPlayer} />
                          Host (full admin dashboard)
                        </label>
                        <label className="admin-checkbox-label">
                          <input type="checkbox" checked={playerForm.is_banker} onChange={(e) => setPlayerForm({ ...playerForm, is_banker: e.target.checked })} disabled={savingPlayer} />
                          Banker (bank screen only)
                        </label>
                      </div>
                      {(playerForm.is_admin || playerForm.is_banker) && (
                        <div className="admin-form-group">
                          <label>Staff PIN</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={playerForm.staffPin}
                            onChange={(e) => setPlayerForm({ ...playerForm, staffPin: e.target.value.replace(/\D/g, '') })}
                            placeholder={playerModal.mode === 'edit' && playerModal.user.has_staff_pin ? 'Leave blank to keep current PIN' : '4–8 digits'}
                            disabled={savingPlayer}
                          />
                          <p className="admin-form-hint">
                            {playerModal.mode === 'edit' && playerModal.user.has_staff_pin
                              ? 'They sign in at /staff with their name and this PIN.'
                              : "No PIN yet: they can't sign in at /staff until you set one."}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {playerModal.mode === 'add' && activeSession && (
                    <div className="admin-form-group">
                      <label className="admin-checkbox-label">
                        <input type="checkbox" checked={addToSession} onChange={(e) => setAddToSession(e.target.checked)} disabled={savingPlayer} />
                        Add to {activeSession.name} and assign Phase {activeSession.current_phase || 0} missions
                      </label>
                    </div>
                  )}
                </div>
                <div className="admin-modal-footer">
                  <button className="button-secondary" onClick={closePlayerModal} disabled={savingPlayer}>Cancel</button>
                  <button className="button-primary" onClick={handleSavePlayer} disabled={savingPlayer}>
                    {savingPlayer ? 'Saving...' : playerModal.mode === 'edit' ? 'Save' : 'Add Player'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default AdminDashboard

