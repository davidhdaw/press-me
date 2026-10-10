import { Link } from 'react-router-dom'
import { RecordingButton } from './Briefing'

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

          <p className="reveal-back"><Link to="/">Back to my missions</Link></p>
        </div>
      </div>
    </div>
  )
}

export default RevealPage
