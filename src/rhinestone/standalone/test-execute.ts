import axios from 'axios'
import { Address, Hex } from 'viem'

const API_URL = 'http://localhost:4000/rhinestone'

async function testExecuteTransaction() {
  console.log('Testing transaction execution via Rhinestone bundle...\n')

  // First, check server status
  try {
    const statusRes = await axios.get(`${API_URL}/status`)
    console.log('Server status:', statusRes.data)
  } catch (error) {
    console.error('Failed to get server status. Is the server running?')
    process.exit(1)
  }

  // Send a test bundle message that will trigger transaction execution
  const bundleMessage = {
    type: 'RhinestoneBundle',
    bundleId: 'test-bundle-123',
    targetFillPayload: {
      chainId: 1,
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8Bb17' as Address, // Random address
      value: BigInt(1000000000000000), // 0.001 ETH
      data: '0x' as Hex, // Empty data
    },
    bundleData: '0x' as Hex,
  }

  try {
    console.log('Sending bundle message to trigger transaction...')
    const response = await axios.post(`${API_URL}/send-bundle`, bundleMessage)
    console.log('Bundle message sent successfully:', response.data)
    
    console.log('\nCheck the server logs to see the transaction execution!')
    console.log('The RhinestoneService should have received the bundle and attempted to execute it.')
  } catch (error) {
    console.error('Failed to send bundle message:', error.response?.data || error.message)
  }

  // Send a test relayer action
  const relayerAction = {
    type: 'RhinestoneRelayerActionV1',
    id: 'test-action-456',
    fill: {
      id: 'test-fill-789',
      call: {
        chainId: 10, // Optimism
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: BigInt(0),
        data: '0x12345678' as Hex, // Some function call
      },
    },
  }

  try {
    console.log('\nSending relayer action to trigger another transaction...')
    const response = await axios.post(`${API_URL}/send`, relayerAction)
    console.log('Relayer action sent successfully:', response.data)
    
    console.log('\nThe RhinestoneService should have executed both transactions!')
  } catch (error) {
    console.error('Failed to send relayer action:', error.response?.data || error.message)
  }
}

// Run the test
testExecuteTransaction().catch(console.error)