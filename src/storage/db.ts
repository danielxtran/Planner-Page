import { Dexie, type EntityTable } from 'dexie'
import type { Task } from './tasks'

// The one Dexie instance. Only modules in src/storage/ may import this.
export const db = new Dexie('planner-hub') as Dexie & {
  tasks: EntityTable<Task, 'id'>
}

// Schema strings list the primary key first, then indexed fields only.
// Unindexed fields (title, done, updatedAt) are still stored, just not queryable
// by index. Any change to a stored shape needs a new db.version(n) with an
// .upgrade() that migrates existing rows; never edit an old version in place.
db.version(1).stores({
  tasks: 'id, userId, createdAt',
})
