import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, LogOut, Search, ShieldCheck, Trash2, UserRound, Users, UserX, Wallet } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'
import type { User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { Brand } from '../components/Brand'
import { supabase } from '../lib/supabase'
import './AdminDashboardPage.css'

type AdminUser = {
  id: string
  email: string
  display_name: string
  country_name: string
  currency_code: string
  created_at: string
  is_suspended: boolean
}

type AdminActivity = {
  id: number
  user_id: string
  event_type: string
  description: string
  created_at: string
}

type AdminTransaction = {
  id: number
  user_id: string
  direction: 'money_in' | 'money_out'
  account_name: string
  amount: number
  currency_code: string
  transfer_method: string
  destination: string
  created_at: string
}

type UserBalance = {
  user_id: string
  currency_code: string
  money_in: number
  money_out: number
  total_balance: number
}

type UserDetails = {
  activity: AdminActivity[]
  transactions: AdminTransaction[]
}

function formatCurrency(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount)
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`
  }
}

export default function AdminDashboardPage() {
  const { userId: selectedUserId } = useParams()
  const [user, setUser] = useState<User | null>(null)
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase))
  const [accessLoading, setAccessLoading] = useState(Boolean(supabase))
  const [isAdmin, setIsAdmin] = useState(false)
  const [pageLoading, setPageLoading] = useState(Boolean(supabase))
  const [pageError, setPageError] = useState(supabase ? '' : 'Supabase is not configured.')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [activity, setActivity] = useState<AdminActivity[]>([])
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [balances, setBalances] = useState<UserBalance[]>([])
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [detailsLoadedUserId, setDetailsLoadedUserId] = useState('')
  const [query, setQuery] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    let active = true
    const client = supabase
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextUserId = session?.user.id ?? null
      if (nextUserId !== currentUserId.current) {
        currentUserId.current = nextUserId
        setIsAdmin(false)
        setAccessLoading(Boolean(session?.user))
      }
      setUser(session?.user ?? null)
      setSessionLoading(false)
    })

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setPageError(error.message)
      currentUserId.current = data.session?.user.id ?? null
      setUser(data.session?.user ?? null)
      setSessionLoading(false)
    }).catch((caughtError: unknown) => {
      if (!active) return
      setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to verify your sign-in.')
      setSessionLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    if (!user || !supabase) return

    let active = true
    void Promise.resolve(supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    ).then(({ data, error }) => {
        if (!active) return
        if (error) {
          setPageError(`Administrator access could not be verified: ${error.message}`)
        } else {
          setIsAdmin(Boolean(data))
        }
        setAccessLoading(false)
      }, (caughtError: unknown) => {
        if (!active) return
        setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to verify administrator access.')
        setAccessLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionLoading, user])

  useEffect(() => {
    if (!isAdmin || !supabase) return

    let active = true
    const client = supabase
    async function loadAdminData() {
      const usersResult: AdminUser[] = []
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from('profiles')
          .select('id, email, display_name, country_name, currency_code, created_at, is_suspended')
          .order('created_at', { ascending: false })
          .range(from, from + 499)
        if (error) throw error
        const rows = (data ?? []) as AdminUser[]
        usersResult.push(...rows)
        if (rows.length < 500) break
      }

      const [activityResult, transactionsResult, balancesResult] = await Promise.all([
        client.from('user_activity')
          .select('id, user_id, event_type, description, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(100),
        client.from('account_transactions')
          .select('id, user_id, direction, account_name, amount, currency_code, transfer_method, destination, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(100),
        client.rpc('admin_list_user_balances'),
      ])
      if (!active) return

      const errors = [activityResult.error, transactionsResult.error, balancesResult.error].filter(Boolean)
      if (errors.length) {
        const message = errors.map((error) => error?.message).join('; ')
        setPageError(`Admin data could not be loaded: ${message}. Check that supabase/admin_dashboard.sql was applied.`)
      } else {
        setUsers(usersResult)
        setActivity((activityResult.data ?? []) as AdminActivity[])
        setTransactions((transactionsResult.data ?? []) as AdminTransaction[])
        const balanceRows = (balancesResult.data ?? []) as UserBalance[]
        setBalances(balanceRows.map((balance) => ({
          ...balance,
          money_in: Number(balance.money_in),
          money_out: Number(balance.money_out),
          total_balance: Number(balance.total_balance),
        })) as UserBalance[])
      }
      setPageLoading(false)
    }

    void loadAdminData().catch((caughtError: unknown) => {
      if (!active) return
      setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to load admin dashboard data.')
      setPageLoading(false)
    })

    return () => {
      active = false
    }
  }, [isAdmin])

  useEffect(() => {
    if (!selectedUserId || !isAdmin || !supabase) return
    const requestedUserId: string = selectedUserId

    let active = true
    const client = supabase
    async function loadUserDetails() {
      const allActivity: AdminActivity[] = []
      const allTransactions: AdminTransaction[] = []
      for (let from = 0; ; from += 500) {
        const [activityResult, transactionsResult] = await Promise.all([
          client.from('user_activity')
            .select('id, user_id, event_type, description, created_at')
            .eq('user_id', requestedUserId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + 499),
          client.from('account_transactions')
            .select('id, user_id, direction, account_name, amount, currency_code, transfer_method, destination, created_at')
            .eq('user_id', requestedUserId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + 499),
        ])
        if (!active) return
        if (activityResult.error || transactionsResult.error) {
          const message = [activityResult.error?.message, transactionsResult.error?.message].filter(Boolean).join('; ')
          setPageError(`Could not load this user's details: ${message}`)
          setUserDetails(null)
          setDetailsLoadedUserId(requestedUserId)
          return
        }
        const activityRows = (activityResult.data ?? []) as AdminActivity[]
        const transactionRows = (transactionsResult.data ?? []).map((transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
        })) as AdminTransaction[]
        allActivity.push(...activityRows)
        allTransactions.push(...transactionRows)
        if (activityRows.length < 500 && transactionRows.length < 500) break
      }
      if (!active) return
      setPageError('')
      setUserDetails({ activity: allActivity, transactions: allTransactions })
      setDetailsLoadedUserId(requestedUserId)
    }
    void loadUserDetails().catch((caughtError: unknown) => {
      if (!active) return
      setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to load this user’s details.')
      setDetailsLoadedUserId(requestedUserId)
    })
    return () => {
      active = false
    }
  }, [isAdmin, selectedUserId])

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return users
    return users.filter((candidate) =>
      [candidate.email, candidate.display_name, candidate.country_name, candidate.currency_code]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    )
  }, [query, users])

  async function toggleSuspension(target: AdminUser) {
    if (!supabase || target.id === user?.id) return
    setPendingUserId(target.id)
    try {
      const { error } = await supabase.rpc('admin_set_user_suspension', {
        p_user_id: target.id,
        p_suspended: !target.is_suspended,
      })
      if (error) {
        toast.error('User status was not changed', { description: error.message })
      } else {
        setUsers((current) => current.map((candidate) =>
          candidate.id === target.id ? { ...candidate, is_suspended: !target.is_suspended } : candidate,
        ))
        toast.success(target.is_suspended ? 'User access restored' : 'User suspended')
      }
    } catch (caughtError) {
      toast.error('User status was not changed', {
        description: caughtError instanceof Error ? caughtError.message : 'The server could not be reached.',
      })
    } finally {
      setPendingUserId('')
    }
  }

  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !deleteTarget) return
    setPendingUserId(deleteTarget.id)
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: deleteTarget.id,
        p_confirmation_email: confirmationEmail.trim(),
      })
      if (error) {
        toast.error('User was not deleted', { description: error.message })
      } else {
        setUsers((current) => current.filter((candidate) => candidate.id !== deleteTarget.id))
        setActivity((current) => current.filter((eventRow) => eventRow.user_id !== deleteTarget.id))
        setTransactions((current) => current.filter((transaction) => transaction.user_id !== deleteTarget.id))
        toast.success('User and their data were deleted')
        setDeleteTarget(null)
        setConfirmationEmail('')
      }
    } catch (caughtError) {
      toast.error('User was not deleted', {
        description: caughtError instanceof Error ? caughtError.message : 'The server could not be reached.',
      })
    } finally {
      setPendingUserId('')
    }
  }

  async function logOut() {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) toast.error('Unable to log out', { description: error.message })
    } catch (caughtError) {
      toast.error('Unable to log out', {
        description: caughtError instanceof Error ? caughtError.message : 'The server could not be reached.',
      })
    }
  }

  if (sessionLoading || accessLoading) {
    if (!user && !sessionLoading) return <Navigate to="/login" replace />
    return <main className="admin-state" role="status">Verifying administrator access…</main>
  }

  if (!supabase || pageError && (!user || !isAdmin)) {
    return <main className="admin-state"><Brand /><h1>Admin dashboard unavailable.</h1><p role="alert">{pageError || 'Connect Supabase to continue.'}</p><Link className="button button-dark" to="/login">Go to login <ArrowLeft size={17} /></Link></main>
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return <main className="admin-state"><ShieldCheck size={30} /><h1>Administrator access required.</h1><p>This page is restricted to accounts granted an administrator role.</p><Link className="button button-dark" to="/dashboard">Back to dashboard <ArrowLeft size={17} /></Link></main>
  }

  const suspendedCount = users.filter((candidate) => candidate.is_suspended).length
  const profileName = (userId: string) => {
    const profile = users.find((candidate) => candidate.id === userId)
    return profile?.display_name || profile?.email || 'Deleted or unavailable user'
  }

  if (selectedUserId) {
    const selectedUser = users.find((candidate) => candidate.id === selectedUserId)
    const userBalance = balances.find((balance) => balance.user_id === selectedUserId)
    const detailsLoading = detailsLoadedUserId !== selectedUserId
    const userAccountBalance = (accountName: string) => (userDetails?.transactions ?? [])
      .filter((transaction) => transaction.account_name === accountName && transaction.currency_code === selectedUser?.currency_code)
      .reduce((balance, transaction) => balance + (transaction.direction === 'money_in' ? transaction.amount : -transaction.amount), 0)

    return (
      <main className="admin-page">
        <header className="admin-header">
          <Brand />
          <div className="admin-header-actions">
            <Link to="/admin"><ArrowLeft size={16} /> All users</Link>
            <Link to="/dashboard">User dashboard</Link>
            <button type="button" onClick={() => void logOut()}><LogOut size={16} /> Log out</button>
          </div>
        </header>
        <div className="admin-content">
          {selectedUser ? (
            <>
              <div className="admin-title-row admin-user-detail-title">
                <div><p className="eyebrow"><ShieldCheck size={14} /> USER DETAILS</p><h1>{selectedUser.display_name || 'Unnamed user'}</h1><p>{selectedUser.email}</p></div>
                <span className={`admin-status ${selectedUser.is_suspended ? 'suspended' : 'active'}`}>{selectedUser.is_suspended ? 'Suspended' : 'Active'}</span>
              </div>
              {pageError && <p className="admin-error" role="alert">{pageError}</p>}
              <section className="admin-metrics admin-user-balance-metrics" aria-label="User ledger balances">
                <article><span><Wallet size={18} /> Total balance</span><strong>{formatCurrency(userBalance?.total_balance ?? 0, selectedUser.currency_code || 'USD')}</strong><small>Illustrative ledger only</small></article>
                <article><span><ArrowDownLeft size={18} /> Money in</span><strong>{formatCurrency(userBalance?.money_in ?? 0, selectedUser.currency_code || 'USD')}</strong><small>Recorded deposits</small></article>
                <article><span><ArrowUpRight size={18} /> Money out</span><strong>{formatCurrency(userBalance?.money_out ?? 0, selectedUser.currency_code || 'USD')}</strong><small>Recorded transfers</small></article>
                <article><span><CalendarDays size={18} /> Member since</span><strong>{new Date(selectedUser.created_at).toLocaleDateString()}</strong><small>Profile creation date</small></article>
              </section>
              <p className="admin-data-note">Balances are calculated from illustrative entries in {selectedUser.currency_code || 'the user’s selected currency'}. They do not represent real money.</p>

              <section className="admin-panel admin-profile-details" aria-labelledby="admin-profile-title">
                <div className="admin-panel-heading"><div><p className="eyebrow">PROFILE</p><h2 id="admin-profile-title">Account information</h2></div></div>
                <dl>
                  <div><dt>Full name</dt><dd>{selectedUser.display_name || 'Not provided'}</dd></div>
                  <div><dt>Email</dt><dd>{selectedUser.email || 'Not provided'}</dd></div>
                  <div><dt>Country</dt><dd>{selectedUser.country_name || 'Not provided'}</dd></div>
                  <div><dt>Preferred currency</dt><dd>{selectedUser.currency_code || 'Not provided'}</dd></div>
                  <div><dt>User ID</dt><dd>{selectedUser.id}</dd></div>
                  <div><dt>Status</dt><dd>{selectedUser.is_suspended ? 'Suspended' : 'Active'}</dd></div>
                </dl>
              </section>

              {detailsLoading ? <p className="admin-detail-loading" role="status">Loading user activity…</p> : (
                <div className="admin-lower-grid">
                  <section className="admin-panel" aria-labelledby="admin-user-accounts-title">
                    <div className="admin-panel-heading"><div><p className="eyebrow">BALANCE BY ACCOUNT</p><h2 id="admin-user-accounts-title">Accounts</h2></div></div>
                    <ul className="admin-balance-list">
                      {['Everyday account', 'Savings space'].map((accountName) => <li key={accountName}><span>{accountName}</span><strong>{formatCurrency(userAccountBalance(accountName), selectedUser.currency_code || 'USD')}</strong></li>)}
                    </ul>
                  </section>
                  <section className="admin-panel" aria-labelledby="admin-user-ledger-title">
                    <div className="admin-panel-heading"><div><p className="eyebrow">ACCOUNT HISTORY</p><h2 id="admin-user-ledger-title">Ledger entries</h2></div><span>{userDetails?.transactions.length ?? 0}</span></div>
                    <ul className="admin-event-list">
                      {userDetails?.transactions.map((transaction) => <li key={transaction.id}><span className={`admin-event-icon ${transaction.direction}`} aria-hidden="true">{transaction.direction === 'money_in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span><strong>{transaction.direction === 'money_in' ? '+' : '−'}{formatCurrency(transaction.amount, transaction.currency_code)}</strong><small>{transaction.account_name} · {transaction.transfer_method} · {new Date(transaction.created_at).toLocaleString()}</small><small>Recipient/source: {transaction.destination}</small></span></li>)}
                      {!userDetails?.transactions.length && <li className="admin-empty">No ledger entries recorded.</li>}
                    </ul>
                  </section>
                  <section className="admin-panel" aria-labelledby="admin-user-events-title">
                    <div className="admin-panel-heading"><div><p className="eyebrow">PROFILE HISTORY</p><h2 id="admin-user-events-title">Activity events</h2></div><span>{userDetails?.activity.length ?? 0}</span></div>
                    <ul className="admin-event-list">
                      {userDetails?.activity.map((eventRow) => <li key={eventRow.id}><span className="admin-event-icon"><UserRound size={16} /></span><span><strong>{eventRow.event_type.replaceAll('_', ' ')}</strong><small>{new Date(eventRow.created_at).toLocaleString()}</small><small>{eventRow.description}</small></span></li>)}
                      {!userDetails?.activity.length && <li className="admin-empty">No activity events recorded.</li>}
                    </ul>
                  </section>
                </div>
              )}
            </>
          ) : pageLoading ? <p className="admin-detail-loading" role="status">Loading user profile…</p> : <section className="admin-panel"><h1>User not found</h1><p>This profile may have been deleted or is not available.</p><Link to="/admin">Return to all users</Link></section>}
        </div>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Brand />
        <div className="admin-header-actions">
          <Link to="/dashboard"><ArrowLeft size={16} /> User dashboard</Link>
          <button type="button" onClick={() => void logOut()}><LogOut size={16} /> Log out</button>
        </div>
      </header>

      <div className="admin-content">
        <div className="admin-title-row">
          <div><p className="eyebrow"><ShieldCheck size={14} /> ADMINISTRATION</p><h1>Admin dashboard</h1><p>Manage user access and review illustrative account activity.</p></div>
          <span className="admin-access-badge"><span /> Protected admin access</span>
        </div>

        {pageError && <p className="admin-error" role="alert">{pageError}</p>}

        <section className="admin-metrics" aria-label="User overview">
          <article><span><Users size={18} /> Total users</span><strong>{pageLoading ? '—' : users.length}</strong><small>All registered profiles</small></article>
          <article><span><UserRound size={18} /> Active users</span><strong>{pageLoading ? '—' : users.length - suspendedCount}</strong><small>Not currently suspended</small></article>
          <article><span><UserX size={18} /> Suspended</span><strong>{pageLoading ? '—' : suspendedCount}</strong><small>Access restricted</small></article>
          <article><span><Wallet size={18} /> Ledger activity</span><strong>{pageLoading ? '—' : transactions.length}</strong><small>Recent illustrative entries</small></article>
        </section>

        <section className="admin-panel" aria-labelledby="admin-users-title">
          <div className="admin-panel-heading">
            <div><p className="eyebrow">USER MANAGEMENT</p><h2 id="admin-users-title">All users</h2></div>
            <label className="admin-search"><Search size={16} /><span className="sr-only">Search users</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or country" /></label>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-user-table">
              <thead><tr><th>User</th><th>Country</th><th>Currency</th><th>Total balance</th><th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visibleUsers.map((candidate) => (
                  <tr key={candidate.id}>
                    <td><Link className="admin-user-link" to={`/admin/users/${candidate.id}`}><strong>{candidate.display_name || 'Unnamed user'}</strong><small>{candidate.email}</small></Link></td>
                    <td>{candidate.country_name || '—'}</td>
                    <td>{candidate.currency_code || '—'}</td>
                    <td className="admin-user-balance">{formatCurrency(balances.find((balance) => balance.user_id === candidate.id)?.total_balance ?? 0, candidate.currency_code || 'USD')}<small>Illustrative</small></td>
                    <td>{new Date(candidate.created_at).toLocaleDateString()}</td>
                    <td><span className={`admin-status ${candidate.is_suspended ? 'suspended' : 'active'}`}>{candidate.is_suspended ? 'Suspended' : 'Active'}</span></td>
                    <td className="admin-user-actions">
                      <button type="button" disabled={pendingUserId === candidate.id || candidate.id === user.id} onClick={() => void toggleSuspension(candidate)}>
                        <UserX size={15} /> {candidate.is_suspended ? 'Restore' : 'Suspend'}
                      </button>
                      <button className="delete" type="button" disabled={pendingUserId === candidate.id || candidate.id === user.id} onClick={() => { setDeleteTarget(candidate); setConfirmationEmail('') }}>
                        <Trash2 size={15} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!pageLoading && visibleUsers.length === 0 && <tr><td className="admin-empty-row" colSpan={7}>{query ? 'No users match that search.' : 'No user profiles found.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="admin-data-note">Suspension blocks account activity. Deletion permanently removes the account, activity, and illustrative ledger entries and cannot be undone.</p>
        </section>

        <div className="admin-lower-grid">
          <section className="admin-panel" aria-labelledby="admin-activity-title">
            <div className="admin-panel-heading"><div><p className="eyebrow">LATEST EVENTS</p><h2 id="admin-activity-title">Activity</h2></div><span>{activity.length} recent</span></div>
            <ul className="admin-event-list">
              {activity.map((eventRow) => <li key={eventRow.id}><span className="admin-event-icon"><UserRound size={16} /></span><span><strong>{eventRow.event_type.replaceAll('_', ' ')}</strong><small>{profileName(eventRow.user_id)} · {new Date(eventRow.created_at).toLocaleString()}</small><small>{eventRow.description}</small></span></li>)}
              {!pageLoading && activity.length === 0 && <li className="admin-empty">No recent activity.</li>}
            </ul>
          </section>
          <section className="admin-panel" aria-labelledby="admin-transactions-title">
            <div className="admin-panel-heading"><div><p className="eyebrow">ILLUSTRATIVE LEDGER</p><h2 id="admin-transactions-title">Transactions</h2></div><span>{transactions.length} recent</span></div>
            <ul className="admin-event-list">
              {transactions.map((transaction) => <li key={transaction.id}><span className={`admin-event-icon ${transaction.direction}`} aria-hidden="true">{transaction.direction === 'money_in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span><strong>{transaction.direction === 'money_in' ? '+' : '−'}{formatCurrency(Number(transaction.amount), transaction.currency_code)}</strong><small>{profileName(transaction.user_id)} · {transaction.account_name} · {transaction.transfer_method}</small><small>{new Date(transaction.created_at).toLocaleString()} · To {transaction.destination}</small></span></li>)}
              {!pageLoading && transactions.length === 0 && <li className="admin-empty">No illustrative transactions recorded.</li>}
            </ul>
            <p className="admin-data-note">Amounts use user-selected currencies. Totals across currencies are intentionally not combined.</p>
          </section>
        </div>
      </div>

      {deleteTarget && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && pendingUserId !== deleteTarget.id) setDeleteTarget(null) }}>
          <section className="admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="admin-delete-title">Delete this user?</h2>
            <p>This permanently deletes <strong>{deleteTarget.email}</strong> and cascades their profile, activity history, and illustrative ledger entries. This cannot be undone.</p>
            <form onSubmit={(event) => void deleteUser(event)}>
              <label htmlFor="admin-confirm-email">Type the user’s email address to confirm</label>
              <input id="admin-confirm-email" type="email" autoComplete="off" required value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} />
              <div><button className="admin-cancel-button" type="button" disabled={pendingUserId === deleteTarget.id} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="admin-confirm-delete" type="submit" disabled={pendingUserId === deleteTarget.id || confirmationEmail.trim() !== deleteTarget.email}>{pendingUserId === deleteTarget.id ? 'Deleting…' : 'Delete permanently'}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
