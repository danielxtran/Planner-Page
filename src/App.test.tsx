import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the hub heading and the to-do widget', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Planner Hub' })).toBeInTheDocument()
    // Waiting for the empty state means the initial task load has finished.
    expect(await screen.findByText('Nothing to do. Enjoy it!')).toBeInTheDocument()
  })
})
