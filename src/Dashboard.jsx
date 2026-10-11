import React, { useState, useEffect } from 'react'
import { neonApi } from './neonApi'
import BankStrip from './BankStrip'
import BriefingModalPanel from './Briefing'
import { FINAL_PHASE } from './api/game.js'
import AgentTab from './AgentTab'
import MissionsTab, { BriefingMissionRow } from './MissionsTab'

function renderSignoffMadlibPreview(template, firstName, lastName, variableValue) {
  const playerName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const varVal = (variableValue || '').trim()
  const parts = template.split(/(\{player_name\}|\{variable\}|\{signer_name\})/g)
  return parts.map((part, i) => {
    if (part === '{player_name}') {
      return (
        <span key={i} className="mission-signoff-madlib-fill">
          {playerName || '________'}
        </span>
      )
    }
    if (part === '{variable}') {
      return (
        <span key={i} className="mission-signoff-madlib-fill">
          {varVal || '________'}
        </span>
      )
    }
    if (part === '{signer_name}') {
      return (
        <span key={i} className="mission-signoff-madlib-fill mission-signoff-madlib-blank">
          {' '}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function formatWitnessSignedAt(iso) {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// payment: money a witness paid this player at sign-off, deposited alongside the bounty
function DepositNotice({ amount, payment }) {
  const total = amount + (payment?.amount || 0)
  return (
    <div className="bounty-award">
      <p className="bounty-award-amount">${total.toLocaleString()} deposited!</p>
      <p className="bounty-award-lede">
        {payment && `$${amount.toLocaleString()} bounty + $${payment.amount.toLocaleString()} from ${payment.from}. `}
        It's in your bank. Tap BANK at the bottom of the screen to see your balance.
      </p>
    </div>
  )
}

// The player's code name, shown at the top of their dashboard
function AgentBadge({ user }) {
  const codename = [user?.alias_1, user?.alias_2].filter(Boolean).join(' ')
  if (!codename) return null
  return (
    <div className="dashboard-agent">
      <span className="dashboard-agent-label">Agent</span>
      <strong className="dashboard-agent-name">{codename}</strong>
    </div>
  )
}

function DashboardFooter({ currentUser, onLogout, onUserUpdate, bankSessionId, bankRefreshKey }) {
  return (
    <footer className="dashboard-footer">
      <BankStrip sessionId={bankSessionId} userId={currentUser?.id} refreshKey={bankRefreshKey} />
      <AgentTab currentUser={currentUser} onUserUpdate={onUserUpdate} />
      <div className="dashboard-footer-actions">
        <button type="button" className="logout-button button-min" onClick={onLogout}>LOGOUT</button>
      </div>
    </footer>
  )
}

// Bump this whenever the briefing changes so every player sees the new one once
const BRIEFING_SEEN_KEY = 'briefingSeen:oct10'

// Which culminating-mission unlocks this phone has already announced
const CULMINATING_SEEN_KEY = 'culminatingSeen'

function readCulminatingSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CULMINATING_SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function markCulminatingSeen(playerMissionId) {
  try {
    const seen = readCulminatingSeen()
    seen.add(playerMissionId)
    localStorage.setItem(CULMINATING_SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // Without storage the announcement may repeat after a reload; harmless
  }
}

function Dashboard({ agentId, firstName, lastName, onLogout, onUserUpdate, currentUser }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successKeys, setSuccessKeys] = useState({})
  const [completedMissions, setCompletedMissions] = useState(new Set())
  const [missionErrors, setMissionErrors] = useState({})

  const [activeSessionId, setActiveSessionId] = useState(null)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [signerPassphrase, setSignerPassphrase] = useState('')
  // Missions that charge the witness at sign-off: amount they agree to, and what was paid
  const [paymentAmount, setPaymentAmount] = useState('')
  const [completedPayment, setCompletedPayment] = useState(null)
  const [signoffSuccessSignerName, setSignoffSuccessSignerName] = useState(null)
  const [signoffSignedAt, setSignoffSignedAt] = useState(null)
  const [signoffPhase, setSignoffPhase] = useState('brief')

  const [showMissionModal, setShowMissionModal] = useState(false)
  const [isMissionClosing, setIsMissionClosing] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [showMissionSuccess, setShowMissionSuccess] = useState(false)
  const [showMissionFailed, setShowMissionFailed] = useState(false)
  const [missionFailedMessage, setMissionFailedMessage] = useState(null)
  const [completedBounty, setCompletedBounty] = useState(0)
  const [isInActiveSession, setIsInActiveSession] = useState(false)
  const [sessionPaused, setSessionPaused] = useState(false)
  // Bumped when the phone wakes up / the tab comes back, to refresh everything
  // at once instead of showing stale data until the next poll
  const [wakeTick, setWakeTick] = useState(0)
  const [sessionCheckLoading, setSessionCheckLoading] = useState(true)

  const [showBriefingModal, setShowBriefingModal] = useState(() => !localStorage.getItem(BRIEFING_SEEN_KEY))
  const [isBriefingClosing, setIsBriefingClosing] = useState(false)

  const [pushMissions, setPushMissions] = useState([])
  const [pendingPushMission, setPendingPushMission] = useState(null)
  const [showPushMissionModal, setShowPushMissionModal] = useState(false)
  const [isPushMissionClosing, setIsPushMissionClosing] = useState(false)
  const [pushMissionType, setPushMissionType] = useState('new')

  const [unlockedCulminating, setUnlockedCulminating] = useState(null)
  const [isUnlockClosing, setIsUnlockClosing] = useState(false)

  // ── Session & mission data fetching ────────────────────────────────────────

  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        setSessionCheckLoading(true)
        const activeSession = await neonApi.getCurrentSession()
        setSessionPaused(activeSession?.status === 'paused')
        if (activeSession && activeSession.participant_user_ids) {
          const agentIdNum = Number(agentId)
          const participantIds = activeSession.participant_user_ids.map(id => Number(id))
          const userInSession = participantIds.includes(agentIdNum)
          setIsInActiveSession(userInSession)
          setActiveSessionId(activeSession.id)
          setCurrentPhase(activeSession.current_phase || 0)

          if (!userInSession) {
            setMissions([])
            setLoading(false)
          }
        } else {
          setIsInActiveSession(false)
          setActiveSessionId(null)
          setCurrentPhase(0)
          setMissions([])
          setLoading(false)
        }
      } catch (error) {
        console.error('Error checking active session:', error)
        setIsInActiveSession(false)
        setActiveSessionId(null)
        setMissions([])
        setLoading(false)
      } finally {
        setSessionCheckLoading(false)
      }
    }

    checkActiveSession()
  }, [agentId])

  useEffect(() => {
    if (isInActiveSession && !sessionCheckLoading && activeSessionId) {
      fetchMissions()
    } else if (!isInActiveSession) {
      setError(null)
    }
  }, [agentId, isInActiveSession, sessionCheckLoading, activeSessionId])

  useEffect(() => {
    if (missions.length > 0 || (!loading && !sessionCheckLoading)) {
      setError(null)
    }
  }, [missions, loading, sessionCheckLoading])

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') setWakeTick(t => t + 1)
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('pageshow', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('pageshow', onWake)
    }
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const activeSession = await neonApi.getCurrentSession()
        setSessionPaused(activeSession?.status === 'paused')
        if (activeSession && activeSession.participant_user_ids) {
          const userInSession = activeSession.participant_user_ids.map(Number).includes(Number(agentId))
          if (userInSession !== isInActiveSession) {
            setIsInActiveSession(userInSession)
            if (!userInSession) setMissions([])
          }
          setActiveSessionId(activeSession.id)
          if (activeSession.current_phase !== undefined) {
            setCurrentPhase(activeSession.current_phase)
          }
        } else {
          if (isInActiveSession) {
            setIsInActiveSession(false)
            setMissions([])
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error)
      }
    }
    if (wakeTick > 0) checkSession()
    const interval = setInterval(checkSession, 10000)
    return () => clearInterval(interval)
  }, [agentId, isInActiveSession, wakeTick])

  useEffect(() => {
    if (!isInActiveSession || !activeSessionId) return

    const checkMissions = async () => {
      try {
        const playerMissions = await neonApi.getPlayerMissions(activeSessionId, agentId)
        setError(null)
        if (playerMissions && playerMissions.length > 0) {
          setCurrentPhase(playerMissions[0].currentPhase || 0)
        }
        setMissions(playerMissions || [])
        setCompletedMissions(new Set(
          (playerMissions || []).filter(m => m.completed).map(m => m.playerMissionId)
        ))
      } catch (error) {
        if (error && error.message && !error.message.includes('session')) {
          console.error('[AUTO-CHECK] Error checking missions:', error)
        }
      }
    }

    if (wakeTick > 0) checkMissions()
    const interval = setInterval(checkMissions, 5000)
    return () => clearInterval(interval)
  }, [agentId, isInActiveSession, activeSessionId, wakeTick])

  useEffect(() => {
    if (!isInActiveSession || !activeSessionId) return

    const checkPushMissions = async () => {
      try {
        // One query; split into acknowledged / new / completed-but-unseen here
        const all = (await neonApi.getPushMissionsForPlayer(activeSessionId, agentId)) || []
        const at = (t) => new Date(t).getTime()
        setPushMissions(all.filter(m => m.acknowledged).sort((a, b) => at(b.created_at) - at(a.created_at)))

        if (showPushMissionModal) return

        const pending = all.filter(m => !m.acknowledged)
        if (pending.length > 0) {
          setPendingPushMission(pending[0])
          setPushMissionType('new')
          setShowPushMissionModal(true)
          return
        }

        const completedUnseen = all
          .filter(m => m.completed && !m.completion_seen)
          .sort((a, b) => at(a.completed_at) - at(b.completed_at))
        if (completedUnseen.length > 0) {
          setPendingPushMission(completedUnseen[0])
          setPushMissionType('completed')
          setShowPushMissionModal(true)
        }
      } catch (error) {
        console.error('[PUSH-MISSIONS] Error checking push missions:', error)
      }
    }

    checkPushMissions()
    const interval = setInterval(checkPushMissions, 5000)
    return () => clearInterval(interval)
  }, [agentId, isInActiveSession, activeSessionId, showPushMissionModal, wakeTick])

  const fetchMissions = async () => {
    try {
      setLoading(true)
      setError(null)
      if (!activeSessionId) { setMissions([]); return }

      const playerMissions = await neonApi.getPlayerMissions(activeSessionId, agentId)
      setMissions(playerMissions || [])
      if (playerMissions && playerMissions.length > 0) {
        setCurrentPhase(playerMissions[0].currentPhase || 0)
      }
      setCompletedMissions(new Set(
        (playerMissions || []).filter(m => m.completed).map(m => m.playerMissionId)
      ))
      setSuccessKeys({})
      setMissionErrors({})
    } catch (error) {
      console.error('Error fetching missions:', error)
      if (error && error.message) setError('Failed to fetch missions: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Culminating mission unlock announcement ────────────────────────────────

  // Announce a newly unlocked culminating mission once nothing else is on screen
  // (e.g. after the player closes the success screen for their last mission).
  useEffect(() => {
    if (unlockedCulminating || showMissionModal || showPushMissionModal || showBriefingModal) return
    const seen = readCulminatingSeen()
    const next = missions.find(m =>
      m.culminatingUnlocked && !m.completed && !m.phaseLocked && !seen.has(m.playerMissionId)
    )
    if (next) {
      setIsUnlockClosing(false)
      setUnlockedCulminating(next)
    }
  }, [missions, unlockedCulminating, showMissionModal, showPushMissionModal, showBriefingModal])

  const acknowledgeCulminatingUnlock = () => {
    if (!unlockedCulminating) return
    markCulminatingSeen(unlockedCulminating.playerMissionId)
    setIsUnlockClosing(true)
    setTimeout(() => {
      setUnlockedCulminating(null)
      setIsUnlockClosing(false)
    }, 300)
  }

  // ── Push mission modal ─────────────────────────────────────────────────────

  const handleAcknowledgePushMission = async () => {
    if (!pendingPushMission) return
    try {
      if (pushMissionType === 'new') {
        await neonApi.acknowledgePushMission(pendingPushMission.id, agentId)
      } else {
        await neonApi.markCompletionSeen(pendingPushMission.id, agentId)
      }
      setIsPushMissionClosing(true)
      setTimeout(() => {
        setShowPushMissionModal(false)
        setIsPushMissionClosing(false)
        setPendingPushMission(null)
      }, 300)
    } catch (error) {
      console.error('Error acknowledging push mission:', error)
    }
  }

  // ── Mission & briefing modals ─────────────────────────────────────────────

  const resetMissionModal = () => {
    setShowMissionModal(false)
    setIsMissionClosing(false)
    setSelectedMissionId(null)
    setShowMissionSuccess(false)
    setShowMissionFailed(false)
    setMissionFailedMessage(null)
    setCompletedBounty(0)
    setSignoffSuccessSignerName(null)
    setSignoffPhase('brief')
    setSignerPassphrase('')
    setPaymentAmount('')
    setCompletedPayment(null)
    setSignoffSignedAt(null)
  }

  const openBriefingModal = () => {
    resetMissionModal()
    setShowBriefingModal(true)
    setIsBriefingClosing(false)
  }

  const closeBriefingModal = () => {
    setIsBriefingClosing(true)
    localStorage.setItem(BRIEFING_SEEN_KEY, '1')
    setTimeout(() => {
      setShowBriefingModal(false)
      setIsBriefingClosing(false)
    }, 300)
  }

  const openMissionModal = (missionId) => {
    setShowBriefingModal(false)
    setIsBriefingClosing(false)
    setSelectedMissionId(missionId)
    setShowMissionModal(true)
    setShowMissionSuccess(false)
    setShowMissionFailed(false)
    setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
    setMissionFailedMessage(null)
    setCompletedBounty(0)
    setSignoffSuccessSignerName(null)
    setSignoffPhase('brief')
    setSignerPassphrase('')
    setPaymentAmount('')
    setCompletedPayment(null)
    setSignoffSignedAt(null)

    const mission = missions.find(m => m.playerMissionId === missionId)
    if (mission?.completionType === 'signoff' && mission.completed) {
      setShowMissionSuccess(false)
      setSignoffPhase('witnessDone')
      setSignoffSuccessSignerName(mission.signerName || null)
      setSignoffSignedAt(mission.signedOffAt || null)
      setCompletedBounty(mission.bountyAwarded || 0)
    } else if (mission?.completed) {
      setShowMissionSuccess(true)
      setCompletedBounty(mission.bountyAwarded || 0)
    }
  }

  const closeMissionModal = () => {
    setIsMissionClosing(true)
    setTimeout(() => {
      resetMissionModal()
    }, 300)
  }

  const handleSuccessKeyChange = (playerMissionId, value) => {
    setSuccessKeys(prev => ({ ...prev, [playerMissionId]: value }))
    if (missionErrors[playerMissionId]) {
      setMissionErrors(prev => ({ ...prev, [playerMissionId]: '' }))
    }
  }

  const handleSubmitMission = async (playerMissionId) => {
    const mission = missions.find(m => m.playerMissionId === playerMissionId)
    if (!mission) {
      setMissionErrors(prev => ({ ...prev, [playerMissionId]: 'Mission not found' }))
      return
    }

    setMissionErrors(prev => ({ ...prev, [playerMissionId]: '' }))
    setShowMissionSuccess(false)

    try {
      let result
      if (mission.completionType === 'phrase') {
        const answer = successKeys[playerMissionId]
        if (!answer) return
        result = await neonApi.completePhaseMission(playerMissionId, answer, agentId)
      } else if (mission.completionType === 'signoff') {
        if (!signerPassphrase) {
          setMissionErrors(prev => ({ ...prev, [playerMissionId]: 'The person signing off must enter their passphrase' }))
          return
        }
        result = await neonApi.signOffMission(
          playerMissionId,
          signerPassphrase,
          mission.paymentType ? parseInt(paymentAmount || mission.paymentMin, 10) : undefined
        )
        setCompletedPayment(result.payment || null)
      }

      setCompletedMissions(prev => new Set([...prev, playerMissionId]))
      setSuccessKeys(prev => { const n = { ...prev }; delete n[playerMissionId]; return n })
      setSignerPassphrase('')

      if (mission.completionType === 'signoff') {
        setSignoffPhase('witnessDone')
        setSignoffSuccessSignerName(result.signerName || null)
        setSignoffSignedAt(result.signedOffAt ?? null)
        setMissions(prev => prev.map(m =>
          m.playerMissionId === playerMissionId
            ? {
              ...m,
              completed: true,
              bountyAwarded: result.bounty || 0,
              signerName: result.signerName ?? m.signerName,
              signedOffAt: result.signedOffAt ?? m.signedOffAt
            }
            : m
        ))
        if (result.bounty > 0) setCompletedBounty(result.bounty)
        if (selectedMissionId === playerMissionId) {
          setShowMissionFailed(false)
          setMissionErrors(prev => ({ ...prev, [playerMissionId]: '' }))
        }
      } else {
        if (result.bounty > 0) setCompletedBounty(result.bounty)
        if (selectedMissionId === playerMissionId) {
          setShowMissionSuccess(true)
          setShowMissionFailed(false)
          setMissionErrors(prev => ({ ...prev, [playerMissionId]: '' }))
        }
      }
    } catch (error) {
      console.error('Error completing mission:', error)
      setMissionErrors(prev => ({ ...prev, [playerMissionId]: error.message || 'Failed to complete mission. Please try again.' }))
      setShowMissionSuccess(false)
    }
  }

  // Footer bank strip: refetch whenever something new has been deposited
  const bankSessionId = isInActiveSession ? activeSessionId : null
  const bankRefreshKey = `${completedMissions.size}-${pushMissions.filter(m => m.completed).length}-${wakeTick}`

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-page">
          <div className="dashboard-missions-sticky">
            <AgentBadge user={currentUser} />
            <div className="dashboard-missions-heading">MISSIONS</div>
            <div className="dashboard-content dashboard-content-missions">
              <div className="tab-content">
                <BriefingMissionRow onOpenBriefing={openBriefingModal} />
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>LOADING MISSION DATA...</p>
                </div>
              </div>
            </div>
          </div>
          <DashboardFooter currentUser={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} bankSessionId={bankSessionId} bankRefreshKey={bankRefreshKey} />
        </div>
        {showBriefingModal && (
          <BriefingModalPanel isClosing={isBriefingClosing} onClose={closeBriefingModal} passphrase={currentUser?.passphrase} />
        )}
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-page">
          <div className="dashboard-missions-sticky">
            <AgentBadge user={currentUser} />
            <div className="dashboard-missions-heading">MISSIONS</div>
            <div className="dashboard-content dashboard-content-missions">
              <div className="tab-content">
                <BriefingMissionRow onOpenBriefing={openBriefingModal} />
                <h1>ERROR</h1>
                <p>{error}</p>
                <div className="tab-actions">
                  <button type="button" onClick={fetchMissions} className="retry-button">RETRY</button>
                </div>
              </div>
            </div>
          </div>
          <DashboardFooter currentUser={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} bankSessionId={bankSessionId} bankRefreshKey={bankRefreshKey} />
        </div>
        {showBriefingModal && (
          <BriefingModalPanel isClosing={isBriefingClosing} onClose={closeBriefingModal} passphrase={currentUser?.passphrase} />
        )}
      </div>
    )
  }

  // ── Normal render ──────────────────────────────────────────────────────────

  const selectedMission = missions.find(m => m.playerMissionId === selectedMissionId)

  return (
    <div className="dashboard-container">
      <div className="dashboard-page">
        <div className="dashboard-missions-sticky">
          <AgentBadge user={currentUser} />
            <div className="dashboard-missions-heading">MISSIONS</div>
          <div className="dashboard-content dashboard-content-missions">
            <MissionsTab
              isInActiveSession={isInActiveSession}
              missions={missions}
              currentPhase={currentPhase}
              completedMissions={completedMissions}
              onMissionClick={openMissionModal}
              onOpenBriefing={openBriefingModal}
              pushMissions={pushMissions}
              paused={sessionPaused}
              gameOver={Number(currentPhase) > FINAL_PHASE}
            />
          </div>
        </div>
        <DashboardFooter currentUser={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} bankSessionId={bankSessionId} bankRefreshKey={bankRefreshKey} />
      </div>

      {showBriefingModal && (
        <BriefingModalPanel isClosing={isBriefingClosing} onClose={closeBriefingModal} passphrase={currentUser?.passphrase} />
      )}

      {showMissionModal && selectedMission && (
        <div className={`modal mission-modal ${isMissionClosing ? 'closing' : ''}`}>
          {!showMissionSuccess && !showMissionFailed ? (
            <>
              <div className="modal-header">
                <button type="button" onClick={closeMissionModal} className="close-button">Close</button>
              </div>
              <div className="modal-content">
                <h2>{selectedMission.title}</h2>
                <p style={{ whiteSpace: 'pre-line' }}>{selectedMission.missionBody}</p>

                {selectedMission.completionType === 'reveal' && !selectedMission.completed && (
                  <div className="mission-handler-note">
                    Find the hidden message to complete this mission.
                  </div>
                )}

                {selectedMission.completionType === 'phrase' && (
                  <div className="field-group">
                    <label htmlFor="mission-success-key">Your Answer</label>
                    <div className="input-with-clear">
                      <input
                        id="mission-success-key"
                        type="text"
                        value={successKeys[selectedMissionId] || ''}
                        onChange={(e) => handleSuccessKeyChange(selectedMissionId, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && successKeys[selectedMissionId]) {
                            handleSubmitMission(selectedMissionId)
                          }
                        }}
                        placeholder="Enter your answer..."
                      />
                    </div>
                    {missionErrors[selectedMissionId] && (
                      <div className="mission-error">{missionErrors[selectedMissionId]}</div>
                    )}
                    <div className="mission-inline-action">
                      <button
                        type="button"
                        onClick={() => handleSubmitMission(selectedMissionId)}
                        disabled={!successKeys[selectedMissionId]}
                        className="save-button"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}

                {selectedMission.completionType === 'signoff' && signoffPhase === 'brief' && (
                  <>
                    {selectedMission.signerConstraint === 'new_signer' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be someone who hasn't signed off on any of your other missions.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'same_signer' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be the same person who signed off on your earlier mission.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'admin_only' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be signed off by a host.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'ceo' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be signed off by the CEO.
                      </p>
                    )}
                    {selectedMission.paymentType && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        {selectedMission.paymentType === 'witness_to_player'
                          ? `Your witness pays you at least $${selectedMission.paymentMin.toLocaleString()} from their bank account when they sign off.`
                          : `Your witness pays at least $${selectedMission.paymentMin.toLocaleString()} from their bank account to MacGuffin Toys when they sign off.`}
                      </p>
                    )}
                    {missionErrors[selectedMissionId] && (
                      <div className="mission-error">{missionErrors[selectedMissionId]}</div>
                    )}
                    <div className="mission-inline-action">
                      <button
                        type="button"
                        onClick={() => {
                          setMissionErrors(prev => ({ ...prev, [selectedMissionId]: '' }))
                          setSignerPassphrase('')
                          setSignoffPhase('witness')
                        }}
                        className="save-button mission-complete-outline-button"
                      >
                        Complete mission
                      </button>
                    </div>
                  </>
                )}

                {selectedMission.completionType === 'signoff' && signoffPhase === 'witness' && (
                  <>
                    {selectedMission.signerConstraint === 'new_signer' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be someone who hasn't signed off on any of your other missions.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'same_signer' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be the same person who signed off on your earlier mission.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'admin_only' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be signed off by a host.
                      </p>
                    )}
                    {selectedMission.signerConstraint === 'ceo' && (
                      <p className="mission-signoff-hint mission-signoff-hint--constraint-emphasis">
                        Must be signed off by the CEO.
                      </p>
                    )}

                    <div className="mission-witness-panel">
                      <p className="mission-witness-instruction">
                        Hand your phone to an authorized witness to confirm.
                      </p>

                      {selectedMission.signoffPromptTemplate && (
                        <div className="mission-signoff-preview mission-signoff-preview--madlib">
                          {renderSignoffMadlibPreview(
                            selectedMission.signoffPromptTemplate,
                            firstName,
                            lastName,
                            selectedMission.variableValue
                          )}
                        </div>
                      )}

                      {selectedMission.paymentType && (
                        <div className="field-group mission-payment">
                          <label htmlFor="signoff-payment">
                            {selectedMission.paymentType === 'witness_to_player'
                              ? `Witness pays ${firstName}`
                              : 'Witness pays MacGuffin Toys'}
                          </label>
                          <div className="mission-payment-row">
                            <span className="mission-payment-currency">$</span>
                            <input
                              id="signoff-payment"
                              type="text"
                              inputMode="numeric"
                              value={paymentAmount === '' ? String(selectedMission.paymentMin) : paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ''))}
                            />
                          </div>
                          <p className="mission-signoff-hint">
                            At least ${selectedMission.paymentMin.toLocaleString()}, taken from the witness's bank account when they sign off. Entering your passphrase agrees to pay.
                          </p>
                        </div>
                      )}

                      <div className="field-group">
                        <label htmlFor="signer-passphrase">Authorized witness</label>
                        <div className="input-with-clear">
                          <input
                            id="signer-passphrase"
                            type="password"
                            value={signerPassphrase}
                            onChange={(e) => setSignerPassphrase(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && signerPassphrase) {
                                handleSubmitMission(selectedMissionId)
                              }
                            }}
                            placeholder="Enter passphrase"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      {missionErrors[selectedMissionId] && (
                        <div className="mission-error">{missionErrors[selectedMissionId]}</div>
                      )}
                      <div className="mission-inline-action">
                        <button
                          type="button"
                          onClick={() => handleSubmitMission(selectedMissionId)}
                          disabled={!signerPassphrase}
                          className="save-button"
                        >
                          Sign off
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {selectedMission.completionType === 'signoff' && signoffPhase === 'witnessDone' && (
                  <div className="mission-witness-panel mission-witness-panel--signed">
                    {selectedMission.signoffPromptTemplate && (
                      <div className="mission-signoff-preview mission-signoff-preview--madlib">
                        {renderSignoffMadlibPreview(
                          selectedMission.signoffPromptTemplate,
                          firstName,
                          lastName,
                          selectedMission.variableValue
                        )}
                      </div>
                    )}
                    <p className="mission-witness-signed-summary">
                      {completedPayment && (
                        <>
                          {completedPayment.type === 'witness_to_house' &&
                            `${signoffSuccessSignerName || selectedMission.signerName} invested $${completedPayment.amount.toLocaleString()} in MacGuffin Toys. `}
                        </>
                      )}
                      Signed by{' '}
                      <strong>{signoffSuccessSignerName || selectedMission.signerName}</strong>
                      {' '}
                      at {formatWitnessSignedAt(signoffSignedAt ?? selectedMission.signedOffAt)}.
                    </p>
                    {(completedBounty > 0 || completedPayment?.type === 'witness_to_player') && (
                      <div className="mission-witness-bounty-wrap">
                        <DepositNotice
                          amount={completedBounty}
                          payment={completedPayment?.type === 'witness_to_player'
                            ? { amount: completedPayment.amount, from: signoffSuccessSignerName || selectedMission.signerName }
                            : null}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : showMissionFailed ? (
            <>
              <div className="modal-header">
                <button type="button" onClick={closeMissionModal} className="close-button">Close</button>
              </div>
              <div className="modal-content">
                <div className="mission-failed">
                  <p className="mission-failed-title">MISSION FAILED</p>
                  <h2>{selectedMission.title}</h2>
                  {missionFailedMessage && (
                    <p className="mission-failed-message">
                      {missionFailedMessage.replace(/^Mission failed\.\s*/i, '')}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="modal-header">
                <button type="button" onClick={closeMissionModal} className="close-button">Close</button>
              </div>
              <div className="modal-content">
                <div className="mission-success">
                  <p>Mission success</p>
                  <h2>{selectedMission.title}</h2>
                  {completedBounty > 0 && (
                    <div className="mission-phrase-payout-shell">
                      <DepositNotice amount={completedBounty} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showPushMissionModal && pendingPushMission && (
        <div className={`modal push-mission-modal ${isPushMissionClosing ? 'closing' : ''}`}>
          <div className="modal-header">
            <span className={`push-mission-badge ${pushMissionType === 'completed' ? 'push-mission-badge--complete' : ''}`}>
              {pushMissionType === 'new' ? 'INCOMING TRANSMISSION' : 'MISSION COMPLETE'}
            </span>
          </div>
          <div className="modal-content">
            <h2>{pendingPushMission.title}</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{pendingPushMission.mission_body}</p>
            {pushMissionType === 'new' && pendingPushMission.bounty > 0 && (
              <div className="push-mission-bounty">Bounty: ${pendingPushMission.bounty}</div>
            )}
            {pushMissionType === 'completed' && pendingPushMission.bounty > 0 && (
              <div className="mission-phrase-payout-shell" style={{ marginTop: 'var(--unit-base)' }}>
                <DepositNotice amount={pendingPushMission.bounty} />
              </div>
            )}
          </div>
          <div className="push-mission-footer">
            <button
              type="button"
              onClick={handleAcknowledgePushMission}
              className="push-mission-ack-button"
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      )}

      {unlockedCulminating && !showPushMissionModal && (
        <div className={`modal push-mission-modal ${isUnlockClosing ? 'closing' : ''}`}>
          <div className="modal-header">
            <span className="push-mission-badge push-mission-badge--complete">
              PHASE {unlockedCulminating.phase} COMPLETE
            </span>
          </div>
          <div className="modal-content">
            <h2>{unlockedCulminating.title}</h2>
            <p>
              {unlockedCulminating.firstOnly
                ? "You're the first agent to complete every mission in this phase, and you've unlocked a special mission no one else will get."
                : "You've completed every mission in this phase and unlocked a culminating mission."}
            </p>
            <p><strong>See your handler for more information.</strong></p>
            {unlockedCulminating.bounty > 0 && (
              <div className="push-mission-bounty">Bounty: ${unlockedCulminating.bounty}</div>
            )}
          </div>
          <div className="push-mission-footer">
            <button type="button" onClick={acknowledgeCulminatingUnlock} className="push-mission-ack-button">
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
