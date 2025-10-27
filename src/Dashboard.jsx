import React, { useState, useEffect } from 'react'
import { neonApi } from './neonApi'

function Dashboard({ agentName, agentId, firstName, lastName, team, onLogout }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState('Calculating...')
  const [successKeys, setSuccessKeys] = useState({})
  const [agentNameVisible, setAgentNameVisible] = useState(false)
  const [realNameVisible, setRealNameVisible] = useState(false)
  const [teamVisible, setTeamVisible] = useState(false)
  const [completedMissions, setCompletedMissions] = useState(new Set())
  const [activeTab, setActiveTab] = useState('missions')
  const [missionErrors, setMissionErrors] = useState({})
  
  // Intel state
  const [users, setUsers] = useState([])
  const [intelLoading, setIntelLoading] = useState(false)
  const [randomizedAliases, setRandomizedAliases] = useState([])
  const [userSelections, setUserSelections] = useState({})
  const [userAliases, setUserAliases] = useState({})
  const [dragOverId, setDragOverId] = useState(null)
  const [usedAliases, setUsedAliases] = useState(new Set())
  
  // New state for relationship and alibi
  const [relationship, setRelationship] = useState('')
  const [alibi, setAlibi] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalRelationship, setModalRelationship] = useState('')
  const [modalAlibi, setModalAlibi] = useState('')
 
  // Data arrays for relationships and alibis
  const relationships = [
    'a long lost childhood friend of the host',
    'a former business partner of the host',
    'the host\'s estranged sibling',
    'a college roommate of the host',
    'the host\'s ex-spouse',
    'a former colleague from the host\'s previous job',
    'the host\'s neighbor from their old apartment',
    'a member of the host\'s book club',
    'the host\'s personal trainer',
    'a friend from the host\'s hiking group'
  ]

  const alibis = [
    'the host owes you money',
    'you\'re here to collect on a bet you won',
    'you\'re delivering a package for a mutual friend',
    'you\'re here to discuss a business opportunity',
    'you\'re attending as the host\'s plus-one',
    'you\'re here to pick up something you left behind',
    'you\'re delivering a message from a mutual acquaintance',
    'you\'re here to finalize plans for an upcoming trip',
    'you\'re attending as a favor to the host',
    'you\'re here to discuss a shared investment'
  ]

  // Function to get random relationship and alibi
  const getRandomBackstory = () => {
    const randomRelationship = relationships[Math.floor(Math.random() * relationships.length)]
    const randomAlibi = alibis[Math.floor(Math.random() * alibis.length)]
    setRelationship(randomRelationship)
    setAlibi(randomAlibi)
  }

  // Modal functions
  const openModal = () => {
    setModalRelationship(relationship)
    setModalAlibi(alibi)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  const saveModal = () => {
    setRelationship(modalRelationship)
    setAlibi(modalAlibi)
    setShowModal(false)
  }

  const clearRelationship = () => {
    setModalRelationship('')
  }

  const clearAlibi = () => {
    setModalAlibi('')
  }

  useEffect(() => {
    fetchRandomMissions()
    getRandomBackstory() // Initialize with random backstory
  }, [])

  // Fetch users when intel tab is accessed
  useEffect(() => {
    if (activeTab === 'intel' && users.length === 0) {
      fetchUsers()
    }
  }, [activeTab])

  const fetchUsers = async () => {
    try {
      setIntelLoading(true)
      const allUsers = await neonApi.getUsers()
      setUsers(allUsers)
      
      // Initialize user selections with their actual teams
      const selections = {}
      allUsers.forEach(user => {
        selections[user.id] = user.team
      })
      setUserSelections(selections)
      
      // Randomize aliases once when users are fetched
      const aliases = allUsers.flatMap(user => [user.alias_1, user.alias_2])
      const shuffled = [...aliases].sort(() => Math.random() - 0.5)
      setRandomizedAliases(shuffled)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIntelLoading(false)
    }
  }

  const handleTeamSelection = (userId, team) => {
    setUserSelections(prev => ({
      ...prev,
      [userId]: team
    }))
  }

  const handleDragStart = (e, alias) => {
    e.dataTransfer.setData('text/plain', alias)
  }

  const handleDragOver = (e, userId, targetIndex) => {
    e.preventDefault()
    setDragOverId(`${userId}-${targetIndex}`)
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e, userId, targetIndex) => {
    e.preventDefault()
    const alias = e.dataTransfer.getData('text/plain')
    setUserAliases(prev => {
      const current = prev[userId] || []
      const updated = [...current]
      updated[targetIndex] = alias
      return {
        ...prev,
        [userId]: updated
      }
    })
    setUsedAliases(prev => new Set([...prev, alias]))
    setDragOverId(null)
  }

  const handleClearAll = () => {
    // Reset all team selections to unknown
    const unknownSelections = {}
    users.forEach(user => {
      unknownSelections[user.id] = 'unknown'
    })
    setUserSelections(unknownSelections)
    
    // Clear all aliases
    setUserAliases({})
    
    // Clear used aliases so they reappear in alias-section
    setUsedAliases(new Set())
  }

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
      const assignedMissions = await neonApi.refreshMissions(agentId)
      setMissions(assignedMissions)
      // Clear completed missions state when refreshing
      setCompletedMissions(new Set())
      setSuccessKeys({})
      // Clear any existing errors when refreshing
      setMissionErrors({})
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
    // Clear error when user starts typing
    if (missionErrors[missionId]) {
      setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
    }
  }

  const handleSubmitMission = async (missionId) => {
    const successKey = successKeys[missionId]
    if (!successKey) return

    // Clear any existing error for this mission
    setMissionErrors(prev => ({ ...prev, [missionId]: '' }))

    try {
      await neonApi.completeMission(missionId, successKey, { team: team, points: 10 })
      
      // Mission completed successfully
      setCompletedMissions(prev => new Set([...prev, missionId]))
      setSuccessKeys(prev => {
        const newKeys = { ...prev }
        delete newKeys[missionId]
        return newKeys
      })
      setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
      // Mission stays visible with completed status - no automatic refresh
    } catch (error) {
      console.error('Error completing mission:', error)
      setMissionErrors(prev => ({ ...prev, [missionId]: error.message || 'Failed to complete mission. Please try again.' }))
    }
  }


  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-tabs">
            <button 
              className={`tab-button tab-agent ${activeTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('agent')}
            >
              AGENT
            </button>
            <button 
              className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
            >
              MISSIONS
            </button>
            <button 
              className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => setActiveTab('intel')}
            >
              INTEL
            </button>
          </div>
        </div>
        <div className={`dashboard-content dashboard-content-${activeTab}`}>
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
              className={`tab-button tab-agent ${activeTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('agent')}
            >
              Agent
            </button>
            <button 
              className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
            >
              Missions
            </button>
            <button 
              className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => setActiveTab('intel')}
            >
              Intel
            </button>
          </div>
        </div>
        <div className={`dashboard-content dashboard-content-${activeTab}`}>
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
            className={`tab-button tab-agent ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            AGENT
          </button>
          <button 
            className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
            onClick={() => setActiveTab('missions')}
          >
            MISSIONS
          </button>
          <button 
            className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
            onClick={() => setActiveTab('intel')}
          >
            INTEL
          </button>
        </div>
        </div>

      <div className={`dashboard-content dashboard-content-${activeTab}`}>
        {activeTab === 'agent' && (
          <div className="tab-content">
            <div className="agent-card">
              <h3>Classified</h3>
              <h4>Reveal to trusted associates only</h4>
              
              <div className="field-group">
                <div className="field-label">Agent</div>
                <div className="field-row">
                  <span className={agentNameVisible ? 'visible' : 'hidden'}>{agentName}</span>
                  <button onClick={() => setAgentNameVisible(!agentNameVisible)} className="toggle-button">
                    {agentNameVisible ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
                      </svg>
                    )}
                    <span className="button-text">{agentNameVisible ? 'hide' : 'reveal'}</span>
                    </button>
                </div>
              </div>
              
              <div className="field-group">
                <div className="field-label">AKA</div>
                <div className="field-row">
                  <span className={realNameVisible ? 'visible' : 'hidden'}>{firstName} {lastName}</span>
                  <button onClick={() => setRealNameVisible(!realNameVisible)} className="toggle-button">
                    {realNameVisible ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
                      </svg>
                    )}
                    <span className="button-text">{realNameVisible ? 'hide' : 'reveal'}</span>
                    </button>
                </div>
              </div>
              
              <div className="field-group">
                <div className="field-label">Team</div>
                <div className="field-row">
                  <span className={`team-${team} ${teamVisible ? 'visible' : 'hidden'}`}>{team} team</span>
                  <button onClick={() => setTeamVisible(!teamVisible)} className="toggle-button">
                    {teamVisible ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
                      </svg>
                    )}
                    <span className="button-text">{teamVisible ? 'hide' : 'reveal'}</span>
                    </button>
                </div>
              </div>
            </div>
            <div className="backstory-card">
              <h3>Cover story</h3>
              <p>You are {firstName} {lastName}, <span className="relationship">{relationship}</span>. You are here tonight because <span className="alibi">{alibi}</span>.</p>
              <div className="backstory-buttons">
                <button onClick={getRandomBackstory} className="reroll-button">
                  Reroll
                </button>
                <button onClick={openModal} className="write-your-own-button">
                  Write your own
                </button>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-button button-min">
                LOGOUT
              </button>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="tab-content">
            <div className="missions-grid">
              {missions.map((mission, index) => (
                <div key={mission.id} className="mission-card">
                  <div className="mission-header">
                    <h3>Operation {mission.title}</h3>
                  </div>
                  
                    <p>{mission.mission_body}</p>
                  
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                        </svg>
                      </button>
                    </div>
                    {missionErrors[mission.id] && (
                      <div className="mission-error">
                        {missionErrors[mission.id]}
                      </div>
                    )}
                  </div>
                )}
              </div>
              ))}
            </div>
              <button onClick={fetchRandomMissions} className="refresh-button button-min">
                Refresh missions
              </button>
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="tab-content">
            {intelLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>LOADING INTEL...</p>
              </div>
            ) : (
              <>
                <div className="intel-container">
                  <div className="intel-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>Guest list</h3>
                      <button onClick={handleClearAll} className="clear-button">
                        Clear
                      </button>
                    </div>
                    <table className="users-list">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>AKA</th>
                        <th>Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={`${user.id}-name`}>
                          <td 
                            className={`${
                              userSelections[user.id] === 'red' ? 'team-red' : 
                              userSelections[user.id] === 'blue' ? 'team-blue' : 
                              ''
                            }`}
                          >
                            {user.firstname} {user.lastname}
                          </td>
                          <td>
                            <div className="aka-container">
                              <div 
                                onDragOver={(e) => handleDragOver(e, user.id, 0)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 0)}
                                className={`drop-zone ${dragOverId === `${user.id}-0` ? 'drag-over' : ''} ${userAliases[user.id]?.[0] ? 'filled' : ''}`}
                              >
                                {userAliases[user.id]?.[0] || 'AKA...'}
                              </div>
                              <div 
                                onDragOver={(e) => handleDragOver(e, user.id, 1)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 1)}
                                className={`drop-zone ${dragOverId === `${user.id}-1` ? 'drag-over' : ''} ${userAliases[user.id]?.[1] ? 'filled' : ''}`}
                              >
                                {userAliases[user.id]?.[1] || 'AKA...'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="team-selector">
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name={`team-${user.id}`}
                                  checked={userSelections[user.id] === 'red'}
                                  onChange={() => handleTeamSelection(user.id, 'red')}
                                  style={{ display: 'none' }}
                                />
                                <img 
                                  src="/svgs/Red.svg" 
                                  alt="Red" 
                                  className="team-icon"
                                />
                                {userSelections[user.id] === 'red' && (
                                  <img 
                                    src="/svgs/Circle.svg" 
                                    alt="Checked" 
                                    className="circle-icon"
                                  />
                                )}
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name={`team-${user.id}`}
                                  checked={userSelections[user.id] === 'blue'}
                                  onChange={() => handleTeamSelection(user.id, 'blue')}
                                  style={{ display: 'none' }}
                                />
                                <img 
                                  src="/svgs/Blue.svg" 
                                  alt="Blue" 
                                  className="team-icon"
                                />
                                {userSelections[user.id] === 'blue' && (
                                  <img 
                                    src="/svgs/Circle.svg" 
                                    alt="Checked" 
                                    className="circle-icon"
                                  />
                                )}
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name={`team-${user.id}`}
                                  checked={userSelections[user.id] === 'unknown'}
                                  onChange={() => handleTeamSelection(user.id, 'unknown')}
                                  style={{ display: 'none' }}
                                />
                                <img 
                                  src="/svgs/Question.svg" 
                                  alt="Unknown" 
                                  className="team-icon"
                                />
                                {userSelections[user.id] === 'unknown' && (
                                  <img 
                                    src="/svgs/Circle.svg" 
                                    alt="Checked" 
                                    className="circle-icon"
                                  />
                                )}
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
                
                <div className="alias-section">
                    {randomizedAliases
                      .filter(alias => !usedAliases.has(alias))
                      .map((alias, index) => (
                        <div 
                          key={`alias-${index}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, alias)}
                        >
                          {alias}
                        </div>
                      ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
        {showModal && (
          <div className="modal">
            <div className="modal-header">
              <button onClick={closeModal} className="close-button">
                ×
              </button>
        </div>

            <div className="modal-content">
              <h2>Write Your Own!</h2>
              
              <div className="field-group">
                <label htmlFor="relationship-field">Relationship</label>
                <div className="input-with-clear">
                  <textarea
                    id="relationship-field"
                    type="text"
                    value={modalRelationship}
                    onChange={(e) => setModalRelationship(e.target.value)}
                    placeholder="Enter your relationship to the host..."
                  />
                  <button onClick={clearRelationship} className="clear-button">
                    ×
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="alibi-field">Alibi</label>
                <div className="input-with-clear">
                  <textarea
                    id="alibi-field"
                    type="text"
                    value={modalAlibi}
                    onChange={(e) => setModalAlibi(e.target.value)}
                    placeholder="Enter your reason for being here..."
                  />
                  <button onClick={clearAlibi} className="clear-button">
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closeModal} className="cancel-button">
                Cancel
              </button>
              <button onClick={saveModal} className="save-button">
                Save
          </button>
        </div>
      </div>
      )}
    </div>
  )
}

export default Dashboard
