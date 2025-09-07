/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/soroban.ts
import { 
  rpc,
  Contract, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE,
  Address,
  xdr,
  scValToNative,
  nativeToScVal,
  
} from '@stellar/stellar-sdk'
// import * as SorobanClient from '@stellar/stellar-sdk/rpc'
import { WalletService } from './wallet'
import { i128 } from '@stellar/stellar-sdk/contract'
import { SecureStellarManager } from './stellar-manager-secure';

export interface TrailingOrder {
  id: bigint
  user: string
  asset: string
  token: string
  amount: bigint
  trail_percentage: number
  initial_price: bigint
  highest_price: bigint
  stop_price: bigint
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
  token?: string
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
  // Check and execute orders (updated to use local wallet)
  async checkAndExecuteOrders(): Promise<{ 
    success: boolean; 
    executedOrderIds?: bigint[]; 
    error?: string 
  }> {
    // const walletInfo = this.localWallet.getWalletInfo()
    // if (!walletInfo) {
    //   return {
    //     success: false,
    //     error: 'No wallet available. Initialize wallet first.'
    //   }
    // }

    try {
      const stellarManager = new SecureStellarManager();


  // const StellarSdk = await import('@stellar/stellar-sdk');

// Keypair'inizi zaten oluşturmuştunuz
 const keypair = stellarManager.getOrCreateKeypair();



// Friendbot'tan testnet XLM al




//             const StellarSdk = await import('@stellar/stellar-sdk');
//              const keypair = StellarSdk.Keypair.random();
// // ;
// //            const account = await this.server.getAccount(keypair.publicKey())
// const response = await fetch(
//   `https://friendbot.stellar.org?addr=${keypair.publicKey()}`
// );
           const account = await this.server.getAccount(keypair.publicKey())
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call('check_and_execute_orders')
        )
        .setTimeout(60)
        .build()

      // First simulate
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      const preparedTransaction = await this.server.prepareTransaction(transaction)
      preparedTransaction.sign(keypair);
      
      const sendResponse = await this.server.sendTransaction(preparedTransaction);
      
      if (sendResponse.status === 'PENDING') {
        // Transaction submitted, wait for confirmation
        let getResponse = await this.server.getTransaction(sendResponse.hash)
        
        // Poll for transaction result
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(sendResponse.hash)
        }
        
        if (getResponse.status === 'SUCCESS') {
          // Extract executed order IDs from transaction result
          let executedOrderIds: bigint[] = []
          
          try {
            const result = getResponse.returnValue
            if (result) {
              const nativeResult = scValToNative(result)
              console.log('Contract result:', nativeResult)
              
              // The contract should return an array of executed order IDs
              if (Array.isArray(nativeResult)) {
                executedOrderIds = nativeResult.map(id => BigInt(id))
              } else if (nativeResult !== null && nativeResult !== undefined) {
                // If single value, convert to array
                executedOrderIds = [BigInt(nativeResult)]
              }
            }
          } catch (error) {
            console.warn('Could not parse executed order IDs:', error)
          }
          
          // Güvenli keypair bilgileri
          const info = stellarManager.getKeypairInfo();
          console.log('🔐 Şifrelenmiş Keypair Bilgileri:');
          console.log(`🔑 Public Key: ${info.publicKey}`);
          console.log(`⏳ Kalan süre: ${info.remainingHours} saat`);
          console.log(`🛡️ Şifreleme durumu: ${info.isEncrypted ? 'Aktif' : 'Pasif'}`);
          console.log(`📅 Bitiş tarihi: ${info.expiresAt.toLocaleString('tr-TR')}`);
          
          return {
            success: true,
            executedOrderIds
          };
        } else {
          return {
            success: false,
            error: `Transaction failed: ${getResponse.status}`
          }
        }
      } else {
        return {
          success: false,
          error: `Transaction submission failed: ${sendResponse.status}`
        }
      }

  } catch (error) {
    console.error('❌ Transaction hatası:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    }
  }

  // Update order prices for active orders - this should be called periodically
  async updateOrderPrices(): Promise<{ 
    success: boolean; 
    updatedCount?: number;
    error?: string 
  }> {
    try {
      console.log('🔧 UPDATE_PRICES: Starting price update process...')
      
      const stellarManager = new SecureStellarManager();
      const keypair = stellarManager.getOrCreateKeypair();
      console.log('🔧 UPDATE_PRICES: Using keypair:', keypair.publicKey())
      
      const account = await this.server.getAccount(keypair.publicKey())
      console.log('🔧 UPDATE_PRICES: Account loaded, sequence:', account.sequenceNumber())
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call('update_order_prices')
        )
        .setTimeout(60)
        .build()

      console.log('🔧 UPDATE_PRICES: Transaction built, simulating...')

      // First simulate
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        console.error('❌ UPDATE_PRICES: Simulation failed:', simulateResponse)
        return {
          success: false,
          error: 'Price update simulation failed'
        }
      }

      console.log('✅ UPDATE_PRICES: Simulation successful, signing and submitting...')

      // Sign and submit
      transaction.sign(keypair)
      const submitResponse = await this.server.sendTransaction(transaction)
      
      console.log('🔧 UPDATE_PRICES: Submit response status:', submitResponse.status)
      
      if (submitResponse.status === 'PENDING') {
        // Wait for confirmation
        console.log('⏳ UPDATE_PRICES: Waiting for confirmation, hash:', submitResponse.hash)
        let getResponse = await this.server.getTransaction(submitResponse.hash)
        
        while (getResponse.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 1000))
          getResponse = await this.server.getTransaction(submitResponse.hash)
        }
        
        if (getResponse.status === 'SUCCESS') {
          console.log('✅ UPDATE_PRICES: Transaction confirmed successfully!')
          return {
            success: true,
            updatedCount: 0 // Smart contract should return this
          }
        } else {
          console.error('❌ UPDATE_PRICES: Transaction failed:', getResponse)
          return {
            success: false,
            error: 'Price update transaction failed'
          }
        }
      }
      
      console.error('❌ UPDATE_PRICES: Submit failed, status:', submitResponse.status)
      return {
        success: false,
        error: 'Price update submission failed'
      }
    } catch (error) {
      console.error('❌ UPDATE_PRICES: Exception occurred:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
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
      
      if (rpc.Api.isSimulationSuccess(response)) {
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
// async getval():Promise<string|null>{
//       const StellarSdk = await import('@stellar/stellar-sdk');
//     const keypair = StellarSdk.Keypair.random();
// return keypair.publicKey();
// }
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
      
      if (rpc.Api.isSimulationSuccess(response)) {
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
      
      if (rpc.Api.isSimulationSuccess(response)) {
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

  // Generic Oracle contract call method
  async callOracleContract(contractId: string, methodName: string, args: (string | number)[] = []): Promise<unknown> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const oracleContract = new Contract(contractId)
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          oracleContract.call(
            methodName,
            ...args.map(arg => {
              if (typeof arg === 'string' && arg.startsWith('C')) {
                return nativeToScVal(Address.fromString(arg), { type: 'address' })
              }
              return nativeToScVal(arg)
            })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          return scValToNative(result)
        }
      }
      
      return null
    } catch (error) {
      console.error(`Error calling Oracle contract method ${methodName}:`, error)
      throw error
    }
  }
async callOracleContractHistory(contractId: string, methodName: string, args: any[] = []): Promise<unknown> {
  try {
    const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    const account = await this.server.getAccount(dummyAddress)
    
    const oracleContract = new Contract(contractId)
    
    // ScVal argümanlarını hazırla
    const scValArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.startsWith('C')) {
        // Stellar address
        return nativeToScVal(Address.fromString(arg), { type: 'address' })
      } else if (typeof arg === 'number') {
        // Sayı için u32 olarak dönüştür
        return nativeToScVal(arg, { type: 'u32' })
      } else if (typeof arg === 'string') {
        // String argümanlar
        return nativeToScVal(arg, { type: 'string' })
      }
      // Diğer durumlar için otomatik dönüştürme
      return nativeToScVal(arg)
    })
    
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        oracleContract.call(
          methodName,
          ...scValArgs
        )
      )
      .setTimeout(30)
      .build()
    
    console.log('Transaction built, simulating...')
    const response = await this.server.simulateTransaction(transaction)
    
    console.log('Simulation response:', response)
    
    if (rpc.Api.isSimulationSuccess(response)) {
      const result = response.result?.retval
      if (result) {
        const nativeResult = scValToNative(result)
        console.log('Native result:', nativeResult)
        return nativeResult
      }
    } else {
      console.error('Simulation failed:', response)
      if (response.error) {
        console.error('Error details:', response.error)
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error calling Oracle contract method ${methodName}:`, error)
    throw error
  }
}
  // Create new trailing stop order
  async createOrder(
    userAddress: string,
    assetAddress: string,
    tokenAddress: string,
    amount: bigint,
    trailPercentage: number
  ): Promise<{ success: boolean; orderId?: bigint; error?: string }> {
    try {
      console.log('SorobanService.createOrder called with:', {
        userAddress,
        assetAddress,
        tokenAddress,
        amount: amount.toString(),
        trailPercentage
      });

      const account = await this.server.getAccount(userAddress)
      
      // Validate input parameters
      if (trailPercentage < 0 || trailPercentage > 5000) { // 0% to 50% (in basis points)
        throw new Error(`Invalid trail percentage: ${trailPercentage}. Must be between 0 and 5000 basis points.`);
      }

      if (amount <= 0) {
        throw new Error(`Invalid amount: ${amount}. Must be positive.`);
      }
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'create_order',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' }),
            nativeToScVal(Address.fromString(assetAddress), { type: 'address' }),
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' }),
            nativeToScVal(amount, { type: 'i128' }),
            nativeToScVal(trailPercentage, { type: 'u32' })
          )
        )
        .setTimeout(30)
        .build()

      console.log('Transaction parameters:', {
        userAddress,
        assetAddress,
        tokenAddress,
        amount: amount.toString(),
        trailPercentage
      });

      console.log('Transaction built, simulating...');

      // First simulate to check if transaction is valid
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      console.log('Simulation response:', simulateResponse);
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        console.error('Simulation failed:', simulateResponse);
        return {
          success: false,
          error: `Transaction simulation failed: ${JSON.stringify(simulateResponse)}`
        }
      }
   const preparedTransaction = await this.server.prepareTransaction(transaction);
   
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR());
      
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
        console.error('Transaction send failed:', sendResponse);
        return {
          success: false,
          error: `Transaction failed: ${sendResponse.status}`
        }
      }
    } catch (error) {
      console.error('Error creating order:', error)
      
      // More detailed error reporting
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error types
        if (error.message.includes('bad_union_switch')) {
          errorMessage = 'Contract parameter type mismatch. Please check input values.';
        } else if (error.message.includes('invoke_contract_failed')) {
          errorMessage = 'Contract execution failed. Please verify contract parameters.';
        } else if (error.message.includes('insufficient_balance')) {
          errorMessage = 'Insufficient balance to create order.';
        }
      }
      
      return {
        success: false,
        error: errorMessage
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
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

     
         const preparedTransaction = await this.server.prepareTransaction(transaction);
   
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR());
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

  // Emergency sell order at current market price
  async emergencySellOrder(
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
            'emergency_sell_order',
            nativeToScVal(Address.fromString(userAddress), { type: 'address' }),
            nativeToScVal(orderId, { type: 'u64' })
          )
        )
        .setTimeout(30)
        .build()

      // First simulate to check if transaction is valid
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      const preparedTransaction = await this.server.prepareTransaction(transaction);
   
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR());
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
      console.error('Error executing emergency sell:', error)
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
      
      if (rpc.Api.isSimulationSuccess(response)) {
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
      
      if (rpc.Api.isSimulationSuccess(response)) {
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
    
    console.log('Raw order data from contract:', data)
    
    const parsed = {
      id: BigInt(data.id || 0),
      user: data.user || '',
      asset: data.asset || '',
      token: data.token || data.asset || '', // Use token field or fallback to asset
      amount: BigInt(data.amount || 0),
      trail_percentage: Number(data.trail_percentage || 0),
      initial_price: BigInt(data.initial_price || 0),
      highest_price: BigInt(data.highest_price || 0),
      stop_price: BigInt(data.current_stop_price || 0),
      status: (data.status as TrailingOrder['status']) || 'Active',
      created_at: BigInt(data.created_at || 0),
      updated_at: BigInt(data.updated_at || 0),
      executed_at: data.executed_at ? BigInt(data.executed_at) : undefined,
      execution_price: data.execution_price ? BigInt(data.execution_price) : undefined,
    }
    
    console.log('Parsed order:', {
      id: parsed.id.toString(),
      initial_price: parsed.initial_price.toString(),
      highest_price: parsed.highest_price.toString(),
      trail_percentage: parsed.trail_percentage,
      status: parsed.status
    })
    
    return parsed
  }

  // Utility method to format amounts (convert from stroops)
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

  // Utility method to parse amounts (convert to stroops)
  static parseAmount(amount: string, decimals: number = 14): bigint {
    const parts = amount.split('.')
    const whole = parts[0] || '0'
    const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
    
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)
  }
  static parseAmountfortoken(amount: string, decimals: number = 7): bigint {
    const parts = amount.split('.')
    const whole = parts[0] || '0'
    const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
    
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)
  }

  // Admin functions
  async getContractBalance(tokenAddress: string): Promise<bigint | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_contract_balance',
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          return scValToNative(result) as bigint
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting contract balance:', error)
      return null
    }
  }

  async checkLiquidityNeeds(tokenAddress: string): Promise<bigint | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'check_liquidity_needs',
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          return scValToNative(result) as bigint
        }
      }
      
      return null
    } catch (error) {
      console.error('Error checking liquidity needs:', error)
      return null
    }
  }

  async getCommissionInfo(tokenAddress: string): Promise<[bigint, bigint] | null> {
    try {
      const dummyAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const account = await this.server.getAccount(dummyAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'get_commission_info',
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
          )
        )
        .setTimeout(30)
        .build()

      const response = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result?.retval
        if (result) {
          const native = scValToNative(result) as [bigint, bigint]
          return native
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting commission info:', error)
      return null
    }
  }

  async addLiquidity(fromAddress: string, tokenAddress: string, amount: bigint): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.server.getAccount(fromAddress)
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          this.contract.call(
            'add_liquidity',
            nativeToScVal(Address.fromString(fromAddress), { type: 'address' }),
            nativeToScVal(Address.fromString(tokenAddress), { type: 'address' }),
            nativeToScVal(amount, { type: 'i128' })
          )
        )
        .setTimeout(30)
        .build()

      // First simulate to check if transaction is valid
      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (!rpc.Api.isSimulationSuccess(simulateResponse)) {
        return {
          success: false,
          error: 'Transaction simulation failed'
        }
      }

      const preparedTransaction = await this.server.prepareTransaction(transaction)
      const signResult = await this.wallet.signTransaction(preparedTransaction.toXDR())
      
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
      console.error('Error adding liquidity:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add liquidity' }
    }
  }

  async getEmergencyCommissionRate(): Promise<number> {
    try {
      // Use a temporary keypair for read-only operations
       const stellarManager = new SecureStellarManager();


  // const StellarSdk = await import('@stellar/stellar-sdk');

// Keypair'inizi zaten oluşturmuştunuz
 const keypair = stellarManager.getOrCreateKeypair();

const account = await this.server.getAccount(keypair.publicKey())
     

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(this.contract.call('get_emergency_commission_rate'))
        .setTimeout(30)
        .build()

      const simulateResponse = await this.server.simulateTransaction(transaction)
      
      if (rpc.Api.isSimulationSuccess(simulateResponse)) {
        const result = simulateResponse.result?.retval
        if (result) {
          // Convert XDR result to number
          const commissionRate = scValToNative(result)
          console.log('📊 Emergency commission rate from contract:', commissionRate, 'basis points')
          return commissionRate as number
        }
      }
      
      console.log('⚠️ Failed to get commission rate from contract, using default')
      return 50 // Default 0.5% (50 basis points)
    } catch (error) {
      console.error('Error getting emergency commission rate:', error)
      return 50 // Default 0.5% (50 basis points)
    }
  }
}