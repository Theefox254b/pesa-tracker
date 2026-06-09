// pages/api/students/index.js
import { withAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default withAuth(async function handler(req, res) {
  const userId = req.user.id
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('students').select('*').eq('user_id', userId).order('created_at')
    return res.status(200).json({ students: data || [] })
  }
  if (req.method === 'POST') {
    const { students: list } = req.body
    const rows = (Array.isArray(list) ? list : [list]).map(s => ({ ...s, user_id: userId }))
    const { data, error } = await supabaseAdmin.from('students').insert(rows).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ students: data })
  }
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (id === 'all') {
      await supabaseAdmin.from('students').delete().eq('user_id', userId)
    } else {
      await supabaseAdmin.from('students').delete().eq('id', id).eq('user_id', userId)
    }
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
})
