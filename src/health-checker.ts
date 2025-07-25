import axios from 'axios'
import pLimit from 'p-limit'
import {
  fetchNodeList,
  BLOCK_HEIGHT_TOLERANCE,
  REDIS_KEY_HEALTHY_NODES,
  NETWORK,
} from './config.js'
import { redis } from './redis.js'
import { measureLatency } from './utils.js'

async function checkNodes() {
  try {
    const nodeList = await fetchNodeList(NETWORK)
    console.log(
      `[health-check] Fetched ${nodeList.length} nodes for ${NETWORK}`,
    )
    const limit = pLimit(5) // 最大5並列
    const results = await Promise.all(
      nodeList.map((url) =>
        limit(async () => {
          const infoUrl = url + '/chain/info'
          console.log(`[health-check] Checking node: ${infoUrl}`)
          try {
            const latency = await measureLatency(infoUrl)
            if (latency === Infinity) throw new Error('Timeout')
            const { data } = await axios.get(infoUrl, { timeout: 3000 })
            console.log(
              `[health-check] Success: ${url} height=${data.height} latency=${latency}ms`,
            )
            return { url, height: data.height, latency }
          } catch (e) {
            console.log(
              `[health-check] Failed: ${url} (${e instanceof Error ? e.message : e})`,
            )
            return null
          }
        })
      )
    )
    // 最新ブロック高さを取得
    const heights = results.filter(Boolean).map((n) => n!.height)
    const maxHeight = Math.max(...heights)
    // 許容範囲内かつタイムアウトしていないノードのみ
    const healthy = results
      .filter(
        (n) =>
          n &&
          Math.abs(n.height - maxHeight) <= BLOCK_HEIGHT_TOLERANCE &&
          n.latency !== Infinity,
      )
      .sort((a, b) => a!.latency - b!.latency)
    await redis.set(REDIS_KEY_HEALTHY_NODES(NETWORK), JSON.stringify(healthy))
    if (healthy.length === 0) {
      console.log('[health-check] No healthy nodes found.')
    } else {
      console.log('[health-check] Updated healthy nodes:', healthy)
    }
  } finally {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.quit()
    }
  }
}

// cron等で定期実行する想定のため、1回だけ実行
checkNodes().catch((e) => {
  console.error('[health-check] Fatal error:', e)
  process.exit(1)
})
