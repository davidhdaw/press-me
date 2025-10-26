import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { addBounce } from './helpers.js'

function Mission({ alias1, alias2, realName, team, onLogout }) {
  const navigate = useNavigate()
  const effectRef1 = useRef(null)
  const effectRef2 = useRef(null)
  const teamColor = "team-"+{team}.team
  const bgColor = "bg-"+{team}.team
  

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


  return (
    <div className={"mission-container " + (bgColor)}>
        <div className="agent-header">
        <p>Welcome to the <span className={teamColor}>{team} team</span>, <span className={bgColor}>{realName}</span>... or should I say</p>
        </div>

        <div className="agent-intro">
            <p>Special Agent</p>
            <h1 ref={effectRef1} className="rotate">{alias1}</h1>
            <h1 ref={effectRef2} className="rotate">{alias2}</h1>
          </div>


          <div className="mission-objectives">
            <p>Your objectives are as follows:</p>
            <ul>
              <li>Complete missions.</li>
              <li>Make new friends.</li>
              <li>Do not get caught.</li>
              <li>Ask the hosts if you need help.</li>
              <li>Do not get caught.</li>
            </ul>
          </div>
          <button 
          className="mission-button"
          onClick={() => navigate('/dashboard')}
        >
          This message will self destruct in 3...
        </button>
        </div>
        
  )
}

export default Mission 
