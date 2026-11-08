import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LayoutDashboard, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Brand, CairnMark } from '../components/Brand'
import { countries, type Country } from '../lib/countries'
import { supabase } from '../lib/supabase'

type AuthPageProps = {
  mode: 'login' | 'create-account'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate()
  const isCreateAccount = mode === 'create-account'
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [countryListOpen, setCountryListOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(!supabase)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCurrentUserEmail(session?.user.email ?? '')
    })

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setCurrentUserEmail(data.session?.user.email ?? '')
      setSessionChecked(true)
    }).catch((sessionError: unknown) => {
      if (!active) return
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to check your login session.')
      setSessionChecked(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!supabase) {
      const message = 'Supabase is not configured. Add your project URL and publishable key to .env.local, then restart the app.'
      setError(message)
      toast.error('Authentication is unavailable', { description: message })
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email')).trim()
    const password = String(formData.get('password'))

    if (isCreateAccount && !selectedCountry) {
      const message = 'Choose your country to continue.'
      setError(message)
      toast.error(message)
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (isCreateAccount) {
        const displayName = String(formData.get('displayName')).trim()
        const country = selectedCountry
        if (!country) throw new Error('Choose your country to continue.')

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              country_code: country.code,
              country_name: country.name,
              currency_code: country.currencyCode,
              currency_name: country.currencyName,
            },
            emailRedirectTo: window.location.origin,
          },
        })

        if (signUpError) throw signUpError

        if (data.session) {
          toast.success('Your account is ready.')
          navigate('/dashboard', { replace: true })
          form.reset()
          setSelectedCountry(null)
          setCountrySearch('')
        } else {
          const message = 'Supabase created the account but did not start a session. Check that email confirmation is disabled in Authentication settings, then check Supabase Auth logs if the issue continues.'
          setError(message)
          toast.error('Account created, but sign-in did not start', { description: message })
        }
        return
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      const { error: activityError } = await supabase.from('user_activity').insert({
        user_id: signInData.user.id,
        event_type: 'signed_in',
        description: 'You signed in to your Cairn account.',
      })
      if (activityError) {
        toast.error('Sign-in activity could not be recorded', {
          description: `${activityError.message}. Apply supabase/activity_notifications.sql to enable activity history.`,
        })
      } else {
        toast.success('Welcome back.')
      }
      navigate('/dashboard', { replace: true })
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Authentication failed. Please try again.'
      setError(message)
      toast.error('Authentication failed', { description: message })
    } finally {
      setBusy(false)
    }
  }

  async function logOut() {
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        toast.error('Sign-out activity could not be recorded', { description: sessionError.message })
      }
      if (sessionData.session?.user) {
        const { error: activityError } = await supabase.from('user_activity').insert({
          user_id: sessionData.session.user.id,
          event_type: 'sign_out_requested',
          description: 'You requested to sign out of your Cairn account.',
        })
        if (activityError) {
          toast.error('Sign-out activity could not be recorded', {
            description: `${activityError.message}. Apply supabase/activity_notifications.sql to enable activity history.`,
          })
        }
      }
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      toast.success('You have logged out.')
      setMessage('You have logged out.')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to log out. Please try again.'
      setError(message)
      toast.error('Unable to log out', { description: message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Brand />
        <Link className="auth-back-link" to="/"><ArrowLeft size={16} /> Back to home</Link>
      </header>
      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <p className="eyebrow">YOUR WAY FORWARD</p>
          <h1 id="auth-story-title">A clearer view<br />starts <span className="serif">here.</span></h1>
          <p>One calm place for the everyday, the important, and everything you’re working toward.</p>
          <div className="auth-story-mark"><CairnMark light /></div>
          <div className="auth-security-note"><LockKeyhole size={17} /><span>Private by design.<br /><strong>Your details stay yours.</strong></span></div>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">SECURE ACCESS</p>
          <h2 id="auth-title">{isCreateAccount ? 'Begin your journey.' : 'Welcome back.'}</h2>
          <p className="auth-card-intro">{isCreateAccount ? 'Create your Cairn profile to get started.' : 'Log in to continue to your Cairn profile.'}</p>
          {!supabase && <p className="auth-config-message" role="status">Connect your Supabase project to enable account access. See the setup steps in README.md.</p>}
          {currentUserEmail ? (
            <div className="auth-session-message">
              <p>You’re logged in as <strong>{currentUserEmail}</strong>.</p>
              <p>Continue to your account overview. Balances and activity are fictional.</p>
              <Link className="button button-dark auth-submit" to="/dashboard">Open dashboard <LayoutDashboard size={17} /></Link>
              <button className="button button-dark auth-submit" type="button" onClick={logOut} disabled={busy}>{busy ? 'Please wait…' : 'Log out'} <ArrowRight size={17} /></button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {isCreateAccount && (
                <>
                  <label htmlFor="auth-display-name">Your name</label>
                  <input id="auth-display-name" name="displayName" type="text" autoComplete="name" maxLength={100} placeholder="Your name" required disabled={busy || !supabase || !sessionChecked} />
                  <label htmlFor="country-search">Country or currency</label>
                  <div className="country-picker">
                    <input
                      id="country-search"
                      type="search"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={countryListOpen}
                      aria-controls="country-options"
                      aria-describedby="country-currency"
                      autoComplete="off"
                      placeholder="Search countries or currencies"
                      value={countrySearch}
                      disabled={busy || !supabase || !sessionChecked}
                      onFocus={() => setCountryListOpen(true)}
                      onChange={(event) => {
                        setCountrySearch(event.target.value)
                        setSelectedCountry(null)
                        setCountryListOpen(true)
                      }}
                    />
                    {countryListOpen && (
                      <div className="country-options" id="country-options" role="listbox" aria-label="Countries">
                        {countries
                          .filter((country) => `${country.name} ${country.code} ${country.currencyCode} ${country.currencyName}`.toLowerCase().includes(countrySearch.trim().toLowerCase()))
                          .map((country) => (
                            <button
                              className="country-option"
                              key={country.code}
                              type="button"
                              role="option"
                              aria-selected={selectedCountry?.code === country.code}
                              onClick={() => {
                                setSelectedCountry(country)
                                setCountrySearch(country.name)
                                setCountryListOpen(false)
                                setError('')
                              }}
                            >
                              <span>{country.name}</span>
                              <small>{country.currencyName} ({country.currencyCode})</small>
                            </button>
                          ))}
                        {countries.every((country) => !`${country.name} ${country.code} ${country.currencyCode} ${country.currencyName}`.toLowerCase().includes(countrySearch.trim().toLowerCase())) && (
                          <p className="country-no-results">No matching country or currency.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="country-currency" id="country-currency" aria-live="polite">
                    {selectedCountry
                      ? `Currency: ${selectedCountry.currencyName} (${selectedCountry.currencyCode})`
                      : 'Choose your country to set your currency.'}
                  </p>
                </>
              )}
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={busy || !supabase || !sessionChecked} />
              <label htmlFor="auth-password">{isCreateAccount ? 'Create a password' : 'Password'}</label>
              <div className="auth-password-field">
                <input id="auth-password" name="password" type={passwordVisible ? 'text' : 'password'} autoComplete={isCreateAccount ? 'new-password' : 'current-password'} minLength={isCreateAccount ? 8 : undefined} placeholder={isCreateAccount ? 'At least 8 characters' : 'Enter your password'} required disabled={busy || !supabase || !sessionChecked} />
                <button type="button" className="auth-password-toggle" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} disabled={busy}><EyeIcon visible={passwordVisible} /></button>
              </div>
              <button className="button button-dark auth-submit" type="submit" disabled={busy || !supabase || !sessionChecked}>{busy ? 'Please wait…' : isCreateAccount ? 'Create account' : 'Log in'} <ArrowRight size={17} /></button>
            </form>
          )}
          {error && <p className="auth-error-message" role="alert">{error}</p>}
          {message && <p className="auth-status-message" role="status">{message}</p>}
          <p className="auth-status-note"><LockKeyhole size={14} /> Supabase secures your login. This app does not provide real banking services.</p>
          <div className="auth-signup">
            {isCreateAccount ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New to Cairn? <Link to="/create-account">Begin your journey</Link></>}
          </div>
        </section>
      </div>
      <footer className="auth-footer">A concept banking experience. No real accounts or transactions.</footer>
    </main>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? <EyeOff size={19} /> : <Eye size={19} />
}
