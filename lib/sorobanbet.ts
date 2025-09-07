// lib/soroban.ts
import { 
  Contract, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE,
  Address,
  xdr,
  scValToNative,
  nativeToScVal
} from '@stellar/stellar-sdk'
import * as SorobanClient from '@stellar/stellar-sdk/rpc'
import { WalletService } from './wallet'

export interface TrailingOrder {
  id: bigint
  user: string
  asset: string
  amount: bigint
  trail_percentage: number
  initial_price: bigint
  highest_price: bigint
  current_stop_price: bigint
  status: 'Active' | 'Executed' | 'Cancelled'
  created_at: bigint
  updated_at: bigint
  executed_at?: bigint
  execution_price?: bigint
}

interface OrderResultData {
  id: number | string
  user: string
  asset: string
  amount: number | string
  trail_percentage: number
  initial_price: number | string
  highest_price: number | string
  current_stop_price: number | string
  status: string
  created_at: number | string
  updated_at: number | string
  executed_at?: number | string
  execution_price?: number | string
}

export class SorobanService {
  private server: SorobanClient.Server
  private contract: Contract
  private wallet: WalletService
  
  constructor(
    private contractAddress: string,
    private rpcUrl: string = 'https://soroban-testnet.stellar.org'
  ) {
    this.server = new SorobanClient.Server(rpcUrl)
    this.contract = new Contract(contractAddress)
    this.wallet = WalletService.getInstance()
  }

