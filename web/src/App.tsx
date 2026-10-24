import { BrowserRouter, Route, Routes } from 'react-router'
import BedsideScreen from './pages/BedsideScreen'
import FamilyView from './pages/FamilyView'
import NurseView from './pages/NurseView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BedsideScreen />} />
        <Route path="/nurse" element={<NurseView />} />
        <Route path="/family" element={<FamilyView />} />
      </Routes>
    </BrowserRouter>
  )
}
