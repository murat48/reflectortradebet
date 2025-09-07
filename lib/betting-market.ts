/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/betting-market.ts
import { 
  rpc,
  Contract, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE,
  Address,
  scValToNative,
  nativeToScVal
} from '@stellar/stellar-sdk'
import { WalletService } from './wallet'
import { i128 } from '@stellar/stellar-sdk/contract'
import { SecureStellarManager } from './stellar-manager-secure'

export interface Market {
  id: bigint
  title: string
  token: string
  betting_token: string
  initial_price: bigint
  target_price: bigint
  stable_tolerance: bigint
  start_time: bigint
  end_time: bigint
  total_up_bets: bigint
  total_down_bets: bigint
  total_stable_bets: bigint
  up_betters_count: number
  down_betters_count: number
  stable_betters_count: number
  is_resolved: boolean
  is_paid_out: boolean
  winning_side?: 'Up' | 'Down' | 'Stable'
  final_price?: bigint
  auto_restart: boolean
  restart_duration: bigint
  house_edge: bigint
}

export interface UserBet {
  user: string
  market_id: bigint
  amount: bigint
  prediction: 'Up' | 'Down' | 'Stable'
  timestamp: bigint
  odds_when_placed: bigint
  is_paid_out: boolean
  winnings: bigint
}

export interface Odds {
  up_odds: bigint
  down_odds: bigint
  stable_odds: bigint
}

export interface MarketStats {
  total_volume: bigint
  total_betters: number
  up_percentage: bigint
  down_percentage: bigint
  stable_percentage: bigint
  prize_pool: bigint
  house_commission: bigint
}

export interface PayoutSummary {
  total_winners: number
  total_paid_amount: bigint
  house_commission: bigint
  remaining_balance: bigint
}

export class BettingMarketService {
  private server: rpc.Server
  private contract: Contract
  private wallet: WalletService
  
  constructor(
    private contractAddress: string,
    private rpcUrl: string = 'https://soroban-testnet.stellar.org'
  ) {
    this.server = new rpc.Server(rpcUrl)
    this.contract = new Contract(contractAddress)
    this.wallet = WalletService.getInstance()
  }

