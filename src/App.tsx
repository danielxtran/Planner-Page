import { TodoWidget } from './widgets/todo/TodoWidget'

function App() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="font-hand text-6xl font-bold">Planner Hub</h1>
        <p className="mt-1 text-ink-soft">Your cozy little corner for to-dos, notes, and plans.</p>
      </header>

      {/* Single widget until the grid editor (milestone 3) arranges them. */}
      <div className="max-w-md">
        <TodoWidget />
      </div>
    </main>
  )
}

export default App
