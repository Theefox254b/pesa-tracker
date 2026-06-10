import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Landing() {
  const router  = useRouter()
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name:'', email:'', password:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  const field = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    // Client-side validation
    if (mode === 'register') {
      if (form.password !== form.confirm) {
        setError('Passwords do not match.'); setLoading(false); return
      }
      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
      if (!emailRegex.test(form.email)) {
        setError('Please enter a valid email address.'); setLoading(false); return
      }
    }

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name:form.name, email:form.email, password:form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }

      if (mode === 'register') {
        // Show email verification message instead of redirecting
        setSuccess('Account created! Please check your email to verify your account before signing in.')
        setLoading(false)
        return
      }
      router.push('/app')
    } catch { setError('Network error. Please try again.'); setLoading(false) }
  }

  return (
    <>
      <Head>
        <title>Pesa Tracker — Smart M-Pesa Ledger</title>
        <meta name="description" content="Track your M-Pesa transactions, manage student funds, budget and invest smartly." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d2137 40%, #0a1628 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>

        {/* Decorative background circles */}
        <div style={{position:'fixed',top:'-80px',right:'-80px',width:320,height:320,borderRadius:'50%',background:'radial-gradient(circle,#10b98122,transparent)',pointerEvents:'none'}}/>
        <div style={{position:'fixed',bottom:'-100px',left:'-100px',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,#0ea5e922,transparent)',pointerEvents:'none'}}/>

        {/* Logo + Banner */}
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{
            width:64,height:64,borderRadius:18,
            background:'linear-gradient(135deg,#10b981,#0ea5e9)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:32,margin:'0 auto 16px',
            boxShadow:'0 8px 32px #10b98144',
          }}>📲</div>
          <h1 style={{fontSize:32,fontWeight:800,color:'#fff',margin:'0 0 8px',letterSpacing:-1}}>
            Pesa Tracker
          </h1>
          <p style={{fontSize:14,color:'#94a3b8',fontWeight:500,letterSpacing:2,margin:0}}>
            SMART M-PESA LEDGER · 🇰🇪
          </p>

          {/* Feature pills */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginTop:20}}>
            {['📊 Budgeting','🎓 Student Funds','📈 Investments','🤖 AI Coach','📡 Auto SMS'].map(f=>(
              <span key={f} style={{
                background:'#ffffff0f',border:'1px solid #ffffff18',
                color:'#94a3b8',fontSize:11,fontWeight:600,
                padding:'4px 10px',borderRadius:20,
              }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Auth Card */}
        <div style={{
          width:'100%',maxWidth:420,
          background:'#ffffff0a',
          backdropFilter:'blur(20px)',
          border:'1px solid #ffffff15',
          borderRadius:24,
          padding:'32px 28px',
          boxShadow:'0 24px 60px #00000044',
        }}>
          {/* Tab toggle */}
          <div style={{
            display:'flex',background:'#ffffff0a',
            borderRadius:12,padding:4,marginBottom:28,
            border:'1px solid #ffffff10',
          }}>
            {['login','register'].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError('');setSuccess('')}} style={{
                flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',
                fontFamily:'inherit',fontSize:13,fontWeight:700,
                transition:'all .2s',
                background: mode===m ? 'linear-gradient(135deg,#10b981,#059669)' : 'transparent',
                color: mode===m ? '#fff' : '#64748b',
                boxShadow: mode===m ? '0 4px 12px #10b98133' : 'none',
              }}>
                {m==='login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode==='register' && (
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:1,marginBottom:6,textTransform:'uppercase'}}>Full Name</label>
                <input required value={form.name} onChange={e=>field('name',e.target.value)}
                  placeholder="e.g. Brian Sahani"
                  style={inputStyle}/>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:1,marginBottom:6,textTransform:'uppercase'}}>Email Address</label>
              <input required type="email" value={form.email} onChange={e=>field('email',e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:1,marginBottom:6,textTransform:'uppercase'}}>Password</label>
              <input required type="password" value={form.password} onChange={e=>field('password',e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                style={inputStyle}/>
            </div>
            {mode==='register' && (
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:1,marginBottom:6,textTransform:'uppercase'}}>Confirm Password</label>
                <input required type="password" value={form.confirm} onChange={e=>field('confirm',e.target.value)}
                  placeholder="Repeat your password"
                  style={inputStyle}/>
              </div>
            )}

            {error && (
              <div style={{background:'#ff000015',border:'1px solid #ff000033',color:'#f87171',fontSize:13,padding:'10px 14px',borderRadius:10,marginBottom:14}}>
                ⚠ {error}
              </div>
            )}
            {success && (
              <div style={{background:'#10b98115',border:'1px solid #10b98133',color:'#34d399',fontSize:13,padding:'10px 14px',borderRadius:10,marginBottom:14}}>
                ✅ {success}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width:'100%',padding:'13px',border:'none',borderRadius:12,cursor:'pointer',
              background:'linear-gradient(135deg,#10b981,#059669)',
              color:'#fff',fontFamily:'inherit',fontSize:14,fontWeight:700,
              boxShadow:'0 4px 20px #10b98133',
              opacity: loading ? 0.7 : 1,
              transition:'opacity .2s,transform .1s',
            }}>
              {loading ? 'Please wait…' : mode==='login' ? '→ Sign In' : '→ Create Account'}
            </button>
          </form>

          <p style={{textAlign:'center',fontSize:12,color:'#475569',marginTop:16}}>
            {mode==='login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setSuccess('')}}
              style={{background:'none',border:'none',color:'#10b981',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
              {mode==='login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Trust row */}
        <div style={{display:'flex',gap:16,marginTop:24,fontSize:11,color:'#334155',fontWeight:600}}>
          <span>🔒 Encrypted</span>
          <span>·</span>
          <span>🇰🇪 Kenya-built</span>
          <span>·</span>
          <span>💾 Auto-saved</span>
          <span>·</span>
          <span>🆓 Free to use</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        input::placeholder { color: #334155; }
        input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px #10b98118 !important; outline: none; }
      `}</style>
    </>
  )
}

const inputStyle = {
  display:'block',width:'100%',
  background:'#ffffff08',
  border:'1px solid #ffffff15',
  borderRadius:10,color:'#e2e8f0',
  fontFamily:"'Plus Jakarta Sans',sans-serif",
  fontSize:13,padding:'11px 14px',
  outline:'none',transition:'border-color .18s',
  boxSizing:'border-box',
}
