import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Landing() {
  const router = useRouter()
  const [mode,    setMode]    = useState('login')   // 'login' | 'register'
  const [form,    setForm]    = useState({ name:'', email:'', password:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const field = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    if (mode === 'register' && form.password !== form.confirm) {
      setError('Passwords do not match.'); setLoading(false); return
    }
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name:form.name, email:form.email, password:form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }
      router.push('/app')
    } catch { setError('Network error. Please try again.'); setLoading(false) }
  }

  return (
    <>
      <Head>
        <title>Pesa Tracker — Smart M-Pesa Ledger</title>
        <meta name="description" content="Track M-Pesa transactions, manage student funds, budget smartly, and grow your investments." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen" style={{ background:'linear-gradient(160deg,#f0fdf4 0%,#eff6ff 50%,#f0fdf4 100%)' }}>

        {/* ── Nav ── */}
        <nav className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#10b981,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📲</div>
              <div>
                <div className="font-extrabold text-lg text-slate-900 leading-none">Pesa Tracker</div>
                <div className="text-xs font-semibold tracking-widest" style={{color:'#10b981'}}>SMART M-PESA LEDGER</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setMode('login');setError('')}} className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors">Sign In</button>
              <button onClick={()=>{setMode('register');setError('')}} className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Get Started</button>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col lg:flex-row gap-12 items-center">

          {/* ── Hero ── */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-wide">
              🇰🇪 BUILT FOR KENYA · M-PESA NATIVE
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Your money,<br/>
              <span style={{background:'linear-gradient(135deg,#10b981,#0ea5e9)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>fully in control.</span>
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed mb-8">
              Paste an M-Pesa SMS and watch it automatically categorized. Track student pocket money, log investments, set budgets, and get AI-powered financial coaching — all in one place.
            </p>

            {/* Feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { icon:'📲', title:'Auto SMS Parsing',    desc:'Paste any M-Pesa SMS — received, sent or paid — and it\'s logged instantly.' },
                { icon:'🎓', title:'Student Fund Tracking',desc:'Separate student pocket money from personal funds automatically.' },
                { icon:'📈', title:'Investments & Savings',desc:'Track your MMF, SACCO, stocks and savings in one portfolio view.' },
                { icon:'🤖', title:'AI Budget Coach',      desc:'Get personalized financial advice and smart budgeting help from Claude.' },
                { icon:'🔔', title:'Auto SMS Forwarding',  desc:'Connect SMS Forwarder app to auto-log every M-Pesa message via webhook.' },
                { icon:'📊', title:'Insights & Health Score',desc:'Daily, monthly and quarterly spending analysis with financial health scoring.' },
              ].map(f => (
                <div key={f.title} className="flex gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-2xl flex-shrink-0">{f.icon}</div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{f.title}</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Webhook info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
              <div className="font-bold text-blue-800 mb-1">📡 Auto-forward M-Pesa SMS</div>
              <div className="text-blue-700 leading-relaxed">After signing up, connect <strong>SMS Forwarder</strong> (Android) to your personal webhook URL. Every M-Pesa SMS will auto-log to your ledger — no manual pasting needed.</div>
            </div>
          </div>

          {/* ── Auth Card ── */}
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              {/* Toggle */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                {['login','register'].map(m => (
                  <button key={m} onClick={()=>{setMode(m);setError('')}} className="flex-1 py-2 text-sm font-bold rounded-lg transition-all" style={mode===m?{background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',boxShadow:'0 2px 8px #10b98128'}:{color:'#64748b'}}>
                    {m==='login'?'Sign In':'Create Account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode==='register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 tracking-wide uppercase">Full Name</label>
                    <input required value={form.name} onChange={e=>field('name',e.target.value)} placeholder="John Kamau" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"/>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 tracking-wide uppercase">Email</label>
                  <input required type="email" value={form.email} onChange={e=>field('email',e.target.value)} placeholder="john@email.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 tracking-wide uppercase">Password</label>
                  <input required type="password" value={form.password} onChange={e=>field('password',e.target.value)} placeholder="Min 8 characters" minLength={8} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"/>
                </div>
                {mode==='register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 tracking-wide uppercase">Confirm Password</label>
                    <input required type="password" value={form.confirm} onChange={e=>field('confirm',e.target.value)} placeholder="Repeat password" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"/>
                  </div>
                )}

                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-60" style={{background:'linear-gradient(135deg,#10b981,#059669)',boxShadow:'0 4px 14px #10b98128'}}>
                  {loading ? 'Please wait…' : mode==='login' ? '→ Sign In' : '→ Create Account'}
                </button>
              </form>

              {mode==='login' && (
                <p className="text-center text-xs text-slate-500 mt-4">Don't have an account? <button onClick={()=>{setMode('register');setError('')}} className="text-emerald-600 font-bold">Sign up free</button></p>
              )}
              {mode==='register' && (
                <p className="text-center text-xs text-slate-500 mt-4">Already have an account? <button onClick={()=>{setMode('login');setError('')}} className="text-emerald-600 font-bold">Sign in</button></p>
              )}
            </div>

            {/* Trust badges */}
            <div className="flex justify-center gap-4 mt-4 text-xs text-slate-400 font-medium">
              <span>🔒 Secure</span>
              <span>•</span>
              <span>🇰🇪 Kenya-built</span>
              <span>•</span>
              <span>💾 Auto-saved</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
