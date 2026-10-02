import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './hooks/useAuth'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => (err?.status && err.status < 500 ? false : count < 2),
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