  // Test contract connection
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(this.contract.call('hello'))
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const message = scValToNative(result)
          return { success: true, message: message as string }
        }
      }
      
      return { success: false, error: 'Failed to get response from contract' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Get current price from oracle
  async getCurrentPrice(tokenAddress: string): Promise<bigint | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_price',
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const price = scValToNative(result)
          return BigInt(price || 0)
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting current price:', error)
      return null
    }
  }

  // Create new market
  async createMarket(
    admin: string,
    title: string,
    token: string,
    bettingToken: string,
    targetPrice: bigint,
    stableTolerance: bigint,
    durationHours: bigint,
    autoRestart: boolean,
    houseEdge: bigint
  ): Promise<{ success: boolean; marketId?: bigint; error?: string }> {
    try {
      const account = await this.server.getAccount(admin)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'create_market',
            nativeToScVal(Address.fromString(admin), { type: 'address' }),
            nativeToScVal(title, { type: 'string' }),
            nativeToScVal(Address.fromString(token), { type: 'address' }),
            nativeToScVal(Address.fromString(bettingToken), { type: 'address' }),
            nativeToScVal(targetPrice, { type: 'i128' }),
            nativeToScVal(stableTolerance, { type: 'i128' }),
            nativeToScVal(durationHours, { type: 'u64' }),
            nativeToScVal(autoRestart, { type: 'bool' }),
            nativeToScVal(houseEdge, { type: 'i128' })
          )
        )
        .setTimeout(60)
        .build()

      // Simulate first
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return { success: false, error: 'Transaction simulation failed' }
      }

      const preparedTransaction = await this.server.prepareTransaction(transaction)
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR())
      
      if (!signResult.success || !signResult.signedXDR) {
        return { success: false, error: signResult.error || 'Failed to sign transaction' }
      }

      const signedTransaction = TransactionBuilder.fromXDR(signResult.signedXDR, Networks.TESTNET)
      const sendResponse = await this.server.sendTransaction(signedTransaction)

      if (sendResponse.status === 'PENDING') {
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
        }

        if (getResponse.status === 'SUCCESS') {
          const result = getResponse.returnValue
          let marketId = BigInt(0)
          
          if (result) {
            try {
              const nativeResult = scValToNative(result)
              marketId = BigInt(nativeResult as string | number)
            } catch (e) {
              console.warn('Could not parse market ID from result:', e)
            }
          }

          return { success: true, marketId }
        } else {
          return { success: false, error: `Transaction failed: ${getResponse.status}` }
        }
      } else {
        return { success: false, error: `Transaction failed: ${sendResponse.status}` }
      }
    } catch (error) {
      console.error('Error creating market:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Place bet (test version without token transfer) - Using u32 for enum
  async placeBetTest(
    user: string,
    marketId: bigint,
    amount: bigint,
    prediction: 'Up' | 'Down' | 'Stable'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      debugger;
      const account = await this.server.getAccount(user)
      
      // Convert string prediction to u32: Up=0, Down=1, Stable=2
      const predictionU32 = prediction === 'Up' ? 0 : prediction === 'Down' ? 1 : 2;
      
      console.log('Using u32 prediction format:', predictionU32, 'for', prediction);
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'place_bet', // Use the new u32 function
            nativeToScVal(Address.fromString(user), { type: 'address' }),
            nativeToScVal(marketId, { type: 'u64' }),
            nativeToScVal(amount, { type: 'i128' }),
            nativeToScVal(predictionU32, { type: 'u32' }) // Send as u32
          )
        )
        .setTimeout(60)
        .build()

      console.log('Transaction built with u32 prediction, simulating...');
      
      // Simulate first
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      console.log('Simulation response:', simulateResponse);
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        console.error('Simulation failed:', simulateResponse);
        return { success: false, error: 'Transaction simulation failed' }
      }

      const preparedTransaction = await this.server.prepareTransaction(transaction)
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR())
      
      if (!signResult.success || !signResult.signedXDR) {
        return { success: false, error: signResult.error || 'Failed to sign transaction' }
      }

      const signedTransaction = TransactionBuilder.fromXDR(signResult.signedXDR, Networks.TESTNET)
      const sendResponse = await this.server.sendTransaction(signedTransaction)

      if (sendResponse.status === 'PENDING') {
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
        }

        if (getResponse.status === 'SUCCESS') {
          return { success: true }
        } else {
          return { success: false, error: `Transaction failed: ${getResponse.status}` }
        }
      } else {
        return { success: false, error: `Transaction failed: ${sendResponse.status}` }
      }
    } catch (error) {
      console.error('Error placing bet:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Get market by ID
  async getMarket(marketId: bigint): Promise<Market | null> {
    try {
      console.log(`🔍 BettingMarketService: Fetching market ${marketId} from contract ${this.contractAddress}`)
      
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_market',
            nativeToScVal(marketId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result)
          const market = this.parseMarketFromResult(nativeResult)
          console.log(`✅ BettingMarketService: Market ${marketId} found:`, {
            id: market.id.toString(),
            title: market.title,
            is_resolved: market.is_resolved,
            end_time: market.end_time.toString()
          })
          return market
        } else {
          console.log(`❌ BettingMarketService: Market ${marketId} has no result data`)
        }
      } else {
        console.log(`❌ BettingMarketService: Market ${marketId} simulation failed:`, response)
      }
      
      return null
    } catch (error) {
      console.error(`💥 BettingMarketService: Error getting market ${marketId}:`, error)
      return null
    }
  }

  // Get active markets
  async getActiveMarkets(): Promise<Market[]> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(this.contract.call('get_active_markets'))
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result)
          if (Array.isArray(nativeResult)) {
            return nativeResult.map(market => this.parseMarketFromResult(market))
          }
        }
      }
      
      return []
    } catch (error) {
      console.error('Error getting active markets:', error)
      return []
    }
  }

  // Get resolved markets by checking individual market IDs with optimization
  async getResolvedMarkets(): Promise<Market[]> {
    try {
      const resolvedMarkets: Market[] = []
      
      // Get total markets count
      const totalMarkets = await this.getTotalMarkets()
      const totalMarketsNum = Number(totalMarkets) // Convert to number for arithmetic
      console.log(`Checking ${totalMarketsNum} markets for resolved status...`)
      
      // Use Promise.allSettled for parallel fetching with limited concurrency
      const batchSize = 5 // Process 5 markets at a time to avoid overwhelming
      const batches: Promise<void>[] = []
      
      for (let i = 1; i <= totalMarketsNum; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, totalMarketsNum - i + 1) }, (_, idx) => i + idx)
        
        const batchPromise = Promise.allSettled(
          batch.map(async (marketId) => {
            try {
              const market = await this.getMarket(BigInt(marketId))
              if (market && market.is_resolved) {
                resolvedMarkets.push(market)
              }
            } catch (error) {
              // Skip markets that don't exist or can't be accessed
              console.log(`Skipping market ${marketId}:`, error)
            }
          })
        ).then(() => {
          // Log progress
          console.log(`Processed markets ${i} to ${Math.min(i + batchSize - 1, totalMarketsNum)}`)
        })
        
        batches.push(batchPromise)
      }
      
      // Wait for all batches to complete
      await Promise.all(batches)
      
      // Sort by end time (most recent first)
      resolvedMarkets.sort((a, b) => Number(b.end_time) - Number(a.end_time))
      
      console.log(`Found ${resolvedMarkets.length} resolved markets out of ${totalMarketsNum} total`)
      return resolvedMarkets
    } catch (error) {
      console.error('Error getting resolved markets:', error)
      return []
    }
  }

  // Calculate odds for market
  async calculateOdds(marketId: bigint): Promise<Odds | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'calculate_improved_odds',
            nativeToScVal(marketId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result) as any
          return {
            up_odds: BigInt(nativeResult.up_odds || 0),
            down_odds: BigInt(nativeResult.down_odds || 0),
            stable_odds: BigInt(nativeResult.stable_odds || 0)
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error calculating odds:', error)
      return null
    }
  }

  // Get user bet
  async getUserBet(marketId: bigint, user: string): Promise<UserBet | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_user_bet',
            nativeToScVal(marketId, { type: 'u64' }),
            nativeToScVal(Address.fromString(user), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result)
          return this.parseUserBetFromResult(nativeResult)
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting user bet:', error)
      return null
    }
  }

  // Get market stats
  async getMarketStats(marketId: bigint): Promise<MarketStats | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_market_stats',
            nativeToScVal(marketId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result) as any
          return {
            total_volume: BigInt(nativeResult.total_volume || 0),
            total_betters: Number(nativeResult.total_betters || 0),
            up_percentage: BigInt(nativeResult.up_percentage || 0),
            down_percentage: BigInt(nativeResult.down_percentage || 0),
            stable_percentage: BigInt(nativeResult.stable_percentage || 0),
            prize_pool: BigInt(nativeResult.prize_pool || 0),
            house_commission: BigInt(nativeResult.house_commission || 0)
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting market stats:', error)
      return null
    }
  }

  // Resolve market manually
  // async resolveMarketManual(
  //   admin: string,
  //   marketId: bigint,
  //   finalPrice: bigint
  // ): Promise<{ success: boolean; winningSide?: string; error?: string }> {
  //   try {
  //     const account = await this.server.getAccount(admin)
      
  //     const transaction = new TransactionBuilder(account, {
  //       fee: BASE_FEE,
  //       networkPassphrase: Networks.TESTNET,
  //     })
  //       .addOperation(
  //         this.contract.call(
  //           'resolve_market_manual',
  //           nativeToScVal(Address.fromString(admin), { type: 'address' }),
  //           nativeToScVal(marketId, { type: 'u64' }),
  //           nativeToScVal(finalPrice, { type: 'i128' })
  //         )
  //       )
  //       .setTimeout(60)
  //       .build()

  //     // Simulate first
  //     const simulateResponse = await this.server.simulateTransaction(transaction)
      
  //     if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
  //       return { success: false, error: 'Transaction simulation failed' }
  //     }

  //     const preparedTransaction = await this.server.prepareTransaction(transaction)
  //     const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR())
      
  //     if (!signResult.success || !signResult.signedXDR) {
  //       return { success: false, error: signResult.error || 'Failed to sign transaction' }
  //     }

  //     const signedTransaction = TransactionBuilder.fromXDR(signResult.signedXDR, Networks.TESTNET)
  //     const sendResponse = await this.server.sendTransaction(signedTransaction)

  //     if (sendResponse.status === 'PENDING') {
  //       let getResponse = await this.server.getTransaction(sendResponse.hash)
        
  //       while (getResponse.status === 'NOT_FOUND') {
  //         await new Promise(resolve => setTimeout(resolve, 1000))
  //         getResponse = await this.server.getTransaction(sendResponse.hash)
  //       }

  //       if (getResponse.status === 'SUCCESS') {
  //         const result = getResponse.returnValue
  //         let winningSide = 'Unknown'
          
  //         if (result) {
  //           try {
  //             const nativeResult = scValToNative(result)
  //             winningSide = nativeResult as string
  //           } catch (e) {
  //             console.warn('Could not parse winning side from result:', e)
  //           }
  //         }

  //         return { success: true, winningSide }
  //       } else {
  //         return { success: false, error: `Transaction failed: ${getResponse.status}` }
  //       }
  //     } else {
  //       return { success: false, error: `Transaction failed: ${sendResponse.status}` }
  //     }
  //   } catch (error) {
  //     console.error('Error resolving market:', error)
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error'
  //     }
  //   }
  // }
  async resolveMarketManual(
    admin: string,
    marketId: bigint,
    finalPrice: bigint
  ): Promise<{ success: boolean; winningSide?: string; error?: string }> {
    try {
      debugger;
         const stellarManager = new SecureStellarManager();
       
       const keypair = stellarManager.getOrCreateKeypair();
         const account = await this.server.getAccount(keypair.publicKey())
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'resolve_market_manual',
            nativeToScVal(Address.fromString(keypair.publicKey()), { type: 'address' }),
            nativeToScVal(marketId, { type: 'u64' }),
            nativeToScVal(finalPrice, { type: 'i128' })
          )
        )
        .setTimeout(60)
        .build()

      // Simulate first
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      console.log('Simulation successful, preparing transaction...')
      
      const preparedTransaction = await this.server.prepareTransaction(transaction)
      preparedTransaction.sign(keypair);
      
      console.log('Transaction signed, sending...')

      const sendResponse = await this.server.sendTransaction(preparedTransaction)
      
      console.log('Send response:', sendResponse)

      if (sendResponse.status === 'PENDING') {
        console.log('Transaction pending, waiting for confirmation...')
        
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        let attempts = 0
        const maxAttempts = 30
        
        while (getResponse.status === 'NOT_FOUND' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
          attempts++
          console.log(`Waiting for transaction confirmation... attempt ${attempts}/${maxAttempts}`)
        }

        console.log('Final transaction response:', getResponse)

        if (getResponse.status === 'SUCCESS') {
          const result = getResponse.returnValue
          let winningSide = 'Unknown'
          
          if (result) {
            try {
              const nativeResult = scValToNative(result)
              winningSide = nativeResult as string
              console.log(`Market resolved successfully, winning side: ${winningSide}`)
            } catch (e) {
              console.warn('Could not parse winning side from result:', e)
            }
          }

          return { success: true, winningSide }
        } else {
          const errorMsg = `Transaction failed with status: ${getResponse.status}`
          console.error(errorMsg)
          return { success: false, error: errorMsg }
        }
      } else {
        const errorMsg = `Transaction failed with send status: ${sendResponse.status}`
        console.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      console.error('Error resolving market:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  // Get total markets count
  async getTotalMarkets(): Promise<bigint> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(this.contract.call('get_total_markets'))
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const count = scValToNative(result)
          return BigInt(count || 0)
        }
      }
      
      return BigInt(0)
    } catch (error) {
      console.error('Error getting total markets:', error)
      return BigInt(0)
    }
  }

  // Helper methods for parsing contract results
  private parseMarketFromResult(data: any): Market {
    // Safe parsing for winning_side enum
    let winningSide: 'Up' | 'Down' | 'Stable' | undefined = undefined;
    
    if (data.winning_side !== undefined && data.winning_side !== null) {
      // Handle different possible enum formats
      if (typeof data.winning_side === 'string') {
        winningSide = data.winning_side as 'Up' | 'Down' | 'Stable';
      } else if (typeof data.winning_side === 'number') {
        // Handle numeric format: 0=Up, 1=Down, 2=Stable
        switch (data.winning_side) {
          case 0: winningSide = 'Up'; break;
          case 1: winningSide = 'Down'; break;
          case 2: winningSide = 'Stable'; break;
        }
      } else if (typeof data.winning_side === 'object') {
        // Handle instance format: { "Up": {} } or { "tag": "Up" }
        if (data.winning_side.tag) {
          winningSide = data.winning_side.tag as 'Up' | 'Down' | 'Stable';
        } else {
          // Find the key in the object
          const keys = Object.keys(data.winning_side);
          if (keys.length > 0) {
            winningSide = keys[0] as 'Up' | 'Down' | 'Stable';
          }
        }
      }
    }
    
    return {
      id: BigInt(data.id || 0),
      title: data.title || '',
      token: data.token || '',
      betting_token: data.betting_token || '',
      initial_price: BigInt(data.initial_price || 0),
      target_price: BigInt(data.target_price || 0),
      stable_tolerance: BigInt(data.stable_tolerance || 0),
      start_time: BigInt(data.start_time || 0),
      end_time: BigInt(data.end_time || 0),
      total_up_bets: BigInt(data.total_up_bets || 0),
      total_down_bets: BigInt(data.total_down_bets || 0),
      total_stable_bets: BigInt(data.total_stable_bets || 0),
      up_betters_count: Number(data.up_betters_count || 0),
      down_betters_count: Number(data.down_betters_count || 0),
      stable_betters_count: Number(data.stable_betters_count || 0),
      is_resolved: Boolean(data.is_resolved),
      is_paid_out: Boolean(data.is_paid_out),
      winning_side: winningSide,
      final_price: data.final_price ? BigInt(data.final_price) : undefined,
      auto_restart: Boolean(data.auto_restart),
      restart_duration: BigInt(data.restart_duration || 0),
      house_edge: BigInt(data.house_edge || 0)
    }
  }

  private parseUserBetFromResult(data: any): UserBet {
    // Safe parsing for prediction enum
    let prediction: 'Up' | 'Down' | 'Stable' = 'Up'; // Default value
    
    if (data.prediction) {
      if (typeof data.prediction === 'string') {
        prediction = data.prediction as 'Up' | 'Down' | 'Stable';
      } else if (typeof data.prediction === 'object') {
        // Handle instance format: { "Up": {} } or { "tag": "Up" }
        if (data.prediction.tag) {
          prediction = data.prediction.tag as 'Up' | 'Down' | 'Stable';
        } else {
          // Find the key in the object
          const keys = Object.keys(data.prediction);
          if (keys.length > 0) {
            prediction = keys[0] as 'Up' | 'Down' | 'Stable';
          }
        }
      }
    }
    
    return {
      user: data.user || '',
      market_id: BigInt(data.market_id || 0),
      amount: BigInt(data.amount || 0),
      prediction: prediction,
      timestamp: BigInt(data.timestamp || 0),
      odds_when_placed: BigInt(data.odds_when_placed || 0),
      is_paid_out: Boolean(data.is_paid_out),
      winnings: BigInt(data.winnings || 0)
    }
  }

  // Utility methods for formatting
 static formatAmount(amount: i128, decimals: number = 14): string {
    const divisor = BigInt(10 ** decimals)
    const whole = Number(amount / divisor)
    const fraction = Number(amount % divisor)
    
    if (fraction === 0) {
      return whole.toString()
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0')
    return `${whole}.${fractionStr}`.replace(/\.?0+$/, '')
  }
  static formatAmountTarget(amount: i128, decimals: number): string {
    const divisor = BigInt(10 ** decimals)
    const whole = Number(amount / divisor)
    const fraction = Number(amount % divisor)
    
    if (fraction === 0) {
      return whole.toString()
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0')
    return `${whole}.${fractionStr}`.replace(/\.?0+$/, '')
  }


  static parseAmount(amount: string, decimals: number = 7): bigint {
    const parts = amount.split('.')
    const whole = parts[0] || '0'
    const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
    
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)
  }

  static formatOdds(odds: bigint): string {
    const oddsNum = Number(odds) / 1000
    return `${oddsNum.toFixed(2)}x`
  }

  static formatPercentage(percentage: bigint): string {
    const pct = Number(percentage) / 100
    return `${pct.toFixed(1)}%`
  }
}
