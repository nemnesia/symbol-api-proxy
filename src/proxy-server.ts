import express from 'express'
import axios from 'axios'
import { redis } from './redis.js'
import { REDIS_KEY_HEALTHY_NODES } from './config.js'

const app = express()
const PORT = process.env.SYMBOL_API_PROXY_PORT || process.env.PORT || 3000

app.use('/symbol-api', async (req, res) => {
  const healthyRaw = await redis.get(REDIS_KEY_HEALTHY_NODES())
  if (!healthyRaw) return res.status(503).send('No healthy nodes')
  const healthy = JSON.parse(healthyRaw)
  for (const node of healthy) {
    try {
      const url = node.url + req.originalUrl.replace('/symbol-api', '')
      const { data, status, headers } = await axios({
        method: req.method,
        url,
        headers: req.headers,
        data: req.body,
        timeout: 5000,
      })
      return res.status(status).set(headers).send(data)
    } catch {
      continue
    }
  }
  res.status(502).send('All nodes failed')
})

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`)
})
