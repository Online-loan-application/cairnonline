import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Eye, EyeOff, Fingerprint, Globe2, LockKeyhole, Menu, MoveUpRight, ShieldCheck, Sparkles, WalletCards, X, Zap } from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { Brand, CairnMark } from './components/Brand'
import { Toaster } from './components/ui/sonner'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))

type Account = {
  id: string
  label: string
  title: string
  balance: string
  caption: string
  metric: string
  metricLabel: string
  path: string
}

const accounts: Account[] = [
  {
    id: 'everyday', label: 'Everyday', title: 'Everyday account', balance: '$8,240.60', caption: 'Illustrative balance', metric: '$3,860', metricLabel: 'Example monthly spending',
    path: 'M4 114 C42 106 55 78 92 88 S146 126 184 90 S236 38 272 60 S330 96 396 28',
  },
  {
    id: 'savings', label: 'Savings', title: 'Savings space', balance: '$16,439.60', caption: 'Across three savings goals', metric: '82%', metricLabel: 'Example goal progress',
    path: 'M4 118 C38 118 56 104 92 100 S144 106 184 82 S232 74 272 54 S332 46 396 18',
  },
  {
    id: 'global', label: 'Global', title: 'Global account', balance: '$4,920.40', caption: 'Illustrative multi-currency balance', metric: '12', metricLabel: 'Example currencies',
    path: 'M4 108 C42 68 62 118 98 92 S146 46 184 70 S238 116 272 76 S338 38 396 48',
  },
]

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1400)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="splash" aria-label="Cairn Bank introduction">
      <button className="splash-skip" onClick={onDone} aria-label="Skip introduction"><X size={18} /></button>
      <div className="splash-lockup">
        <div className="splash-symbol"><CairnMark /></div>
        <div className="splash-word"><span>CAIRN</span><small>YOUR WAY FORWARD</small></div>
      </div>
      <div className="splash-progress"><span /></div>
    </div>
  )
}

function TransferDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [summary, setSummary] = useState({ recipient: '', amount: '' })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function close() {
    setConfirmed(false)
    setSummary({ recipient: '', amount: '' })
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSummary({ recipient: String(data.get('recipient')), amount: String(data.get('amount')) })
    setConfirmed(true)
  }

  return (
    <dialog ref={ref} className="transfer-dialog" onClose={close} onCancel={close} onClick={(e) => { if (e.target === e.currentTarget) close() }} aria-labelledby="transfer-title">
      <div className="dialog-inner">
        <button className="icon-button dialog-close" onClick={close} aria-label="Close transfer preview"><X size={20} /></button>
        <span className="dialog-kicker">INTERACTIVE PREVIEW</span>
        {confirmed ? (
          <div className="transfer-confirmation" aria-live="polite">
            <div className="confirmation-icon"><Check size={34} /></div>
            <h2 id="transfer-title">Preview complete.</h2>
            <p>This preview represents <strong>${Number(summary.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> to <strong>{summary.recipient}</strong>. No money has moved.</p>
            <button className="button button-dark" onClick={close}>Back to Cairn <ArrowRight size={17} /></button>
          </div>
        ) : (
          <>
            <h2 id="transfer-title">Preview a transfer.</h2>
            <p>Try the flow with fictional details. Nothing is sent or stored.</p>
            <form onSubmit={submit}>
              <label htmlFor="recipient">Recipient</label>
              <select id="recipient" name="recipient" required defaultValue="Alex Morgan" autoFocus>
                <option>Alex Morgan</option>
                <option>Jordan Lee</option>
                <option>Sam Rivera</option>
              </select>
              <label htmlFor="amount">Amount (USD)</label>
              <div className="amount-field"><span>$</span><input id="amount" name="amount" type="number" min="1" max="10000" step="0.01" defaultValue="125.00" required /></div>
              <label htmlFor="note">Note <span>Optional</span></label>
              <input id="note" name="note" type="text" maxLength={60} placeholder="Dinner, tickets, rent…" />
              <button className="button button-orange" type="submit">Preview transfer <ArrowUpRight size={17} /></button>
              <small className="form-note"><LockKeyhole size={13} /> Illustrative only—no real transaction.</small>
            </form>
          </>
        )}
      </div>
    </dialog>
  )
}

function LandingPage() {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [splash, setSplash] = useState(!reducedMotion)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeAccount, setActiveAccount] = useState(accounts[0])
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [transferOpen, setTransferOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = splash ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [splash])

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((element) => {
        gsap.fromTo(element, { y: 38, scale: 0.97, opacity: 0 }, {
          y: 0, scale: 1, opacity: 1, duration: 0.85, ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        })
      })
      gsap.utils.toArray<SVGPathElement>('.draw-path').forEach((path) => {
        const length = path.getTotalLength()
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
        gsap.to(path, {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: path.closest('.draw-scene'), start: 'top 82%', end: 'bottom 42%', scrub: 0.6 },
        })
      })
      gsap.to('.hero-line-art', {
        rotate: 22, yPercent: 12, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
      })
      gsap.to('.floating-note', {
        y: -70, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
      })
    })
    return () => {
      context.revert()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [reducedMotion])

  function tiltCard(event: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion || !cardRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    cardRef.current.style.transform = `rotateX(${-y * 13}deg) rotateY(${x * 16}deg) translateZ(0)`
  }

  function resetCard() {
    if (cardRef.current) cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} />}
      <header className="site-header">
        <div className="nav-shell">
          <Brand />
          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#accounts" onClick={closeMenu}>Accounts</a>
            <a href="#cards" onClick={closeMenu}>Cards</a>
            <a href="#security" onClick={closeMenu}>Security</a>
            <Link className="mobile-nav-create-account" to="/create-account" onClick={closeMenu}>Create account</Link>
            <Link className="mobile-nav-login" to="/login" onClick={closeMenu}>Log in</Link>
          </nav>
          <Link className="nav-cta" to="/create-account">Begin your journey <ArrowUpRight size={15} /></Link>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow glow-one" /><div className="hero-glow glow-two" />
          <svg className="hero-line-art draw-scene" viewBox="0 0 700 700" aria-hidden="true">
            <path className="draw-path" d="M92 542 C196 664 452 666 578 512 C704 358 604 112 396 74 C188 36 28 226 92 400 C156 574 390 572 478 424 C566 276 430 152 302 206 C174 260 210 420 340 430" />
            <path className="draw-path" d="M144 566 L560 150 M218 610 L618 210" />
          </svg>
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">A CLEARER WAY TO BANK</p>
            <h1 id="hero-title"><span>Money,</span><span className="serif">in clear</span><span>view.</span></h1>
            <p className="hero-intro">Everyday spending, saving, and global money—brought together in one calm, beautifully simple experience.</p>
            <div className="hero-actions">
              <Link className="button button-dark" to="/create-account">Begin your journey <ArrowRight size={17} /></Link>
              <a className="button button-dark" href="#accounts">Explore accounts <ArrowDown size={17} /></a>
              <Link className="text-link" to="/login">Log in <ArrowRight size={16} /></Link>
              <a className="text-link" href="#security">Why Cairn <ArrowRight size={16} /></a>
            </div>
          </div>

          <div className="hero-product" aria-label="Cairn illustrative app preview">
            <div className="account-glass">
              <div className="product-top"><span>CAIRN / PREVIEW</span><Fingerprint size={23} /></div>
              <p>Total balance</p>
              <div className="hero-balance"><span>$</span>24,680<small>.20</small></div>
              <div className="balance-change"><MoveUpRight size={15} /> 8.4% <span>example this month</span></div>
              <svg className="hero-chart" viewBox="0 0 420 130" role="img" aria-label="Illustrative rising balance chart">
                <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EC5E27" stopOpacity=".25"/><stop offset="1" stopColor="#EC5E27" stopOpacity="0"/></linearGradient></defs>
                <path d="M4 112 C48 112 56 92 92 94 S144 110 184 82 S238 72 270 54 S338 56 416 12 L416 130 L4 130Z" fill="url(#chartFill)" />
                <path d="M4 112 C48 112 56 92 92 94 S144 110 184 82 S238 72 270 54 S338 56 416 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="416" cy="12" r="6" />
              </svg>
              <div className="product-bottom"><span><i /> Illustrative account</span><span>•• 2048</span></div>
            </div>
            <div className="mini-bank-card">
              <div><CairnMark light /><span>CAIRN</span></div>
              <strong>•••• &nbsp; 2048</strong>
              <small>PREVIEW CARD</small>
            </div>
            <div className="floating-note"><Sparkles size={20} /><div><strong>Goal almost there</strong><span>82% · illustrative</span></div></div>
          </div>
          <a className="scroll-cue" href="#accounts" aria-label="Scroll to accounts"><span>SCROLL TO DISCOVER</span><ArrowDown size={16} /></a>
        </section>

        <section className="accounts-section" id="accounts" aria-labelledby="accounts-title">
          <div className="section-heading reveal">
            <div><p className="eyebrow">ONE ACCOUNT, MANY POSSIBILITIES</p><h2 id="accounts-title">Every account.<br /><span className="serif">One calm view.</span></h2></div>
            <p>Switch between everyday money, savings goals, and global balances without losing the thread. This interactive preview uses fictional data.</p>
          </div>
          <div className="account-workspace reveal">
            <div className="account-tabs" role="tablist" aria-label="Illustrative account types">
              {accounts.map((account) => <button key={account.id} role="tab" aria-selected={activeAccount.id === account.id} aria-controls="account-panel" className={activeAccount.id === account.id ? 'active' : ''} onClick={() => setActiveAccount(account)}>{account.label}<ChevronRight size={16} /></button>)}
            </div>
            <div className="account-panel" id="account-panel" role="tabpanel" key={activeAccount.id}>
              <div className="account-panel-head"><div><span>{activeAccount.title}</span><div className="panel-balance">{balanceVisible ? activeAccount.balance : '$••••••'}</div><small>{activeAccount.caption}</small></div><button className="icon-button" onClick={() => setBalanceVisible(!balanceVisible)} aria-label={balanceVisible ? 'Hide illustrative balance' : 'Show illustrative balance'}>{balanceVisible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
              <svg className="account-chart" viewBox="0 0 400 140" role="img" aria-label={`${activeAccount.label} illustrative account trend`}><path d={activeAccount.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              <div className="account-panel-foot"><div><strong>{activeAccount.metric}</strong><span>{activeAccount.metricLabel}</span></div><button className="button button-orange" onClick={() => setTransferOpen(true)}>Preview transfer <ArrowUpRight size={17} /></button></div>
            </div>
            <div className="workspace-note"><CircleDollarSign size={22} /><p><strong>Built around your real life.</strong><br />Create spaces for bills, goals, and the things you are looking forward to.</p></div>
          </div>
        </section>

        <section className="principles" aria-label="Cairn principles">
          <div className="principle reveal"><Zap /><h3>Fast, not frantic.</h3><p>Clear actions and instant-feeling flows, without the noise.</p></div>
          <div className="principle reveal"><Globe2 /><h3>Global by nature.</h3><p>A concept built for currencies, countries, and life in motion.</p></div>
          <div className="principle reveal"><ShieldCheck /><h3>Security made visible.</h3><p>Understandable controls that help you feel in charge.</p></div>
        </section>

        <section className="cards-section" id="cards" aria-labelledby="cards-title">
          <div className="card-copy reveal">
            <p className="eyebrow">THE CAIRN CARD</p>
            <h2 id="cards-title">A little less plastic.<br /><span className="serif">A lot more possibility.</span></h2>
            <p>A card concept designed to feel as considered as the app behind it. Move your pointer across the card to explore its tactile finish.</p>
            <ul className="feature-list"><li><Check size={17} /> Virtual and physical card concept</li><li><Check size={17} /> Clear spending controls</li><li><Check size={17} /> Designed for global everyday use</li></ul>
            <button className="text-link" onClick={() => setTransferOpen(true)}>Try the transfer preview <ArrowRight size={16} /></button>
          </div>
          <div className="card-stage reveal" onPointerMove={tiltCard} onPointerLeave={resetCard}>
            <svg className="card-orbit" viewBox="0 0 600 600" aria-hidden="true"><circle cx="300" cy="300" r="240" /><circle cx="300" cy="300" r="176" /></svg>
            <div className="tilt-card" ref={cardRef}>
              <div className="tilt-card-top"><div><CairnMark light /><span>CAIRN</span></div><WalletCards size={30} /></div>
              <div className="card-chip"><span /><span /><span /></div>
              <div className="card-number">5312 &nbsp; •••• &nbsp; •••• &nbsp; 2048</div>
              <div className="tilt-card-bottom"><span>CAIRN CARDHOLDER<small>CONCEPT / NO VALUE</small></span><strong>09/30</strong></div>
            </div>
            <span className="card-stage-note">MOVE TO TILT</span>
          </div>
        </section>

        <section className="security-section draw-scene" id="security" aria-labelledby="security-title">
          <div className="security-art reveal">
            <svg viewBox="0 0 560 620" aria-hidden="true">
              <path className="draw-path" d="M280 42 L474 118 V280 C474 424 396 518 280 578 C164 518 86 424 86 280 V118 Z" />
              <path className="draw-path" d="M280 112 L408 162 V282 C408 376 356 446 280 494 C204 446 152 376 152 282 V162 Z" />
              <path className="draw-path" d="M204 304 L258 358 L366 238" />
              <circle cx="280" cy="300" r="228" />
            </svg>
            <div className="security-badge"><Fingerprint size={34} /><span>YOU ARE<br />THE KEY</span></div>
          </div>
          <div className="security-copy reveal">
            <p className="eyebrow">SECURITY, IN PLAIN SIGHT</p>
            <h2 id="security-title">Protection you<br /><span className="serif">can understand.</span></h2>
            <p>Security should not feel like fine print. Cairn’s concept puts clear controls, thoughtful authentication, and transparent activity at the center.</p>
            <div className="security-points"><div><LockKeyhole /><span><strong>Private by design</strong>No real banking data in this concept.</span></div><div><Fingerprint /><span><strong>Human authentication</strong>A vision for secure access without friction.</span></div></div>
          </div>
        </section>

        <section className="closing-section">
          <div className="closing-stones" aria-hidden="true"><i /><i /><i /></div>
          <p className="eyebrow">YOUR WAY FORWARD</p>
          <h2>Find your<br /><span className="serif">financial balance.</span></h2>
          <Link className="button button-cream" to="/create-account">Create your account <ArrowUpRight size={18} /></Link>
        </section>
      </main>

      <footer>
        <Brand light />
        <p>A concept banking experience. No real accounts, cards, or transactions.</p>
        <a href="#top">Back to top <ArrowUpRight size={15} /></a>
      </footer>
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  )
}

function App() {
  return (
    <>
      <Suspense fallback={<div role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/create-account" element={<AuthPage mode="create-account" />} />
          <Route path="/dashboard/*" element={<DashboardPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </>
  )
}

export default App
