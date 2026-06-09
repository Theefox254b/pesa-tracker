/**
 * POST /api/webhook/sms
 *
 * SMS Forwarder app configuration:
 *   URL:    https://your-app.vercel.app/api/webhook/sms
 *   Method: POST
 *   Headers:
 *     x-webhook-secret: (your WEBHOOK_SECRET)
 *     x-user-email:     (your account email)
 *   Body type: JSON
 *   Body:
 *     { "sms": "%sms_body%" }
 *
 * Filter: sender contains "MPESA" or "M-PESA"
 */

import { supabaseAdmin } from '../../../lib/supabase'
import { parseSms, matchStudent } from '../../../lib/mpesa'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Authenticate via shared secret
  const secret = req.headers['x-webhook-secret']
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret.' })
  }

  // Identify which user this belongs to via email header
  const email = req.headers['x-user-email']
  if (!email) return res.status(400).json({ error: 'x-user-email header required.' })

  const { data: user } = await supabaseAdmin.from('users').select('id').eq('email', email.toLowerCase()).single()
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const smsBody = req.body?.sms || req.body?.message || req.body?.body || ''
  if (!smsBody) return res.status(400).json({ error: 'No SMS body found in payload.' })

  const parsed = parseSms(smsBody)
  if (!parsed) return res.status(200).json({ ok: true, ignored: true, reason: 'Not a parseable M-Pesa message.' })

  // Match student for received transactions
  if (parsed.type === 'received') {
    const { data: students } = await supabaseAdmin.from('students').select('*').eq('user_id', user.id)
    const match = matchStudent(parsed, students || [])
    parsed.fund         = match ? 'student' : 'personal'
    parsed.student_id   = match?.internal_id || null
    parsed.student_name = match?.name || null
    parsed.category     = 'income'
  }

  const { data, error } = await supabaseAdmin.from('transactions').insert({
    user_id:      user.id,
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
    note:         '',
    balance:      parsed.balance || null,
    raw_sms:      smsBody,
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true, transaction: data })
}
