import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { addBounce } from './helpers.js'

function Mission({ agentName, onLogout }) {
  const [showMissionAccepted, setShowMissionAccepted] = useState(false)
  const navigate = useNavigate()
  const effectRef = useRef(null)
  
  const handleMissionAccept = () => {
    setShowMissionAccepted(true)
    // Redirect to dashboard after 3 seconds
    setTimeout(() => {
      navigate('/dashboard')
    }, 3000)
  }

  const handleLogout = () => {
    onLogout()
  }

  // Apply addBounce effect when component mounts
  useEffect(() => {
    if (effectRef.current) {
      addBounce(effectRef.current)
    }
  }, [])

  if (showMissionAccepted) {
    return (
      <div className="mission-container">
        <div className="mission-card">
          <div>
            <h1>MISSION ACCEPTED</h1>
            <button 
              onClick={handleLogout}
              className="logout-button"
            >
              LOGOUT
            </button>
          </div>
          
          <div>
            MISSION BRIEFING COMPLETE - REDIRECTING TO DASHBOARD
          </div>
          
          <div className="mission-content">
            <h2>AGENT {agentName}</h2>
            <div>
              <p>
                MISSION STATUS: ACTIVE
              </p>
              
              <div>
                <h3>MISSION BRIEFING COMPLETE</h3>
                <p>
                  You have successfully accepted your mission briefing. 
                  You are now being redirected to the Mission Control Dashboard 
                  where you can view available operations and accept specific missions.
                </p>
              </div>
              
              <p>
                REDIRECTING TO DASHBOARD IN 3 SECONDS...
              </p>
              
              <div>
                Prepare for operational deployment. Good luck, Agent.
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mission-container">
      <div className="mission-card">
        <div>
          <h1>MISSION BRIEFING</h1>
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            LOGOUT
          </button>
        </div>
        
        <div className="mission-content" >
          <h2 ref={effectRef} className="rotate">Agent {agentName}</h2>
          <div>
            <p>You are about to be shown classified team assignment information that you will <strong>NEVER</strong> be shown again.</p>
            <ul>
              <li>This information will be displayed for exactly <strong>20 seconds</strong></li>
              <li>Once the timer expires, all traces will be permanently erased</li>
              <li>Memorize everything you see - there are no second chances</li>
            </ul>
          </div>
        </div>
        
        <button 
          className="mission-button"
          onClick={handleMissionAccept}
        >
          DISPLAY CLASSIFIED INFORMATION
        </button>
      </div>
    </div>
  )
}

export default Mission 
