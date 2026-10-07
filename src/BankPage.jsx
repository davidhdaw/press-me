import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'
import { StatementList } from './BankStatement'
import { money } from './money'
import './AdminDashboard.css'

// Only rendered for a verified banker or host (see StaffGate)
function BankPage({ staff, onLogout }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [statement, setStatement] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [correction, setCorrection] = useState({ open: false, sign: '+', amount: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'ok' | 'error', text }

  // Prize exchange can happen while a session is paused, so fall back to it
  const loadAccounts = useCallback(async () => {
    try {
      const sessions = await neonApi.getAllSessions()
      const current = sessions.find(s => s.status === 'active') || sessions.find(s => s.status === 'paused') || null
      setSession(current)
      setAccounts(current ? await neonApi.getBalances(current.id) : [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Keyed on the id: loadAccounts replaces the session object on every refresh
  const sessionId = session?.id
  const loadStatement = useCallback(async (userId) => {
    if (!sessionId || !userId) return
    try {
      setStatement(await neonApi.getStatement(sessionId, userId))
    } catch (error) {
      console.error('Error loading statement:', error)
    }
  }, [sessionId])

  useEffect(() => {
    loadAccounts()
    const interval = setInterval(loadAccounts, 15000)
    return () => clearInterval(interval)
  }, [loadAccounts])

  useEffect(() => {
    setStatement(null)
    if (selectedId) loadStatement(selectedId)
  }, [selectedId, loadStatement])

  const selected = accounts.find(a => a.id === selectedId)

  const openAccount = (id) => {
    setSelectedId(id)
    setAmount('')
    setNote('')
    setCorrection({ open: false, sign: '+', amount: '', reason: '' })
    setFeedback(null)
  }

  const submit = async (kind, value, text) => {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await neonApi.recordTransaction({
        sessionId,
        userId: selectedId,
        kind,
        amount: value,
        note: text,
        createdBy: staff.id,
      })
      setStatement(result)
      const what = kind === 'withdrawal'
        ? `Withdrew ${money(value)}${text?.trim() ? ` for ${text.trim()}` : ''}.`
        : `${value > 0 ? 'Added' : 'Removed'} ${money(Math.abs(value))}.`
      setFeedback({ type: 'ok', text: `${what} New balance ${money(result.balance)}.` })
      setAmount('')
      setNote('')
      setCorrection({ open: false, sign: '+', amount: '', reason: '' })
      loadAccounts()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = (e) => {
    e.preventDefault()
    const value = parseInt(amount, 10)
    if (!value || value <= 0) {
      setFeedback({ type: 'error', text: 'Enter how much they are spending.' })
      return
    }
    const name = `${selected.firstname} ${selected.lastname}`
    if (!window.confirm(`Take ${money(value)} from ${name}${note.trim() ? ` for ${note.trim()}` : ''}?`)) return
    submit('withdrawal', value, note)
  }

  const handleCorrection = (e) => {
    e.preventDefault()
    const value = parseInt(correction.amount, 10)
    if (!value || value <= 0) {
      setFeedback({ type: 'error', text: 'Enter the correction amount.' })
      return
    }
    if (!correction.reason.trim()) {
      setFeedback({ type: 'error', text: 'Say why, so other staff can follow the history.' })
      return
    }
    submit('adjustment', correction.sign === '-' ? -value : value, correction.reason)
  }

  const query = search.trim().toLowerCase()
  const visible = accounts.filter(a =>
    !query || `${a.firstname} ${a.lastname} ${a.alias_1} ${a.alias_2}`.toLowerCase().includes(query)
  )

  return (
    <div className="admin-dashboard bank-page">
      <div className="admin-header">
        <h1>Bank</h1>
        <div className="admin-actions">
          <span className="staff-signed-in">{staff.firstname} {staff.lastname}</span>
          {staff.is_admin && (
            <button onClick={() => navigate('/admin')} className="back-button">Admin</button>
          )}
          <button onClick={onLogout} className="logout-button">Logout</button>
        </div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="admin-placeholder"><p>Loading accounts...</p></div>
        ) : !session ? (
          <div className="admin-section">
            <p className="admin-empty-message">No session is running, so there are no accounts to show.</p>
          </div>
        ) : !selected ? (
          <div className="admin-section">
            <h2>{session.name}{session.status === 'paused' ? ' (paused)' : ''}</h2>
            <input
              type="search"
              className="bank-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or alias"
            />
            <ul className="bank-accounts">
              {visible.map(a => (
                <li key={a.id}>
                  <button type="button" className="bank-account-row" onClick={() => openAccount(a.id)}>
                    <span>
                      <strong>{a.firstname} {a.lastname}</strong>
                      <span className="bank-statement-meta">{a.alias_1} {a.alias_2}</span>
                    </span>
                    <span className="bank-account-balance">{money(a.balance)}</span>
                  </button>
                </li>
              ))}
              {visible.length === 0 && <p className="admin-empty-message">No matching players.</p>}
            </ul>
          </div>
        ) : (
          <div className="admin-section">
            <button type="button" className="button-small" onClick={() => openAccount(null)}>← All accounts</button>
            <div className="bank-balance-card">
              <h2>{selected.firstname} {selected.lastname}</h2>
              <div className="bank-balance">{money(statement ? statement.balance : selected.balance)}</div>
              <span className="bank-statement-meta">Earned {money(selected.earned)} · Spent {money(selected.spent)}</span>
            </div>

            {feedback && (
              <p className={feedback.type === 'ok' ? 'bank-feedback' : 'bank-feedback bank-feedback--error'}>{feedback.text}</p>
            )}

            <form onSubmit={handleWithdraw} className="bank-form">
              <h3>Spend at the bank</h3>
              <div className="admin-form-group">
                <label htmlFor="bank-amount">Amount ($)</label>
                <input id="bank-amount" type="text" inputMode="numeric" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} disabled={busy} />
              </div>
              <div className="admin-form-group">
                <label htmlFor="bank-note">For</label>
                <input id="bank-note" type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. rubber duck" disabled={busy} />
              </div>
              <button type="submit" className="button-primary" disabled={busy || !amount}>
                {busy ? 'Saving...' : `Withdraw ${amount ? money(amount) : ''}`}
              </button>
            </form>

            {correction.open ? (
              <form onSubmit={handleCorrection} className="bank-form">
                <h3>Correct balance</h3>
                <div className="admin-form-group bank-correction-row">
                  <select value={correction.sign} onChange={(e) => setCorrection({ ...correction, sign: e.target.value })} disabled={busy}>
                    <option value="+">Add</option>
                    <option value="-">Remove</option>
                  </select>
                  <input type="text" inputMode="numeric" value={correction.amount} placeholder="$"
                    onChange={(e) => setCorrection({ ...correction, amount: e.target.value.replace(/\D/g, '') })} disabled={busy} />
                </div>
                <div className="admin-form-group">
                  <input type="text" value={correction.reason} placeholder="Reason (required)"
                    onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} disabled={busy} />
                </div>
                <div className="session-controls">
                  <button type="button" className="button-secondary" onClick={() => setCorrection({ open: false, sign: '+', amount: '', reason: '' })} disabled={busy}>Cancel</button>
                  <button type="submit" className="button-primary" disabled={busy}>Save correction</button>
                </div>
              </form>
            ) : (
              <button type="button" className="button-small bank-correction-toggle" onClick={() => setCorrection({ ...correction, open: true })}>
                Correct a mistake
              </button>
            )}

            <h3>History</h3>
            {statement ? <StatementList entries={statement.entries} /> : <p className="admin-placeholder">Loading...</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default BankPage
