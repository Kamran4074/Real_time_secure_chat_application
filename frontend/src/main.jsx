import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthContextProvider } from './features/auth'
import RealtimeProvider from './RealtimeProvider'
import { configureApiClient } from './shared/api/client'

configureApiClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthContextProvider>
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </AuthContextProvider>
  </BrowserRouter>
)
