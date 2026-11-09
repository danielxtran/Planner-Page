import { describe, expect, it } from 'vitest'
import { addDaysTo, describeDue } from './dates'

// A Monday, so weekday expectations are easy to read.
const TODAY = '2026-11-09'

describe('describeDue', () => {
  it.each([
    ['2026-11-09', 'Today', 'today'],
    ['2026-11-10', 'Tomorrow', 'soon'],
    ['2026-11-13', 'Fri', 'soon'],
    ['2026-11-15', 'Sun', 'soon'],
    ['2026-11-16', 'Nov 16', 'later'],
    ['2027-01-04', 'Jan 4, 2027', 'later'],
    ['2026-11-08', 'Overdue · Nov 8', 'overdue'],
    ['2025-12-31', 'Overdue · Dec 31, 2025', 'overdue'],
  ])('%s reads as "%s"', (dueDate, text, tone) => {
    expect(describeDue(dueDate, TODAY, false)).toMatchObject({ text, tone })
  })

  it('never calls a done task overdue', () => {
    expect(describeDue('2026-11-08', TODAY, true)).toMatchObject({
      text: 'Yesterday',
      tone: 'later',
    })
    expect(describeDue('2026-11-01', TODAY, true)).toMatchObject({ text: 'Nov 1', tone: 'later' })
  })

  it('gives an unambiguous full date', () => {
    expect(describeDue('2026-11-13', TODAY, false).full).toBe('Friday, November 13, 2026')
  })
})

describe('addDaysTo', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysTo('2026-12-30', 6)).toBe('2027-01-05')
    expect(addDaysTo('2028-02-28', 1)).toBe('2028-02-29')
  })
})
