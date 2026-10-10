import { useState, useRef, useEffect } from 'react'

// Drop the informant's recording at public/briefing-recording.mp3. Until it's
// there, the button says so and points players at the transcript.
const RECORDING_SRC = '/briefing-recording.mp3'

const BUTTON_LABELS = {
  idle: 'Press to play',
  playing: 'Pause',
  paused: 'Resume',
  ended: 'Play again',
  unavailable: 'Recording unavailable',
}

function RecordingButton() {
  const audioRef = useRef(null)
  const [state, setState] = useState('idle')
  const [progress, setProgress] = useState(0)

  // Stop playback when the briefing closes
  useEffect(() => () => audioRef.current?.pause(), [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || state === 'unavailable') return
    if (state === 'playing') {
      audio.pause()
    } else {
      if (state === 'ended') audio.currentTime = 0
      audio.play().catch(() => setState('unavailable'))
    }
  }

  return (
    <div className="briefing-recording">
      <audio
        ref={audioRef}
        src={RECORDING_SRC}
        preload="metadata"
        onPlay={() => setState('playing')}
        onPause={(e) => { if (!e.currentTarget.ended) setState('paused') }}
        onEnded={() => { setState('ended'); setProgress(1) }}
        onError={() => setState('unavailable')}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget
          if (duration) setProgress(currentTime / duration)
        }}
      />
      <button
        type="button"
        className={`briefing-press-button briefing-press-button--${state}`}
        onClick={toggle}
        disabled={state === 'unavailable'}
      >
        {BUTTON_LABELS[state]}
      </button>
      {state === 'unavailable' ? (
        <p className="briefing-recording-note">Read the transcript below instead.</p>
      ) : (
        <div className="briefing-progress" aria-hidden="true">
          <div className="briefing-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function BriefingModalPanel({ isClosing, onClose, passphrase }) {
  return (
    <div className={`modal briefing-modal ${isClosing ? 'closing' : ''}`}>
      <div className="modal-header">
        <button type="button" onClick={onClose} className="close-button">Close</button>
      </div>
      <div className="modal-content">
        <div className="backstory-card briefing-modal-card">
          <img className="briefing-modal-seal" src="/briefing-seal.png" alt="" />
          <h4>Hello, agent.</h4>
          <p>
            We received the following recording from an informer within <strong>MacGuffin Toys</strong>.
            Please go somewhere <strong>QUIET</strong> and <strong>AWAY FROM PRYING EARS</strong> to listen to it.
            Or just read the transcript. Make your own choices.
          </p>

          <RecordingButton />

          <details className="briefing-transcript">
            <summary>Read the transcript</summary>
            <p>It’s me, Honeybear. Not my real name. Listen, I’m risking life and limb to get this message to you but the matter is urgent. Something bad is going down at MacGuffin Toys. I thought we were developing cutting edge, top secret technology to make children happy but the CEO of the company has more sinister plans for our toys. She’s been taking meetings with military contractors but I believe her intentions are bigger - and worse - than even that.</p>
            <p>I want to tell you everything, but it’s not safe for me to reveal my identity. Please help me. It’s not too late.</p>
          </details>

          <p>
            We have an opportunity to infiltrate the organization for the CEO’s annual company party on <strong>Saturday, October 10</strong>.
            Your mission is to uncover and stop whatever the CEO is planning. We've prepared a series of smaller missions that will help you locate the device.
            You can do missions in any order.
          </p>
          <p>
            Due to the severity of the threat, we may have sent a few too many agents to retrieve the device.
            If you see a fellow agent in disguise, please help them maintain their cover by playing along.
            You can also sign off on their missions using your secret passphrase: <strong>{passphrase || '—'}</strong>.
          </p>
          <p><strong>Good luck, have fun, and don't get caught.</strong></p>
        </div>
      </div>
    </div>
  )
}

export default BriefingModalPanel
