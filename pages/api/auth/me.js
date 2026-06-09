import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  res.status(200).json({ user: req.user })
})
