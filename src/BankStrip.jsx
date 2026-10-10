import { useState, useEffect, useCallback } from 'react'
import { neonApi } from './neonApi'
import { StatementList } from './BankStatement'
import { money } from './money'

// The player's bank balance in the dashboard footer; tap for the statement.
// Re-fetches on an interval (bankers change balances from another device) and
// whenever refreshKey changes (a mission was just completed on this phone).
function BankStrip({ sessionId, userId, refreshKey }) {
  const [statement, setStatement] = useState(null)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId || !userId) return
    try {
      setStatement(await neonApi.getStatement(sessionId, userId))
    } catch (error) {
      console.error('Error loading bank statement:', error)
    }
  }, [sessionId, userId])

  useEffect(() => {
    if (!sessionId) {
      setStatement(null)
      return
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [sessionId, load, refreshKey])

  if (!sessionId) return null

  const close = () => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 300)
  }

  return (
    <>
      <button type="button" className="bank-strip" onClick={() => { load(); setOpen(true) }}>
        <span className="bank-strip-label">BANK</span>
        <span className="bank-strip-balance">{statement ? money(statement.balance) : '…'}</span>
      </button>

      {open && (
        <div className={`modal bank-modal ${closing ? 'closing' : ''}`}>
          <div className="modal-header">
            <button type="button" onClick={close} className="close-button">Close</button>
          </div>
          <div className="modal-content">
            <p className="bank-modal-label">Your balance</p>
            <div className="bank-modal-balance">{statement ? money(statement.balance) : '…'}</div>
            <p className="bank-modal-hint">Spend it at the bank. Ask a host where to find it.</p>
            {statement && <StatementList entries={statement.entries} />}
          </div>
        </div>
      )}
    </>
  )
}

export default BankStrip
