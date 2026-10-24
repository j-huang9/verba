// Routes (lib/router.ts).
import { Screen } from './components/Screen'
import { VoiceSetup } from './components/VoiceSetup'
import { navigate, useRoute } from './lib/router'
import { usePatient } from './lib/store'
import Home from './pages/Home'
import Log from './pages/Log'
import NewPatient from './pages/NewPatient'
import PatientPage from './pages/PatientPage'
import Talk from './pages/Talk'
import Teach from './pages/Teach'

function VoicePage({ id }: { id: string }) {
  const p = usePatient(id)
  return (
    <Screen back={`/p/${id}`} title={p ? `${p.preferredName || p.name}’s voice` : 'Their voice'}>
      <div className="mt-6">
        <VoiceSetup patientId={id} onDone={() => navigate(`/p/${id}`, { replace: true })} />
      </div>
    </Screen>
  )
}

export default function App() {
  const route = useRoute()
  switch (route.name) {
    case 'home':
      return <Home />
    case 'new':
      return <NewPatient />
    case 'patient':
      return <PatientPage id={route.id} />
    case 'talk':
      return <Talk id={route.id} board={route.board} />
    case 'teach':
      return <Teach id={route.id} />
    case 'voice':
      return <VoicePage id={route.id} />
    case 'log':
      return <Log id={route.id} />
  }
}
