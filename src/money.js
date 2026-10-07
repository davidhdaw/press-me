// Bank amounts are whole dollars
export const money = (n) => `$${Number(n || 0).toLocaleString()}`
