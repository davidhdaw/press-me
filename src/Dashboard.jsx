import React, { useState, useEffect } from 'react'

function Dashboard({ agentName, agentId, onLogout }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState('Calculating...')
  const [successKeys, setSuccessKeys] = useState({})
  const [completedMissions, setCompletedMissions] = useState(new Set())
  const [activeTab, setActiveTab] = useState('missions')

  useEffect(() => {
    fetchRandomMissions()
  }, [])

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (missions.length > 0 && missions[0].mission_expires) {
        const now = new Date()
        const expiry = new Date(missions[0].mission_expires)
        const diffMs = expiry - now
        
        if (diffMs <= 0) {
          setTimeLeft('MISSIONS EXPIRED')
        } else {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
          const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000)
          
          if (diffHours > 0) {
            setTimeLeft(`${diffHours}h ${diffMinutes}m ${diffSeconds}s remaining`)
          } else if (diffMinutes > 0) {
            setTimeLeft(`${diffMinutes}m ${diffSeconds}s remaining`)
          } else {
            setTimeLeft(`${diffSeconds}s remaining`)
          }
        }
      } else {
        setTimeLeft('No active missions')
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [missions])

  const fetchRandomMissions = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3001/api/missions/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agentId
        })
      })
      if (response.ok) {
        const assignedMissions = await response.json()
        setMissions(assignedMissions)
        // Clear completed missions state when refreshing
        setCompletedMissions(new Set())
        setSuccessKeys({})
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

  const handleSuccessKeyChange = (missionId, value) => {
    setSuccessKeys(prev => ({
      ...prev,
      [missionId]: value
    }))
  }

  const handleSubmitMission = async (missionId) => {
    const successKey = successKeys[missionId]
    if (!successKey) return

    try {
      const response = await fetch(`http://localhost:3001/api/missions/${missionId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successKey: successKey,
          teamPoints: { team: 'red', points: 10 } // You might want to get actual team from user data
        })
      })

      if (response.ok) {
        // Mission completed successfully
        setCompletedMissions(prev => new Set([...prev, missionId]))
        setSuccessKeys(prev => {
          const newKeys = { ...prev }
          delete newKeys[missionId]
          return newKeys
        })
        // Mission stays visible with completed status - no automatic refresh
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Incorrect success key!')
      }
    } catch (error) {
      console.error('Error completing mission:', error)
      alert('Error completing mission')
    }
  }


  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-tabs">
            <button 
              className={`tab-button ${activeTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('agent')}
            >
              AGENT
            </button>
            <button 
              className={`tab-button ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
            >
              MISSIONS
            </button>
            <button 
              className={`tab-button ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => setActiveTab('intel')}
            >
              INTEL
            </button>
          </div>
        </div>
        <div className="dashboard-content">
          <div className="tab-content">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>LOADING MISSION DATA...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-tabs">
            <button 
              className={`tab-button ${activeTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('agent')}
            >
              AGENT
            </button>
            <button 
              className={`tab-button ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
            >
              MISSIONS
            </button>
            <button 
              className={`tab-button ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => setActiveTab('intel')}
            >
              INTEL
            </button>
          </div>
        </div>
        <div className="dashboard-content">
          <div className="tab-content">
            <h1>ERROR</h1>
            <p style={{ color: '#e74c3c' }}>{error}</p>
            <div className="tab-actions">
              <button onClick={fetchRandomMissions} className="retry-button">
                RETRY
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-tabs">
          <button 
            className={`tab-button ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            AGENT
          </button>
          <button 
            className={`tab-button ${activeTab === 'missions' ? 'active' : ''}`}
            onClick={() => setActiveTab('missions')}
          >
            MISSIONS
          </button>
          <button 
            className={`tab-button ${activeTab === 'intel' ? 'active' : ''}`}
            onClick={() => setActiveTab('intel')}
          >
            INTEL
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {activeTab === 'agent' && (
          <div className="tab-content">
            <h2>Agent Information</h2>
            <p>Agent Name: {agentName}</p>
            <p>Agent ID: {agentId}</p>
            <p>Mission Timer: {timeLeft}</p>
            <p>This is placeholder content for the Agent tab.</p>
            <div className="tab-actions">
              <button onClick={handleLogout} className="logout-button">
                LOGOUT
              </button>
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="tab-content">
            <div className="missions-grid">
              {missions.map((mission, index) => (
                <div key={mission.id} className="mission-card">
                  <div className="mission-header">
                    <h3>{mission.title}</h3>
                    <span className={`status-badge ${completedMissions.has(mission.id) ? 'completed' : 'active'}`}>
                      {completedMissions.has(mission.id) ? 'COMPLETED' : 'ACTIVE'}
                    </span>
                  </div>
                  
                  <div className="mission-body">
                    <p>{mission.mission_body}</p>
                  </div>
                  
                  <div className="mission-footer">
                    {!completedMissions.has(mission.id) && (
                      <div className="mission-completion">
                        <div className="success-key-input">
                          <input
                            type="text"
                            placeholder="Enter success key..."
                            value={successKeys[mission.id] || ''}
                            onChange={(e) => handleSuccessKeyChange(mission.id, e.target.value)}
                            className="success-key-field"
                          />
                          <button
                            onClick={() => handleSubmitMission(mission.id)}
                            disabled={!successKeys[mission.id]}
                            className="submit-mission-button"
                          >
                            SUBMIT
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="tab-actions">
              <button onClick={fetchRandomMissions} className="refresh-button">
                GET NEW MISSIONS
              </button>
            </div>
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="tab-content">
            <h2>Intel Reports</h2>
            <p>This is placeholder content for the Intel tab.</p>
            <p>Intel information and reports would be displayed here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
