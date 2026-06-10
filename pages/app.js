import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id:'transport',     label:'Transport',     icon:'🚗', color:'#0ea5e9' },
  { id:'food',          label:'Food',           icon:'🍽️', color:'#10b981' },
  { id:'drinks',        label:'Drinks',         icon:'🥤', color:'#06b6d4' },
  { id:'enjoyment',     label:'Enjoyment',      icon:'🎉', color:'#3b82f6' },
  { id:'subscriptions', label:'Subscriptions',  icon:'📱', color:'#0d9488' },
  { id:'goodwill',      label:'Goodwill',       icon:'🤝', color:'#059669' },
  { id:'rent',          label:'Rent/Utilities', icon:'🏠', color:'#f59e0b' },
  { id:'insurance',     label:'Insurance',      icon:'🛡️', color:'#8b5cf6' },
  { id:'other',         label:'Other',          icon:'📦', color:'#64748b' },
]
const INVEST_TYPES = [
  { id:'savings',   label:'Savings Account',   icon:'🏦' },
  { id:'mmf',       label:'Money Market Fund',  icon:'📈' },
  { id:'stocks',    label:'Stocks / Shares',    icon:'📊' },
  { id:'sacco',     label:'SACCO',              icon:'🤝' },
  { id:'land',      label:'Land / Property',    icon:'🏘️' },
  { id:'insurance', label:'Life Insurance',     icon:'🛡️' },
  { id:'crypto',    label:'Crypto',             icon:'₿'  },
  { id:'other',     label:'Other',              icon:'💼' },
]
const TABS = ['dashboard','log','budget','investments','students','insights','history','settings']

function fmt(n)  { return `Ksh ${(n||0).toLocaleString('en-KE',{minimumFractionDigits:2})}` }
function uid()   { return Date.now().toString(36)+Math.random().toString(36).slice(2,6) }
function inPeriod(tx, p) {
  if (!tx?.date) return false
  const [d,m,y] = tx.date.split('/').map(Number)
  if (!d||!m||!y) return false
  const date = new Date(2000+y,m-1,d), now = new Date()
  if (p==='day')     return date.toDateString()===now.toDateString()
  if (p==='month')   return date.getMonth()===now.getMonth()&&date.getFullYear()===now.getFullYear()
  if (p==='quarter') return Math.floor(date.getMonth()/3)===Math.floor(now.getMonth()/3)&&date.getFullYear()===now.getFullYear()
  return true
}

