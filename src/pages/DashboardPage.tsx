import { useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowDownToLine, ArrowUpRight, Bell, Check, CreditCard, Eye, EyeOff, LayoutDashboard, LogOut, Menu, PiggyBank, Send, ShieldCheck, UserRound, Wallet, X } from 'lucide-react'
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { Brand } from '../components/Brand'
import { supabase } from '../lib/supabase'
import { transferMethods } from '../lib/transferMethods'
import './DashboardPage.css'

type DashboardUser = {
  id: string
  email: string
  name: string
  countryName: string
  currencyCode: string
}

const accounts = [
  { name: 'Everyday account', detail: '•••• 2048', balance: 0, icon: Wallet },
  { name: 'Savings space', detail: 'Rainy day goal · 0%', balance: 0, icon: PiggyBank },
  { name: 'Cairn card', detail: 'Virtual · •••• 5312', balance: null, icon: CreditCard },
]

type ActivityEvent = {
  id: number
  event_type: 'account_created' | 'signed_in' | 'sign_out_requested' | 'deposit_preview' | 'transfer_preview' | 'account_suspended' | 'account_reactivated'
  description: string
  created_at: string
  read_at: string | null
}

type LedgerTransaction = {
  id: number
  direction: 'money_in' | 'money_out'
  account_name: string
  amount: number
  currency_code: string
  transfer_method: string
  destination: string
  created_at: string
}

const activityTitles: Record<ActivityEvent['event_type'], string> = {
  account_created: 'Account created',
  signed_in: 'Signed in',
  sign_out_requested: 'Sign-out requested',
  deposit_preview: 'Money in recorded',
  transfer_preview: 'Money out recorded',
  account_suspended: 'Account access suspended',
  account_reactivated: 'Account access restored',
}

function getDashboardUser(user: User | null, currencyCode?: string | null): DashboardUser | null {
  if (!user) return null
  const displayName = user.user_metadata?.display_name
  const metadataCurrency = user.user_metadata?.currency_code
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : user.email?.split('@')[0] || 'there',
    countryName: typeof user.user_metadata?.country_name === 'string' ? user.user_metadata.country_name : '',
    currencyCode: isCurrencyCode(currencyCode)
      ? currencyCode
      : isCurrencyCode(metadataCurrency)
        ? metadataCurrency
        : 'USD',
  }
}

function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
}

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount)
}

function parseLedgerTransaction(value: unknown): LedgerTransaction | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount)
  if (
    !Number.isSafeInteger(id)
    || id < 1
    || (row.direction !== 'money_in' && row.direction !== 'money_out')
    || typeof row.account_name !== 'string'
    || !Number.isFinite(amount)
    || typeof row.currency_code !== 'string'
    || typeof row.transfer_method !== 'string'
    || typeof row.destination !== 'string'
    || typeof row.created_at !== 'string'
  ) return null
  return {
    id,
    direction: row.direction,
    account_name: row.account_name,
    amount,
    currency_code: row.currency_code,
    transfer_method: row.transfer_method,
    destination: row.destination,
    created_at: row.created_at,
  }
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="dashboard-page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

function AccountList({
  accounts: accountList,
  getBalance,
  currencyCode,
  showBalances,
}: {
  accounts: typeof accounts
  getBalance: (accountName: string) => number
  currencyCode: string
  showBalances: boolean
}) {
  return (
    <div className="dashboard-account-list">
      {accountList.map(({ name, detail, balance, icon: Icon }) => (
        <article className="dashboard-account" key={name}>
          <span className="dashboard-account-icon"><Icon size={20} /></span>
          <span className="dashboard-account-info"><strong>{name}</strong><small>{detail}</small></span>
          <strong className="dashboard-account-balance">
            {balance === null ? 'Active' : showBalances ? formatCurrency(getBalance(name), currencyCode) : '••••••'}
          </strong>
        </article>
      ))}
    </div>
  )
}

