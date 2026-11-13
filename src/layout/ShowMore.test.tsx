import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hub } from './Hub'

/**
 * jsdom does no layout: every element is 0px tall and ResizeObserver doesn't
 * exist. So this test supplies both: a fake observer it can trigger by hand,
 * and made-up heights for each column's content.
 */
const observed: { element: Element; callback: () => void }[] = []

class FakeResizeObserver {
  callback: () => void
  constructor(callback: () => void) {
    this.callback = callback
  }
  observe(element: Element) {
    observed.push({ element, callback: this.callback })
  }
  disconnect() {
    for (let i = observed.length - 1; i >= 0; i--) {
      if (observed[i].callback === this.callback) observed.splice(i, 1)
    }
  }
  unobserve() {}
}

function setColumnHeights(...heights: number[]) {
  act(() => {
    observed.forEach(({ element, callback }, i) => {
      Object.defineProperty(element, 'offsetHeight', { value: heights[i], configurable: true })
      callback()
    })
  })
}

/** Pretends the window is wide (columns side by side) or narrow (stacked). */
function stubWidth(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: wide, addEventListener: () => {}, removeEventListener: () => {} })),
  )
}

async function twoColumnHub() {
  render(<Hub />)
  await screen.findByRole('heading', { name: 'To-do' })
  fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
  fireEvent.click(screen.getByRole('button', { name: '2 columns, 6 + 6 twelfths' }))
  await screen.findByRole('button', { name: 'Add widget to column 2 of row 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }))
  await waitFor(() => expect(observed).toHaveLength(2))
}

const showMore = () => screen.queryByRole('button', { name: /show more/i })

beforeEach(() => {
  observed.length = 0
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Show more', () => {
  it('cuts a column much taller than its neighbor, and opens and closes it', async () => {
    stubWidth(true)
    await twoColumnHub()
    setColumnHeights(1200, 400)

    const button = await screen.findByRole('button', { name: 'Show more of column 1 of row 1' })
    const clip = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(clip.style.maxHeight).toBe('400px')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(clip.style.maxHeight).toBe('')
    expect(button).toHaveTextContent('Show less')

    fireEvent.click(button)
    expect(clip.style.maxHeight).toBe('400px')
  })

  it('leaves columns alone when they are close in height', async () => {
    stubWidth(true)
    await twoColumnHub()
    setColumnHeights(450, 400)
    expect(showMore()).toBeNull()
  })

  it('never cuts on a narrow screen, where columns stack', async () => {
    stubWidth(false)
    await twoColumnHub()
    setColumnHeights(1200, 400)
    expect(showMore()).toBeNull()
  })

  it('shows everything while editing the layout', async () => {
    stubWidth(true)
    await twoColumnHub()
    setColumnHeights(1200, 400)
    await screen.findByRole('button', { name: /show more/i })

    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
    expect(showMore()).toBeNull()
  })
})
