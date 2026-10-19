import { useEffect } from 'react'
import { Sidebar, TopBar } from './components/Layout'
import Toaster from './components/Toaster'
import { resumePending } from './lib/pipeline'
import { useRoute } from './lib/router'
import AnalysisDetail from './screens/AnalysisDetail'
import AnalysisList from './screens/AnalysisList'
import CandidateProfile from './screens/CandidateProfile'
import Cvtheque from './screens/Cvtheque'
import Dashboard from './screens/Dashboard'
import DesignSystem from './screens/DesignSystem'
import OfferCriteria from './screens/OfferCriteria'
import SearchScreen from './screens/Search'
import Settings from './screens/Settings'
import UploadScreen from './screens/Upload'

function Screen() {
  const { parts } = useRoute()
  const [root, id] = parts
  switch (root) {
    case undefined: return <Dashboard />
    case 'cvtheque': return <Cvtheque />
    case 'candidats': return id ? <CandidateProfile key={id} id={id} /> : <Cvtheque />
    case 'import': return <UploadScreen />
    case 'recherche': return <SearchScreen />
    case 'criteres': return <OfferCriteria />
    case 'analyses': return id ? <AnalysisDetail key={id} id={id} /> : <AnalysisList />
    case 'parametres': return <Settings />
    case 'design': return <DesignSystem />
    default: return <Dashboard />
  }
}

export default function App() {
  useEffect(() => { resumePending() }, [])
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          <Screen />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
