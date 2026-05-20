import { useState, useEffect, useCallback, Component } from 'react'
import { db } from '@/lib/supabase'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'

const AUTH_KEY = 'ca_auth'
const GIS_CLIENT_ID = '570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="text-center p-8">
            <p className="text-sm text-red-600 font-medium">Lỗi ứng dụng</p>
            <p className="text-xs text-zinc-400 mt-1">{String(this.state.error)}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })
  const [authError, setAuthError] = useState('')

  const handleCredential = useCallback(async (resp) => {
    setAuthError('')
    try {
      const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${resp.credential}`)
      if (!res.ok) { setAuthError('Xác thực Google thất bại.'); return }
      const info = await res.json()
      if (!info.email) { setAuthError('Đăng nhập thất bại.'); return }

      const { data } = await db.from('users').select('email').eq('email', info.email).maybeSingle()
      if (!data) { setAuthError('Email không có quyền truy cập.'); return }

      const authUser = { email: info.email, name: info.name, picture: info.picture }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)
    } catch {
      setAuthError('Có lỗi xảy ra, vui lòng thử lại.')
    }
  }, [])

  useEffect(() => {
    if (user) return
    const init = () => {
      if (!window.google) return
      window.google.accounts.id.initialize({ client_id: GIS_CLIENT_ID, callback: handleCredential })
      const btn = document.getElementById('g-btn')
      if (btn) window.google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large' })
    }
    if (window.google) {
      init()
    } else {
      // Listen on the GIS script element directly (more reliable than window.load)
      const gisScript = document.querySelector('script[src*="accounts.google.com/gsi"]')
      if (gisScript) {
        gisScript.addEventListener('load', init)
        return () => gisScript.removeEventListener('load', init)
      }
      window.addEventListener('load', init)
      return () => window.removeEventListener('load', init)
    }
  }, [user, handleCredential])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }, [])

  if (!user) return <Login error={authError} />
  return <Dashboard user={user} onLogout={handleLogout} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
