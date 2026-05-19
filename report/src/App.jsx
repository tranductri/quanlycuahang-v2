import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/supabase'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'

const AUTH_KEY = 'ca_auth'
const GIS_CLIENT_ID = '570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })
  const [authError, setAuthError] = useState('')

  const handleCredential = useCallback(async (resp) => {
    setAuthError('')
    try {
      const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${resp.credential}`)
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
      window.google?.accounts.id.initialize({ client_id: GIS_CLIENT_ID, callback: handleCredential })
      window.google?.accounts.id.renderButton(document.getElementById('g-btn'), { theme: 'outline', size: 'large' })
    }
    if (window.google) init()
    else window.addEventListener('load', init)
    return () => window.removeEventListener('load', init)
  }, [user, handleCredential])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }, [])

  if (!user) return <Login error={authError} />
  return <Dashboard user={user} onLogout={handleLogout} />
}
