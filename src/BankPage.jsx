import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { neonApi } from './neonApi'
import { StatementList } from './BankStatement'
import { money } from './money'
import './AdminDashboard.css'

// One-tap prices at the prize table
const QUICK_AMOUNTS = [100, 500, 1000]
// Matches the server-side limit in api/bank.js undoTransaction
const UNDO_MS = 5 * 60 * 1000

// Only rendered for a verified banker or host (see StaffGate).
// Built for speed at a busy prize table: each player row has one-tap spend
// buttons, mistakes are fixed with Undo rather than a confirmation step, and
// adding money (rarer) lives on the player's detail screen.
function BankPage({ staff, onLogout }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState({}) // userId -> dollars still in flight (negative)
  const pendingCount = useRef(0)
  const [recent, setRecent] = useState([]) // this banker's latest spends, newest first
  const [flashId, setFlashId] = useState(null)
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'error', text }
  const [now, setNow] = useState(Date.now())

  const [selectedId, setSelectedId] = useState(null)
  const [statement, setStatement] = useState(null)
  const [addForm, setAddForm] = useState({ amount: '', reason: '' })
  const [spendForm, setSpendForm] = useState({ amount: '', note: '' })
  const [busy, setBusy] = useState(false)

  // Prize exchange can happen while a session is paused, so fall back to it
  const loadAccounts = useCallback(async () => {
    try {
      const sessions = await neonApi.getAllSessions()
      const current = sessions.find(s => s.status === 'active') || sessions.find(s => s.status === 'paused') || null
      const balances = current ? await neonApi.getBalances(current.id) : []
      // Don't overwrite optimistic balances while a tap is still being saved
      if (pendingCount.current === 0) setAccounts(balances)
      setSession(current)
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const sessionId = session?.id

  useEffect(() => {
    loadAccounts()
    const interval = setInterval(loadAccounts, 15000)
    return () => clearInterval(interval)
  }, [loadAccounts])

  // Re-render periodically so Undo buttons expire on time
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setStatement(null)
    if (selectedId && sessionId) {
      neonApi.getStatement(sessionId, selectedId).then(setStatement).catch(err => console.error('Error loading statement:', err))
    }
  }, [selectedId, sessionId])

  const updateAccount = (userId, fields) =>
    setAccounts(prev => prev.map(a => (a.id === userId ? { ...a, ...fields } : a)))

  const flash = (userId) => {
    setFlashId(userId)
    setTimeout(() => setFlashId(id => (id === userId ? null : id)), 600)
  }

  const quickSpend = async (account, amount) => {
    const name = `${account.firstname} ${account.lastname}`
    pendingCount.current++
    setPending(p => ({ ...p, [account.id]: (p[account.id] || 0) - amount }))
    flash(account.id)
    try {
      const result = await neonApi.recordTransaction({
        sessionId, userId: account.id, kind: 'withdrawal', amount, note: null, createdBy: staff.id,
      })
      setAccounts(prev => prev.map(a => (a.id === account.id
        ? { ...a, balance: result.balance, spent: a.spent + amount }
        : a)))
      setRecent(prev => [{ txId: result.transactionId, userId: account.id, name, amount, at: Date.now() }, ...prev].slice(0, 5))
      setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', text: `${name}: ${error.message || 'could not save. Try again.'}` })
    } finally {
      pendingCount.current--
      setPending(p => ({ ...p, [account.id]: (p[account.id] || 0) + amount }))
    }
  }

  const undo = async (item) => {
    try {
      const result = await neonApi.undoTransaction(item.txId, staff.id)
      setAccounts(prev => prev.map(a => (a.id === item.userId
        ? { ...a, balance: result.balance, spent: Math.max(0, a.spent - item.amount) }
        : a)))
      if (selectedId === item.userId) setStatement(result)
      setRecent(prev => prev.filter(r => r.txId !== item.txId))
      setNotice({ type: 'ok', text: `Undone: ${money(item.amount)} back to ${item.name}.` })
    } catch (error) {
      setRecent(prev => prev.filter(r => r.txId !== item.txId))
      setNotice({ type: 'error', text: error.message })
    }
  }

  const openAccount = (id) => {
    setSelectedId(id)
    setAddForm({ amount: '', reason: '' })
    setSpendForm({ amount: '', note: '' })
    setNotice(null)
  }

  // Detail screen: add money (deliberate) or spend an unusual amount
  const submitDetail = async (kind, amount, note, successText) => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await neonApi.recordTransaction({
        sessionId, userId: selectedId, kind, amount, note, createdBy: staff.id,
      })
      setStatement(result)
      updateAccount(selectedId, { balance: result.balance })
      if (kind === 'withdrawal') {
        const a = accounts.find(x => x.id === selectedId)
        setRecent(prev => [{ txId: result.transactionId, userId: selectedId, name: `${a.firstname} ${a.lastname}`, amount, at: Date.now() }, ...prev].slice(0, 5))
      }
      setNotice({ type: 'ok', text: `${successText} New balance ${money(result.balance)}.` })
      setAddForm({ amount: '', reason: '' })
      setSpendForm({ amount: '', note: '' })
      loadAccounts()
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = (e) => {
    e.preventDefault()
    const value = parseInt(addForm.amount, 10)
    if (!value) return setNotice({ type: 'error', text: 'Enter how much to add.' })
    if (!addForm.reason.trim()) return setNotice({ type: 'error', text: 'Give a reason, so other staff can follow the history.' })
    const name = `${selected.firstname} ${selected.lastname}`
    if (!window.confirm(`Add ${money(value)} to ${name}'s account?\nReason: ${addForm.reason.trim()}`)) return
    submitDetail('adjustment', value, addForm.reason, `Added ${money(value)}.`)
  }

  const handleSpend = (e) => {
    e.preventDefault()
    const value = parseInt(spendForm.amount, 10)
    if (!value) return setNotice({ type: 'error', text: 'Enter how much they are spending.' })
    submitDetail('withdrawal', value, spendForm.note, `Spent ${money(value)}${spendForm.note.trim() ? ` on ${spendForm.note.trim()}` : ''}.`)
  }

  const selected = accounts.find(a => a.id === selectedId)
  const balanceOf = (a) => a.balance + (pending[a.id] || 0)
  const query = search.trim().toLowerCase()
  const visible = accounts.filter(a =>
    !query || `${a.firstname} ${a.lastname} ${a.alias_1} ${a.alias_2}`.toLowerCase().includes(query)
  )
  const undoable = recent.filter(r => now - r.at < UNDO_MS)

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
        {notice && (
          <p className={notice.type === 'ok' ? 'bank-feedback' : 'bank-feedback bank-feedback--error'} onClick={() => setNotice(null)}>
            {notice.text}
          </p>
        )}

        {loading ? (
          <div className="admin-placeholder"><p>Loading accounts...</p></div>
        ) : !session ? (
          <div className="admin-section">
            <p className="admin-empty-message">No session is running, so there are no accounts to show.</p>
          </div>
        ) : !selected ? (
          <div className="admin-section bank-list-section">
            <div className="bank-list-header">
              <h2>{session.name}{session.status === 'paused' ? ' (paused)' : ''}</h2>
              <input
                type="search"
                className="bank-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or alias"
              />
            </div>
            <ul className="bank-accounts">
              {visible.map(a => {
                const balance = balanceOf(a)
                return (
                  <li key={a.id} className={`bank-row${flashId === a.id ? ' bank-row--flash' : ''}`}>
                    <button type="button" className="bank-row-name" onClick={() => openAccount(a.id)} title="History, add money, other amounts">
                      <strong>{a.firstname} {a.lastname}</strong>
                      <span className="bank-statement-meta">{a.alias_1} {a.alias_2} ›</span>
                    </button>
                    <span className="bank-account-balance">{money(balance)}</span>
                    <div className="bank-quick">
                      {QUICK_AMOUNTS.map(amount => (
                        <button
                          key={amount}
                          type="button"
                          disabled={balance < amount}
                          onClick={() => quickSpend(a, amount)}
                          aria-label={`Spend ${money(amount)} for ${a.firstname} ${a.lastname}`}
                        >
                          −{money(amount)}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
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

            <form onSubmit={handleAdd} className="bank-form">
              <h3>Add money</h3>
              <div className="admin-form-group">
                <label htmlFor="bank-add-amount">Amount ($)</label>
                <input id="bank-add-amount" type="text" inputMode="numeric" value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value.replace(/\D/g, '') })} disabled={busy} />
              </div>
              <div className="admin-form-group">
                <label htmlFor="bank-add-reason">Reason (required)</label>
                <input id="bank-add-reason" type="text" value={addForm.reason} placeholder="e.g. host bonus, refund"
                  onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} disabled={busy} />
              </div>
              <button type="submit" className="button-primary" disabled={busy || !addForm.amount || !addForm.reason.trim()}>
                {busy ? 'Saving...' : `Add ${addForm.amount ? money(addForm.amount) : 'money'}`}
              </button>
            </form>

            <form onSubmit={handleSpend} className="bank-form">
              <h3>Spend another amount</h3>
              <div className="bank-correction-row">
                <input type="text" inputMode="numeric" value={spendForm.amount} placeholder="$"
                  onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value.replace(/\D/g, '') })} disabled={busy} />
                <input type="text" value={spendForm.note} placeholder="For (optional)"
                  onChange={(e) => setSpendForm({ ...spendForm, note: e.target.value })} disabled={busy} />
              </div>
              <button type="submit" className="button-secondary" disabled={busy || !spendForm.amount}>
                Spend {spendForm.amount ? money(spendForm.amount) : ''}
              </button>
            </form>

            <h3>History</h3>
            {statement ? <StatementList entries={statement.entries} /> : <p className="admin-placeholder">Loading...</p>}
          </div>
        )}
      </div>

      {undoable.length > 0 && (
        <div className="bank-recent">
          {undoable.slice(0, 3).map(r => (
            <div key={r.txId} className="bank-recent-row">
              <span>−{money(r.amount)} · {r.name}</span>
              <button type="button" onClick={() => undo(r)}>Undo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BankPage
