import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { addBounce } from './helpers.js'

function Mission({ alias1, alias2, realName, team, onLogout }) {
  const [showMissionAccepted, setShowMissionAccepted] = useState(false)
  const navigate = useNavigate()
  const effectRef1 = useRef(null)
  const effectRef2 = useRef(null)
  const teamColor = "team-"+{team}.team
  const bgColor = "bg-"+{team}.team
  
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
    if (effectRef1.current) {
      addBounce(effectRef1.current)
    }
    if (effectRef2.current) {
      addBounce(effectRef2.current)
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
            <h2>AGENT {alias1} {alias2}</h2>
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
    <div className={"mission-container " + (bgColor)}>
        <div className="agent-header">
        <button 
            onClick={handleLogout}
            className="logout-button"
          >
            LOGOUT
        </button>
        <p>Welcome to the <span className={teamColor}>{team} team</span>, <span className={bgColor}>{realName}</span>... or should I say</p>>
        </div>

        <div className="agent-intro">
            <p>Special Agent</p>
            <h1 ref={effectRef1} className="rotate">{alias1}</h1>
            <h1 ref={effectRef2} className="rotate">{alias2}</h1>
          </div>

        <div className="mission-content">

          <div className="mission-objectives">
            <p>Your objectives are as follows:</p>
            <ul>
              <li>Complete missions.</li>
              <li>Make new friends.</li>
              <li>Do not get caught.</li>
              <li>Ask the hosts if you need any help.</li>
              <li>Do not get caught.</li>
            </ul>
            <button 
          className="mission-button"
          onClick={handleMissionAccept}
        >
          This message will self destruct in 3 seconds.
        </button>
          </div>
        </div>
        
    </div>
  )
}

export default Mission 
