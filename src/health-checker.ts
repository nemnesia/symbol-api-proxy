import axios from 'axios';
import { fetchNodeList, BLOCK_HEIGHT_TOLERANCE, REDIS_KEY_HEALTHY_NODES, NETWORK } from './config.js';
import { redis } from './redis.js';
import { measureLatency } from './utils.js';

async function checkNodes() {
  const nodeList = await fetchNodeList(NETWORK);
  const results = await Promise.all(
    nodeList.map(async (url) => {
      const infoUrl = url + '/chain/info';
      try {
        const latency = await measureLatency(infoUrl);
        if (latency === Infinity) throw new Error('Timeout');
        const { data } = await axios.get(infoUrl, { timeout: 3000 });
        return { url, height: data.height, latency };
      } catch {
        return null;
      }
    })
  );
  // 最新ブロック高さを取得
  const heights = results.filter(Boolean).map((n) => n!.height);
  const maxHeight = Math.max(...heights);
  // 許容範囲内かつタイムアウトしていないノードのみ
  const healthy = results.filter(
    (n) => n && Math.abs(n.height - maxHeight) <= BLOCK_HEIGHT_TOLERANCE && n.latency !== Infinity
  ).sort((a, b) => a!.latency - b!.latency);
  await redis.set(REDIS_KEY_HEALTHY_NODES(NETWORK), JSON.stringify(healthy));
  console.log('Updated healthy nodes:', healthy);
}

// cron等で定期実行する想定のため、1回だけ実行
checkNodes();
