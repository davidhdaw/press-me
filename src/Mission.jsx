import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Mission({ agentName, onLogout }) {
  const [showMissionAccepted, setShowMissionAccepted] = useState(false)
  const navigate = useNavigate()
  
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
        <div>
          CLASSIFIED MISSION - EYES ONLY
        </div>
        
        <div className="mission-content">
          <h2>AGENT {agentName}</h2>
          <div>
            <p><strong>MISSION CODE:</strong> OPERATION SHADOW STRIKE</p>
            <p><strong>PRIORITY:</strong> CRITICAL</p>
            <p><strong>STATUS:</strong> ACTIVE</p>
            <br />
            <p>
              CRITICAL INFORMATION DISPLAY
            </p>
            <br />
            <p>You are about to be shown classified team assignment information that you will <strong>NEVER</strong> be shown again.</p>
            <br />
            <p><strong>IMPORTANT:</strong></p>
            <ul>
              <li>This information will be displayed for exactly <strong>20 seconds</strong></li>
              <li>Once the timer expires, all traces will be permanently erased</li>
              <li>You will have <strong>NO WAY</strong> to access this information again</li>
              <li>Memorize everything you see - there are no second chances</li>
            </ul>
            <br />
            <p >
              THIS IS YOUR ONLY OPPORTUNITY TO VIEW THIS DATA
            </p>
            <br />
            <p>
              WARNING: This information will be deleted from all secure networks upon acceptance
            </p>
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
