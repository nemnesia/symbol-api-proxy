import axios from 'axios'

export async function measureLatency(url: string): Promise<number> {
  const start = Date.now()
  try {
    await axios.get(url, { timeout: 3000 })
    return Date.now() - start
  } catch {
    return Infinity
  }
}