  // Helper to build and simulate transaction
  private async buildTransaction(
    userAddress: string,
    operation: xdr.Operation
  ): Promise<TransactionBuilder> {
    const account = await this.server.getAccount(userAddress)
    return new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }).addOperation(operation).setTimeout(30)
  }

  // Get user orders
  async getUserOrders(userAddress: string): Promise<TrailingOrder[]> {
    try {
      const account = await this.server.getAccount(userAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_user_orders',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (SorobanClient.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          // Convert XDR result to native JavaScript objects
          const nativeResult = scValToNative(result)
          return this.parseOrdersFromResult(nativeResult)
        }
      } else {
        throw new Error(`Simulation failed`)
      }
      
      return []
    } catch (error) {
      console.error('Error getting user orders:', error)
      throw error
    }
  }

  // Get active orders for user
  async getUserActiveOrders(userAddress: string): Promise<TrailingOrder[]> {
    try {
      const account = await this.server.getAccount(userAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_user_active_orders',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (SorobanClient.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result)
          return this.parseOrdersFromResult(nativeResult)
        }
      }
      
      return []
    } catch (error) {
      console.error('Error getting active orders:', error)
      throw error
    }
  }

  // Get current price for asset
  async getCurrentPrice(assetAddress: string): Promise<bigint | null> {
    try {
      // We need a dummy account for read-only operations
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_current_price',
            nativeToScVal(Address.fromString(assetAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (SorobanClient.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const price = scValToNative(result)
          return price ? BigInt(price) : null
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting current price:', error)
      return null
    }
  }

  // Create new trailing stop order
  async createOrder(
    userAddress: string,
    assetAddress: string,
    amount: bigint,
    trailPercentage: number
  ): Promise<{ success: boolean; orderId?: bigint; error?: string }> {
    try {
      const account = await this.server.getAccount(userAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'create_order',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' }),
            nativeToScVal(Address.fromString(assetAddress), { type: 'address' }),
            nativeToScVal(amount, { type: 'i128' }),
            nativeToScVal(trailPercentage, { type: 'u32' })
          )
        )
        .setTimeout(30)
        .build()

      // First simulate to check if transaction is valid
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!SorobanClient.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      // For simple contract calls, we can directly sign the original transaction
      // The simulation was just to validate it will work
      const signResult = await this.wallet.signTransaction(transaction.toXDR());
      
      if (!signResult.success || !signResult.signedXDR) {
        return {
          success: false,
          error: signResult.error || 'Failed to sign transaction'
        }
      }

      // Reconstruct and send signed transaction
      const signedTransaction = TransactionBuilder.fromXDR(signResult.signedXDR, Networks.TESTNET)
      const sendResponse = await this.server.sendTransaction(signedTransaction)

      if (sendResponse.status === 'PENDING') {
        // Wait for confirmation
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        
        // Poll for transaction result
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
        }

        if (getResponse.status === 'SUCCESS') {
          // Try to extract order ID from transaction result
          const result = getResponse.returnValue
          let orderId = BigInt(0)
          
          if (result) {
            try {
              const nativeResult = scValToNative(result)
              orderId = BigInt(nativeResult)
            } catch (e) {
              console.warn('Could not parse order ID from result:', e)
            }
          }

          return {
            success: true,
            orderId
          }
        } else {
          return {
            success: false,
            error: `Transaction failed: ${getResponse.status}`
          }
        }
      } else {
        return {
          success: false,
          error: `Transaction failed: ${sendResponse.status}`
        }
      }
    } catch (error) {
      console.error('Error creating order:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Cancel order
  async cancelOrder(
    userAddress: string,
    orderId: bigint
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.server.getAccount(userAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'cancel_order',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' }),
            nativeToScVal(orderId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      // First simulate to check if transaction is valid
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!SorobanClient.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      // For simple contract calls, we can directly sign the original transaction
      const signResult = await this.wallet.signTransaction(transaction.toXDR())
      
      if (!signResult.success || !signResult.signedXDR) {
        return {
          success: false,
          error: signResult.error || 'Failed to sign transaction'
        }
      }

      const signedTransaction = TransactionBuilder.fromXDR(signResult.signedXDR, Networks.TESTNET)
      const sendResponse = await this.server.sendTransaction(signedTransaction)

      if (sendResponse.status === 'PENDING') {
        // Wait for confirmation
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        
        // Poll for transaction result
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
        }

        if (getResponse.status === 'SUCCESS') {
          return { success: true }
        } else {
          return {
            success: false,
            error: `Transaction failed: ${getResponse.status}`
          }
        }
      } else {
        return {
          success: false,
          error: `Transaction failed: ${sendResponse.status}`
        }
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Get order by ID
  async getOrderById(orderId: bigint): Promise<TrailingOrder | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_order_by_id',
            nativeToScVal(orderId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (SorobanClient.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const nativeResult = scValToNative(result)
          if (nativeResult) {
            return this.parseOrderFromResult(nativeResult)
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting order by ID:', error)
      return null
    }
  }

  // Get total orders count
  async getTotalOrders(): Promise<bigint> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call('get_total_orders')
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (SorobanClient.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const count = scValToNative(result)
          return BigInt(count || 0)
        }
      }
      
      return BigInt(0)
    } catch (error) {
      console.error('Error getting total orders:', error)
      return BigInt(0)
    }
  }

  // Helper method to parse orders from contract result
  private parseOrdersFromResult(result: unknown): TrailingOrder[] {
    if (!Array.isArray(result)) return []
    
    return result.map((orderData: unknown) => this.parseOrderFromResult(orderData))
  }

  // Helper method to parse single order from contract result
  private parseOrderFromResult(orderData: unknown): TrailingOrder {
    const data = orderData as OrderResultData
    
    return {
      id: BigInt(data.id || 0),
      user: data.user || '',
      asset: data.asset || '',
      amount: BigInt(data.amount || 0),
      trail_percentage: Number(data.trail_percentage || 0),
      initial_price: BigInt(data.initial_price || 0),
      highest_price: BigInt(data.highest_price || 0),
      current_stop_price: BigInt(data.current_stop_price || 0),
      status: (data.status as TrailingOrder['status']) || 'Active',
      created_at: BigInt(data.created_at || 0),
      updated_at: BigInt(data.updated_at || 0),
      executed_at: data.executed_at ? BigInt(data.executed_at) : undefined,
      execution_price: data.execution_price ? BigInt(data.execution_price) : undefined,
    }
  }

  // Utility method to format amounts (convert from stroops)
  static formatAmount(amount: bigint, decimals: number = 7): string {
    const divisor = BigInt(10 ** decimals)
    const whole = amount / divisor
    const fraction = amount % divisor
    
    if (fraction === BigInt(0)) {
      return whole.toString()
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0')
    return `${whole}.${fractionStr}`.replace(/\.?0+$/, '')
  }

  // Utility method to parse amounts (convert to stroops)
  static parseAmount(amount: string, decimals: number = 7): bigint {
    const parts = amount.split('.')
    const whole = parts[0] || '0'
    const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
    
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)
  }
}