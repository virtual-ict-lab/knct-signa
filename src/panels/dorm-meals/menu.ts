export interface MealMenu { breakfast: string[]; lunch: string[]; dinner: string[] }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// APIのtextはOCR除外済み。rawTextや信頼度・警告は表示しない。
function menuNames(value: unknown): string[] {
  if (!record(value) || typeof value.text !== 'string') return []
  return value.text.slice(0, 10000).split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^[\[［【]\s*(?:A|B|共通料理)\s*[\]］】]$/i.test(line)).slice(0, 40)
}
export function menuForDate(value: unknown, date: string): MealMenu | null {
  if (!record(value) || !Array.isArray(value.weeks)) return null
  for (const week of value.weeks) {
    if (!record(week) || !Array.isArray(week.days)) continue
    const day = week.days.find(day => record(day) && day.date === date)
    if (record(day)) return { breakfast: menuNames(day.breakfast), lunch: menuNames(day.lunch), dinner: menuNames(day.dinner) }
  }
  return null
}
export function japanDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
