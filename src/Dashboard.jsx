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
  const [userFilter, setUserFilter] = useState('')
  
  // Touch drag state
  const [touchedElement, setTouchedElement] = useState(null)
  
  // New state for relationship and alibi
  const [relationship, setRelationship] = useState('')
  const [alibi, setAlibi] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [modalRelationship, setModalRelationship] = useState('')
  const [modalAlibi, setModalAlibi] = useState('')
  
  // Mission completion modal state
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [isMissionClosing, setIsMissionClosing] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(null)
 
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
    setIsClosing(true)
    setTimeout(() => {
      setShowModal(false)
      setIsClosing(false)
    }, 300)
  }

  const openMissionModal = (missionId) => {
    setSelectedMissionId(missionId)
    setShowMissionModal(true)
  }

  const closeMissionModal = () => {
    setIsMissionClosing(true)
    setTimeout(() => {
      setShowMissionModal(false)
      setIsMissionClosing(false)
      setSelectedMissionId(null)
    }, 300)
  }

  const saveModal = () => {
    setRelationship(modalRelationship)
    setAlibi(modalAlibi)
    closeModal()
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

  // Auto-hide revealed items after 3 seconds
  useEffect(() => {
    if (agentNameVisible) {
      const timer = setTimeout(() => {
        setAgentNameVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [agentNameVisible])

  useEffect(() => {
    if (realNameVisible) {
      const timer = setTimeout(() => {
        setRealNameVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [realNameVisible])

  useEffect(() => {
    if (teamVisible) {
      const timer = setTimeout(() => {
        setTeamVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [teamVisible])

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
    e.target.classList.add('dragging')
  }

  const handleDragOver = (e, userId, targetIndex) => {
    e.preventDefault()
    setDragOverId(`${userId}-${targetIndex}`)
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging')
  }

  const handleDrop = (e, userId, targetIndex) => {
    e.preventDefault()
    const alias = e.dataTransfer.getData('text/plain')
    
    // Remove the dragging class from all elements
    document.querySelectorAll('.alias-section .dragging').forEach(el => {
      el.classList.remove('dragging')
    })
    
    // Get the current aliases for this user
    const currentAliases = userAliases[userId] || []
    const existingAlias = currentAliases[targetIndex]
    
    // If there's already an alias in this position, return it to the alias-section
    if (existingAlias) {
      setUsedAliases(prev => {
        const updated = new Set(prev)
        updated.delete(existingAlias)
        return updated
      })
    }
    
    // Add the new alias to the drop zone
    setUserAliases(prev => {
      const current = prev[userId] || []
      const updated = [...current]
      updated[targetIndex] = alias
      return {
        ...prev,
        [userId]: updated
      }
    })
    
    // Mark the new alias as used
    setUsedAliases(prev => new Set([...prev, alias]))
    setDragOverId(null)
  }

  const handleRemoveAlias = (userId, targetIndex) => {
    const currentAliases = userAliases[userId] || []
    const aliasToRemove = currentAliases[targetIndex]
    
    if (aliasToRemove) {
      // Remove from userAliases
      setUserAliases(prev => {
        const current = prev[userId] || []
        const updated = [...current]
        updated[targetIndex] = undefined
        return {
          ...prev,
          [userId]: updated
        }
      })
      
      // Return to alias-section by removing from usedAliases
      setUsedAliases(prev => {
        const updated = new Set(prev)
        updated.delete(aliasToRemove)
        return updated
      })
    }
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

  // Touch handlers for mobile
  const handleTouchStart = (e, alias) => {
    e.preventDefault()
    const touch = e.touches[0]
    const target = e.currentTarget
    
    setTouchedElement({
      alias,
      element: target,
      startX: touch.clientX,
      startY: touch.clientY
    })
    
    target.classList.add('dragging')
  }

  const handleTouchMove = (e) => {
    if (!touchedElement) return
    
    e.preventDefault()
    const touch = e.touches[0]
    
    // Find the element under the touch point
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const dropZone = element?.closest('.drop-zone')
    
    if (dropZone) {
      // Extract userId and targetIndex from data attributes
      const userId = dropZone.getAttribute('data-user-id')
      const targetIndex = dropZone.getAttribute('data-target-index')
      
      if (userId && targetIndex !== null) {
        const foundId = `${userId}-${targetIndex}`
        setDragOverId(foundId)
      }
    } else {
      setDragOverId(null)
    }
  }

  const handleTouchEnd = (e) => {
    if (!touchedElement) return
    
    e.preventDefault()
    const touch = e.changedTouches[0]
    
    // Remove dragging class
    touchedElement.element.classList.remove('dragging')
    
    // Find the element under the touch point
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const dropZone = element?.closest('.drop-zone')
    
    if (dropZone) {
      // Extract userId and targetIndex from data attributes
      const userId = dropZone.getAttribute('data-user-id')
      const targetIndex = parseInt(dropZone.getAttribute('data-target-index'), 10)
      
      if (userId && !isNaN(targetIndex)) {
        // Use the existing handleDrop logic
        const alias = touchedElement.alias
        
        // Get the current aliases for this user
        const currentAliases = userAliases[userId] || []
        const existingAlias = currentAliases[targetIndex]
        
        // If there's already an alias in this position, return it to the alias-section
        if (existingAlias) {
          setUsedAliases(prev => {
            const updated = new Set(prev)
            updated.delete(existingAlias)
            return updated
          })
        }
        
        // Add the new alias to the drop zone
        setUserAliases(prev => {
          const current = prev[userId] || []
          const updated = [...current]
          updated[targetIndex] = alias
          return {
            ...prev,
            [userId]: updated
          }
        })
        
        // Mark the new alias as used
        setUsedAliases(prev => new Set([...prev, alias]))
      }
    }
    
    setTouchedElement(null)
    setDragOverId(null)
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

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (showModal) {
      closeModal()
    }
    if (showMissionModal) {
      closeMissionModal()
    }
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
      
      // Close the modal if it's open
      if (selectedMissionId === missionId) {
        closeMissionModal()
      }
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
              onClick={() => handleTabChange('agent')}
            >
              AGENT
            </button>
            <button 
              className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => handleTabChange('missions')}
            >
              MISSIONS
            </button>
            <button 
              className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => handleTabChange('intel')}
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
              onClick={() => handleTabChange('agent')}
            >
              Agent
            </button>
            <button 
              className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => handleTabChange('missions')}
            >
              Missions
            </button>
            <button 
              className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
              onClick={() => handleTabChange('intel')}
            >
              Intel
            </button>
          </div>
        </div>
        <div className={`dashboard-content dashboard-content-${activeTab}`}>
          <div className="tab-content">
          <h1>ERROR</h1>
          <p>{error}</p>
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
            onClick={() => handleTabChange('agent')}
          >
            AGENT
          </button>
          <button 
            className={`tab-button tab-missions ${activeTab === 'missions' ? 'active' : ''}`}
            onClick={() => handleTabChange('missions')}
          >
            MISSIONS
          </button>
          <button 
            className={`tab-button tab-intel ${activeTab === 'intel' ? 'active' : ''}`}
            onClick={() => handleTabChange('intel')}
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
                <div className={`field-row ${agentNameVisible ? 'visible' : 'hidden'}`}>
                  <span>{agentName}</span>
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
                <div className={`field-row ${realNameVisible ? 'visible' : 'hidden'}`}>
                  <span>{firstName} {lastName}</span>
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
                <div className={`field-row ${teamVisible ? 'visible' : 'hidden'} team-${team}`}>
                  <span>{team} team</span>
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
                  <button
                    onClick={() => openMissionModal(mission.id)}
                    className="complete-mission-button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                    </svg>
                    <span>Complete mission</span>
                  </button>
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
                    <div className="guest-list-header">
                      <h3>Guest list</h3>
                      <div className="user-filter-container">
                        <svg 
                          className="user-filter-search-icon" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                          type="text"
                          placeholder="Search"
                          value={userFilter}
                          onChange={(e) => setUserFilter(e.target.value)}
                          className="user-filter-input"
                        />
                        {userFilter && (
                          <button 
                            onClick={() => setUserFilter('')}
                            className="user-filter-clear-button"
                            type="button"
                          >
                            <img src="/svgs/X.svg" alt="Clear filter" />
                          </button>
                        )}
                      </div>
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
                      {users
                        .filter(user => {
                          const fullName = `${user.firstname} ${user.lastname}`.toLowerCase()
                          return fullName.includes(userFilter.toLowerCase())
                        })
                        .map((user) => (
                        <tr key={`${user.id}-name`} data-user-id={user.id}>
                          <td 
                            className={`${
                              userSelections[user.id] === 'red' ? 'team-red' : 
                              userSelections[user.id] === 'blue' ? 'team-blue' : 
                              ''
                            }`}
                            data-user-id={user.id}
                          >
                            {user.firstname} {user.lastname}
                          </td>
                          <td>
                            <div className="aka-container">
                              <div 
                                onDragOver={(e) => handleDragOver(e, user.id, 0)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 0)}
                                data-user-id={user.id}
                                data-target-index="0"
                                className={`drop-zone ${dragOverId === `${user.id}-0` ? 'drag-over' : ''} ${userAliases[user.id]?.[0] ? 'filled' : ''}`}
                              >
                                <span className="alias-text">
                                  {userAliases[user.id]?.[0] || 'AKA...'}
                                </span>
                                {userAliases[user.id]?.[0] && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveAlias(user.id, 0)
                                    }}
                                    className="remove-alias-button"
                                  >
                                    <img src="/svgs/X.svg" alt="Remove" />
                                  </button>
                                )}
                              </div>
                              <div 
                                onDragOver={(e) => handleDragOver(e, user.id, 1)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 1)}
                                data-user-id={user.id}
                                data-target-index="1"
                                className={`drop-zone ${dragOverId === `${user.id}-1` ? 'drag-over' : ''} ${userAliases[user.id]?.[1] ? 'filled' : ''}`}
                              >
                                <span className="alias-text">
                                  {userAliases[user.id]?.[1] || 'AKA...'}
                                </span>
                                {userAliases[user.id]?.[1] && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveAlias(user.id, 1)
                                    }}
                                    className="remove-alias-button"
                                  >
                                    <img src="/svgs/X.svg" alt="Remove" />
                                  </button>
                                )}
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
                                <div className="radio-content">
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
                                </div>
                                <span className="team-label">Red</span>
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name={`team-${user.id}`}
                                  checked={userSelections[user.id] === 'blue'}
                                  onChange={() => handleTeamSelection(user.id, 'blue')}
                                  style={{ display: 'none' }}
                                />
                                <div className="radio-content">
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
                                </div>
                                <span className="team-label">Blue</span>
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name={`team-${user.id}`}
                                  checked={userSelections[user.id] === 'unknown'}
                                  onChange={() => handleTeamSelection(user.id, 'unknown')}
                                  style={{ display: 'none' }}
                                />
                                <div className="radio-content">
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
                                </div>
                                <span className="team-label">Unknown</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <button 
                    onClick={handleClearAll} 
                    className="clear-button"
                  >
                    Clear
                  </button>
                </div>
                </div>
                
                <div className="alias-section">
                    {randomizedAliases
                      .filter(alias => !usedAliases.has(alias))
                      .map((alias, index) => {
                        // Create a deterministic rotation based on the alias text
                        const hash = alias.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                        const rotation = ((hash % 12) - 6) * 0.5 // -3 to +3 degrees
                        return (
                          <div 
                            key={`alias-${index}`}
                            className="alias-section-item"
                            draggable
                            data-alias={alias}
                            onDragStart={(e) => handleDragStart(e, alias)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, alias)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            style={{
                              '--rotation': `${rotation}deg`
                            }}
                          >
                            {alias}
                          </div>
                        )
                      })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
        {showModal && (
          <div className={`modal ${isClosing ? 'closing' : ''}`}>
            <div className="modal-header">
              <button onClick={closeModal} className="close-button">
                Close
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
                    <img src="/svgs/X.svg" alt="Clear" />
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
                    <img src="/svgs/X.svg" alt="Clear" />
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

      {/* Mission Completion Modal */}
        {showMissionModal && selectedMissionId && (() => {
          const mission = missions.find(m => m.id === selectedMissionId)
          if (!mission) return null
          
          return (
            <div className={`modal ${isMissionClosing ? 'closing' : ''}`}>
              <div className="modal-header">
                <button onClick={closeMissionModal} className="close-button">
                  Close
                </button>
              </div>

              <div className="modal-content">
                <h2>Operation {mission.title}</h2>
                <p>{mission.mission_body}</p>
                
                <div className="field-group">
                  <label htmlFor="mission-success-key">Success Key</label>
                  <div className="input-with-clear">
                    <input
                      id="mission-success-key"
                      type="text"
                      value={successKeys[selectedMissionId] || ''}
                      onChange={(e) => handleSuccessKeyChange(selectedMissionId, e.target.value)}
                      placeholder="Enter success key..."
                    />
                  </div>
                </div>

                {missionErrors[selectedMissionId] && (
                  <div className="mission-error">
                    {missionErrors[selectedMissionId]}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button onClick={closeMissionModal} className="cancel-button">
                  Cancel
                </button>
                <button 
                  onClick={() => handleSubmitMission(selectedMissionId)}
                  disabled={!successKeys[selectedMissionId]}
                  className="save-button"
                >
                  Submit
                </button>
              </div>
            </div>
          )
        })()}
    </div>
  )
}

export default Dashboard
