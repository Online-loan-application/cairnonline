import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, CircleAlert, LoaderCircle } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Brand } from '../components/Brand'
import { depositMethods, getTransferMethod, transferMethods } from '../lib/transferMethods'
import { supabase } from '../lib/supabase'
import './AccountActionPage.css'

type AccountName = 'Everyday account' | 'Savings space'
type Direction = 'money_in' | 'money_out'
type LedgerRow = {
  id: number
  direction: Direction
  account_name: AccountName
  amount: number
  currency_code: string
  transfer_method: string
  destination: string
  created_at: string
}

const accounts: AccountName[] = ['Everyday account', 'Savings space']

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(value)
}

export default function AccountActionPage() {
  const location = useLocation()
  const action = location.pathname.endsWith('/deposit') ? 'deposit' : 'transfer'
  const direction: Direction = action === 'deposit' ? 'money_in' : 'money_out'
  const urlMethod = new URLSearchParams(location.search).get('method')
  const selectedMethod = getTransferMethod(urlMethod)
  const [userId, setUserId] = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase))
  const [pageLoading, setPageLoading] = useState(Boolean(supabase))
  const [pageError, setPageError] = useState(supabase ? '' : 'Supabase is not configured.')
  const [saving, setSaving] = useState(false)
  const [transactions, setTransactions] = useState<LedgerRow[]>([])
  const [accountName, setAccountName] = useState<AccountName>(accounts[0])
  const [depositMethod, setDepositMethod] = useState('Cash deposit')
  const [savedTransaction, setSavedTransaction] = useState<LedgerRow | null>(null)

  useEffect(() => {
    if (!supabase) return

    let active = true
    const client = supabase
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setPageError(error.message)
      if (data.session?.user) setUserId(data.session.user.id)
      setSessionLoading(false)
    }).catch((caughtError: unknown) => {
      if (!active) return
      setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to verify your sign-in.')
      setSessionLoading(false)
    })

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUserId(session?.user.id ?? '')
      setSessionLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || !userId || !supabase) return
    let active = true
    const client = supabase
    async function loadAccount() {
      try {
        const [profileResult, transactionResult] = await Promise.all([
          client.from('profiles').select('currency_code, is_suspended').eq('id', userId).maybeSingle(),
          client.from('account_transactions')
            .select('id, direction, account_name, amount, currency_code, transfer_method, destination, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }),
        ])
        if (!active) return
        if (profileResult.error) throw profileResult.error
        if (transactionResult.error) throw transactionResult.error
        if (profileResult.data?.is_suspended) {
          setPageError('This account is suspended. Contact support for assistance.')
          return
        }
        if (typeof profileResult.data?.currency_code === 'string' && /^[A-Z]{3}$/.test(profileResult.data.currency_code)) {
          setCurrencyCode(profileResult.data.currency_code)
        }
        setTransactions((transactionResult.data ?? []).map((row) => ({
          ...row,
          amount: Number(row.amount),
        })) as LedgerRow[])
      } catch (caughtError) {
        if (active) setPageError(caughtError instanceof Error ? caughtError.message : 'Unable to load your account.')
      } finally {
        if (active) {
          setSessionLoading(false)
          setPageLoading(false)
        }
      }
    }
    void loadAccount()
    return () => {
      active = false
    }
  }, [sessionLoading, userId])

  const accountBalance = useMemo(() => transactions
    .filter((transaction) => transaction.account_name === accountName && transaction.currency_code === currencyCode)
    .reduce((balance, transaction) => balance + (transaction.direction === 'money_in' ? transaction.amount : -transaction.amount), 0),
  [accountName, currencyCode, transactions])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId) return
    const data = new FormData(event.currentTarget)
    const amount = Number(data.get('amount'))
    let destination: string
    let method: string

    if (action === 'deposit') {
      method = depositMethod
      destination = String(data.get('deposit_note') ?? '').trim() || 'Illustrative deposit'
    } else {
      method = selectedMethod.name
      const values = Object.fromEntries(
        selectedMethod.fields.map((field) => [field.name, String(data.get(field.name) ?? '').trim()]),
      )
      destination = selectedMethod.makeDestination(values)
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      toast.error('Enter an amount greater than zero and no more than 10,000,000.')
      return
    }
    if (destination.length > 100) {
      toast.error('The recipient details are too long. Shorten them and try again.')
      return
    }
    if (action === 'transfer' && amount > accountBalance) {
      toast.error('The amount exceeds the available balance in this account.')
      return
    }

    setSaving(true)
    try {
      const { data: result, error } = await supabase.rpc('record_account_transaction', {
        p_direction: direction,
        p_account_name: accountName,
        p_amount: amount,
        p_currency_code: currencyCode,
        p_transfer_method: method,
        p_destination: destination,
      })
      if (error) throw error
      const row = Array.isArray(result) ? result[0] : result
      if (!row || typeof row !== 'object') throw new Error('The saved entry could not be verified.')
      const transaction = { ...row, amount: Number(row.amount) } as LedgerRow
      setTransactions((current) => [transaction, ...current])
      setSavedTransaction(transaction)
      toast.success(`${action === 'deposit' ? 'Deposit' : 'Transfer'} recorded`, {
        description: 'Illustrative entry only. No real funds moved.',
      })
    } catch (caughtError) {
      toast.error('Could not record this entry', {
        description: caughtError instanceof Error ? caughtError.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (sessionLoading) {
    return <main className="account-action-state" role="status"><LoaderCircle className="account-action-spinner" size={24} /> Loading account…</main>
  }
  if (!supabase) return <main className="account-action-state"><Brand /><h1>Account actions unavailable.</h1><p role="alert">{pageError}</p><Link className="button button-dark" to="/login">Go to login</Link></main>
  if (!userId) return <Navigate to="/login" replace />
  if (pageLoading) return <main className="account-action-state" role="status"><LoaderCircle className="account-action-spinner" size={24} /> Loading account…</main>
  if (pageError) return <main className="account-action-state"><Brand /><h1>Could not open this page.</h1><p role="alert">{pageError}</p><Link className="button button-dark" to="/dashboard">Back to dashboard</Link></main>

  return (
    <main className="account-action-page">
      <header className="account-action-header">
        <Brand />
        <Link to="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link>
      </header>
      <div className="account-action-content">
        <div className="account-action-heading">
          <p className="eyebrow">{action === 'deposit' ? 'MONEY IN' : 'MONEY OUT'}</p>
          <h1>{savedTransaction ? 'Entry recorded.' : action === 'deposit' ? 'Deposit' : 'Transfer'}</h1>
          <p>{savedTransaction ? 'Your illustrative ledger was updated.' : action === 'deposit' ? 'Record an illustrative deposit to one of your accounts.' : `Choose a route and enter the recipient details for your ${selectedMethod.name} transfer.`}</p>
        </div>

        <div className="account-action-disclosure"><CircleAlert size={18} /><p><strong>Illustrative only.</strong> This app is not a bank and does not connect to payment services. Use fictional details only; never enter real account numbers, credentials, wallet keys, or payment information.</p></div>

        {savedTransaction ? (
          <section className="account-action-panel account-action-success" aria-live="polite">
            <span className="account-action-success-icon"><Check size={25} /></span>
            <h2>{savedTransaction.direction === 'money_in' ? 'Deposit' : 'Transfer'} recorded</h2>
            <strong>{savedTransaction.direction === 'money_in' ? '+' : '−'}{formatCurrency(savedTransaction.amount, savedTransaction.currency_code)}</strong>
            <p>{savedTransaction.account_name} · {savedTransaction.transfer_method}</p>
            <Link className="button button-dark" to="/dashboard/activity">View activity</Link>
          </section>
        ) : (
          <div className="account-action-columns">
            {action === 'transfer' && (
              <section className="account-action-panel account-route-panel" aria-labelledby="transfer-method-heading">
                <div className="account-action-panel-heading"><p className="eyebrow">SELECT A ROUTE</p><h2 id="transfer-method-heading">Transfer method</h2></div>
                <div className="account-route-grid">
                  {transferMethods.map(({ name, description, icon: Icon }) => (
                    <Link
                      className={`account-route-card ${selectedMethod.name === name ? 'active' : ''}`}
                      key={name}
                      to={`/dashboard/transfer?method=${encodeURIComponent(name)}`}
                      aria-current={selectedMethod.name === name ? 'true' : undefined}
                    >
                      <span><Icon size={22} /></span><strong>{name}</strong><small>{description}</small>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="account-action-panel account-form-panel" aria-labelledby="account-form-heading">
              <div className="account-action-panel-heading"><p className="eyebrow">{action === 'deposit' ? 'DEPOSIT DETAILS' : selectedMethod.description.toUpperCase()}</p><h2 id="account-form-heading">{action === 'deposit' ? 'Add a ledger entry' : `${selectedMethod.name} details`}</h2></div>
              <form className="account-action-form" onSubmit={(event) => void submit(event)}>
                <label htmlFor="account-action-account">{action === 'deposit' ? 'Deposit to account' : 'Transfer from account'}</label>
                <select id="account-action-account" value={accountName} onChange={(event) => setAccountName(event.target.value as AccountName)}>
                  {accounts.map((name) => <option key={name}>{name}</option>)}
                </select>
                {action === 'transfer' && <p className="account-action-available">Illustrative available balance: <strong>{formatCurrency(accountBalance, currencyCode)}</strong></p>}

                {action === 'deposit' ? (
                  <>
                    <label htmlFor="deposit-method">Deposit method</label>
                    <select id="deposit-method" value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)}>
                      {depositMethods.map((method) => <option key={method}>{method}</option>)}
                    </select>
                    <label htmlFor="deposit-note">Source or reference <span>Optional</span></label>
                    <input id="deposit-note" name="deposit_note" type="text" maxLength={100} placeholder="Fictional source or note" />
                  </>
                ) : (
                  <div className="account-method-fields">
                    {selectedMethod.fields.map((field) => (
                      <div className="account-method-field" key={field.name}>
                        <label htmlFor={`transfer-${field.name}`}>{field.label}</label>
                        {field.options ? (
                          <select id={`transfer-${field.name}`} name={field.name} defaultValue={field.options[0]} required>
                            {field.options.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        ) : (
                          <input
                            id={`transfer-${field.name}`}
                            name={field.name}
                            type={field.type ?? 'text'}
                            inputMode={field.inputMode}
                            autoComplete="off"
                            maxLength={field.maxLength}
                            placeholder={field.placeholder}
                            required
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <label htmlFor="account-action-amount">Amount ({currencyCode})</label>
                <div className="account-action-amount"><span>{currencyCode}</span><input id="account-action-amount" name="amount" type="number" min="0.000001" max="10000000" step="any" placeholder="0.00" required /></div>
                <button className="button button-dark" type="submit" disabled={saving}>
                  {saving ? 'Recording…' : action === 'deposit' ? 'Record deposit' : 'Record transfer'}
                  {action === 'deposit' ? <ArrowDownToLine size={17} /> : <ArrowUpRight size={17} />}
                </button>
                <small className="account-action-form-note">No money will be moved. Only this illustrative ledger entry is saved.</small>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
