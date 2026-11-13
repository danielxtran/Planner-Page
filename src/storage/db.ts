import { Dexie, type EntityTable } from 'dexie'
import type { CalendarEvent, CalendarSource } from './calendars'
import type { Category } from './categories'
import type { StoredImage } from './images'
import type { StickyBoard, StickyNote } from './stickies'
import type { Note } from './notes'
import type { Page } from './pages'
import type { Task } from './tasks'

// The one Dexie instance. Only modules in src/storage/ may import this.
export const db = new Dexie('planner-hub') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  categories: EntityTable<Category, 'id'>
  pages: EntityTable<Page, 'id'>
  notes: EntityTable<Note, 'id'>
  images: EntityTable<StoredImage, 'id'>
  calendarSources: EntityTable<CalendarSource, 'id'>
  calendarEvents: EntityTable<CalendarEvent, 'id'>
  stickyBoards: EntityTable<StickyBoard, 'id'>
  stickyNotes: EntityTable<StickyNote, 'id'>
}

// Schema strings list the primary key first, then indexed fields only.
// Unindexed fields (title, done, updatedAt) are still stored, just not queryable
// by index. Any change to a stored shape needs a new db.version(n) with an
// .upgrade() that migrates existing rows; never edit an old version in place.
db.version(1).stores({
  tasks: 'id, userId, createdAt',
})

// v2 (milestone 2): tasks gain priority, categoryId and dueDate; categories table added.
// categoryId is indexed so deleting a category can find its tasks quickly.
db.version(2)
  .stores({
    tasks: 'id, userId, createdAt, categoryId',
    categories: 'id, userId, createdAt',
  })
  .upgrade((tx) =>
    tx
      .table('tasks')
      .toCollection()
      .modify((task) => {
        // Literal values, not imported constants: a migration is a snapshot of
        // what v2 meant, and must not change if the app's defaults change later.
        task.priority ??= 4
        task.categoryId ??= null
        task.dueDate ??= null
      }),
  )

// v3 (milestone 3): a pages table holding each hub page's layout as JSON.
// A brand-new table has no existing rows to migrate, so no .upgrade() is needed.
// Only changed tables are listed; tables left out carry over from v2 unchanged.
db.version(3).stores({
  pages: 'id, userId, createdAt',
})

// v4 (milestones 4-5): pages gain a `theme`; a notes table holds each notes
// widget's rich text. Widget settings (like a to-do widget's saved filter) live
// inside the page's layout JSON, which storage treats as opaque: each widget
// reads its own settings with defaults for anything missing, so older layouts
// need no migration for those.
db.version(4)
  .stores({
    notes: 'id, userId, createdAt',
  })
  .upgrade((tx) =>
    tx
      .table('pages')
      .toCollection()
      .modify((page) => {
        page.theme ??= 'graph'
      }),
  )

// v5: an images table for image widgets. New table, nothing to migrate.
db.version(5).stores({
  images: 'id, userId, createdAt',
})

// v6 (milestone 6): connected calendars and cached copies of their events.
// Events are indexed by sourceId so a sync or removal can find one calendar's events.
db.version(6).stores({
  calendarSources: 'id, userId, createdAt',
  calendarEvents: 'id, userId, sourceId, start',
})

// v7: sticky-note widgets. A board per widget (its pad), and the notes stuck
// aside on it, indexed by boardId to list one widget's pile.
db.version(7).stores({
  stickyBoards: 'id, userId, createdAt',
  stickyNotes: 'id, userId, boardId, createdAt',
})
