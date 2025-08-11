import { createWalletClient, publicActions } from 'viem'
import { SimpleAccountClient, SimpleAccountClientConfig } from './simple-account.client'
import { SimpleAccountActions } from './simple-account.client'

export function createSimpleAccountClient(
  parameters: SimpleAccountClientConfig,
): SimpleAccountClient {
  const { key = 'simpleAccountClient', name = 'Simple Account Client', transport } = parameters

  let client = createWalletClient({
    ...parameters,
    key,
    name,
    transport,
  }) as SimpleAccountClient
  client.simpleAccountAddress = parameters.simpleAccountAddress
  client = client.extend(SimpleAccountActions).extend(publicActions) as any
  return client
}
EOF < /dev/null
