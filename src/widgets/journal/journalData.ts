import type { CategoryColor } from '../../storage/categories'
import type { Mood } from '../../storage/journal'

/** Gentle, short prompts: easy to answer in a sentence on a tired day. */
export const PROMPTS = [
  'What made you smile today?',
  'What is one thing you finished today, however small?',
  "What's taking up the most space in your head right now?",
  'What are you looking forward to this week?',
  'Who made your day a little better?',
  'What felt hard today, and how did you get through it?',
  'What would make tomorrow feel easier?',
  'What did you learn today?',
  'What is something you want to remember about today?',
  'What are three things you are grateful for?',
  'How did you take care of yourself today?',
  'What drained your energy today? What gave you energy?',
  'If today had a title, what would it be?',
  "What's one thing you can let go of tonight?",
  'What surprised you today?',
  'What is a small win you can celebrate?',
  'What would you tell a friend who had the day you had?',
  'What did you do today just for fun?',
  "What's one thing on your mind that you could write down and set aside?",
  'Where did you feel most like yourself today?',
  'What is something kind you did or saw today?',
  'What do you want to spend more time on?',
  'What song, show, or book matched your mood today?',
  'What is one tiny step toward something you care about?',
  'What did your body need today?',
  'What are you proud of this week?',
  "What's a question you've been thinking about?",
  'Describe a moment from today in detail.',
] as const

/**
 * Today's prompt, picked from the date so it stays the same all day (and is
 * the same on every device). `shuffle` steps through the list for "Another prompt".
 */
export function promptFor(date: string, shuffle = 0): string {
  let hash = 0
  for (const char of date) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PROMPTS[(hash + shuffle) % PROMPTS.length]
}

/** The next prompt after `current` in the list, for "Another prompt". */
export function nextPrompt(current: string): string {
  const index = PROMPTS.indexOf(current as (typeof PROMPTS)[number])
  return PROMPTS[(index + 1) % PROMPTS.length]
}

export const MOOD_META: Record<Mood, { emoji: string; label: string; color: CategoryColor }> = {
  great: { emoji: '😄', label: 'Great', color: 'mint' },
  good: { emoji: '🙂', label: 'Good', color: 'sky' },
  okay: { emoji: '😐', label: 'Okay', color: 'butter' },
  low: { emoji: '😔', label: 'Low', color: 'lavender' },
  rough: { emoji: '😣', label: 'Rough', color: 'rose' },
}
