const swatches = [
  { name: 'peach', className: 'bg-peach' },
  { name: 'mint', className: 'bg-mint' },
  { name: 'lavender', className: 'bg-lavender' },
  { name: 'butter', className: 'bg-butter' },
  { name: 'sky', className: 'bg-sky' },
  { name: 'rose', className: 'bg-rose' },
]

function App() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="font-hand text-6xl font-bold">Planner Hub</h1>
        <p className="mt-1 text-ink-soft">Your cozy little corner for to-dos, notes, and plans.</p>
      </header>

      {/* Placeholder sticky note until the grid editor exists. */}
      <section
        aria-label="Welcome note"
        className="max-w-sm -rotate-1 rounded-sm bg-butter p-6 shadow-[2px_3px_0_rgb(61_53_80/0.15)]"
      >
        <h2 className="font-hand text-3xl">Nothing here yet!</h2>
        <p className="mt-2">Widgets will live on this page soon.</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Palette">
          {swatches.map((s) => (
            <li key={s.name} className={`${s.className} rounded-full px-3 py-1 text-sm`}>
              {s.name}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
