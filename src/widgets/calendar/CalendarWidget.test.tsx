import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addCalendarSource, replaceCalendarEvents } from '../../storage/calendars'
import { addTask } from '../../storage/tasks'
import { readCalendarConfig } from './calendarConfig'
import { CalendarWidget } from './CalendarWidget'
import { localDate } from './syncWindow'

function StandaloneCalendar() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  return (
    <>
      <CalendarWidget
        widget={{ id: 'w1', type: 'calendar', config }}
        onConfigChange={(_label, next) => setConfig(next)}
        onAddBelow={() => {}}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}

const savedConfig = () => readCalendarConfig(JSON.parse(screen.getByTestId('config').textContent!))

/** Two calendars with one event each today, synced just now (so nothing refreshes on load). */
async function seed() {
  const today = localDate(new Date())
  const canvas = await addCalendarSource({
    kind: 'canvas',
    name: 'Classes',
    color: 'peach',
    feedUrl: 'https://x.instructure.com/feeds/calendars/user_a.ics',
  })
  const google = await addCalendarSource({ kind: 'google', name: 'Personal', color: 'sky' })
  await replaceCalendarEvents(canvas.id, [
    {
      title: 'Essay due',
      start: today,
      end: null,
      allDay: true,
      location: null,
      url: 'https://x.instructure.com/courses/1/assignments/2',
    },
  ])
  await replaceCalendarEvents(google.id, [
    {
      title: 'Coffee with Sam',
      start: today,
      end: null,
      allDay: true,
      location: 'Café',
      url: null,
    },
  ])
  return { canvas, google }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CalendarWidget', () => {
  it('invites you to connect a calendar when there are none', async () => {
    // As if .env.local had no Google ID, whatever this machine's file says.
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    render(<StandaloneCalendar />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Connect Canvas, Google, or Outlook' }),
    )
    expect(screen.getByRole('form', { name: 'Add a Canvas calendar' })).toBeInTheDocument()
    // Without an app ID, the button is off and the panel says how to set it up.
    expect(screen.getByRole('button', { name: 'Connect Google Calendar' })).toBeDisabled()
  })

  it("shows today's events with links, and tasks due today", async () => {
    await seed()
    await addTask('Read chapter 5', { dueDate: localDate(new Date()) })
    render(<StandaloneCalendar />)

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Essay due/ })).toHaveAttribute(
      'href',
      'https://x.instructure.com/courses/1/assignments/2',
    )
    expect(screen.getByText('Coffee with Sam')).toBeInTheDocument()
    expect(await screen.findByText('Read chapter 5')).toBeInTheDocument()
  })

  it('lets each widget choose its calendars and options', async () => {
    const { canvas } = await seed()
    render(<StandaloneCalendar />)
    await screen.findByText('Coffee with Sam')

    fireEvent.click(screen.getByRole('button', { name: 'Calendars' }))
    const settings = screen.getByRole('group', { name: 'Calendar settings' })
    fireEvent.click(within(settings).getByRole('checkbox', { name: /Personal/ }))

    await waitFor(() => expect(screen.queryByText('Coffee with Sam')).toBeNull())
    expect(savedConfig().sourceIds).toEqual([canvas.id])

    fireEvent.click(within(settings).getByRole('button', { name: '14 days' }))
    fireEvent.click(within(settings).getByRole('button', { name: 'Tasks with due dates' }))
    expect(savedConfig()).toMatchObject({ days: 14, showTasks: false })

    // Ticking it again goes back to "all", so calendars added later show up too.
    fireEvent.click(within(settings).getByRole('checkbox', { name: /Personal/ }))
    expect(savedConfig().sourceIds).toBeNull()
  })
})
