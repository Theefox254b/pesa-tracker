// ── M-Pesa SMS Parser ─────────────────────────────────────────────────────────
export function parseSms(raw) {
  const msg = raw.trim()
  const bal = msg.match(/new m-?pesa balance is ksh([\d,]+\.\d{2})/i)
  const balance = bal ? parseFloat(bal[1].replace(/,/g, '')) : null
  const amt = s => parseFloat(s.replace(/,/g, ''))

  let m
  // RECEIVED
  if ((m = msg.match(
    /confirmed\.?\s*you have received\s+ksh([\d,]+\.\d{2})\s+from\s+([A-Z][A-Z\s]+?)\s+([\d*]+)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+([\d:]+\s*[APM]{2})/i
  ))) return { type:'received', amount:amt(m[1]), party:m[2].trim(), phone:m[3], date:m[4], time:m[5].trim(), balance }

  // SENT
  if ((m = msg.match(
    /confirmed\.?\s*ksh([\d,]+\.\d{2})\s+sent to\s+([A-Z][A-Z\s]+?)\s+([\d*]+)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+([\d:]+\s*[APM]{2})/i
  ))) return { type:'sent', amount:amt(m[1]), party:m[2].trim(), phone:m[3], date:m[4], time:m[5].trim(), balance }

  // PAID TO (paybill/till)
  if ((m = msg.match(
    /confirmed\.?\s*ksh([\d,]+\.\d{2})\s+paid to\s+([^.]+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+([\d:]+\s*[APM]{2})/i
  ))) return { type:'sent', amount:amt(m[1]), party:m[2].trim(), phone:'', date:m[3], time:m[4].trim(), balance }

  return null
}

// ── Student matcher — by parent first name ────────────────────────────────────
export function matchStudent(parsed, students) {
  if (!parsed || parsed.type !== 'received') return null
  const senderFirst = (parsed.party || '').toUpperCase().trim().split(/\s+/)[0]
  if (!senderFirst || senderFirst.length < 2) return null
  return students.find(s =>
    (s.parent || '').toUpperCase().trim().split(/\s+/)[0] === senderFirst
  ) || null
}

// ── CSV parser ────────────────────────────────────────────────────────────────
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const start = /\d/i.test(lines[0]?.split(',')[0]) ? 0 : 1
  return lines.slice(start).map((line, i) => {
    const p = line.split(',').map(x => x.trim())
    return {
      name:       (p[0] || '').toUpperCase(),
      parent:     p[1] || '',
      phone:      p[2] || '',
      student_id: p[3] || '',
      internal_id:`auto_${i}_${(p[0]||'').toUpperCase()}`,
    }
  }).filter(s => s.name.length > 1)
}
