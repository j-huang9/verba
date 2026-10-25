// Routes (lib/router.ts) and the tab bar. The app opens on Talk with the last patient,
// or on Patients when there are none. Teach is a full-screen camera page with no tab bar.
import { Screen } from './components/Screen'
import { TabBar } from './components/TabBar'
import type { Tab } from './lib/tabBar'
import { VoiceSetup } from './components/VoiceSetup'
import { navigate, useRoute } from './lib/router'
import { usePatient, usePatients } from './lib/store'
import Log from './pages/Log'
import NewPatient from './pages/NewPatient'
import PatientPage from './pages/PatientPage'
import Patients from './pages/Patients'
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
  const hasPatients = usePatients().length > 0

  let page: React.ReactNode
  let tab: Tab | null
  switch (route.name) {
    case 'home':
      page = hasPatients ? <Talk id={null} board={false} /> : <Patients />
      tab = hasPatients ? 'talk' : 'patients'
      break
    case 'patients':
      page = <Patients />
      tab = 'patients'
      break
    case 'new':
      page = <NewPatient />
      tab = 'patients'
      break
    case 'patient':
      page = <PatientPage id={route.id} />
      tab = 'patients'
      break
    case 'voice':
      page = <VoicePage id={route.id} />
      tab = 'patients'
      break
    case 'talk':
      page = <Talk id={route.id} board={route.board} />
      tab = 'talk'
      break
    case 'log':
      page = <Log id={route.id} />
      tab = 'log'
      break
    case 'teach':
      page = <Teach id={route.id} />
      tab = null
      break
  }
  return (
    <>
      {page}
      {tab && <TabBar active={tab} />}
    </>
  )
}
