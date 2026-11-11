/** A calendar widget's saved settings. The calendars themselves are shared by all calendar widgets. */
export interface CalendarConfig {
  title: string
  /** Which connected calendars to show; null = all of them, including ones connected later. */
  sourceIds: string[] | null
  days: CalendarDays
  /** Also list to-do tasks on their due dates (and overdue ones under Today). */
  showTasks: boolean
}

export const DAY_CHOICES = [3, 7, 14] as const
export type CalendarDays = (typeof DAY_CHOICES)[number]

export function readCalendarConfig(config: Record<string, unknown>): CalendarConfig {
  return {
    title: typeof config.title === 'string' ? config.title : '',
    sourceIds: Array.isArray(config.sourceIds)
      ? config.sourceIds.filter((id): id is string => typeof id === 'string')
      : null,
    days: DAY_CHOICES.includes(config.days as CalendarDays) ? (config.days as CalendarDays) : 7,
    showTasks: typeof config.showTasks === 'boolean' ? config.showTasks : true,
  }
}
