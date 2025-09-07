/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/wallet.ts
import { 
  isConnected, 
  getAddress, 
  signTransaction,
  requestAccess,
  setAllowed
} from '@stellar/freighter-api'

export class WalletService {
  [x: string]: any
  private static instance: WalletService
  private isFreighterAvailable = false

  private constructor() {
    this.checkFreighterAvailability()
  }

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService()
    }
    return WalletService.instance
  }

  private async checkFreighterAvailability() {
    try {
      const result = await isConnected()
      this.isFreighterAvailable = result.isConnected
    } catch (error) {
      console.warn('Freighter not available:', error)
      this.isFreighterAvailable = false
    }
  }

  async connectWallet(): Promise<{ success: boolean; address?: string; error?: string }> {
    try {
      if (!this.isFreighterAvailable) {
        return {
          success: false,
          error: 'Freighter wallet is not installed. Please install it from https://www.freighter.app/'
        }
      }

      // Request access to Freighter
      const accessResult = await requestAccess()
      if (accessResult.error) {
        return {
          success: false,
          error: accessResult.error
        }
      }
      
      // Set permission
      const allowResult = await setAllowed()
      if (allowResult.error) {
        return {
          success: false,
          error: allowResult.error
        }
      }
      
      // Get public key
      const addressResult = await getAddress()
      if (addressResult.error) {
        return {
          success: false,
          error: addressResult.error
        }
      }
      
      return {
        success: true,
        address: addressResult.address
      }
    } catch (error) {
      console.error('Wallet connection error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet'
      }
    }
  }

  // Alias for connectWallet to maintain compatibility
  async connect(): Promise<{ success: boolean; address?: string; error?: string }> {
    return this.connectWallet()
  }

  async isWalletConnected(): Promise<boolean> {
    try {
      const result = await isConnected()
      return result.isConnected
    } catch {
      return false
    }
  }

  async getAddress(): Promise<string | null> {
    try {
      if (await this.isWalletConnected()) {
        const result = await getAddress()
        return result.address || null
      }
      return null
    } catch {
      return null
    }
  }

  async signTransaction(transactionXDR: string): Promise<{ success: boolean; signedXDR?: string; error?: string }> {
    try {
      const userAddress = await this.getAddress()
      if (!userAddress) {
        return {
          success: false,
          error: 'No wallet address available'
        }
      }

      const result = await signTransaction(transactionXDR, {
       networkPassphrase: 'Test SDF Network ; September 2015',
        address: userAddress
      })
      
      if (result.signedTxXdr) {
        return {
          success: true,
          signedXDR: result.signedTxXdr
        }
      } else {
        return {
          success: false,
          error: 'Failed to sign transaction'
        }
      }
    } catch (error) {
      console.error('Transaction signing error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign transaction'
      }
    }
  }
}