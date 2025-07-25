import express from 'express'
import axios from 'axios'
import { redis } from './redis.js'
import { REDIS_KEY_HEALTHY_NODES } from './config.js'

const app = express()
const PORT = process.env.SYMBOL_API_PROXY_PORT || process.env.PORT || 3000


function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

app.use('/symbol-api-proxy', async (req, res) => {
  const healthyRaw = await redis.get(REDIS_KEY_HEALTHY_NODES())
  if (!healthyRaw) return res.status(503).send('No healthy nodes')
  let healthy = JSON.parse(healthyRaw)
  healthy = healthy.slice(0, 50)
  healthy = shuffle(healthy)
  for (const node of healthy) {
    try {
      const url = node.url + req.originalUrl.replace('/symbol-api-proxy', '')
      console.log(`[proxy] Full URL: ${url}`)
      const { data, status, headers } = await axios({
        method: req.method,
        url,
        timeout: 5000,
      })
      return res.status(status).set(headers).send(data)
    } catch (error) {
      console.error(`[proxy] Error forwarding request to ${node.url}:`, error)
      continue
    }
  }
  res.status(502).send('All nodes failed')
})

// /symbol-api-proxy 以外は404
app.use((req, res) => {
  res.status(404).send('Not Found')
})

app.listen(PORT, () => {
  console.log(`Proxy server listening on port http://localhost:${PORT}`)
})
