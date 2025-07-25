// mainnet/testnet 切り替えとノードリスト取得
import axios from 'axios'

export type NetworkType = 'mainnet' | 'testnet'

export const NETWORK: NetworkType =
  (process.env.SYMBOL_NETWORK as NetworkType) || 'mainnet'

const NODE_LIST_URLS = {
  mainnet: 'https://symbol.services/nodes?ssl=true',
  testnet: 'https://testnet.symbol.services/nodes?ssl=true',
}

export async function fetchNodeList(
  network: NetworkType = NETWORK,
): Promise<string[]> {
  const url = NODE_LIST_URLS[network]
  const { data } = await axios.get(url)
  return (data || [])
    .map((n: any) => n.apiStatus?.restGatewayUrl)
    .filter(Boolean)
}

export const BLOCK_HEIGHT_TOLERANCE = 1
export const REDIS_KEY_HEALTHY_NODES = (network: NetworkType = NETWORK) =>
  `symbol:healthyNodes:${network}`
