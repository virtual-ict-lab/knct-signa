export type Theme = 'dark' | 'light'
export interface ThemePreference { theme: Theme; revision: number }

export function resolveTheme(theme: Theme, revision: number, preference: ThemePreference | null): Theme {
  return preference?.revision === revision ? preference.theme : theme
}

export function parseThemePreference(raw: string | null): ThemePreference | null {
  try {
    const parsed = JSON.parse(raw ?? 'null')
    return parsed && ['dark', 'light'].includes(parsed.theme) && Number.isSafeInteger(parsed.revision) ? parsed : null
  } catch { return null }
}
