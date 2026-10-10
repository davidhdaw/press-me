// Shared by the banker screen and the player's statement on their phone.
// Styles live in App.css (bank-statement*).

import { money } from './money'

function formatTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const ENTRY_LABELS = {
  mission: 'Mission',
  push: 'Special ops',
  withdrawal: 'Spent at the bank',
  adjustment: 'Added by the bank',
  payment: 'Payment',
}

export function StatementList({ entries }) {
  if (entries.length === 0) {
    return <p className="admin-empty-message">No transactions yet.</p>
  }
  return (
    <ul className="bank-statement">
      {entries.map(e => (
        <li key={e.id} className="bank-statement-row">
          <div>
            <strong>{e.note || ENTRY_LABELS[e.kind]}</strong>
            <span className="bank-statement-meta">
              {[e.note && ENTRY_LABELS[e.kind], formatTime(e.createdAt), e.byName].filter(Boolean).join(' · ')}
            </span>
          </div>
          <span className={`bank-amount ${e.amount < 0 ? 'bank-amount--out' : 'bank-amount--in'}`}>
            {e.amount < 0 ? '−' : '+'}{money(Math.abs(e.amount))}
          </span>
        </li>
      ))}
    </ul>
  )
}
