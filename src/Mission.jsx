import React from 'react'

function Mission({ agentName }) {
  return (
    <div className="mission-container">
      <div className="mission-card">
        <h1>MISSION BRIEFING</h1>
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
            <p>The president has initiated Ghost Protocol. Your mission, should you choose to accept it, involves infiltrating the secure facility at coordinates 34.04032069062232, -118.23105960396222. Codenamed "The Obscure." Intelligence suggests that classified documents have been compromised and are being held at this location.</p>
            <br />
            <p><strong>OBJECTIVES:</strong></p>
            <ul style={{ marginLeft: '2rem', marginTop: '0.5rem' }}>
              <li>Find a potential agent with a corndog on their nametag</li>
              <li>Hand off the authentication token to the agent</li>
              <li>Tell them the code phrase: "The Obscure is not the Unknown"</li>
              <li>Tell them to hold the token up to their phone and that any additional information is codeword classified</li>
            </ul>
            <br />
            <br />
            <p style={{ color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>⚠️ WARNING: This message will be deleted from all public networks upon acceptance ⚠️</p>
          </div>
        </div>
        
        <button 
          className="mission-button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '2rem',
            padding: '1rem 2rem',
            background: 'linear-gradient(45deg, #e74c3c, #c0392b)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontFamily: 'Courier New, monospace'
          }}
        >
          MISSION ACCEPTED
        </button>
      </div>
    </div>
  )
}

export default Mission 