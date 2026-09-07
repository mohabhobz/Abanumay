import { useState } from 'react'
import ProjectScreen from './screens/ProjectScreen.jsx'
import ChatScreen from './screens/ChatScreen.jsx'

export default function App() {
  const [view, setView] = useState('project')
  return view === 'chat'
    ? <ChatScreen onExit={() => setView('project')} />
    : <ProjectScreen onOpenChat={() => setView('chat')} />
}
