/**
 * The looks a page can use. Each theme is a set of CSS variable overrides in
 * theme.css under [data-theme='<id>']; components only use the variables, so
 * adding a theme never touches a component.
 */
export const THEMES = [
  { id: 'graph', label: 'Graph paper' },
  { id: 'bujo', label: 'Bullet journal' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Unknown names (say, from a newer version's backup) fall back to graph paper. */
export function resolveTheme(name: string): ThemeId {
  return THEMES.some((t) => t.id === name) ? (name as ThemeId) : 'graph'
}
