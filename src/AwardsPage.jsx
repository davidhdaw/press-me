import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'
import './Awards.css'

function formatClock(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const statFor = (entry) => entry.stat || (entry.finishedAt ? `Finished at ${formatClock(entry.finishedAt)}` : '')

// Default to the running session, else the most recently started one
function defaultSession(sessions) {
  const started = sessions.filter(s => s.started_at)
  return sessions.find(s => s.status === 'active')
    || started.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0]
    || null
}

// Host-only presenter screen for the end-of-game ceremony (see StaffGate).
// Slides: intro, one per award (tap once to reveal, again to advance), outro.
function AwardsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [slide, setSlide] = useState(-1) // -1 intro, 0..n-1 awards, n outro
  const [revealed, setRevealed] = useState(new Set())

  useEffect(() => {
    neonApi.getAllSessions()
      .then(all => {
        setSessions(all)
        setSessionId(defaultSession(all)?.id ?? null)
        if (!defaultSession(all)) setLoading(false)
      })
      .catch(() => { setError('Could not load sessions.'); setLoading(false) })
  }, [])

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      setData(await neonApi.getAwards(sessionId))
    } catch (err) {
      console.error('Error computing awards:', err)
      setError('Could not compute awards. Check the connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  const awards = data?.awards || []
  const last = awards.length // outro index

  const advance = useCallback(() => {
    if (slide >= 0 && slide < last && !revealed.has(slide)) {
      setRevealed(prev => new Set(prev).add(slide))
    } else {
      setSlide(s => Math.min(s + 1, last))
    }
  }, [slide, last, revealed])

  const back = useCallback(() => setSlide(s => Math.max(s - 1, -1)), [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'SELECT') return
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); advance() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, back])

  const restart = () => { setSlide(-1); setRevealed(new Set()) }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const award = slide >= 0 && slide < last ? awards[slide] : null
  const isRevealed = revealed.has(slide)

  return (
    <div className="awards-page">
      <div className="awards-stage" onClick={data && !loading ? advance : undefined}>
        {loading ? (
          <p className="awards-muted">Tallying the results...</p>
        ) : error ? (
          <p className="awards-muted">{error}</p>
        ) : !sessionId ? (
          <p className="awards-muted">No session has been played yet.</p>
        ) : slide === -1 ? (
          <div className="awards-slide">
            <p className="awards-kicker">Debriefing</p>
            <h1 className="awards-title">The Awards</h1>
            <p className="awards-sub">{data.session.name}</p>
            <p className="awards-hint">Tap or press space to begin</p>
          </div>
        ) : award ? (
          <div className="awards-slide" key={award.key}>
            <p className="awards-kicker">Award {slide + 1} of {last}</p>
            <h1 className="awards-title">{award.title}</h1>
            <p className="awards-sub">{award.description}</p>
            {!isRevealed ? (
              <p className="awards-hint">Tap to reveal</p>
            ) : award.winner ? (
              <div className="awards-reveal">
                <div className="awards-winner">{award.winner.names.join(' & ')}</div>
                <div className="awards-stat">{statFor(award.winner)}</div>
                {award.topThree.length > 1 && (
                  <ol className="awards-runners">
                    {award.topThree.map((entry, i) => (
                      <li key={i} className={entry.userIds.join() === award.winner.userIds.join() ? 'is-winner' : ''}>
                        <span>{entry.names.join(' & ')}</span>
                        <span>{statFor(entry)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {award.passedOver && (
                  <p className="awards-note">The leader already took home an award, so this one goes to the next agent in line.</p>
                )}
              </div>
            ) : (
              <div className="awards-reveal">
                <div className="awards-winner awards-winner--none">Nobody qualified</div>
                {award.topThree.length > 0 && (
                  <>
                    <ol className="awards-runners">
                      {award.topThree.map((entry, i) => (
                        <li key={i}><span>{entry.names.join(' & ')}</span><span>{statFor(entry)}</span></li>
                      ))}
                    </ol>
                    <p className="awards-note">Everyone in the running already has an award.</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="awards-slide">
            <p className="awards-kicker">Mission complete</p>
            <h1 className="awards-title">Congratulations, agents</h1>
            <p className="awards-sub">Thank you for playing.</p>
          </div>
        )}
      </div>

      <div className="awards-controls">
        <button type="button" onClick={() => navigate('/admin')}>Exit</button>
        {slide === -1 && sessions.length > 0 && (
          <>
            <select value={sessionId ?? ''} onChange={(e) => { setSessionId(Number(e.target.value)); restart() }}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </select>
            <button type="button" onClick={load} disabled={loading}>Recalculate</button>
          </>
        )}
        {slide === last && <button type="button" onClick={restart}>Start over</button>}
        <span className="awards-controls-spacer" />
        <button type="button" onClick={back} disabled={slide === -1}>Back</button>
        <button type="button" onClick={advance} disabled={!data || loading || slide === last}>
          {award && !isRevealed ? 'Reveal' : 'Next'}
        </button>
        <button type="button" onClick={toggleFullscreen}>Fullscreen</button>
      </div>
    </div>
  )
}

export default AwardsPage
