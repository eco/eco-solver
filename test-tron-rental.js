require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// Mock TronEnergyRental class with the actual service logic
class TronEnergyRental extends EventEmitter {
  constructor(nettsApiKey, catfeeApiKey, tronWebInstance, nettsRealIp, catfeeApiSecret) {
    super();
    this.providers = [];
    this.tronWeb = tronWebInstance;

    // Add catfee first (prioritized)
    if (catfeeApiKey && catfeeApiSecret) {
      this.providers.push(new CatfeeProvider(catfeeApiKey, catfeeApiSecret, this));
    }

    // // Add netts second (fallback)
    // if (nettsApiKey && nettsRealIp) {
    //   this.providers.push(new NettsProvider(nettsApiKey, nettsRealIp));
    // }
  }

  async rentEnergy(params) {
    for (const provider of this.providers) {
      try {
        const result = await provider.rentEnergy(params);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn(`Energy rental failed with ${provider.name}:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'All energy rental providers failed',
    };
  }

  async topUpCatfee(trxAmount) {
    if (trxAmount < 10) {
      return {
        success: false,
        error: 'Minimum top-up amount is 10 TRX'
      };
    }

    if (!this.tronWeb) {
      return {
        success: false,
        error: 'TronWeb instance required for TRX transfers'
      };
    }

    if (!process.env.CATFEE_DEPOSIT_ADDRESS) {
      return {
        success: false,
        error: 'CATFEE_DEPOSIT_ADDRESS not found in environment variables'
      };
    }

    // Mock TronWeb transaction
    console.log(`🚀 Simulating TRX transfer of ${trxAmount} TRX to ${process.env.CATFEE_DEPOSIT_ADDRESS}`);
    return {
      success: true,
      txHash: '0x' + crypto.randomBytes(32).toString('hex')
    };
  }

  async getUserTrxBalance() {
    // Mock user has 50 TRX initially
    return 50;
  }
}

class CatfeeProvider {
  constructor(apiKey, apiSecret, parent) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.parent = parent;
    this.name = 'Catfee';
  }

  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method + requestPath + body;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64');
  }

  getAuthHeaders(method, path, body = '') {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp, method, path, body);
    
    return {
      'CF-ACCESS-KEY': this.apiKey,
      'CF-ACCESS-SIGN': signature,
      'CF-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    };
  }

  async getAccountBalance() {
    try {
      const headers = this.getAuthHeaders('GET', '/v1/account');
      const response = await axios.get('https://api.catfee.io/v1/account', { headers });

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Failed to get account balance');
      }

      return {
        balance: 5, // Force low balance for testing auto-topup
        success: true,
      };
    } catch (error) {
      return {
        balance: 0,
        success: false,
        error: error.response?.data?.msg || error.message,
      };
    }
  }

  async rentEnergy(params) {
    try {
      const queryPath = `/v1/order?quantity=${Math.max(params.amount, 65000)}&receiver=${params.receiverAddress}&duration=1h`;
      const headers = this.getAuthHeaders('POST', queryPath, '');
      
      const response = await axios.post(`https://api.catfee.io${queryPath}`, {}, { headers });

      console.log('📊 Catfee response:', response.data);

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Order creation failed');
      }

      // Check balance after rental and auto-topup if needed (simulate the service logic)
      const balanceCheck = await this.getAccountBalance();
      if (balanceCheck.success && balanceCheck.balance < 10) {
        console.warn(`⚠️  Catfee account balance is low: ${balanceCheck.balance} TRX (below 10 TRX threshold)`);
        
        if (this.parent) {
          const topupAmount = parseFloat(process.env.TOPUP_AMOUNT || '10');
          console.log(`🔄 Automatically topping up ${topupAmount} TRX to catfee account`);
          
          // Get user's TRX balance before transfer
          const userBalanceBefore = await this.parent.getUserTrxBalance();
          
          // Attempt to top up
          const topupResult = await this.parent.topUpCatfee(topupAmount);
          
          if (topupResult.success) {
            console.log(`✅ Successfully topped up ${topupAmount} TRX to catfee account`);
            
            // Check user's balance after transfer (simulate reduction)
            const userBalanceAfter = userBalanceBefore - topupAmount - 0.05; // Simulate fee
            const balanceDrop = userBalanceBefore - userBalanceAfter;
            
            // Emit event if user's balance dropped by the expected amount
            if (balanceDrop >= topupAmount - 0.1) { // Allow small tolerance for transaction fees
              this.parent.emit('balanceDeducted', {
                amount: balanceDrop,
                userBalanceBefore,
                userBalanceAfter,
                purpose: 'catfee_topup',
                txHash: topupResult.txHash
              });
              console.log(`📢 Emitted balanceDeducted event: user balance dropped by ${balanceDrop} TRX`);
            }
          } else {
            console.error(`❌ Failed to top up catfee account: ${topupResult.error}`);
          }
        }
      }

      return {
        success: true,
        txHash: response.data.data?.tx_hash || response.data.data?.txHash || response.data.data?.hash,
        orderId: response.data.data?.id || response.data.data?.order_id || response.data.data?.orderId,
        energyRented: response.data.data?.quantity || params.amount,
        provider: 'Catfee'
      };
    } catch (error) {
      console.log('❌ Catfee error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.msg || error.message,
        provider: 'Catfee'
      };
    }
  }
}

// class NettsProvider {
//   constructor(apiKey, realIp) {
//     this.apiKey = apiKey;
//     this.realIp = realIp;
//     this.name = 'Netts';
//   }

//   async rentEnergy(params) {
//     return {
//       success: false,
//       error: 'Netts provider not fully functional yet',
//       provider: 'Netts'
//     };
//   }
// }

async function testTronRental() {
  console.log('🚀 Testing Tron Energy Rental Service...\n');

  // Set test-specific topup amount
  process.env.TOPUP_AMOUNT = '15';

  const energyRental = new TronEnergyRental(
    // process.env.NETTS_API_KEY,
    null,
    process.env.CATFEE_API_KEY,
    { mockTronWeb: true }, // Mock TronWeb for testing
    // process.env.NETTS_REAL_IP,
    null,
    process.env.CATFEE_API_SECRET
  );

  // Listen for balance deduction events
  energyRental.on('balanceDeducted', (data) => {
    console.log('🎯 Balance Deduction Event Received:', data);
  });

  // Test 1: Check current balance
  console.log('📋 Test 1: Check Catfee Account Balance');
  const catfeeProvider = energyRental.providers.find(p => p.name === 'Catfee');
  if (catfeeProvider) {
    const balance = await catfeeProvider.getAccountBalance();
    console.log('Current balance:', balance);
  }

  // Test 2: Test top-up validation
  console.log('\n💰 Test 2: Top-up Validation');
  const invalidTopUp = await energyRental.topUpCatfee(5);
  console.log('Top-up 5 TRX (should fail):', invalidTopUp);

  const validTopUp = await energyRental.topUpCatfee(15);
  console.log('Top-up 15 TRX (should simulate):', validTopUp);

  // Test 3: Rent energy and check balance warning
  console.log('\n⚡ Test 3: Energy Rental with Balance Check');
  const rentalResult = await energyRental.rentEnergy({
    receiverAddress: 'TZJA6m9Jy9FGhhs7wFffag8dAYsEZdQ7Xh',
    amount: 65000
  });
  console.log('Rental result:', rentalResult);

  console.log('\n✅ All tests completed!');
}

testTronRental().catch(console.error);