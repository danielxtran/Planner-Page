import { Hub } from './layout/Hub'

function App() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="font-hand text-6xl font-bold">Planner Hub</h1>
        <p className="mt-1 text-ink-soft">Your cozy little corner for to-dos, notes, and plans.</p>
      </header>
      <Hub />
    </main>
  )
}

export default App
