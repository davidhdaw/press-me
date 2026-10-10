import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { neonApi } from './neonApi'
import { RecordingButton } from './Briefing'
import { money } from './money'

// The signed-in player on this phone, if any (the page itself needs no login)
function savedPlayer() {
  try {
    return JSON.parse(localStorage.getItem('spyUser') || 'null')
  } catch {
    return null
  }
}

// Finding this page is how "hidden message" missions (e.g. A Voice in the
// Wilderness) get completed: offer the button only to a signed-in player who
// has one unlocked and open. Everyone else just gets the message.
function CompleteHiddenMission() {
  const [player] = useState(savedPlayer)
  const [mission, setMission] = useState(null)
  const [state, setState] = useState('idle') // idle | saving | done | error
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!player?.id) return
    neonApi.getRevealMission(player.id).then(setMission).catch(() => {})
  }, [player])

  if (!mission) return null

  if (mission.completed || state === 'done') {
    return (
      <div className="reveal-complete reveal-complete--done">
        <strong>Mission complete: {mission.title}</strong>
        {mission.bounty > 0 && <span>{money(mission.bounty)} deposited to your bank.</span>}
      </div>
    )
  }

  const complete = async () => {
    setState('saving')
    setError(null)
    try {
      const result = await neonApi.completeRevealMission(mission.playerMissionId, player.id)
      setMission({ ...mission, bounty: result.bounty })
      setState('done')
    } catch (err) {
      setError(err.message || 'Could not complete the mission. Try again.')
      setState('error')
    }
  }

  return (
    <div className="reveal-complete">
      <span>You found it, {player.firstname}.</span>
      <button type="button" onClick={complete} disabled={state === 'saving'}>
        {state === 'saving' ? 'Saving…' : `Complete mission: ${mission.title}`}
      </button>
      {error && <span className="reveal-complete-error">{error}</span>}
    </div>
  )
}

// Hidden message, reached by tapping an NFC tag at the party (/reveal). Open to
// anyone who finds it: no login needed.
function RevealPage() {
  return (
    <div className="modal briefing-modal reveal-page">
      <div className="modal-content">
        <div className="backstory-card briefing-modal-card">
          <img className="briefing-modal-seal" src="/briefing-seal.png" alt="" />
          <h4>Incoming transmission</h4>
          <p>A new recording from your informant. Listen somewhere <strong>QUIET</strong>, or read the transcript.</p>

          <RecordingButton name="honeybear-culminating-mission" />

          <details className="briefing-transcript">
            <summary>Read the transcript</summary>
            <p>It’s time for me to reveal my true identity. You can call me codename: supertoy. That’s right. The first ever sentient toy! Don’t think about it too hard. Listen, if we don’t stop the CEO she’s going to use her super secret mind control technology to take over the entire military for herself! Once she presses her big red button and sets the plan in action, she’ll be unstoppable!! Tell everyone, but don’t let her know you know.</p>
          </details>

          <CompleteHiddenMission />

          <p className="reveal-back"><Link to="/">Back to my missions</Link></p>
        </div>
      </div>
    </div>
  )
}

export default RevealPage
