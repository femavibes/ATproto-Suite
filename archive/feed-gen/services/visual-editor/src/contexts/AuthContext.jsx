import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const AuthContext = createContext(null)
const REQUIRED_OAUTH_SCOPE = 'atproto repo:app.bsky.feed.generator transition:generic'

function getAuthEnvironmentError() {
  const hasCrypto = typeof window !== 'undefined' && typeof window.crypto !== 'undefined'
  const hasSubtle = hasCrypto && !!window.crypto.subtle
  const secure = typeof window !== 'undefined' && !!window.isSecureContext
  if (hasSubtle && secure) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : '(unknown origin)'
  return (
    `Bluesky OAuth requires WebCrypto (crypto.subtle) in a secure context. ` +
    `Current origin: ${origin}. Use https in production, or run local dev at ` +
    `http://127.0.0.1:3000 (or http://localhost) instead of plain-IP/http custom domains.`
  )
}

async function syncBackendSession(session) {
  const ts = await session.getTokenSet(false)
  const origin = window.location.origin
  const r = await fetch(`${origin}/api/auth/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessJwt: ts.access_token,
      tokenType: ts.token_type || 'DPoP',
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || `Session sync failed (${r.status})`)
  }
}

export function AuthProvider({ children }) {
  const [did, setDid] = useState(null)
  const [handle, setHandle] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [handleInput, setHandleInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [oauthClient, setOauthClient] = useState(null)
  const [error, setError] = useState(null)

  const refreshMe = useCallback(async () => {
    const r = await fetch(`${window.location.origin}/api/auth/me`, {
      credentials: 'include',
    })
    if (r.ok) {
      const j = await r.json()
      setDid(j.did || null)
      setHandle(j.handle || null)
      setAvatar(j.avatar || null)
    } else {
      setDid(null)
      setHandle(null)
      setAvatar(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const envErr = getAuthEnvironmentError()
        if (envErr) {
          setError(envErr)
          return
        }
        const { BrowserOAuthClient } = await import('@atproto/oauth-client-browser')
        const origin = window.location.origin
        const client = await BrowserOAuthClient.load({
          clientId: `${origin}/oauth/client-metadata.json`,
          handleResolver: 'https://bsky.social',
        })
        if (cancelled) return
        setOauthClient(client)

        const result = await client.init()
        if (cancelled) return

        if (result?.session) {
          try {
            await syncBackendSession(result.session)
          } catch (e) {
            console.warn('Could not sync OAuth session to app backend:', e)
            setError(
              e instanceof Error ? e.message : 'Could not establish server session'
            )
          }
        }
        await refreshMe()
      } catch (e) {
        console.error(e)
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.toLowerCase().includes('crypto') || msg.toLowerCase().includes('subtle')) {
          setError(getAuthEnvironmentError() || msg)
        } else {
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMe])

  const login = useCallback(async () => {
    if (!oauthClient || !handleInput.trim()) return
    setError(null)
    try {
      const normalizedHandle = handleInput.trim().replace(/^@+/, '').toLowerCase()
      const precheck = await fetch(`${window.location.origin}/api/auth/allowlist-check`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: normalizedHandle }),
      })
      if (!precheck.ok) {
        let detail = `Login not allowed (${precheck.status})`
        try {
          const payload = await precheck.json()
          detail = payload?.detail || detail
        } catch {
          // Keep fallback message if body is not JSON.
        }
        throw new Error(detail)
      }
      await oauthClient.signIn(handleInput.trim(), {
        prompt: 'consent',
        scope: REQUIRED_OAUTH_SCOPE,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [oauthClient, handleInput])

  const logout = useCallback(async () => {
    setError(null)
    try {
      await fetch(`${window.location.origin}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.warn(e)
    }
    if (oauthClient && did) {
      try {
        await oauthClient.revoke(did)
      } catch (e) {
        console.warn(e)
      }
    }
    setDid(null)
    setHandle(null)
    setAvatar(null)
    await refreshMe()
  }, [oauthClient, did, refreshMe])

  const value = useMemo(
    () => ({
      did,
      handle,
      avatar,
      loading,
      error,
      handleInput,
      setHandleInput,
      login,
      logout,
      oauthReady: !!oauthClient,
      getOAuthSession: async () => {
        if (!oauthClient || !did) return null
        return await oauthClient.restore(did)
      },
    }),
    [did, handle, avatar, loading, error, handleInput, login, logout, oauthClient]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