// ── API helpers ───────────────────────────────────────────────────────────────
const api = {
  get:    url  => fetch(url).then(r=>r.json()),
  post:   (url,body) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
  patch:  (url,body) => fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
  delete: url  => fetch(url,{method:'DELETE'}).then(r=>r.json()),
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function AppPage() {
  const router = useRouter()
  const [user,        setUser]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('dashboard')
  const [txs,         setTxs]         = useState([])
  const [students,    setStudents]    = useState([])
  const [investments, setInvestments] = useState([])
  const [budget,      setBudget]      = useState(null)
  const [note,        setNote]        = useState(null)
  const [panel,       setPanel]       = useState('')
  const [smsInput,    setSmsInput]    = useState('')
  const [pendingTx,   setPendingTx]   = useState(null)
  const [period,      setPeriod]      = useState('month')
  const [deletingId,  setDeletingId]  = useState(null)
  const [newStudent,  setNewStudent]  = useState({name:'',parent:'',phone:'',student_id:''})
  const [csvText,     setCsvText]     = useState('')
  const [newInv,      setNewInv]      = useState({name:'',type:'savings',amount:'',return_pct:'',note:''})
  const [budgetDraft, setBudgetDraft] = useState({salary:'',items:[{label:'Rent',amount:'',category:'rent'},{label:'Transport',amount:'',category:'transport'}]})
  const [disburse,    setDisburse]    = useState({student_id:'',amount:'',note:'',date:''})
  const [confirmClearTx, setConfirmClearTx] = useState(false)
  const [confirmClearStudents, setConfirmClearStudents] = useState(false)

  const notify = (msg,type='success') => { setNote({msg,type}); setTimeout(()=>setNote(null),3500) }

  // Auth check & data load
  useEffect(()=>{
    (async()=>{
      const { user:me } = await api.get('/api/auth/me').catch(()=>({user:null}))
      if (!me) { router.push('/'); return }
      setUser(me)
      const [txData, stuData, invData, budData] = await Promise.all([
        api.get('/api/transactions'), api.get('/api/students'),
        api.get('/api/investments'),  api.get('/api/budget'),
      ])
      setTxs(txData.transactions||[])
      setStudents(stuData.students||[])
      setInvestments(invData.investments||[])
      setBudget(budData.budget||null)
      if (budData.budget) setBudgetDraft({salary:String(budData.budget.salary),items:(budData.budget.items||[]).map(i=>({...i,amount:String(i.amount)}))})
      setLoading(false)
    })()
  },[])

  async function logout() {
    await api.post('/api/auth/logout',{})
    router.push('/')
  }

  // SMS
  async function handleSms() {
    if (!smsInput.trim()) return
    const res = await api.post('/api/transactions',{raw_sms:smsInput})
    if (res.error) { notify(res.error,'error'); return }
    const tx = res.transaction
    if (tx.type==='sent' && !tx.category || tx.category==='other') {
      setPendingTx(tx)
    } else {
      setTxs(p=>[tx,...p]); setSmsInput('')
      notify(tx.fund==='student'?`✅ Matched to: ${tx.student_name}`:'✅ Logged as Personal income')
    }
  }

  async function handleCategory(catId) {
    if (!pendingTx) return
    const res = await api.patch('/api/transactions',{id:pendingTx.id,category:catId})
    if (res.error) { notify(res.error,'error'); return }
    setTxs(p=>p.map(t=>t.id===pendingTx.id?res.transaction:t).filter(t=>true))
    setTxs(p=>[res.transaction,...p.filter(t=>t.id!==pendingTx.id)])
    setPendingTx(null); setSmsInput('')
    notify('✅ Logged under '+EXPENSE_CATS.find(c=>c.id===catId)?.label)
  }

  async function handleDeleteTx(id) {
    await api.delete(`/api/transactions?id=${id}`)
    setTxs(p=>p.filter(t=>t.id!==id)); setDeletingId(null); notify('Transaction deleted.')
  }

  // Disburse
  async function handleDisburse() {
    const student = students.find(s=>s.internal_id===disburse.student_id||s.id===disburse.student_id)
    if (!student||!disburse.amount) { notify('Select student and amount.','error'); return }
    const now = new Date()
    const res = await api.post('/api/transactions',{manual:{
      type:'disbursed', fund:'student', amount:parseFloat(disburse.amount),
      party:student.name, student_id:student.internal_id||student.id, student_name:student.name,
      note:disburse.note||'Pocket money', category:'disbursement',
      date:disburse.date||`${now.getDate()}/${now.getMonth()+1}/${String(now.getFullYear()).slice(-2)}`,
      time:`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} ${now.getHours()>=12?'PM':'AM'}`,
    }})
    if (res.error) { notify(res.error,'error'); return }
    setTxs(p=>[res.transaction,...p])
    setDisburse({student_id:'',amount:'',note:'',date:''}); setPanel('')
    notify(`✅ ${fmt(parseFloat(disburse.amount))} disbursed to ${student.name}`)
  }

  // Students
  async function handleAddStudent() {
    if (!newStudent.name.trim()) { notify('Name required.','error'); return }
    const res = await api.post('/api/students',{students:[{...newStudent,name:newStudent.name.toUpperCase(),internal_id:`auto_${Date.now()}_${newStudent.name.toUpperCase()}`}]})
    if (res.error) { notify(res.error,'error'); return }
    setStudents(p=>[...p,...(res.students||[])])
    setNewStudent({name:'',parent:'',phone:'',student_id:''}); setPanel(''); notify('✅ Student saved!')
  }
  async function handleDeleteStudent(id) {
    await api.delete(`/api/students?id=${id}`)
    setStudents(p=>p.filter(s=>s.id!==id)); notify('Student removed.')
  }
  async function handleClearStudents() {
    await api.delete('/api/students?id=all')
    setStudents([]); setConfirmClearStudents(false); notify('All students cleared.')
  }
  async function handlePasteCsv() {
    if (!csvText.trim()) { notify('Paste CSV data first.','error'); return }
    const lines = csvText.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    const start = /\d/i.test(lines[0]?.split(',')[0]) ? 0 : 1
    const parsed = lines.slice(start).map((line,i)=>{
      const p=line.split(',').map(x=>x.trim())
      return {name:(p[0]||'').toUpperCase(),parent:p[1]||'',phone:p[2]||'',student_id:p[3]||'',internal_id:`auto_${i}_${(p[0]||'').toUpperCase()}`}
    }).filter(s=>s.name.length>1)
    if (!parsed.length) { notify('No valid rows found.','error'); return }
    const res = await api.post('/api/students',{students:parsed})
    if (res.error) { notify(res.error,'error'); return }
    setStudents(p=>[...p,...(res.students||[])]); setCsvText(''); setPanel('')
    notify(`✅ Imported ${res.students?.length} students!`)
  }
  function handleFileImport(e) {
    const file=e.target.files[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=ev=>{ setCsvText(ev.target.result); }
    reader.readAsText(file); e.target.value=''
  }

  // Investments
  async function handleAddInvestment() {
    if (!newInv.name||!newInv.amount) { notify('Name and amount required.','error'); return }
    const res = await api.post('/api/investments',{...newInv,amount:parseFloat(newInv.amount),return_pct:parseFloat(newInv.return_pct)||0,date:new Date().toLocaleDateString('en-KE')})
    if (res.error) { notify(res.error,'error'); return }
    setInvestments(p=>[res.investment,...p]); setNewInv({name:'',type:'savings',amount:'',return_pct:'',note:''}); setPanel(''); notify('✅ Investment logged!')
  }
  async function handleDeleteInv(id) {
    await api.delete(`/api/investments?id=${id}`)
    setInvestments(p=>p.filter(i=>i.id!==id)); notify('Investment removed.')
  }

  // Budget
  async function handleSaveBudget() {
    if (!budgetDraft.salary) { notify('Enter salary.','error'); return }
    const items=budgetDraft.items.filter(i=>i.label.trim()&&parseFloat(i.amount)>0).map(i=>({...i,amount:parseFloat(i.amount)}))
    const res = await api.post('/api/budget',{salary:parseFloat(budgetDraft.salary),items,saved_at:new Date().toLocaleDateString('en-KE')})
    if (res.error) { notify(res.error,'error'); return }
    setBudget(res.budget); setPanel(''); notify('✅ Budget saved!')
  }

  // Stats
  const totalRec    = txs.filter(t=>t.type==='received').reduce((s,t)=>s+t.amount,0)
  const totalSent   = txs.filter(t=>t.type==='sent').reduce((s,t)=>s+t.amount,0)
  const totalDisb   = txs.filter(t=>t.type==='disbursed').reduce((s,t)=>s+t.amount,0)
  const stuRec      = txs.filter(t=>t.fund==='student'&&t.type==='received').reduce((s,t)=>s+t.amount,0)
  const persRec     = txs.filter(t=>t.fund==='personal'&&t.type==='received').reduce((s,t)=>s+t.amount,0)
  const persBalance = persRec-totalSent-totalDisb
  const totalInvested=investments.reduce((s,i)=>s+i.amount,0)

  const studentTotals = students.map(s=>{
    const key = s.internal_id||s.id
    const sTxs=txs.filter(t=>t.student_id===key||t.student_name===s.name)
    return {...s,received:sTxs.filter(t=>t.type==='received').reduce((a,t)=>a+t.amount,0),
      disbursed:sTxs.filter(t=>t.type==='disbursed').reduce((a,t)=>a+t.amount,0),count:sTxs.length,
      lastReceived:sTxs.filter(t=>t.type==='received').reduce((l,t)=>new Date(t.created_at)>l?new Date(t.created_at):l,new Date(0))}
  }).sort((a,b)=>b.lastReceived-a.lastReceived)

  const expBreakdown = EXPENSE_CATS.map(c=>({...c,total:txs.filter(t=>t.type==='sent'&&t.category===c.id).reduce((s,t)=>s+t.amount,0)})).filter(c=>c.total>0)
  const maxExp = Math.max(...expBreakdown.map(c=>c.total),1)
  const budgetTotal = budget?.items?.reduce((s,i)=>s+i.amount,0)||0
  const budgetRemaining = (budget?.salary||0) - budgetTotal
  const budgetProgress = budget?.items?.map(item=>{
    const used=txs.filter(t=>t.type==='sent'&&t.category===item.category&&inPeriod(t,'month')).reduce((s,t)=>s+t.amount,0)
    return {...item,used,pct:Math.min(100,(used/item.amount)*100),over:used>item.amount}
  })||[]

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(160deg,#f0fdf4,#eff6ff)'}}><div style={{width:34,height:34,border:'3px solid #e2e8f0',borderTopColor:'#10b981',borderRadius:'50%'}} className="anim-spin"/></div>

  return (
    <>
      <Head><title>Pesa Tracker</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
      <div className="min-h-screen" style={{background:'linear-gradient(160deg,#f0fdf4 0%,#eff6ff 50%,#f0fdf4 100%)'}}>

        {/* Toast */}
        {note&&<div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl border anim-up max-w-xs ${note.type==='error'?'bg-white border-red-200 text-red-600':'bg-white border-emerald-200 text-emerald-700'}`}>{note.msg}</div>}

        {/* Header */}
        <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <div style={{width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#10b981,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📲</div>
              <div><div className="font-extrabold text-base text-slate-900">Pesa Tracker</div><div className="text-xs font-semibold tracking-widest" style={{color:'#10b981',fontSize:9}}>M-PESA LEDGER</div></div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:block">Hi, {user?.name?.split(' ')[0]}</span>
                <button onClick={logout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">Logout</button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0" style={{scrollbarWidth:'none'}}>
              {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className="flex-shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all border-b-2" style={tab===t?{color:'#10b981',borderColor:'#10b981',background:'transparent'}:{color:'#94a3b8',borderColor:'transparent',background:'transparent'}}>{t}</button>)}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-5 pb-10">

          {/* ── DASHBOARD ── */}
          {tab==='dashboard'&&<div className="anim-up">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[{l:'Total Received',v:totalRec,c:'#059669',bc:'#bbf7d0',i:'⬇️'},{l:'Total Expenses',v:totalSent,c:'#e11d48',bc:'#fecdd3',i:'⬆️'},{l:'Student Funds',v:stuRec,c:'#2563eb',bc:'#bfdbfe',i:'🎓'},{l:'Personal Balance',v:persBalance,c:persBalance>=0?'#0284c7':'#e11d48',bc:'#bae6fd',i:'👤'}].map(x=>(
                <div key={x.l} className="bg-white rounded-xl p-4 border shadow-sm" style={{borderColor:x.bc,borderTopWidth:3}}>
                  <div className="text-xl mb-1">{x.i}</div>
                  <div className="text-xs font-bold tracking-wide text-slate-400 uppercase mb-1">{x.l}</div>
                  <div className="text-sm font-extrabold mono" style={{color:x.c}}>{fmt(x.v)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-xl p-4 border shadow-sm" style={{borderColor:'#fde68a',borderTopWidth:3}}>
                <div className="text-xl mb-1">📈</div><div className="text-xs font-bold tracking-wide text-slate-400 uppercase mb-1">Invested</div>
                <div className="text-sm font-extrabold mono" style={{color:'#d97706'}}>{fmt(totalInvested)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm" style={{borderColor:'#d8b4fe',borderTopWidth:3}}>
                <div className="text-xl mb-1">💸</div><div className="text-xs font-bold tracking-wide text-slate-400 uppercase mb-1">Disbursed</div>
                <div className="text-sm font-extrabold mono" style={{color:'#7c3aed'}}>{fmt(totalDisb)}</div>
              </div>
            </div>
            {expBreakdown.length>0&&<div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">Expense Breakdown</div>
              {expBreakdown.map(c=><div key={c.id} className="flex items-center gap-3 mb-2">
                <div className="text-xs font-medium text-slate-600 w-28 shrink-0">{c.icon} {c.label}</div>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div style={{width:`${(c.total/maxExp)*100}%`,height:'100%',background:c.color,borderRadius:'9999px'}}/></div>
                <div className="text-xs font-bold mono w-24 text-right" style={{color:'#e11d48'}}>{fmt(c.total)}</div>
              </div>)}
            </div>}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">Recent Transactions</div>
              {txs.slice(0,5).map(tx=><TxRow key={tx.id} tx={tx}/>)}
              {txs.length===0&&<div className="text-center text-slate-400 py-6 text-sm">No transactions yet — go to <strong>LOG</strong></div>}
            </div>
          </div>}

          {/* ── LOG ── */}
          {tab==='log'&&<div className="anim-up">
            {pendingTx&&<div className="rounded-xl p-4 mb-4 border" style={{background:'linear-gradient(135deg,#fffbeb,#fef3c7)',borderColor:'#fcd34d'}}>
              <div className="text-xs font-bold tracking-widest text-amber-600 mb-2">⚠ SELECT EXPENSE CATEGORY</div>
              <div className="font-bold text-slate-900">{pendingTx.party}</div>
              <div className="text-2xl font-extrabold mono text-red-500 mb-1">- {fmt(pendingTx.amount)}</div>
              <div className="text-xs text-amber-800 mb-3">{pendingTx.date} at {pendingTx.time}</div>
              <div className="grid grid-cols-2 gap-2">
                {EXPENSE_CATS.map(cat=><button key={cat.id} onClick={()=>handleCategory(cat.id)} className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200 text-sm font-semibold hover:border-emerald-400 hover:bg-emerald-50 transition-all">{cat.icon} {cat.label}</button>)}
              </div>
            </div>}

            {panel==='disburse'&&<div className="rounded-xl p-4 mb-4 border anim-up" style={{background:'linear-gradient(135deg,#faf5ff,#ede9fe)',borderColor:'#c4b5fd'}}>
              <div className="text-xs font-bold tracking-widest text-purple-600 mb-3">💸 DISBURSE TO STUDENT</div>
              <select className="block w-full mb-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={disburse.student_id} onChange={e=>setDisburse(p=>({...p,student_id:e.target.value}))}>
                <option value="">Select student…</option>
                {students.map(s=><option key={s.id} value={s.internal_id||s.id}>{s.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="number" placeholder="Amount (Ksh)" className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={disburse.amount} onChange={e=>setDisburse(p=>({...p,amount:e.target.value}))}/>
                <input placeholder="Date (25/5/26)" className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={disburse.date} onChange={e=>setDisburse(p=>({...p,date:e.target.value}))}/>
              </div>
              <input placeholder="Note (e.g. Week 3 pocket money)" className="block w-full mb-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={disburse.note} onChange={e=>setDisburse(p=>({...p,note:e.target.value}))}/>
              <div className="flex gap-2"><button onClick={handleDisburse} className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Log Disbursement</button><button onClick={()=>setPanel('')} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button></div>
            </div>}

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">Paste M-Pesa SMS</div>
                <button onClick={()=>setPanel(panel==='disburse'?'':'disburse')} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:'#faf5ff',border:'1.5px solid #d8b4fe',color:'#7c3aed'}}>💸 Disburse</button>
              </div>
              <textarea className="w-full min-h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 mono text-xs outline-none focus:border-emerald-400 resize-y leading-relaxed" value={smsInput} onChange={e=>setSmsInput(e.target.value)} placeholder={"Paste your M-Pesa SMS here…\n\nWorks for received, sent and paid messages."}/>
              <button onClick={handleSms} className="w-full mt-3 py-3 rounded-xl text-white font-bold text-sm" style={{background:'linear-gradient(135deg,#10b981,#059669)',boxShadow:'0 4px 12px #10b98128'}}>⚡ Parse & Log Transaction</button>
            </div>
          </div>}

          {/* ── BUDGET ── */}
          {tab==='budget'&&<BudgetTab budget={budget} budgetDraft={budgetDraft} setBudgetDraft={setBudgetDraft} budgetProgress={budgetProgress} budgetTotal={budgetTotal} budgetRemaining={budgetRemaining} panel={panel} setPanel={setPanel} handleSaveBudget={handleSaveBudget} txs={txs} totalSent={totalSent} persBalance={persBalance}/>}

          {/* ── INVESTMENTS ── */}
          {tab==='investments'&&<div className="anim-up">
            <div className="flex items-center justify-between mb-4">
              <div><div className="font-bold text-slate-900">{investments.length} Investments</div><div className="text-xs text-slate-400 mt-0.5">Total: <strong style={{color:'#d97706'}}>{fmt(totalInvested)}</strong></div></div>
              <button onClick={()=>setPanel(panel==='inv'?'':'inv')} className="text-xs font-bold px-3 py-2 rounded-lg" style={{background:'#fffbeb',border:'1.5px solid #fde68a',color:'#b45309'}}>+ Log Investment</button>
            </div>
            {panel==='inv'&&<div className="bg-white rounded-xl p-4 border shadow-sm mb-4 anim-up" style={{borderColor:'#fde68a'}}>
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">New Investment / Savings</div>
              <input className="block w-full mb-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Name (e.g. CIC MMF, Co-op Savings)" value={newInv.name} onChange={e=>setNewInv(p=>({...p,name:e.target.value}))}/>
              <select className="block w-full mb-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={newInv.type} onChange={e=>setNewInv(p=>({...p,type:e.target.value}))}>
                {INVEST_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="number" placeholder="Amount (Ksh)" className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={newInv.amount} onChange={e=>setNewInv(p=>({...p,amount:e.target.value}))}/>
                <input type="number" placeholder="Return % p.a." className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" value={newInv.return_pct} onChange={e=>setNewInv(p=>({...p,return_pct:e.target.value}))}/>
              </div>
              <input className="block w-full mb-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Note (e.g. Emergency fund)" value={newInv.note} onChange={e=>setNewInv(p=>({...p,note:e.target.value}))}/>
              <div className="flex gap-2"><button onClick={handleAddInvestment} className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Save Investment</button><button onClick={()=>setPanel('')} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button></div>
            </div>}
            {investments.length===0&&<div className="text-center py-12 text-slate-400"><div className="text-4xl mb-3">📈</div><div>No investments yet.</div></div>}
            {investments.map(inv=>{
              const ti=INVEST_TYPES.find(t=>t.id===inv.type)||INVEST_TYPES[0]
              const annual=inv.return_pct>0?inv.amount*(inv.return_pct/100):0
              return <div key={inv.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-3 flex items-center gap-3">
                <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#f59e0b,#fbbf24)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{ti.icon}</div>
                <div className="flex-1 min-w-0"><div className="font-bold text-sm text-slate-900 truncate">{inv.name}</div><div className="text-xs text-slate-400 mt-0.5">{ti.label}{inv.note?` · ${inv.note}`:''} · {inv.date}</div></div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold mono" style={{color:'#d97706'}}>{fmt(inv.amount)}</div>
                  {annual>0&&<div className="text-xs font-semibold" style={{color:'#059669'}}>+{fmt(annual)}/yr</div>}
                </div>
                <button onClick={()=>handleDeleteInv(inv.id)} className="text-slate-300 hover:text-red-400 text-sm ml-1">🗑</button>
              </div>
            })}
          </div>}

          {/* ── STUDENTS ── */}
          {tab==='students'&&<div className="anim-up">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="font-bold text-slate-900">{students.length} Students</div>
              <div className="flex gap-2 flex-wrap">
                {students.length>0&&!confirmClearStudents&&<button onClick={()=>setConfirmClearStudents(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-500">🗑 Remove All</button>}
                {confirmClearStudents&&<div className="flex items-center gap-2"><span className="text-xs font-bold text-red-500">Sure?</span><button onClick={handleClearStudents} className="text-xs font-bold px-2 py-1 rounded bg-red-500 text-white">Yes</button><button onClick={()=>setConfirmClearStudents(false)} className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500">No</button></div>}
                <button onClick={()=>setPanel(panel==='csv'?'':'csv')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">📋 Paste CSV</button>
                <button onClick={()=>setPanel(panel==='form'?'':'form')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">+ Add</button>
              </div>
            </div>
            {panel==='csv'&&<div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm mb-4 anim-up">
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Import Students</div>
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-3 leading-relaxed"><strong>Format:</strong> Student Name, Parent Name, Phone, Student ID<br/><span style={{color:'#10b981'}}>e.g: JOHN KAMAU, John Kamau, 0712345678, S003</span></div>
              <label className="flex items-center gap-2 p-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer text-sm font-semibold text-blue-600 mb-3">
                📂 Tap to choose a CSV file
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport}/>
              </label>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Or paste CSV text</div>
              <textarea className="w-full min-h-24 bg-slate-50 border border-slate-200 rounded-lg p-2 mono text-xs outline-none focus:border-emerald-400 resize-y" placeholder={"JOHN KAMAU, John Kamau, 0712345678, S003\nJANE WANJIKU, Jane Wanjiku, 0733456789, S004"} value={csvText} onChange={e=>setCsvText(e.target.value)}/>
              <div className="flex gap-2 mt-2"><button onClick={handlePasteCsv} className="flex-1 py-2 rounded-lg text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Import</button><button onClick={()=>{setPanel('');setCsvText('')}} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button></div>
            </div>}
            {panel==='form'&&<div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm mb-4 anim-up">
              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">New Student</div>
              {[['name','Student Full Name *'],['parent','Parent Name * (first name must match M-Pesa)'],['phone','Parent Phone'],['student_id','Student ID (optional)']].map(([f,ph])=>(
                <input key={f} className="block w-full mb-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder={ph} value={newStudent[f]} onChange={e=>setNewStudent(p=>({...p,[f]:e.target.value}))}/>
              ))}
              <div className="flex gap-2"><button onClick={handleAddStudent} className="flex-1 py-2 rounded-lg text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Save</button><button onClick={()=>setPanel('')} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button></div>
            </div>}
            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2 border border-dashed border-slate-200 mb-4">💡 Parent's <strong>first name</strong> must match what M-Pesa shows as the sender name.</div>
            {studentTotals.map(s=><div key={s.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-3 flex items-center gap-3">
              <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#10b981,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:800,flexShrink:0}}>{s.name?.[0]||'?'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-400">{s.parent}{s.phone?` · ${s.phone}`:''}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs font-semibold" style={{color:'#059669'}}>↓ {fmt(s.received)}</span>
                  <span className="text-xs font-semibold" style={{color:'#7c3aed'}}>💸 {fmt(s.disbursed)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-extrabold mono" style={{color:'#0284c7'}}>{fmt(s.received-s.disbursed)}</div>
                <div className="text-xs text-slate-400">{s.count} tx</div>
              </div>
              <button onClick={()=>handleDeleteStudent(s.id)} className="text-slate-300 hover:text-red-400 text-sm ml-1">✕</button>
            </div>)}
            {students.length===0&&<div className="text-center py-12 text-slate-400"><div className="text-4xl mb-3">🎓</div>No students yet.</div>}
          </div>}

          {/* ── INSIGHTS ── */}
          {tab==='insights'&&<InsightsTab txs={txs} period={period} setPeriod={setPeriod} investments={investments} totalInvested={totalInvested} persBalance={persBalance}/>}

          {/* ── HISTORY ── */}
          {tab==='history'&&<div className="anim-up">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-slate-900">{txs.length} Transactions</div>
              {txs.length>0&&!confirmClearTx&&<button onClick={()=>setConfirmClearTx(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-500">🗑 Clear All</button>}
              {confirmClearTx&&<div className="flex items-center gap-2"><span className="text-xs font-bold text-red-500">Clear all?</span><button onClick={()=>{setTxs([]);setConfirmClearTx(false);notify('Cleared.')}} className="text-xs font-bold px-2 py-1 rounded bg-red-500 text-white">Yes</button><button onClick={()=>setConfirmClearTx(false)} className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500">No</button></div>}
            </div>
            {txs.length===0&&<div className="text-center py-12 text-slate-400"><div className="text-4xl mb-3">📋</div>No transactions yet.</div>}
            {txs.map(tx=><TxRow key={tx.id} tx={tx} expanded onDelete={()=>setDeletingId(tx.id)} confirmDelete={deletingId===tx.id} onConfirm={()=>handleDeleteTx(tx.id)} onCancel={()=>setDeletingId(null)}/>)}
          </div>}

          {/* ── SETTINGS ── */}
          {tab==='settings'&&<SettingsTab user={user} notify={notify}/>}

        </div>
      </div>
    </>
  )
}

// ── Budget Tab ────────────────────────────────────────────────────────────────
function BudgetTab({budget,budgetDraft,setBudgetDraft,budgetProgress,budgetTotal,budgetRemaining,panel,setPanel,handleSaveBudget,txs,totalSent,persBalance}) {
  const [chatHistory,setChatHistory]=useState([{role:'ai',text:"Hello, I'm The Accountant — your personal finance coach. Tell me your monthly salary and what you typically spend on rent, transport, food and other fixed costs. I'll help you build a smart budget that works for your life. 💚"}])
  const [chatInput,setChatInput]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const chatEndRef=useRef(null)
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}) },[chatHistory,chatLoading])

  const addItem  = ()=>setBudgetDraft(p=>({...p,items:[...p.items,{label:'',amount:'',category:'other'}]}))
  const removeItem=(i)=>setBudgetDraft(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))
  const updateItem=(i,f,v)=>setBudgetDraft(p=>({...p,items:p.items.map((it,j)=>j===i?{...it,[f]:v}:it)}))

  async function sendChat() {
    if (!chatInput.trim()||chatLoading) return
    const userMsg=chatInput.trim(); setChatInput('')
    setChatHistory(p=>[...p,{role:'user',text:userMsg}]); setChatLoading(true)
    const catBreakdown=EXPENSE_CATS.map(c=>{const t=txs.filter(x=>x.type==='sent'&&x.category===c.id).reduce((s,x)=>s+x.amount,0); return t>0?`${c.label} Ksh${t.toFixed(0)}`:''}).filter(Boolean).join(', ')
    const budgetCtx=budget?`Budget: salary Ksh${budget.salary}, items: ${budget.items.map(i=>`${i.label} Ksh${i.amount}`).join(', ')}.`:'No budget set yet.'
    const messages=[...chatHistory.filter((_,i)=>i>0).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})),{role:'user',content:userMsg}]
    try {
      const res=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,system:`You are a Kenyan personal finance coach. Context: ${budgetCtx} Spending: ${catBreakdown||'none'}. Balance: Ksh${persBalance.toFixed(0)}. Ask one question at a time to help the user budget. When overspending, ask "Which of these can you cut?" Max 3 sentences per reply.`})})
      const data=await res.json()
      setChatHistory(p=>[...p,{role:'ai',text:data.text||'Could not connect.'}])
    } catch { setChatHistory(p=>[...p,{role:'ai',text:'Connection error.'}]) }
    setChatLoading(false)
  }

  return <div className="anim-up">
    {!budget&&panel!=='budget'&&<div className="bg-white rounded-xl p-5 border shadow-sm mb-4" style={{borderColor:'#fde68a',background:'linear-gradient(135deg,#fffbeb,#fefce8)'}}>
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">No Budget Set</div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">Set up your monthly budget to track how well you allocate your salary across expenses, savings and discretionary spend.</p>
      <button onClick={()=>setPanel('budget')} className="w-full py-3 rounded-xl text-amber-800 font-bold text-sm border" style={{background:'linear-gradient(135deg,#fef3c7,#fde68a)',borderColor:'#fcd34d'}}>🎯 Set Up My Budget</button>
    </div>}

    {panel==='budget'&&<div className="bg-white rounded-xl p-4 border shadow-sm mb-4 anim-up" style={{borderColor:'#fde68a'}}>
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">Monthly Budget Setup</div>
      <input type="number" className="block w-full mb-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="My monthly salary / income (Ksh)" value={budgetDraft.salary} onChange={e=>setBudgetDraft(p=>({...p,salary:e.target.value}))}/>
      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Fixed Expenses</div>
      {budgetDraft.items.map((item,i)=><div key={i} className="flex gap-2 mb-2 items-center">
        <input className="flex-[2] px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Label (Rent, NHIF…)" value={item.label} onChange={e=>updateItem(i,'label',e.target.value)}/>
        <input type="number" className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Ksh" value={item.amount} onChange={e=>updateItem(i,'amount',e.target.value)}/>
        <select className="flex-1 px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-emerald-400" value={item.category} onChange={e=>updateItem(i,'category',e.target.value)}>
          {EXPENSE_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <button onClick={()=>removeItem(i)} className="text-slate-300 hover:text-red-400 text-sm shrink-0">✕</button>
      </div>)}
      <button onClick={addItem} className="w-full py-2 mb-3 rounded-lg border border-blue-200 text-blue-600 text-xs font-bold bg-blue-50">+ Add Line</button>
      <div className="flex gap-2"><button onClick={handleSaveBudget} className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Save Budget</button><button onClick={()=>setPanel('')} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button></div>
    </div>}

    {budget&&panel!=='budget'&&<div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
      <div className="flex justify-between items-start mb-4">
        <div><div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-0.5">Monthly Budget</div><div className="text-xs text-slate-400">Set {budget.saved_at}</div></div>
        <button onClick={()=>{setBudgetDraft({salary:String(budget.salary),items:(budget.items||[]).map(i=>({...i,amount:String(i.amount)}))});setPanel('budget')}} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">Edit</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{l:'Salary',v:budget.salary,c:'#059669'},{l:'Budgeted',v:budgetTotal,c:'#e11d48'},{l:'Unallocated',v:budgetRemaining,c:budgetRemaining>=0?'#0284c7':'#e11d48'}].map(x=>(
          <div key={x.l} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs text-slate-400 font-bold tracking-wide uppercase mb-1" style={{fontSize:9}}>{x.l}</div>
            <div className="text-xs font-extrabold mono" style={{color:x.c}}>{fmt(x.v)}</div>
          </div>
        ))}
      </div>
      {budgetProgress.map(item=><div key={item.label} className="py-2.5 border-b border-slate-100 last:border-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-slate-700">{EXPENSE_CATS.find(c=>c.id===item.category)?.icon} {item.label}</span>
          <span className="text-xs font-bold mono" style={{color:item.over?'#e11d48':'#0f172a'}}>{fmt(item.used)} / {fmt(item.amount)}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div style={{width:`${item.pct}%`,height:'100%',background:item.over?'#e11d48':item.pct>75?'#f59e0b':'#10b981',borderRadius:'9999px',transition:'width .5s'}}/></div>
        {item.over&&<div className="text-xs font-semibold mt-0.5" style={{color:'#e11d48'}}>⚠ Over by {fmt(item.used-item.amount)}</div>}
      </div>)}
    </div>}

    {/* AI Coach Chat */}
    <div className="bg-white rounded-xl p-4 border shadow-sm" style={{borderColor:'#a7f3d0'}}>
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">🤖 AI Budget Coach</div>
      <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto mb-3 pr-1">
        {chatHistory.map((m,i)=><div key={i} className={`max-w-xs rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${m.role==='ai'?'bubble-ai':'bubble-user'}`}>{m.text}</div>)}
        {chatLoading&&<div className="bubble-ai rounded-2xl px-3 py-2.5"><div className="flex gap-1"><div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/></div></div>}
        <div ref={chatEndRef}/>
      </div>
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Ask your budget coach…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/>
        <button onClick={sendChat} disabled={chatLoading} className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Send</button>
      </div>
    </div>
  </div>
}

// ── Insights Tab ──────────────────────────────────────────────────────────────
function InsightsTab({txs,period,setPeriod,investments,totalInvested,persBalance}) {
  const [chatHistory,setChatHistory]=useState([{role:'ai',text:'Hi! I can see your spending patterns. Ask me anything about your finances and I\'ll ask the right questions to help you find leaks and grow your wealth. 📊'}])
  const [chatInput,setChatInput]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const chatEndRef=useRef(null)
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}) },[chatHistory,chatLoading])

  const periodTxs=txs.filter(t=>inPeriod(t,period))
  const sentTxs=periodTxs.filter(t=>t.type==='sent')
  const recTxs=periodTxs.filter(t=>t.type==='received'&&t.fund==='personal')
  const totalIn=recTxs.reduce((s,t)=>s+t.amount,0)
  const totalOut=sentTxs.reduce((s,t)=>s+t.amount,0)
  const savingsRate=totalIn>0?((totalIn-totalOut)/totalIn)*100:0
  const byCat=cat=>sentTxs.filter(t=>t.category===cat).reduce((s,t)=>s+t.amount,0)

  // Health score
  const allSent=txs.filter(t=>t.type==='sent').reduce((s,t)=>s+t.amount,0)
  const allRec=txs.filter(t=>t.type==='received'&&t.fund==='personal').reduce((s,t)=>s+t.amount,0)
  const allSavRate=allRec>0?((allRec-allSent)/allRec)*100:0
  const score=Math.min(100,Math.max(0,(allSavRate>=20?40:allSavRate*2)+(allSent<=allRec?30:0)+((byCat('enjoyment')+byCat('drinks'))<totalOut*0.15?15:5)+(totalInvested>0?15:0)))
  const scoreColor=score>=70?'#10b981':score>=40?'#f59e0b':'#e11d48'

  const flags=[]
  if(totalOut>totalIn&&totalIn>0) flags.push({type:'red',icon:'🔴',title:'Spending exceeds income',body:`Spent ${fmt(totalOut)}, received ${fmt(totalIn)}. Deficit of ${fmt(totalOut-totalIn)}.`})
  if(savingsRate<20&&totalIn>0)   flags.push({type:'amber',icon:'⚠️',title:'Low savings rate',body:`${savingsRate.toFixed(0)}% savings rate. Target 20% = ${fmt(totalIn*0.2)} this ${period}.`})
  const lifestyle=byCat('enjoyment')+byCat('drinks')
  if(lifestyle>totalOut*0.2&&lifestyle>0) flags.push({type:'amber',icon:'🎉',title:'High lifestyle spending',body:`${fmt(lifestyle)} on entertainment & drinks (${totalOut>0?(lifestyle/totalOut*100).toFixed(0):0}% of expenses).`})
  const smallSpends=sentTxs.filter(t=>t.amount<200)
  if(smallSpends.length>=5) flags.push({type:'amber',icon:'💦',title:'Many small spends',body:`${smallSpends.length} transactions under Ksh 200 = ${fmt(smallSpends.reduce((s,t)=>s+t.amount,0))} total.`})
  if(savingsRate>=20) flags.push({type:'green',icon:'✅',title:'Great savings discipline',body:`Saving ${savingsRate.toFixed(0)}% of income. Keep going!`})
  if(totalInvested>0) flags.push({type:'blue',icon:'📈',title:'You\'re investing',body:`${fmt(totalInvested)} across ${investments.length} vehicle${investments.length>1?'s':''}. Est. annual return: ${fmt(investments.reduce((s,i)=>s+i.amount*(i.return_pct||0)/100,0))}.`})

  async function sendChat() {
    if (!chatInput.trim()||chatLoading) return
    const userMsg=chatInput.trim(); setChatInput('')
    setChatHistory(p=>[...p,{role:'user',text:userMsg}]); setChatLoading(true)
    const catBreakdown=EXPENSE_CATS.map(c=>{const t=byCat(c.id); return t>0?`${c.label} Ksh${t.toFixed(0)}`:''}).filter(Boolean).join(', ')
    const messages=[...chatHistory.filter((_,i)=>i>0).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})),{role:'user',content:userMsg}]
    try {
      const res=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,system:`Kenyan personal finance coach. Data: income Ksh${totalIn.toFixed(0)}, expenses Ksh${totalOut.toFixed(0)}, savings ${savingsRate.toFixed(1)}%, categories: ${catBreakdown||'none'}, invested Ksh${totalInvested.toFixed(0)}, balance Ksh${persBalance.toFixed(0)}. Ask one probing question when spending is high. Max 3 sentences. Use Kenyan context.`})})
      const data=await res.json()
      setChatHistory(p=>[...p,{role:'ai',text:data.text||'Could not connect.'}])
    } catch { setChatHistory(p=>[...p,{role:'ai',text:'Connection error.'}]) }
    setChatLoading(false)
  }

  const PLABELS={day:'Today',month:'This Month',quarter:'This Quarter'}

  return <div className="anim-up">
    <div className="flex gap-2 mb-4">
      {['day','month','quarter'].map(p=><button key={p} onClick={()=>setPeriod(p)} className="flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all" style={period===p?{background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',borderColor:'#10b981'}:{background:'#fff',color:'#94a3b8',borderColor:'#e2e8f0'}}>{p==='day'?'Daily':p==='month'?'Monthly':'Quarterly'}</button>)}
    </div>

    {/* Score */}
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4 flex items-center gap-4">
      <svg width="76" height="76" viewBox="0 0 80 80" className="shrink-0">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={`${2*Math.PI*34}`} strokeDashoffset={`${2*Math.PI*34*(1-score/100)}`} strokeLinecap="round" transform="rotate(-90 40 40)"/>
        <text x="40" y="36" textAnchor="middle" fontSize="16" fontWeight="800" fill={scoreColor}>{score}</text>
        <text x="40" y="50" textAnchor="middle" fontSize="8" fill="#94a3b8">/ 100</text>
      </svg>
      <div>
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-1">Financial Health</div>
        <div className="text-xl font-extrabold" style={{color:scoreColor}}>{score>=70?'Healthy':score>=40?'Fair':'Needs Work'}</div>
        <div className="text-xs text-slate-400 mt-1 leading-relaxed">Based on savings rate, spending & investments</div>
      </div>
    </div>

    {/* Summary */}
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">{PLABELS[period]} Summary</div>
      {[{l:'💰 Income',v:fmt(totalIn),c:'#059669'},{l:'💸 Expenses',v:fmt(totalOut),c:'#e11d48'},{l:'💾 Net Saved',v:fmt(totalIn-totalOut),c:totalIn>=totalOut?'#0284c7':'#e11d48'},{l:'📊 Savings Rate',v:`${savingsRate.toFixed(1)}%`,c:savingsRate>=20?'#059669':'#f59e0b'}].map(r=>(
        <div key={r.l} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
          <span className="text-xs text-slate-500">{r.l}</span>
          <span className="text-xs font-extrabold mono" style={{color:r.c}}>{r.v}</span>
        </div>
      ))}
    </div>

    {/* Flags */}
    {flags.length>0&&<div className="mb-4">
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">⚑ Flags & Alerts</div>
      {flags.map((f,i)=><div key={i} className={`rounded-xl p-3 mb-2 border flex gap-3 ${f.type==='red'?'bg-red-50 border-red-200':f.type==='amber'?'bg-amber-50 border-amber-200':f.type==='green'?'bg-emerald-50 border-emerald-200':'bg-blue-50 border-blue-200'}`}>
        <span className="text-lg shrink-0">{f.icon}</span>
        <div><div className={`text-xs font-bold mb-0.5 ${f.type==='red'?'text-red-700':f.type==='amber'?'text-amber-700':f.type==='green'?'text-emerald-700':'text-blue-700'}`}>{f.title}</div><div className="text-xs text-slate-500 leading-relaxed">{f.body}</div></div>
      </div>)}
    </div>}

    {/* AI Chat */}
    <div className="bg-white rounded-xl p-4 border shadow-sm" style={{borderColor:'#a7f3d0'}}>
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">🤖 AI Financial Coach</div>
      <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto mb-3 pr-1">
        {chatHistory.map((m,i)=><div key={i} className={`max-w-xs rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${m.role==='ai'?'bubble-ai':'bubble-user'}`}>{m.text}</div>)}
        {chatLoading&&<div className="bubble-ai rounded-2xl px-3 py-2.5"><div className="flex gap-1"><div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/></div></div>}
        <div ref={chatEndRef}/>
      </div>
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-400" placeholder="Ask about your spending, leaks, goals…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/>
        <button onClick={sendChat} disabled={chatLoading} className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>Send</button>
      </div>
    </div>
  </div>
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab({user,notify}) {
  const webhookUrl = typeof window!=='undefined' ? `${window.location.origin}/api/webhook/sms` : ''
  const webhookSecret = '(set in your .env as WEBHOOK_SECRET)'
  function copy(text) { navigator.clipboard.writeText(text).then(()=>notify('Copied!')).catch(()=>notify('Copy failed','error')) }

  return <div className="anim-up">
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">Account</div>
      <div className="flex items-center gap-3 py-2 border-b border-slate-100">
        <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#10b981,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16}}>{user?.name?.[0]||'?'}</div>
        <div><div className="font-bold text-sm text-slate-900">{user?.name}</div><div className="text-xs text-slate-400">{user?.email}</div></div>
      </div>
    </div>

    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
      <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-1">📡 Webhook — Auto SMS Forwarding</div>
      <p className="text-xs text-slate-500 leading-relaxed mb-4">Use <strong>SMS Forwarder</strong> (Android, free on Play Store) to automatically send every M-Pesa SMS to this app.</p>
      <div className="text-xs font-bold text-slate-600 mb-1">Step 1 — Install SMS Forwarder</div>
      <p className="text-xs text-slate-400 mb-3">Search "SMS Forwarder" on Google Play Store and install.</p>
      <div className="text-xs font-bold text-slate-600 mb-1">Step 2 — Configure a new forwarder</div>
      <p className="text-xs text-slate-400 mb-2">Choose <strong>HTTP POST</strong> as the destination. Use these settings:</p>
      <div className="bg-slate-900 rounded-lg p-3 mb-3 text-xs mono">
        <div className="text-slate-400 mb-1">URL:</div>
        <div className="text-emerald-400 mb-2 break-all">{webhookUrl}</div>
        <div className="text-slate-400 mb-1">Headers:</div>
        <div className="text-yellow-300 mb-0.5">x-webhook-secret: {webhookSecret}</div>
        <div className="text-yellow-300 mb-2">x-user-email: {user?.email||'your@email.com'}</div>
        <div className="text-slate-400 mb-1">Body (JSON):</div>
        <div className="text-blue-300">{'{ "sms": "%sms_body%" }'}</div>
      </div>
      <button onClick={()=>copy(webhookUrl)} className="w-full py-2 rounded-lg border text-xs font-bold mb-2" style={{background:'#f0fdf4',borderColor:'#bbf7d0',color:'#059669'}}>📋 Copy Webhook URL</button>
      <div className="text-xs font-bold text-slate-600 mb-1">Step 3 — Set filter</div>
      <p className="text-xs text-slate-400">In SMS Forwarder, set sender filter to contain <strong>MPESA</strong> so only M-Pesa messages are forwarded.</p>
    </div>
  </div>
}

// ── Transaction Row ───────────────────────────────────────────────────────────
function TxRow({tx,expanded,onDelete,confirmDelete,onConfirm,onCancel}) {
  const isIn=tx.type==='received', isDis=tx.type==='disbursed'
  const cat=EXPENSE_CATS.find(c=>c.id===tx.category)
  const borderColor=isDis?'#a855f7':isIn?'#10b981':'#f43f5e'
  const amtColor=isDis?'#7c3aed':isIn?'#059669':'#e11d48'
  const amtSign=isDis?'- ':isIn?'+':'-'
  return <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm mb-2 flex justify-between items-start" style={{borderLeftWidth:4,borderLeftColor:borderColor}}>
    <div className="flex-1 pl-2 min-w-0">
      <div className="font-bold text-sm text-slate-900 truncate">{isDis?'💸 ':''}{tx.party||'—'}</div>
      <div className="text-xs text-slate-400 mt-0.5">{tx.date} · {tx.time}{tx.phone?` · ${tx.phone}`:''}{tx.note?` · ${tx.note}`:''}</div>
      {expanded&&<div className="flex gap-1.5 mt-1.5 flex-wrap">
        {isDis&&<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">💸 → {tx.student_name}</span>}
        {!isDis&&tx.fund==='student'&&<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🎓 {tx.student_name}</span>}
        {!isDis&&tx.fund==='personal'&&isIn&&<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">👤 Personal</span>}
        {cat&&!isIn&&!isDis&&<span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:cat.color+'18',color:cat.color}}>{cat.icon} {cat.label}</span>}
      </div>}
      {confirmDelete&&<div className="flex items-center gap-2 mt-2"><span className="text-xs font-bold text-red-500">Delete?</span><button onClick={onConfirm} className="text-xs font-bold px-2 py-1 rounded bg-red-500 text-white">Yes</button><button onClick={onCancel} className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500">No</button></div>}
    </div>
    <div className="flex items-start gap-1.5 ml-2 shrink-0">
      <div className="text-sm font-extrabold mono" style={{color:amtColor}}>{amtSign}Ksh {(tx.amount||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</div>
      {onDelete&&!confirmDelete&&<button onClick={onDelete} className="text-slate-300 hover:text-red-400 text-xs ml-0.5">🗑</button>}
    </div>
  </div>
}
