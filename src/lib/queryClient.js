import { QueryClient } from '@tanstack/react-query'

async function throwIfResNotOk(res) {
  if (!res.ok) {
    let message = res.statusText
    let code
    try {
      const body = await res.clone().json()
      if (body?.message) message = body.message
      if (body?.code) code = body.code
    } catch {
      try {
        const text = await res.text()
        if (text) message = text
      } catch {
        // ignore
      }
    }
    const error = new Error(message)
    if (code) error.code = code
    error.status = res.status
    throw error
  }
}

export async function apiRequest(method, url, data) {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  })
  await throwIfResNotOk(res)
  return res
}

export function getQueryFn({ on401 }) {
  return async ({ queryKey }) => {
    const res = await fetch(queryKey[0], { credentials: 'include' })

    if (on401 === 'returnNull' && res.status === 401) {
      return null
    }

    await throwIfResNotOk(res)
    return res.json()
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})
