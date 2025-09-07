/* eslint-disable @typescript-eslint/no-explicit-any */
// services/simpleWallet.ts
declare global {
  interface Window {
    freighterApi: {
      isConnected(): Promise<boolean>
      getPublicKey(): Promise<string>
      signTransaction(xdr: string, opts?: any): Promise<string>
      requestAccess(): Promise<{ publicKey: string }>
      getNetwork(): Promise<string>
      getNetworkDetails(): Promise<{ network: string; networkPassphrase: string }>
    }
  }
}

export class SimpleWalletService {
  private static instance: SimpleWalletService | null = null

  static getInstance(): SimpleWalletService {
    if (!this.instance) {
      this.instance = new SimpleWalletService()
    }
    return this.instance
  }

  // Freighter'ın yüklü olup olmadığını kontrol et
  private isFreighterAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.freighterApi
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.isFreighterAvailable()) {
        console.log('❌ Freighter extension not found')
        return false
      }
      
      const connected = await window.freighterApi.isConnected()
      console.log('🔍 Freighter connection status:', connected)
      return connected
    } catch (error) {
      console.error('❌ Error checking Freighter connection:', error)
      return false
    }
  }

  async connect(): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    try {
      if (!this.isFreighterAvailable()) {
        return { 
          success: false, 
          error: 'Freighter extension not found. Please install Freighter wallet extension.' 
        }
      }

      console.log('🔄 Requesting Freighter access...')
      const result = await window.freighterApi.requestAccess()
      
      console.log('✅ Freighter access granted:', result.publicKey)
      return { success: true, publicKey: result.publicKey }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed'
      console.error('❌ Freighter connection error:', errorMsg)
      
      return {
        success: false,
        error: errorMsg
      }
    }
  }

  async getCurrentAddress(): Promise<string | null> {
    try {
      if (!this.isFreighterAvailable()) {
        console.log('❌ Freighter not available')
        return null
      }
      
      const address = await window.freighterApi.getPublicKey()
      console.log('👤 Current address:', address)
      return address
    } catch (error) {
      console.error('❌ Error getting address:', error)
      return null
    }
  }

  async signTransaction(xdr: string): Promise<{ success: boolean; signedXDR?: string; error?: string }> {
    try {
      if (!this.isFreighterAvailable()) {
        return { success: false, error: 'Freighter extension not found' }
      }

      console.log('✍️ Requesting transaction signature...')
      
      // Freighter için network options
      const signOptions = {
        networkPassphrase: 'Test SDF Network ; September 2015'
      }

      const signedXDR = await window.freighterApi.signTransaction(xdr, signOptions)
      
      console.log('✅ Transaction signed successfully')
      return { success: true, signedXDR }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Signing failed'
      console.error('❌ Transaction signing error:', errorMsg)
      
      return {
        success: false,
        error: errorMsg
      }
    }
  }

  // Network bilgisini al
  async getNetwork(): Promise<string> {
    try {
      if (!this.isFreighterAvailable()) {
        return 'unknown'
      }
      
      const network = await window.freighterApi.getNetwork()
      console.log('🌐 Current network:', network)
      return network
    } catch (error) {
      console.error('❌ Error getting network:', error)
      return 'unknown'
    }
  }

  // Freighter'ın hazır olmasını bekle
  async waitForFreighter(timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (this.isFreighterAvailable()) {
        console.log('✅ Freighter detected')
        return true
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log('⏱️ Freighter detection timeout')
    return false
  }

  // Status bilgisini al
  async getStatus(): Promise<{
    available: boolean
    connected: boolean
    address: string | null
    network: string
  }> {
    const available = this.isFreighterAvailable()
    const connected = available ? await this.isConnected() : false
    const address = connected ? await this.getCurrentAddress() : null
    const network = available ? await this.getNetwork() : 'unknown'

    return {
      available,
      connected,
      address,
      network
    }
  }
}