import { useState } from 'react'
import ProjectScreen from './screens/ProjectScreen.jsx'
import ChatScreen from './screens/ChatScreen.jsx'
import LoginScreen from './screens/LoginScreen.jsx'

export default function App() {
  const [view, setView] = useState('login')

  if (view === 'login') return <LoginScreen onDone={() => setView('project')} />
  if (view === 'chat') return <ChatScreen onExit={() => setView('project')} />
  return (
    <ProjectScreen
      onOpenChat={() => setView('chat')}
      onSignOut={() => setView('login')}
    />
  )
}
