import { withAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { parseSms, matchStudent } from '../../../lib/mpesa'

export default withAuth(async function handler(req, res) {
  const userId = req.user.id

  // GET — list all transactions for this user
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ transactions: data })
  }

  // POST — log a new transaction (parsed SMS or manual)
  if (req.method === 'POST') {
    const { raw_sms, manual } = req.body

    let parsed
    if (raw_sms) {
      parsed = parseSms(raw_sms)
      if (!parsed) return res.status(400).json({ error: 'Could not parse M-Pesa message.' })

      // Cross-reference students
      if (parsed.type === 'received') {
        const { data: students } = await supabaseAdmin.from('students').select('*').eq('user_id', userId)
        const match = matchStudent(parsed, students || [])
        parsed.fund         = match ? 'student' : 'personal'
        parsed.student_id   = match?.internal_id || null
        parsed.student_name = match?.name || null
        parsed.category     = 'income'
      }
    } else if (manual) {
      parsed = manual
    } else {
      return res.status(400).json({ error: 'raw_sms or manual payload required.' })
    }

    const { data, error } = await supabaseAdmin.from('transactions').insert({
      user_id:      userId,
      type:         parsed.type,
      fund:         parsed.fund || 'personal',
      amount:       parsed.amount,
      party:        parsed.party,
      phone:        parsed.phone || '',
      date:         parsed.date || '',
      time:         parsed.time || '',
      category:     parsed.category || 'other',
      student_id:   parsed.student_id || null,
      student_name: parsed.student_name || null,
      note:         parsed.note || '',
      balance:      parsed.balance || null,
      raw_sms:      raw_sms || '',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ transaction: data })
  }

  // DELETE — remove a transaction
  if (req.method === 'DELETE') {
    const { id } = req.query
    const { error } = await supabaseAdmin.from('transactions').delete().eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // PATCH — update category on a sent tx
  if (req.method === 'PATCH') {
    const { id, category } = req.body
    const { data, error } = await supabaseAdmin.from('transactions')
      .update({ category }).eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ transaction: data })
  }

  res.status(405).end()
})
