import React, { useState, useEffect } from 'react'

function Dashboard({ agentName, onLogout }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchRandomMissions()
  }, [])

  const fetchRandomMissions = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3001/api/missions/available')
      if (response.ok) {
        const allMissions = await response.json()
        // Get 3 random missions from available ones
        const shuffled = allMissions.sort(() => 0.5 - Math.random())
        const selectedMissions = shuffled.slice(0, 3)
        setMissions(selectedMissions)
      } else {
        setError('Failed to fetch missions')
      }
    } catch (error) {
      console.error('Error fetching missions:', error)
      setError('Failed to fetch missions')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    onLogout()
  }

  const formatExpiryTime = (expiryDate) => {
    if (!expiryDate) return 'No expiry'
    const now = new Date()
    const expiry = new Date(expiryDate)
    const diffMs = expiry - now
    
    if (diffMs <= 0) return 'EXPIRED'
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m remaining`
    } else {
      return `${diffMinutes}m remaining`
    }
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>LOADING MISSION DATA...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <h1>ERROR</h1>
          <p style={{ color: '#e74c3c' }}>{error}</p>
          <button onClick={fetchRandomMissions} className="retry-button">
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <h1>MISSION CONTROL DASHBOARD</h1>
          <button onClick={handleLogout} className="logout-button">
            LOGOUT
          </button>
        </div>
        
        <div className="agent-info">
          <h2>AGENT {agentName}</h2>
          <p>Available Operations: {missions.length}</p>
        </div>

        <div className="missions-grid">
          {missions.map((mission, index) => (
            <div key={mission.id} className="mission-card">
              <div className="mission-header">
                <h3>{mission.title}</h3>
                <span className={`status-badge ${mission.completed ? 'completed' : 'active'}`}>
                  {mission.completed ? 'COMPLETED' : 'ACTIVE'}
                </span>
              </div>
              
              <div className="mission-body">
                <p>{mission.mission_body}</p>
              </div>
              
              <div className="mission-footer">
                <div className="mission-meta">
                  <span className="meta-item">
                    <strong>ID:</strong> {mission.id}
                  </span>
                  <span className="meta-item">
                    <strong>Expires:</strong> {formatExpiryTime(mission.mission_expires)}
                  </span>
                </div>
                
                <button 
                  className="accept-mission-button"
                  onClick={() => console.log(`Accepting mission ${mission.id}`)}
                  disabled={mission.completed}
                >
                  {mission.completed ? 'MISSION COMPLETE' : 'ACCEPT MISSION'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-footer">
          <button onClick={fetchRandomMissions} className="refresh-button">
            REFRESH MISSIONS
          </button>
          <p className="footer-note">
            New missions are assigned randomly. Click refresh to get new assignments.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
