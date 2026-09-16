import { Switch, Route } from 'wouter'
import HomePage from './pages/home-page'
import AuthPage from './pages/auth-page'
import LandingPage from './pages/landing-page'
import SupportResult from './pages/support-result'

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-100">404</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-800">Página no encontrada</h1>
      <p className="mt-1 text-gray-500 text-sm">La URL que buscas no existe.</p>
      <a href="/" className="mt-6 btn-primary">
        Volver al inicio
      </a>
    </div>
  )
}

function App() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/app" component={HomePage} />
      <Route path="/apoyo/resultado" component={SupportResult} />
      <Route component={NotFound} />
    </Switch>
  )
}

export default App
