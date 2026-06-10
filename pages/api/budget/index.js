import { withAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default withAuth(async function handler(req, res) {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ budget: data || null })
    }

    if (req.method === 'POST') {
      const payload = {
        ...req.body,
        user_id: userId,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabaseAdmin
        .from('budgets')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ budget: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
})
