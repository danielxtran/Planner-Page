import { Dexie, type EntityTable } from 'dexie'
import type { Category } from './categories'
import type { Task } from './tasks'

// The one Dexie instance. Only modules in src/storage/ may import this.
export const db = new Dexie('planner-hub') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  categories: EntityTable<Category, 'id'>
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
