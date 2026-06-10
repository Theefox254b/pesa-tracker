import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  const { messages, system } = req.body

  // Check API key exists
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables')
    return res.status(500).json({
      error: 'The Accountant is not configured yet. Please add GEMINI_API_KEY to Vercel environment variables.'
    })
  }

  try {
    // Build Gemini-compatible message array
    // Rules: must start with 'user', must alternate user/model, no consecutive same roles
    const rawMessages = Array.isArray(messages) ? messages : []
    const geminiMessages = []

    for (const m of rawMessages) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      const content = (m.content || '').trim()
      if (!content) continue
      const last = geminiMessages[geminiMessages.length - 1]
      if (last && last.role === role) {
        // Merge consecutive same-role messages
        last.parts[0].text += '\n' + content
      } else {
        geminiMessages.push({ role, parts: [{ text: content }] })
      }
    }

    // Gemini requires messages to start with 'user'
    if (geminiMessages.length === 0 || geminiMessages[0].role !== 'user') {
      geminiMessages.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }

    // Must end with 'user' message for generateContent
    if (geminiMessages[geminiMessages.length - 1].role !== 'user') {
      const last = rawMessages[rawMessages.length - 1]
      geminiMessages.push({ role: 'user', parts: [{ text: last?.content || 'Continue' }] })
    }

    const systemPrompt = system || `You are "The Accountant" — a sharp, caring personal finance coach for Kenyan professionals. 
You are embedded in Pesa Tracker, an M-Pesa financial management app.
Be direct, warm, and practical. Use Kenyan context: Ksh, M-Pesa, matatu, SACCO, chama, Nairobi cost of living.
When you detect excessive spending, ask ONE probing question like "Which of these expenses could you live without this month?"
Keep responses to 2-3 sentences max. Ask one question at a time to drive reflection.
Never introduce yourself as anything other than "The Accountant".`

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
        topP: 0.9,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    // Handle Gemini API errors
    if (!response.ok || data.error) {
      const errMsg = data.error?.message || `Gemini returned status ${response.status}`
      console.error('Gemini API error:', errMsg)
      // Give user a helpful message based on error type
      if (data.error?.code === 400) {
        return res.status(400).json({ error: 'The Accountant received an invalid request. Please try again.' })
      }
      if (data.error?.code === 403) {
        return res.status(403).json({ error: 'Gemini API key is invalid or expired. Please check your GEMINI_API_KEY in Vercel.' })
      }
      if (data.error?.code === 429) {
        return res.status(429).json({ error: 'Too many requests to The Accountant. Please wait a moment and try again.' })
      }
      return res.status(502).json({ error: `The Accountant is unavailable: ${errMsg}` })
    }

    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('Empty Gemini response:', JSON.stringify(data).slice(0, 300))
      return res.status(502).json({ error: 'The Accountant returned an empty response. Please try again.' })
    }

    return res.status(200).json({ text })

  } catch (e) {
    console.error('AI chat exception:', e.message)
    return res.status(500).json({ error: 'Could not reach The Accountant. Please check your internet connection.' })
  }
})
