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
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h1>MISSION ACCEPTED</h1>
            <button 
              onClick={handleLogout}
              className="logout-button"
            >
              LOGOUT
            </button>
          </div>
          
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '2rem', 
            fontSize: '0.8rem', 
            color: '#2ecc71', 
            opacity: 0.8,
            letterSpacing: '1px'
          }}>
            ✅ MISSION BRIEFING COMPLETE - REDIRECTING TO DASHBOARD ✅
          </div>
          
          <div className="mission-content">
            <h2>AGENT {agentName}</h2>
            <div style={{ 
              marginTop: '1rem',
              fontSize: '1rem',
              color: '#ecf0f1',
              lineHeight: '1.6',
              textAlign: 'center'
            }}>
              <p style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '2rem' }}>
                🎯 MISSION STATUS: ACTIVE
              </p>
              
              <div style={{
                background: 'rgba(46, 204, 113, 0.1)',
                padding: '2rem',
                borderRadius: '8px',
                border: '1px solid #2ecc71',
                marginBottom: '2rem'
              }}>
                <h3 style={{ color: '#2ecc71', marginBottom: '1rem' }}>MISSION BRIEFING COMPLETE</h3>
                <p style={{ fontSize: '1rem', lineHeight: '1.6' }}>
                  You have successfully accepted your mission briefing. 
                  You are now being redirected to the Mission Control Dashboard 
                  where you can view available operations and accept specific missions.
                </p>
              </div>
              
              <p style={{ 
                color: '#f39c12', 
                fontWeight: 'bold',
                fontSize: '0.9rem',
                marginTop: '2rem'
              }}>
                ⏰ REDIRECTING TO DASHBOARD IN 3 SECONDS...
              </p>
              
              <div style={{
                fontSize: '0.8rem',
                color: '#bdc3c7',
                opacity: 0.7,
                marginTop: '1rem'
              }}>
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h1>MISSION BRIEFING</h1>
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            LOGOUT
          </button>
        </div>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem', 
          fontSize: '0.8rem', 
          color: '#3498db', 
          opacity: 0.7,
          letterSpacing: '1px'
        }}>
          CLASSIFIED MISSION - EYES ONLY
        </div>
        
        <div className="mission-content">
          <h2>AGENT {agentName}</h2>
          <div style={{ 
            marginTop: '1rem',
            fontSize: '1rem',
            color: '#ecf0f1',
            lineHeight: '1.6',
            textAlign: 'left'
          }}>
            <p><strong>MISSION CODE:</strong> OPERATION SHADOW STRIKE</p>
            <p><strong>PRIORITY:</strong> CRITICAL</p>
            <p><strong>STATUS:</strong> ACTIVE</p>
            <br />
            <p style={{ color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ CRITICAL INFORMATION DISPLAY ⚠️
            </p>
            <br />
            <p>You are about to be shown classified team assignment information that you will <strong>NEVER</strong> be shown again.</p>
            <br />
            <p><strong>IMPORTANT:</strong></p>
            <ul style={{ marginLeft: '2rem', marginTop: '0.5rem' }}>
              <li>This information will be displayed for exactly <strong>20 seconds</strong></li>
              <li>Once the timer expires, all traces will be permanently erased</li>
              <li>You will have <strong>NO WAY</strong> to access this information again</li>
              <li>Memorize everything you see - there are no second chances</li>
            </ul>
            <br />
            <p style={{ color: '#f39c12', fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ THIS IS YOUR ONLY OPPORTUNITY TO VIEW THIS DATA ⚠️
            </p>
            <br />
            <p style={{ color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ WARNING: This information will be deleted from all secure networks upon acceptance ⚠️
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
