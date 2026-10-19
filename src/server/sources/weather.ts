import { z } from 'zod'
import type { WeatherConfig } from '../../shared/config'
import type { WeatherData } from '../../shared/display'
import { fetchText } from './http'

const weatherResponse = z.object({
  current: z.object({ temperature_2m: z.number(), weather_code: z.number().int() }),
  daily: z.object({
    time: z.array(z.string()).min(1), temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1), precipitation_probability_max: z.array(z.number().min(0).max(100).nullable()).min(1),
  }),
})

export function parseWeather(data: unknown): WeatherData {
  const parsed = weatherResponse.parse(data)
  return { temperature: parsed.current.temperature_2m, code: parsed.current.weather_code, high: parsed.daily.temperature_2m_max[0]!, low: parsed.daily.temperature_2m_min[0]!, precipitation: parsed.daily.precipitation_probability_max[0]! }
}

export async function fetchWeather(settings: WeatherConfig, signal: AbortSignal, timezone = 'Asia/Tokyo'): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({ latitude: String(settings.latitude), longitude: String(settings.longitude), current: 'temperature_2m,weather_code', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max', forecast_days: '1', timezone }).toString()
  return parseWeather(JSON.parse(await fetchText(url, { signal })))
}
