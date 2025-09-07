// app/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import SimpleTrailingStopTrading from '@/components/SimpleTrailingStopTrading'
import OracleDataDashboard from '@/components/OracleDataDashboard2'
import BettingMarketDashboard from '@/components/BettingMarketDashboard'
// import OracleDemo from '@/components/OracleDemo'
import { SorobanService } from '@/lib/soroban'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { WalletService } from '@/lib/wallet'

const ADMIN_ADDRESS = 'GALDPLQ62RAX3V7RJE73D3C2F4SKHGCJ3MIYJ4MLU2EAIUXBDSUVS7SA'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'trading' | 'oracle' | 'betting'>('trading')
  const [userAddress, setUserAddress] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [walletService] = useState(() => WalletService.getInstance())

  // Check wallet connection and admin status
  const checkWalletConnection = useCallback(async () => {
    try {
      const isConnected = await walletService.isWalletConnected()
      if (isConnected) {
        const address = await walletService.getAddress()
        if (address) {
          setUserAddress(address)
          setIsAdmin(address === ADMIN_ADDRESS)
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }, [walletService])

  // Check wallet connection on component mount and set up polling
  useEffect(() => {
    checkWalletConnection()
    
    // Poll for wallet connection changes every 2 seconds
    const interval = setInterval(checkWalletConnection, 2000)
    
    return () => clearInterval(interval)
  }, [checkWalletConnection])

  // Initialize Soroban service for the Oracle Dashboard
  const sorobanService = new SorobanService(
    CONTRACT_ADDRESSES.ORACLE // Oracle contract ID
  )

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('trading')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trading'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Trailing Stop Trading
            </button>
            <button
              onClick={() => setActiveTab('oracle')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'oracle'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Oracle Dashboard
            </button>
            <button
              onClick={() => setActiveTab('betting')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'betting'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Betting Market
            </button>
            
            {/* Admin Access Button - Only visible to admins */}
            {isAdmin && (
              <div className="ml-auto">
                <button
                  onClick={() => window.open('/admin', '_blank')}
                  className="py-2 px-4 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors my-2"
                >
                  Admin Access
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {/* {activeTab === 'demo' && <OracleDemo />} */}
        {activeTab === 'oracle' && <OracleDataDashboard sorobanService={sorobanService} />}
        {activeTab === 'trading' && <SimpleTrailingStopTrading />}
        {activeTab === 'betting' && <BettingMarketDashboard contractAddress={CONTRACT_ADDRESSES.BETTING_MARKET} />}
      </div>
    </main>
  )
}