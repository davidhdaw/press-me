import React from 'react'

export function BriefingMissionRow({ onOpenBriefing }) {
  return (
    <button
      type="button"
      className="mission-card mission-card--completed clickable mission-card--briefing"
      onClick={onOpenBriefing}
    >
      <h3>Briefing</h3>
    </button>
  )
}

function MissionsTab({ isInActiveSession, missions, currentPhase, completedMissions, onMissionClick, onOpenBriefing, pushMissions, paused, gameOver }) {
  if (!isInActiveSession) {
    return (
      <div className="tab-content">
        <BriefingMissionRow onOpenBriefing={onOpenBriefing} />
        <div className="no-session-message">
          <h2>THE PARTY HASN'T STARTED YET</h2>
          <p>Wait for the host to start a session. Once a session is active, your missions will appear here.</p>
        </div>
      </div>
    )
  }

  const activePush = (pushMissions || []).filter(m => !m.completed)
  const completedPush = (pushMissions || []).filter(m => m.completed)

  const cp = Number(currentPhase)
  const phaseOrder = [cp, ...([0, 1, 2, 3].filter(p => p !== cp))]

  return (
    <div className="tab-content">
      {gameOver && (
        <div className="game-paused-banner game-over-banner">
          <strong>Mission complete</strong>
          <span>The operation is over, agent. Gather round for the debrief and awards!</span>
        </div>
      )}
      {paused && !gameOver && (
        <div className="game-paused-banner">
          <strong>Game paused</strong>
          <span>Hold tight, agent. The hosts will resume shortly.</span>
        </div>
      )}
      <BriefingMissionRow onOpenBriefing={onOpenBriefing} />

      {(activePush.length > 0 || completedPush.length > 0) && (
        <div className="missions-phase missions-phase--push">
          {activePush.length > 0 && (
            <div className="missions-grid">
              {activePush.map(pm => (
                <div key={`push-${pm.id}`} className="mission-card mission-card--push">
                  <div className="push-mission-card-label">SPECIAL OPS</div>
                  <div className="mission-header">
                    <h3>{pm.title}</h3>
                    {pm.bounty > 0 && (
                      <span style={{ fontSize: '0.75em', color: 'var(--green)', fontWeight: 'bold' }}>{`$${pm.bounty}`}</span>
                    )}
                  </div>
                  <p style={{ whiteSpace: 'pre-line' }}>{pm.mission_body}</p>
                </div>
              ))}
            </div>
          )}
          {completedPush.length > 0 && (
            <div className="missions-grid missions-grid--compact">
              {completedPush.map(pm => (
                <div
                  key={`push-${pm.id}`}
                  className="mission-card mission-card--completed mission-card--push"
                >
                  <div className="mission-card-completed-row">
                    <h3>{pm.title}</h3>
                    {pm.bounty > 0 && (
                      <span className="mission-bounty-badge mission-bounty-badge--paid">+${pm.bounty}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phaseOrder.map(phase => {
        // Culminating missions stay secret until every other mission in the phase is done
        const phaseMissions = missions
          .filter(m => Number(m.phase) === phase)
          .filter(m => !m.isCulminating || m.culminatingUnlocked || m.completed)
          .sort((a, b) => Number(!!b.isCulminating) - Number(!!a.isCulminating))
        if (phaseMissions.length === 0) return null
        const isLocked = phase < cp || gameOver

        const incomplete = m => !completedMissions.has(m.playerMissionId)
        const lockedIncomplete = phaseMissions.filter(m => isLocked && incomplete(m))
        const compactCompleted = phaseMissions.filter(m => completedMissions.has(m.playerMissionId))
        const fullCardMissions = phaseMissions.filter(m => incomplete(m) && !isLocked)
        const showCompactRow = lockedIncomplete.length > 0 || compactCompleted.length > 0

        return (
          <div key={phase} className="missions-phase">
            {fullCardMissions.length > 0 && (
              <div className="missions-grid">
                {fullCardMissions.map(mission => (
                  <div
                    key={mission.playerMissionId}
                    className={`mission-card clickable${mission.isCulminating ? ' mission-card--push mission-card--culminating' : ''}`}
                    onClick={() => onMissionClick(mission.playerMissionId)}
                  >
                    {mission.isCulminating && (
                      <div className="push-mission-card-label">CULMINATING MISSION · SEE YOUR HANDLER</div>
                    )}
                    <div className="mission-header">
                      <h3>{mission.title}</h3>
                      {mission.bounty > 0 && (
                        <span style={{ fontSize: '0.75em', color: 'var(--green)', fontWeight: 'bold' }}>{`$${mission.bounty}`}</span>
                      )}
                    </div>
                    <p style={{ whiteSpace: 'pre-line' }}>{mission.missionBody}</p>
                  </div>
                ))}
              </div>
            )}

            {showCompactRow && (
              <div className="missions-grid missions-grid--compact">
                {compactCompleted.map(mission => (
                  <div
                    key={mission.playerMissionId}
                    className="mission-card mission-card--completed clickable"
                    onClick={() => onMissionClick(mission.playerMissionId)}
                  >
                    <div className="mission-card-completed-row">
                      <h3>{mission.title}</h3>
                      {mission.bountyAwarded > 0 && (
                        <span className="mission-bounty-badge mission-bounty-badge--paid">+${mission.bountyAwarded}</span>
                      )}
                    </div>
                  </div>
                ))}
                {lockedIncomplete.map(mission => (
                  <div
                    key={mission.playerMissionId}
                    className="mission-card mission-card--unavailable"
                    aria-disabled="true"
                  >
                    <h3>{mission.title}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default MissionsTab