function TransactionList({
  transactions,
  currencyCode,
  showBalances,
  loading,
}: {
  transactions: LedgerTransaction[]
  currencyCode: string
  showBalances: boolean
  loading: boolean
}) {
  if (loading && transactions.length === 0) {
    return <p className="dashboard-activity-empty" role="status">Loading transactions…</p>
  }
  if (transactions.length === 0) {
    return <p className="dashboard-activity-empty">No money-in or money-out activity recorded.</p>
  }

  return (
    <ul className="dashboard-activity">
      {transactions.map((transaction) => (
        <li key={transaction.id}>
          <span className={`dashboard-activity-icon ${transaction.direction === 'money_in' ? 'in' : 'out'}`} aria-hidden="true">
            {transaction.direction === 'money_in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
          </span>
          <span className="dashboard-activity-info">
            <strong>{transaction.direction === 'money_in' ? 'Deposit' : 'Transfer'}</strong>
            <small>{transaction.account_name} · {transaction.transfer_method} · {new Date(transaction.created_at).toLocaleString()}</small>
          </span>
          <span className="dashboard-activity-description">{transaction.destination}</span>
          <strong className={transaction.direction === 'money_in' ? 'dashboard-credit' : ''}>
            {showBalances
              ? `${transaction.direction === 'money_in' ? '+' : '−'}${formatCurrency(transaction.amount, transaction.currency_code || currencyCode)}`
              : '••••••'}
          </strong>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminAccessLoading, setAdminAccessLoading] = useState(true)
  const [isSuspended, setIsSuspended] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState('')
  const [showBalances, setShowBalances] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const transferMethod = transferMethods[0].name
  const notificationsRef = useRef<HTMLDivElement>(null)
  const authUserId = useRef<string | null>(null)
  const unreadCount = activity.filter((event) => !event.read_at).length
  const page = location.pathname.endsWith('/accounts')
    ? 'accounts'
    : location.pathname.endsWith('/activity')
      ? 'activity'
      : location.pathname.endsWith('/profile')
        ? 'profile'
        : 'overview'
  const moneyIn = transactions
    .filter((transaction) => transaction.direction === 'money_in')
    .reduce((total, transaction) => total + transaction.amount, 0)
  const moneyOut = transactions
    .filter((transaction) => transaction.direction === 'money_out')
    .reduce((total, transaction) => total + transaction.amount, 0)
  const totalBalance = moneyIn - moneyOut

  function getAccountBalance(accountName: string) {
    return transactions
      .filter((transaction) => transaction.account_name === accountName)
      .reduce((total, transaction) => total + (transaction.direction === 'money_in' ? transaction.amount : -transaction.amount), 0)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextUserId = session?.user.id ?? null
      if (nextUserId !== authUserId.current) {
        authUserId.current = nextUserId
        setIsAdmin(false)
        setAdminAccessLoading(Boolean(session?.user))
      }
      setUser(getDashboardUser(session?.user ?? null))
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      authUserId.current = data.session?.user.id ?? null
      setUser(getDashboardUser(data.session?.user ?? null))
      if (!data.session?.user) setAdminAccessLoading(false)
      setLoading(false)
    }).catch((sessionError: unknown) => {
      if (!active) return
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to check your login session.')
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !user?.id) return

    let active = true
    const client = supabase
    const userId = user.id
    async function loadDashboardData() {
      try {
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('currency_code, country_name, is_suspended')
          .eq('id', userId)
          .maybeSingle()
        if (!active) return
        if (profileError) {
          toast.error('Could not load your profile currency', { description: profileError.message })
        } else if (profile?.currency_code && isCurrencyCode(profile.currency_code)) {
          setUser((current) => current ? {
            ...current,
            currencyCode: profile.currency_code,
            countryName: profile.country_name ?? current.countryName,
          } : current)
        }
        if (profile) setIsSuspended(profile.is_suspended === true)

        const { data: adminGrant, error: adminError } = await client
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
        if (!active) return
        if (adminError) {
          toast.error('Administrator access could not be checked', { description: adminError.message })
        } else {
          setIsAdmin(Boolean(adminGrant))
        }
        setAdminAccessLoading(false)

        const allEvents: ActivityEvent[] = []
        const pageSize = 500
        for (let from = 0; ; from += pageSize) {
          const { data, error: eventsError } = await client
            .from('user_activity')
            .select('id, event_type, description, created_at, read_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + pageSize - 1)
          if (eventsError) throw eventsError
          const page = (data ?? []) as ActivityEvent[]
          allEvents.push(...page)
          if (page.length < pageSize) break
        }
        if (active) setActivity(allEvents)

        const allTransactions: LedgerTransaction[] = []
        for (let from = 0; ; from += pageSize) {
          const { data, error: transactionsError } = await client
            .from('account_transactions')
            .select('id, direction, account_name, amount, currency_code, transfer_method, destination, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + pageSize - 1)
          if (transactionsError) throw transactionsError
          const page = (data ?? []).map(parseLedgerTransaction).filter((row): row is LedgerTransaction => row !== null)
          allTransactions.push(...page)
          if (page.length < pageSize) break
        }
        if (active) setTransactions(allTransactions)
      } catch (caughtError) {
        if (!active) return
        const message = caughtError instanceof Error ? caughtError.message : 'Unable to load your account history.'
        setActivityError(message)
        toast.error('Could not load account history', { description: message })
      } finally {
        if (active) {
          setAdminAccessLoading(false)
          setActivityLoading(false)
        }
      }
    }

    void loadDashboardData()
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    if (adminAccessLoading || !isAdmin || page !== 'overview') return
    navigate('/admin', { replace: true })
  }, [adminAccessLoading, isAdmin, navigate, page])

  useEffect(() => {
    if (!notificationsOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  async function recordActivity(eventType: ActivityEvent['event_type'], description: string) {
    if (!supabase || !user) throw new Error('You must be signed in to record activity.')
    const { data, error: insertError } = await supabase
      .from('user_activity')
      .insert({ user_id: user.id, event_type: eventType, description })
      .select('id, event_type, description, created_at, read_at')
      .single()
    if (insertError) throw insertError
    if (!data) throw new Error('The activity was not saved. Please try again.')
    setActivity((current) => [data as ActivityEvent, ...current])
  }

  async function markActivityRead(ids: number[]) {
    if (!supabase || !user || ids.length === 0) return
    const readAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('user_activity')
      .update({ read_at: readAt })
      .eq('user_id', user.id)
      .in('id', ids)
    if (updateError) {
      toast.error('Could not update notifications', { description: updateError.message })
      return
    }
    setActivity((current) => current.map((event) => ids.includes(event.id) ? { ...event, read_at: readAt } : event))
  }

  function markAllNotificationsRead() {
    void markActivityRead(activity.filter((event) => !event.read_at).map((event) => event.id))
  }

  function markNotificationRead(id: number) {
    void markActivityRead([id])
  }

  async function leaveSuspendedSession() {
    const client = supabase
    if (!client) return
    try {
      const { error: signOutError } = await client.auth.signOut()
      if (signOutError) {
        toast.error('Unable to sign out', { description: signOutError.message })
      } else {
        navigate('/login', { replace: true })
      }
    } catch (caughtError) {
      toast.error('Unable to sign out', {
        description: caughtError instanceof Error ? caughtError.message : 'The server could not be reached.',
      })
    }
  }

  async function logOut() {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      try {
        await recordActivity('sign_out_requested', 'You requested to sign out of your Cairn account.')
      } catch (caughtError) {
        toast.error('Sign-out activity could not be recorded', {
          description: caughtError instanceof Error ? caughtError.message : 'Activity history is unavailable.',
        })
      }
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      toast.success('You are signed out.')
      navigate('/login', { replace: true })
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to log out. Please try again.'
      setError(message)
      toast.error('Unable to log out', { description: message })
    } finally {
      setBusy(false)
    }
  }

  if (loading || (user && adminAccessLoading)) {
    return <main className="dashboard-state" role="status">Checking your session…</main>
  }

  if (!supabase) {
    return (
      <main className="dashboard-state">
        <Brand />
        <h1>Connect your account first.</h1>
        <p>Set up Supabase authentication to open your account overview. No real bank data is used.</p>
        <Link className="button button-dark" to="/login">Go to login <ArrowLeft size={17} /></Link>
      </main>
    )
  }

  if (error && !user) {
    return (
      <main className="dashboard-state">
        <Brand />
        <h1>We couldn’t verify your session.</h1>
        <p role="alert">{error}</p>
        <Link className="button button-dark" to="/login">Return to login <ArrowLeft size={17} /></Link>
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (isSuspended) {
    return (
      <main className="dashboard-state">
        <Brand />
        <h1>Account access suspended.</h1>
        <p>Your account access has been suspended. Contact support for assistance.</p>
        <button
          className="button button-dark"
          type="button"
          onClick={() => void leaveSuspendedSession()}
        >
          <LogOut size={17} /> Sign out
        </button>
      </main>
    )
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand-group">
          <Brand />
          <button
            className="dashboard-menu-toggle"
            type="button"
            aria-label={sidebarOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <div className="dashboard-clock" aria-label="Local date and time">
            <time dateTime={now.toISOString()}>
              <span>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
              <small>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</small>
            </time>
          </div>
          <div className="dashboard-notifications" ref={notificationsRef}>
            <button
              className="dashboard-notification-button"
              type="button"
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-expanded={notificationsOpen}
              aria-controls="dashboard-notification-panel"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="dashboard-notification-count" aria-hidden="true">{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <section className="dashboard-notification-panel" id="dashboard-notification-panel" aria-label="Activity notifications">
                <div className="dashboard-notification-heading">
                  <div><strong>Activity notifications</strong><small>Account and recent activity</small></div>
                  <button className="dashboard-notification-close" type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={17} /></button>
                </div>
                {activityLoading ? (
                  <p className="dashboard-notification-empty" role="status">Loading your activity…</p>
                ) : activity.length > 0 ? (
                  <>
                    <ul className="dashboard-notification-list">
                      {activity.map((event) => (
                        <li key={event.id} className={event.read_at ? 'is-read' : ''}>
                          <button type="button" onClick={() => markNotificationRead(event.id)}>
                            <span className="dashboard-notification-indicator" aria-hidden="true" />
                            <span className="dashboard-notification-copy">
                              <strong>{activityTitles[event.event_type]}</strong>
                              <span>{event.description}</span>
                              <small>{new Date(event.created_at).toLocaleString()}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button className="dashboard-mark-read" type="button" onClick={markAllNotificationsRead} disabled={!unreadCount}>
                      <Check size={14} /> Mark all as read
                    </button>
                  </>
                ) : (
                  <p className="dashboard-notification-empty">{activityError || 'No activity recorded yet.'}</p>
                )}
              </section>
            )}
          </div>
          <button className="dashboard-logout" type="button" onClick={logOut} disabled={busy}>
            <LogOut size={16} /> {busy ? 'Signing out…' : 'Log out'}
          </button>
        </nav>
      </header>

      <div className="dashboard-layout">
        {sidebarOpen && <button className="dashboard-sidebar-backdrop" type="button" aria-label="Close dashboard menu" onClick={() => setSidebarOpen(false)} />}
        <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''}`} id="dashboard-sidebar" aria-label="Dashboard sidebar">
          <p className="dashboard-sidebar-label">WORKSPACE</p>
          <nav className="dashboard-sidebar-nav" aria-label="Dashboard sections">
            <NavLink to="/dashboard" end className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}><LayoutDashboard size={18} /> Overview</NavLink>
            <NavLink to="/dashboard/accounts" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}><Wallet size={18} /> Accounts</NavLink>
            <NavLink to="/dashboard/activity" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}><ArrowDownLeft size={18} /> Activity</NavLink>
            <NavLink to="/dashboard/profile" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}><UserRound size={18} /> Profile</NavLink>
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}><ShieldCheck size={18} /> Admin</NavLink>}
          </nav>
          <div className="dashboard-sidebar-actions">
            <p className="dashboard-sidebar-label">QUICK ACTIONS</p>
            <Link to="/dashboard/deposit" onClick={() => setSidebarOpen(false)}><ArrowDownToLine size={17} /> Deposit</Link>
            <Link to={`/dashboard/transfer?method=${encodeURIComponent(transferMethod)}`} onClick={() => setSidebarOpen(false)}><Send size={17} /> Transfer</Link>
          </div>
        </aside>

        <div className="dashboard-main">
          <section className="dashboard-content" aria-label={`${page} dashboard page`}>
            {page === 'overview' && (
              <>
            <div className="dashboard-welcome">
              <div>
                <p className="eyebrow">YOUR CAIRN OVERVIEW</p>
                <h1 id="dashboard-title">Good to see you, <span className="serif">{user.name}.</span></h1>
                <p>Here’s your money at a glance.</p>
              </div>
              <button className="dashboard-visibility" type="button" onClick={() => setShowBalances((visible) => !visible)} aria-label={showBalances ? 'Hide balances' : 'Show balances'}>
                {showBalances ? <EyeOff size={17} /> : <Eye size={17} />}
                {showBalances ? 'Hide balances' : 'Show balances'}
              </button>
            </div>

            {activityError && <p className="dashboard-error" role="alert">Account history could not be loaded: {activityError}. Apply supabase/activity_notifications.sql and supabase/account_ledger.sql in Supabase.</p>}
            {error && <p className="dashboard-error" role="alert">{error}</p>}

            <section className="dashboard-summary" aria-label="Balance overview">
              <div className="dashboard-total">
                <span>Total balance</span>
                <strong>{showBalances ? formatCurrency(totalBalance, user.currencyCode) : '••••••'}</strong>
                <small>Available balance · {user.currencyCode}</small>
              </div>
              <div className="dashboard-monthly">
                <span>Money in</span>
                <strong>{showBalances ? formatCurrency(moneyIn, user.currencyCode) : '••••••'}</strong>
                <small>Recorded account activity</small>
              </div>
              <div className="dashboard-monthly dashboard-money-out-total">
                <span>Money out</span>
                <strong>{showBalances ? formatCurrency(moneyOut, user.currencyCode) : '••••••'}</strong>
                <small>Recorded account activity</small>
              </div>
              <div className="dashboard-balance-actions">
                <Link className="dashboard-money-in" to="/dashboard/deposit"><ArrowDownToLine size={17} /> Money in</Link>
                <Link className="dashboard-money-out" to={`/dashboard/transfer?method=${encodeURIComponent(transferMethod)}`}><ArrowUpRight size={17} /> Money out</Link>
              </div>
            </section>

            <p className="dashboard-ledger-note">Ledger entries are illustrative only. No real payment services are connected and no real funds move.</p>

            <section className="dashboard-transfer-methods" aria-labelledby="transfer-methods-title">
              <div>
                <p className="eyebrow">CHOOSE A ROUTE</p>
                <h2 id="transfer-methods-title">Ways to transfer</h2>
                <p>Choose an illustrative route. This does not connect to a payment service.</p>
              </div>
              <div className="dashboard-transfer-method-list">
                {transferMethods.map(({ name: method, description, icon: Icon }) => {
                  return (
                  <Link
                    className={transferMethod === method ? 'active' : ''}
                    key={method}
                    to={`/dashboard/transfer?method=${encodeURIComponent(method)}`}
                    aria-current={transferMethod === method ? 'true' : undefined}
                    aria-label={`${method}, ${description}`}
                  >
                    <span className="dashboard-transfer-method-icon"><Icon size={25} strokeWidth={1.8} /></span>
                    <span className="dashboard-transfer-method-name">{method}</span>
                    <span className="dashboard-transfer-method-description">{description}</span>
                  </Link>
                  )
                })}
              </div>
            </section>

            <section className="dashboard-panel dashboard-recent-panel" aria-labelledby="recent-transactions-title">
              <div className="dashboard-panel-heading">
                <div><p className="eyebrow">ACCOUNT HISTORY</p><h2 id="recent-transactions-title">Recent transactions</h2></div>
                <Link to="/dashboard/activity">View all</Link>
              </div>
              <TransactionList transactions={transactions.slice(0, 5)} currencyCode={user.currencyCode} showBalances={showBalances} loading={activityLoading} />
            </section>
              </>
            )}

            {page === 'accounts' && (
              <>
                <PageHeading eyebrow="YOUR ACCOUNTS" title="Accounts" description="View each account and its current illustrative balance." />
                <p className="dashboard-ledger-note">These are illustrative ledger balances only. No real funds are held here.</p>
                {activityError && <p className="dashboard-error" role="alert">Accounts could not be loaded: {activityError}. Apply supabase/account_ledger.sql in Supabase.</p>}
                <section className="dashboard-panel" aria-label="Account balances">
                  <AccountList accounts={accounts} getBalance={getAccountBalance} currencyCode={user.currencyCode} showBalances={showBalances} />
                  <div className="dashboard-account-page-actions">
                    <Link className="button button-dark" to="/dashboard/deposit"><ArrowDownToLine size={17} /> Deposit</Link>
                    <Link className="button button-orange" to={`/dashboard/transfer?method=${encodeURIComponent(transferMethod)}`}><Send size={17} /> Transfer</Link>
                  </div>
                </section>
              </>
            )}

            {page === 'activity' && (
              <>
                <PageHeading eyebrow="YOUR ACCOUNT HISTORY" title="Activity" description="Deposits and transfers recorded in your account ledger." />
                <p className="dashboard-ledger-note">Records are illustrative only and do not represent real payments.</p>
                {activityError && <p className="dashboard-error" role="alert">Activity could not be loaded: {activityError}. Apply supabase/activity_notifications.sql and supabase/account_ledger.sql in Supabase.</p>}
                <section className="dashboard-panel" aria-label="Account transactions">
                  <TransactionList transactions={transactions} currencyCode={user.currencyCode} showBalances={showBalances} loading={activityLoading} />
                </section>
                <section className="dashboard-panel dashboard-event-panel" aria-label="Other account events">
                  <div className="dashboard-panel-heading"><div><p className="eyebrow">ACCOUNT EVENTS</p><h2>History</h2></div><span>{activity.length} events</span></div>
                  <ul className="dashboard-activity">
                    {activity.map((event) => (
                      <li key={event.id}>
                        <span className="dashboard-activity-icon" aria-hidden="true"><UserRound size={18} /></span>
                        <span className="dashboard-activity-info"><strong>{activityTitles[event.event_type]}</strong><small>{new Date(event.created_at).toLocaleString()}</small></span>
                        <span className="dashboard-activity-description">{event.description}</span>
                      </li>
                    ))}
                    {!activityLoading && activity.length === 0 && <li className="dashboard-activity-empty">No account events recorded.</li>}
                  </ul>
                </section>
              </>
            )}

            {page === 'profile' && (
              <>
                <PageHeading eyebrow="YOUR DETAILS" title="Profile" description="Your saved account information and display preferences." />
                <section className="dashboard-panel dashboard-profile-panel" aria-labelledby="profile-title">
                  <div className="dashboard-panel-heading">
                    <div><p className="eyebrow">PERSONAL INFORMATION</p><h2 id="profile-title">Profile details</h2></div>
                    <UserRound size={22} />
                  </div>
                  <dl className="dashboard-profile-details">
                    <div><dt>Name</dt><dd>{user.name}</dd></div>
                    <div><dt>Email</dt><dd>{user.email || 'Not provided'}</dd></div>
                    <div><dt>Country</dt><dd>{user.countryName || 'Not provided'}</dd></div>
                    <div><dt>Preferred currency</dt><dd>{user.currencyCode}</dd></div>
                  </dl>
                </section>
              </>
            )}

            <footer className="dashboard-footer">Illustrative entries only. No real financial information or services are provided.</footer>
          </section>
        </div>
      </div>
    </main>
  )
}
