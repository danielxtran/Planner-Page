import { db } from './db'
import { LOCAL_USER_ID } from './user'

/**
 * Colors are stored by palette name, not hex, so a theme can restyle every
 * category just by changing its CSS variables.
 */
export const CATEGORY_COLORS = ['peach', 'mint', 'lavender', 'butter', 'sky', 'rose'] as const
export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export interface Category {
  id: string
  userId: string
  name: string
  color: CategoryColor
  createdAt: string
  updatedAt: string
}

/** All of the current user's categories, oldest first. */
export async function listCategories(): Promise<Category[]> {
  return db.categories.where('userId').equals(LOCAL_USER_ID).sortBy('createdAt')
}

/** Creates a category, picking the next palette color in turn. Names are unique, ignoring case. */
export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name cannot be empty')

  return db.transaction('rw', db.categories, async () => {
    const existing = await listCategories()
    if (existing.some((c) => sameName(c.name, trimmed))) {
      throw new Error(`A category named "${trimmed}" already exists`)
    }
    const now = new Date().toISOString()
    const category: Category = {
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      name: trimmed,
      color: CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
      createdAt: now,
      updatedAt: now,
    }
    await db.categories.add(category)
    return category
  })
}

/** Deletes a category and returns it. Tasks that used it become uncategorized. */
export async function removeCategory(id: string): Promise<Category> {
  return db.transaction('rw', db.categories, db.tasks, async () => {
    const category = await db.categories.get(id)
    if (!category || category.userId !== LOCAL_USER_ID) {
      throw new Error(`Category not found: ${id}`)
    }
    const now = new Date().toISOString()
    await db.tasks.where('categoryId').equals(id).modify({ categoryId: null, updatedAt: now })
    await db.categories.delete(id)
    return category
  })
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}
