import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'

function Dashboard({ agentName, agentId, firstName, lastName, alias1, alias2, team, onLogout }) {
  const navigate = useNavigate()
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
  const [lockedAliases, setLockedAliases] = useState({}) // Track aliases locked by intel: { userId: [position0, position1] }
  const [aliasTeams, setAliasTeams] = useState({}) // Track team intel for aliases: { alias: 'red' | 'blue' }
  const [dragOverId, setDragOverId] = useState(null)
  const [usedAliases, setUsedAliases] = useState(new Set())
  const [userFilter, setUserFilter] = useState('')
  
  // Touch drag state
  const [touchedElement, setTouchedElement] = useState(null)
  
  // New state for relationship and alibi
  const [relationship, setRelationship] = useState('')
  const [alibi, setAlibi] = useState('')

  // Ref to store current mission IDs for comparison (avoid recreating interval on every change)
  const missionIdsRef = useRef(new Set())
  
  // Countdown timer state
  const [nextReassignmentCountdown, setNextReassignmentCountdown] = useState('Calculating...')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [modalRelationship, setModalRelationship] = useState('')
  const [modalAlibi, setModalAlibi] = useState('')
  
  // Mission completion modal state
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [isMissionClosing, setIsMissionClosing] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(null)
  const [showMissionSuccess, setShowMissionSuccess] = useState(false)
  const [missionIntel, setMissionIntel] = useState(null)
  const [showMissionFailed, setShowMissionFailed] = useState(false)
  const [missionFailedMessage, setMissionFailedMessage] = useState(null)
  const [isInActiveSession, setIsInActiveSession] = useState(false)
  const [sessionCheckLoading, setSessionCheckLoading] = useState(true)
 
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
    setShowMissionSuccess(false) // Reset success state when opening modal
    setShowMissionFailed(false) // Reset failed state when opening modal
    setMissionErrors(prev => ({ ...prev, [missionId]: '' })) // Clear any previous errors
    setMissionIntel(null) // Clear any previous intel
    setMissionFailedMessage(null) // Clear failed message
  }

  const closeMissionModal = () => {
    setIsMissionClosing(true)
    setTimeout(() => {
      setShowMissionModal(false)
      setIsMissionClosing(false)
      setSelectedMissionId(null)
      setShowMissionSuccess(false)
      setMissionIntel(null) // Clear intel when closing
      setShowMissionFailed(false)
      setMissionFailedMessage(null)
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

  // Check if user is in active session
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        setSessionCheckLoading(true)
        const activeSession = await neonApi.getActiveSession()
        if (activeSession && activeSession.participant_user_ids) {
          const userInSession = activeSession.participant_user_ids.includes(agentId)
          setIsInActiveSession(userInSession)
          
          // If user is not in active session, clear any missions they might have
          if (!userInSession) {
            setMissions([])
            setLoading(false)
          }
        } else {
          // No active session exists
          setIsInActiveSession(false)
          setMissions([])
          setLoading(false)
        }
      } catch (error) {
        console.error('Error checking active session:', error)
        setIsInActiveSession(false)
        setMissions([])
        setLoading(false)
      } finally {
        setSessionCheckLoading(false)
      }
    }
    
    checkActiveSession()
    getRandomBackstory() // Initialize with random backstory
  }, [agentId])

  useEffect(() => {
    // Only fetch missions if user is in active session
    if (isInActiveSession && !sessionCheckLoading) {
      fetchRandomMissions()
      updateCountdown()
    }
  }, [agentId, isInActiveSession, sessionCheckLoading])

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

  // Fetch users when intel tab is accessed (only if in active session)
  useEffect(() => {
    if (activeTab === 'intel' && users.length === 0 && isInActiveSession) {
      fetchUsers()
    }
  }, [activeTab, isInActiveSession])

  // Auto-check every 10 seconds for mission reassignments and updates
  useEffect(() => {
    // Update the ref whenever missions change
    missionIdsRef.current = new Set(missions.map(m => m.id))
  }, [missions])

  // Periodically check if user is still in active session
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const activeSession = await neonApi.getActiveSession()
        if (activeSession && activeSession.participant_user_ids) {
          const userInSession = activeSession.participant_user_ids.includes(agentId)
          if (userInSession !== isInActiveSession) {
            setIsInActiveSession(userInSession)
            if (!userInSession) {
              setMissions([])
            }
          }
        } else {
          if (isInActiveSession) {
            setIsInActiveSession(false)
            setMissions([])
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error)
      }
    }, 10000) // Check every 10 seconds
    
    return () => clearInterval(interval)
  }, [agentId, isInActiveSession])

  useEffect(() => {
    // Only auto-check missions if user is in active session
    if (!isInActiveSession) {
      return
    }
    
    const checkMissions = async () => {
      // const checkStartTime = Date.now()
      // console.log('[AUTO-CHECK] Starting mission check at', new Date().toISOString())
      
      try {
        // Check if missions should be reassigned (1 minute for testing)
        // console.log('[AUTO-CHECK] Checking shouldReassignMissions...')
        const shouldReassign = await neonApi.shouldReassignMissions()
        // console.log('[AUTO-CHECK] shouldReassignMissions result:', shouldReassign)
        
        if (shouldReassign) {
          // console.log('[AUTO-CHECK] Triggering mission reassignment...')
          // Trigger reassignment for all users
          const reassignResult = await neonApi.resetAndAssignAllMissions()
          // console.log('[AUTO-CHECK] Reassignment complete:', reassignResult)
        }
        
        // Always check if this user's missions have been updated
        // console.log('[AUTO-CHECK] Fetching missions for agent:', agentId)
        const newMissions = await neonApi.getAllMissionsForAgent(agentId)
        // console.log('[AUTO-CHECK] Fetched missions:', newMissions.length, 'missions')
        
        // Compare mission IDs to detect changes using ref
        const currentMissionIds = missionIdsRef.current
        const newMissionIds = new Set(newMissions.map(m => m.id))
        
        // console.log('[AUTO-CHECK] Current mission IDs:', Array.from(currentMissionIds))
        // console.log('[AUTO-CHECK] New mission IDs:', Array.from(newMissionIds))
        
        // Check if missions have changed (different IDs or count)
        const missionsChanged = 
          currentMissionIds.size !== newMissionIds.size ||
          [...newMissionIds].some(id => !currentMissionIds.has(id)) ||
          [...currentMissionIds].some(id => !newMissionIds.has(id))
        
        // console.log('[AUTO-CHECK] Missions changed?', missionsChanged)
        
        // Only update if missions have actually changed
        if (missionsChanged && newMissions.length > 0) {
          // console.log('[AUTO-CHECK] Updating missions in UI...')
          setMissions(newMissions)
          // Update ref with new mission IDs
          missionIdsRef.current = newMissionIds
          // Clear completed missions state when new missions arrive
          setCompletedMissions(new Set())
          setSuccessKeys({})
          // console.log('[AUTO-CHECK] Missions updated in UI')
        } else {
          // console.log('[AUTO-CHECK] No changes detected, skipping UI update')
        }
        
        // const checkDuration = Date.now() - checkStartTime
        // console.log('[AUTO-CHECK] Check completed in', checkDuration, 'ms')
      } catch (error) {
        // console.error('[AUTO-CHECK] Error checking missions:', error)
        // console.error('[AUTO-CHECK] Error stack:', error.stack)
        // Silently fail - don't show errors to user
      }
    }
    
    // console.log('[AUTO-CHECK] Setting up auto-check interval (every 10 seconds)')
    
    // Initial check after 1 second (give time for initial load)
    const initialTimer = setTimeout(() => {
      // console.log('[AUTO-CHECK] Running initial check (after 1 second)')
      checkMissions()
    }, 1000)
    
    // Then check every 10 seconds
    const interval = setInterval(() => {
      // console.log('[AUTO-CHECK] Running periodic check (every 10 seconds)')
      checkMissions()
    }, 10000)
    
    return () => {
      // console.log('[AUTO-CHECK] Cleaning up interval')
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [agentId]) // Only depend on agentId, not missions

  // Countdown timer for next mission reassignment
  useEffect(() => {
    let hasTriggeredCheck = false // Track if we've already triggered the check for this cycle
    
    const updateCountdown = async () => {
      try {
        const lastAssigned = await neonApi.getLastAssignmentTimestamp()
        
        if (!lastAssigned) {
          setNextReassignmentCountdown('Unknown')
          return
        }
        
        const now = new Date()
        const lastAssignedDate = new Date(lastAssigned)
        
        // Calculate difference - handle timezone issues same way as shouldReassignMissions
        let diffMs = now.getTime() - lastAssignedDate.getTime()
        let diffMinutes = diffMs / (1000 * 60)
        
        // Handle timezone offset (same logic as shouldReassignMissions)
        if (diffMs < 0 && Math.abs(diffMinutes) > 400 && Math.abs(diffMinutes) < 500) {
          const timezoneOffsetMinutes = 480 // PST is UTC-8
          const actualElapsedMs = diffMs + (timezoneOffsetMinutes * 60 * 1000)
          diffMinutes = actualElapsedMs / (1000 * 60)
        } else if (diffMinutes < 0) {
          diffMinutes = Math.abs(diffMinutes)
        }
        
        // Calculate time until next reassignment (1 minute for testing, normally 15 minutes)
        const reassignmentIntervalMinutes = 1 // Testing - change to 15 for production
        const elapsedMinutes = diffMinutes
        const remainingMinutes = Math.max(0, reassignmentIntervalMinutes - elapsedMinutes)
        
        if (remainingMinutes <= 0) {
          setNextReassignmentCountdown('Any moment...')
          
          // Trigger reassignment check after half a second if we haven't already
          if (!hasTriggeredCheck) {
            hasTriggeredCheck = true
            setTimeout(async () => {
              try {
                const shouldReassign = await neonApi.shouldReassignMissions()
                if (shouldReassign) {
                  await neonApi.resetAndAssignAllMissions()
                  // Fetch updated missions for this agent
                  const newMissions = await neonApi.getAllMissionsForAgent(agentId)
                  if (newMissions.length > 0) {
                    setMissions(newMissions)
                    missionIdsRef.current = new Set(newMissions.map(m => m.id))
                    setCompletedMissions(new Set())
                    setSuccessKeys({})
                  }
                }
              } catch (error) {
                // Silently fail
              }
              // Reset the flag after a delay to allow for next cycle
              setTimeout(() => {
                hasTriggeredCheck = false
              }, 2000)
            }, 500) // Half a second delay
          }
        } else {
          // Reset the trigger flag when countdown is not at zero
          hasTriggeredCheck = false
          
          const totalSeconds = Math.floor(remainingMinutes * 60)
          const minutes = Math.floor(totalSeconds / 60)
          const seconds = totalSeconds % 60
          
          if (minutes > 0) {
            setNextReassignmentCountdown(`${minutes}m ${seconds}s`)
          } else {
            setNextReassignmentCountdown(`${seconds}s`)
          }
        }
      } catch (error) {
        setNextReassignmentCountdown('Error calculating')
      }
    }
    
    // Update immediately
    updateCountdown()
    
    // Update every second
    const interval = setInterval(() => {
      updateCountdown()
    }, 1000)
    
    return () => {
      clearInterval(interval)
      hasTriggeredCheck = false
    }
  }, [missions, agentId]) // Reset countdown when missions change (reassignment happened)

  const fetchUsers = async () => {
    try {
      setIntelLoading(true)
      const allUsers = await neonApi.getUsers()
      setUsers(allUsers)
      
      // Get agent's intel
      const agentIntel = await neonApi.getAgentIntel(agentId)
      
      // Initialize user selections with their actual teams
      const selections = {}
      const knownAliases = {} // { userId: [alias1, alias2] }
      const lockedPositions = {} // { userId: [position0, position1] - true if locked }
      
      allUsers.forEach(user => {
        selections[user.id] = user.team
        knownAliases[user.id] = [null, null]
        lockedPositions[user.id] = [false, false]
      })
      
      // Track team intel for aliases
      const aliasTeamMap = {}
      
      // Process agent intel to populate known aliases
      agentIntel.forEach(intel => {
        if (intel.intel_type === 'user' && intel.position) {
          // Find the user this intel is about
          const userInfo = allUsers.find(u => u.id === Number(intel.intel_value))
          if (userInfo) {
            const positionIndex = intel.position - 1 // position is 1 or 2, array index is 0 or 1
            knownAliases[userInfo.id][positionIndex] = intel.alias
            lockedPositions[userInfo.id][positionIndex] = true
          }
        } else if (intel.intel_type === 'team') {
          // Store team affiliation for this alias
          aliasTeamMap[intel.alias] = intel.intel_value
        }
      })
      
      setUserSelections(selections)
      setUserAliases(knownAliases)
      setLockedAliases(lockedPositions)
      setAliasTeams(aliasTeamMap)
      
      // Randomize aliases, excluding known ones
      const allAliases = allUsers.flatMap(user => [user.alias_1, user.alias_2])
      const knownAliasSet = new Set(Object.values(knownAliases).flat().filter(a => a !== null))
      const unknownAliases = allAliases.filter(alias => !knownAliasSet.has(alias))
      const shuffled = [...unknownAliases].sort(() => Math.random() - 0.5)
      setRandomizedAliases(shuffled)
      
      // Mark known aliases as used so they don't appear in the pool
      setUsedAliases(knownAliasSet)
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
    
    // Prevent dropping on locked positions
    if (lockedAliases[userId]?.[targetIndex]) {
      setDragOverId(null)
      return
    }
    
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
    // Prevent removing locked aliases
    if (lockedAliases[userId]?.[targetIndex]) {
      return
    }
    
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
    
    // Clear all aliases except locked ones
    const clearedAliases = {}
    const allAliases = new Set()
    users.forEach(user => {
      clearedAliases[user.id] = [null, null]
      // Keep locked aliases
      if (lockedAliases[user.id]?.[0] && userAliases[user.id]?.[0]) {
        clearedAliases[user.id][0] = userAliases[user.id][0]
        allAliases.add(userAliases[user.id][0])
      }
      if (lockedAliases[user.id]?.[1] && userAliases[user.id]?.[1]) {
        clearedAliases[user.id][1] = userAliases[user.id][1]
        allAliases.add(userAliases[user.id][1])
      }
    })
    setUserAliases(clearedAliases)
    
    // Keep locked aliases marked as used, clear others
    setUsedAliases(allAliases)
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
        // Don't allow drag over locked positions
        const index = parseInt(targetIndex, 10)
        if (!lockedAliases[userId]?.[index]) {
          const foundId = `${userId}-${targetIndex}`
          setDragOverId(foundId)
        } else {
          setDragOverId(null)
        }
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
        // Prevent dropping on locked positions
        if (lockedAliases[userId]?.[targetIndex]) {
          setTouchedElement(null)
          setDragOverId(null)
          return
        }
        
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

  const fetchRandomMissions = async (doReset = false) => {
    try {
      setLoading(true)
      // Optionally reset and reassign before fetching
      if (doReset) {
        await neonApi.resetAndAssignAllMissions()
        // Clear all intel for this agent
        await neonApi.clearAgentIntel(agentId)
        // Reset intel tab state if users are loaded
        if (users.length > 0) {
          setUserAliases({})
          setLockedAliases({})
          setAliasTeams({})
          setUsedAliases(new Set())
        }
      }
      // Fetch all missions (both book and passphrase) assigned to this agent
      let assignedMissions = await neonApi.getAllMissionsForAgent(agentId)
      // If none assigned yet, attempt assignment then fetch again
      if (!assignedMissions || assignedMissions.length === 0) {
        await neonApi.resetAndAssignAllMissions()
        assignedMissions = await neonApi.getAllMissionsForAgent(agentId)
      }
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

    // Find the mission to determine its type
    const mission = missions.find(m => m.id === missionId)
    if (!mission) {
      setMissionErrors(prev => ({ ...prev, [missionId]: 'Mission not found' }))
      return
    }

    // Clear any existing error for this mission
    setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
    setShowMissionSuccess(false) // Reset success state
    setMissionIntel(null)

    try {
      let result
      
      // Route to appropriate completion function based on mission type
      if (mission.type === 'passphrase') {
        // Only receivers can complete passphrase missions
        if (mission.role !== 'receiver') {
          throw new Error('Only the receiver can complete this passphrase mission')
        }
        result = await neonApi.completePassphraseMission(missionId, successKey, agentId)
      } else if (mission.type === 'object') {
        // Object missions
        result = await neonApi.completeObjectMission(missionId, successKey, agentId)
      } else {
        // Book missions
        result = await neonApi.completeBookMission(missionId, successKey, agentId)
      }
      
      // Mission completed (or failed) - mark as completed so they can't try again
      setCompletedMissions(prev => new Set([...prev, missionId]))
      setSuccessKeys(prev => {
        const newKeys = { ...prev }
        delete newKeys[missionId]
        return newKeys
      })
      
      // Store the intel if provided
      if (result.intel) {
        setMissionIntel(result.intel)
        // Refresh intel tab data if it's already loaded
        if (users.length > 0) {
          fetchUsers()
        }
      }
      
      // Show success state only if answer was correct (or for non-passphrase missions)
      // For passphrase missions with incorrect answer, was_correct will be false
      if (selectedMissionId === missionId) {
        if (mission.type === 'passphrase' && result.was_correct === false) {
          // They were tricked - show failed state instead of input field
          setShowMissionSuccess(false)
          setShowMissionFailed(true)
          setMissionFailedMessage(result.message || 'Mission failed. You\'ve been tricked! You fell for the false intel.')
          setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
        } else {
          // Correct answer or non-passphrase mission - show success
          setShowMissionSuccess(true)
          setShowMissionFailed(false)
          setMissionErrors(prev => ({ ...prev, [missionId]: '' }))
        }
      }
    } catch (error) {
      console.error('Error completing mission:', error)
      setMissionErrors(prev => ({ ...prev, [missionId]: error.message || 'Failed to complete mission. Please try again.' }))
      setShowMissionSuccess(false) // Ensure success state is not shown on error
      setMissionIntel(null)
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
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {((alias1 === 'Swift' && alias2 === 'Spider') || (firstName === 'David' && lastName === 'Daw')) && (
                <button 
                  onClick={() => navigate('/admin')} 
                  className="admin-button button-min"
                  style={{ marginRight: '10px' }}
                >
                  ADMIN
                </button>
              )}
              <button onClick={handleLogout} className="logout-button button-min">
                LOGOUT
              </button>
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="tab-content">
            {!isInActiveSession ? (
              <div className="no-session-message">
                <h2>THE PARTY HASN'T STARTED YET</h2>
                <p>Wait for the host to start a session. Once a session is active, your missions will appear here.</p>
              </div>
            ) : (
              <>
                <div className="reassignment-countdown-header">
                  <span className="countdown-label">NEW MISSIONS IN:</span>
                  <span className="countdown-time">{nextReassignmentCountdown}</span>
                </div>
                <div className="missions-grid">
              {missions
                .filter(mission => !completedMissions.has(mission.id))
                .map((mission, index) => (
                <div 
                  key={mission.id} 
                  className="mission-card clickable"
                  onClick={() => openMissionModal(mission.id)}
                >
                  <div className="mission-header">
                    <h3>
                      {mission.type === 'passphrase' 
                        ? mission.title 
                        : mission.type === 'object'
                        ? `Operation ${mission.title}`
                        : `Book Operation: ${mission.title}`
                      }
                    </h3>
                  </div>
                  
                    {mission.type === 'passphrase' ? (
                      (() => {
                        const lines = mission.mission_body.split('\n').filter(line => line.trim() !== '')
                        const displayLines = lines.slice(0, 3)
                        return (
                          <div>
                            <p style={{ whiteSpace: 'pre-line', marginBottom: '0.5rem' }}>{displayLines[0] || ''}</p>
                            {displayLines[1] && (
                              <p 
                                style={{ 
                                  border: '2px solid var(--black)', 
                                  borderRadius: '8px',
                                  padding: '0.25rem', 
                                  display: 'inline-block',
                                  transform: 'rotate(0.5deg)',
                                  margin: '0.5rem 0',
                                  fontStyle: 'italic'
                                }}
                              >
                                {displayLines[1]}
                              </p>
                            )}
                            {displayLines[2] && (
                              <p style={{ whiteSpace: 'pre-line', marginTop: '0.5rem' }}>{displayLines[2]}</p>
                            )}
                          </div>
                        )
                      })()
                    ) : (
                      <p style={{ whiteSpace: 'pre-line' }}>{mission.mission_body}</p>
                    )}
              </div>
              ))}
            </div>
            
            {completedMissions.size > 0 && (
              <div className="completed-missions">
                <h3>Completed Missions</h3>
                <ul>
                  {missions
                    .filter(mission => completedMissions.has(mission.id))
                    .map((mission, index) => (
                      <li key={mission.id}>
                        {mission.type === 'passphrase' 
                          ? mission.title 
                          : mission.type === 'object'
                          ? mission.title
                          : `Book Operation: ${mission.title}`
                        }
                      </li>
                    ))}
                </ul>
              </div>
            )}
            
            {isInActiveSession && (
              <button onClick={() => fetchRandomMissions(true)} className="refresh-button button-min">
                Refresh missions
              </button>
            )}
              </>
            )}
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="tab-content">
            {!isInActiveSession ? (
              <div className="no-session-message">
                <h2>THE PARTY HASN'T STARTED YET</h2>
                <p>Wait for the host to start a session. Once a session is active, you'll be able to access intel.</p>
              </div>
            ) : intelLoading ? (
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
                                onDragOver={(e) => !lockedAliases[user.id]?.[0] && handleDragOver(e, user.id, 0)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 0)}
                                data-user-id={user.id}
                                data-target-index="0"
                                className={`drop-zone ${dragOverId === `${user.id}-0` ? 'drag-over' : ''} ${userAliases[user.id]?.[0] ? 'filled' : ''} ${lockedAliases[user.id]?.[0] ? 'locked' : ''}`}
                              >
                                <span className={`alias-text ${aliasTeams[userAliases[user.id]?.[0]] ? `team-${aliasTeams[userAliases[user.id]?.[0]]}` : ''}`}>
                                  {userAliases[user.id]?.[0] || 'AKA...'}
                                </span>
                                {userAliases[user.id]?.[0] && !lockedAliases[user.id]?.[0] && (
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
                                onDragOver={(e) => !lockedAliases[user.id]?.[1] && handleDragOver(e, user.id, 1)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, user.id, 1)}
                                data-user-id={user.id}
                                data-target-index="1"
                                className={`drop-zone ${dragOverId === `${user.id}-1` ? 'drag-over' : ''} ${userAliases[user.id]?.[1] ? 'filled' : ''} ${lockedAliases[user.id]?.[1] ? 'locked' : ''}`}
                              >
                                <span className={`alias-text ${aliasTeams[userAliases[user.id]?.[1]] ? `team-${aliasTeams[userAliases[user.id]?.[1]]}` : ''}`}>
                                  {userAliases[user.id]?.[1] || 'AKA...'}
                                </span>
                                {userAliases[user.id]?.[1] && !lockedAliases[user.id]?.[1] && (
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
                        const teamColor = aliasTeams[alias] ? `team-${aliasTeams[alias]}` : ''
                        return (
                          <div 
                            key={`alias-${index}`}
                            className={`alias-section-item ${teamColor}`}
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
              {!showMissionSuccess && !showMissionFailed ? (
                <>
                  <div className="modal-header">
                    <button onClick={closeMissionModal} className="close-button">
                      Close
                    </button>
                  </div>

                  <div className="modal-content">
                    <h2>
                      {mission.type === 'passphrase' 
                        ? mission.title 
                        : mission.type === 'object'
                        ? `Operation ${mission.title}`
                        : `Book Operation: ${mission.title}`
                      }
                    </h2>
                    {mission.type !== 'passphrase' && (
                      <p style={{ whiteSpace: 'pre-line' }}>{mission.mission_body}</p>
                    )}
                    
                    {/* Only show input for book missions or passphrase receivers */}
                    {(mission.type !== 'passphrase' || mission.role === 'receiver') && (
                      <div className="field-group">
                        <label htmlFor="mission-success-key">
                          {mission.type === 'passphrase' ? 'Your Answer' : 'Success Key'}
                        </label>
                        <div className="input-with-clear">
                          <input
                            id="mission-success-key"
                            type="text"
                            value={successKeys[selectedMissionId] || ''}
                            onChange={(e) => handleSuccessKeyChange(selectedMissionId, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && successKeys[selectedMissionId]) {
                                handleSubmitMission(selectedMissionId)
                              }
                            }}
                            placeholder={mission.type === 'passphrase' 
                              ? 'Enter the word you received...' 
                              : 'Enter success key...'}
                          />
                        </div>
                      </div>
                    )}

                    {mission.type === 'passphrase' && mission.role !== 'receiver' && (
                      <div className="field-group">
                        <p className="info-text">
                          You are a SENDER for this mission. You'll get credit for completing this mission if the receiver enters your intel.
                        </p>
                      </div>
                    )}

                    {missionErrors[selectedMissionId] && (
                      <div className="mission-error">
                        {missionErrors[selectedMissionId]}
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    {(mission.type !== 'passphrase' || mission.role === 'receiver') && (
                      <button 
                        onClick={() => handleSubmitMission(selectedMissionId)}
                        disabled={!successKeys[selectedMissionId]}
                        className="save-button"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </>
              ) : showMissionFailed ? (
                <>
                  <div className="modal-header">
                    <button onClick={closeMissionModal} className="close-button">
                      Close
                    </button>
                  </div>

                  <div className="modal-content">
                    <div className="mission-failed">
                      <p className="mission-failed-title">MISSION FAILED</p>
                      <h2>
                        {mission.type === 'passphrase' 
                          ? mission.title 
                          : mission.type === 'object'
                          ? mission.title
                          : `Book Operation: ${mission.title}`
                        }
                      </h2>
                      {missionFailedMessage && (
                        <p className="mission-failed-message">
                          {missionFailedMessage.replace(/^Mission failed\.\s*/i, '')}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-header">
                    <button onClick={closeMissionModal} className="close-button">
                      Close
                    </button>
                  </div>

                  <div className="modal-content">
                    <div className="mission-success">
                      <p>Mission success</p>
                      <h2>
                        {mission.type === 'passphrase' 
                          ? mission.title 
                          : mission.type === 'object'
                          ? mission.title
                          : `Book Operation: ${mission.title}`
                        }
                      </h2>
                      {missionIntel && (
                        <div className="success-intel">
                          <h3>New intel:</h3>
                          {missionIntel.intel_type === 'team' ? (
                            <p>
                              <span className="alias-container filled">{missionIntel.alias}</span>
                              {' is on the '}
                              <span className={`team-${missionIntel.intel_value}`}>{missionIntel.intel_value}</span>
                              {' team.'}
                            </p>
                          ) : missionIntel.intel_type === 'user' && missionIntel.user_name ? (
                            <p>
                              {missionIntel.user_name}
                              {' uses the '}
                              <span className="alias-container filled">{missionIntel.position === 1 ? 'first' : 'second'}</span>
                              {' alias '}
                              <span className="alias-container filled">{missionIntel.alias}</span>
                              {'.'}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}
    </div>
  )
}

export default Dashboard
