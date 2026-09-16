import { createContext, useContext } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getQueryFn, apiRequest, queryClient } from '../lib/queryClient'
import { clearQrDraft } from '../lib/qr-draft'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials) => {
      const res = await apiRequest('POST', '/api/login', credentials)
      return res.json()
    },
    onSuccess: (loggedInUser) => {
      queryClient.removeQueries({ queryKey: ['/api/qrcodes'] })
      queryClient.setQueryData(['/api/user'], loggedInUser)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (credentials) => {
      const res = await apiRequest('POST', '/api/register', credentials)
      return res.json()
    },
    onSuccess: (newUser) => {
      queryClient.removeQueries({ queryKey: ['/api/qrcodes'] })
      queryClient.setQueryData(['/api/user'], newUser)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/logout')
    },
    onSuccess: () => {
      clearQrDraft()
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === '/api/qrcodes' || query.queryKey[0] === '/api/user',
      })
      queryClient.setQueryData(['/api/user'], null)
    },
  })

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        registerMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
