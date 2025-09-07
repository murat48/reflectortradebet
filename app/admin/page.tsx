/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { SorobanService } from '@/lib/soroban'
import { WalletService } from '@/lib/wallet'
import { ASSETS } from '@/components/AssetPriceDisplay'

const CONTRACT_ADDRESS = 'CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX'
const ADMIN_ADDRESS = 'GALDPLQ62RAX3V7RJE73D3C2F4SKHGCJ3MIYJ4MLU2EAIUXBDSUVS7SA'
const REFRESH_INTERVAL = 30000 // 30 seconds auto-refresh

interface LiquidityData {
  tokenSymbol: string;
  contractBalance: string;
  liquidityNeeds: string;
  availableCommission: string;
}

export default function AdminPanel() {
  const [sorobanService] = useState(() => new SorobanService(CONTRACT_ADDRESS))
  const [walletService] = useState(() => WalletService.getInstance())
  
  // State
  const [connected, setConnected] = useState(false)
  const [userAddress, setUserAddress] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Admin data
  const [liquidityInfo, setLiquidityInfo] = useState<{
    [tokenAddress: string]: LiquidityData
  }>({})
  const [adminLoading, setAdminLoading] = useState(false)
  const [liquidityAmount, setLiquidityAmount] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Statistics
  const [contractStats, setContractStats] = useState({
    totalActiveOrders: 0,
    totalUsers: 0,
    totalVolume: '0'
  })

  // Format address for display
  const formatAddress = useCallback((addr: string) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : ''
  }, [])

  // Check wallet connection
  const checkWalletConnection = useCallback(async () => {
    try {
      const isConnected = await walletService.isWalletConnected()
      if (isConnected) {
        const address = await walletService.getAddress()
        if (address) {
          setUserAddress(address)
          setConnected(true)
          setIsAdmin(address === ADMIN_ADDRESS)
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }, [walletService])

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true)
      setError('')
      
      const result = await walletService.connectWallet()
      
      if (result.success && result.address) {
        setUserAddress(result.address)
        setConnected(true)
        setIsAdmin(result.address === ADMIN_ADDRESS)
        setSuccess('Wallet connected successfully!')
      } else {
        setError(result.error || 'Failed to connect wallet')
      }
    } catch (error) {
      setError('Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }

  // Load liquidity information for all tokens
  const loadLiquidityInfo = useCallback(async () => {
    if (!isAdmin || !connected) return
    
    try {
      setAdminLoading(true)
      setError('')
      
      // Get all available tokens from ASSETS
      const liquidityData: { [tokenAddress: string]: LiquidityData } = {}
      
      // Query liquidity info for each token
      for (const asset of Object.values(ASSETS)) {
        try {
          // Get contract balance
          const contractBalance = await sorobanService.getContractBalance(asset.token)
          
          // Get liquidity needs  
          const liquidityNeeds = await sorobanService.checkLiquidityNeeds(asset.token)
          
          // Get commission info
          const commissionInfo = await sorobanService.getCommissionInfo(asset.token)
          
          liquidityData[asset.token] = {
            tokenSymbol: asset.symbol,
            contractBalance: contractBalance ? SorobanService.formatAmount(contractBalance) : '0',
            liquidityNeeds: liquidityNeeds ? SorobanService.formatAmount(liquidityNeeds) : '0',
            availableCommission: commissionInfo ? SorobanService.formatAmount(commissionInfo[1]) : '0'
          }
        } catch (error) {
          console.error(`Error loading liquidity info for ${asset.symbol}:`, error)
          liquidityData[asset.token] = {
            tokenSymbol: asset.symbol,
            contractBalance: 'Error',
            liquidityNeeds: 'Error', 
            availableCommission: 'Error'
          }
        }
      }
      
      setLiquidityInfo(liquidityData)
      setLastRefresh(new Date())
      setSuccess('Liquidity information updated successfully')
      
    } catch (error) {
      console.error('Error loading liquidity info:', error)
      setError('Failed to load liquidity information')
    } finally {
      setAdminLoading(false)
    }
  }, [isAdmin, connected, sorobanService])

  // Add liquidity for specific token
  const addLiquidity = async (tokenAddress: string) => {
    if (!isAdmin || !connected || !liquidityAmount) return
    
    try {
      setAdminLoading(true)
      setError('')
      
      const amountInStroops = SorobanService.parseAmountfortoken(liquidityAmount)
      
      const result = await sorobanService.addLiquidity(userAddress, tokenAddress, amountInStroops)
      
      if (result.success) {
        const asset = Object.values(ASSETS).find(a => a.token === tokenAddress)
        const tokenSymbol = asset ? asset.symbol : formatAddress(tokenAddress)
        
        setSuccess(`Liquidity added successfully: ${liquidityAmount} ${tokenSymbol}`)
        setLiquidityAmount('')
        // Refresh liquidity info
        await loadLiquidityInfo()
      } else {
        setError(result.error || 'Failed to add liquidity')
      }
    } catch (error) {
      console.error('Error adding liquidity:', error)
      setError('Failed to add liquidity')
    } finally {
      setAdminLoading(false)
    }
  }

  // Load contract statistics
  const loadContractStats = useCallback(async () => {
    if (!isAdmin || !connected) return
    
    try {
      // You can implement these functions in soroban.ts if needed
      // For now, showing placeholder values
      setContractStats({
        totalActiveOrders: 0, // await sorobanService.getTotalActiveOrders()
        totalUsers: 0, // await sorobanService.getTotalUsers()
        totalVolume: '0' // await sorobanService.getTotalVolume()
      })
    } catch (error) {
      console.error('Error loading contract stats:', error)
    }
  }, [isAdmin, connected])

  // Clear messages
  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  // Check wallet connection on mount
  useEffect(() => {
    checkWalletConnection()
  }, [checkWalletConnection])

  // Load data when admin connects
  useEffect(() => {
    if (isAdmin && connected) {
      loadLiquidityInfo()
      loadContractStats()
    }
  }, [isAdmin, connected, loadLiquidityInfo, loadContractStats])

  // Auto-refresh liquidity info
  useEffect(() => {
    if (isAdmin && connected) {
      const interval = setInterval(() => {
        loadLiquidityInfo()
      }, REFRESH_INTERVAL)
      
      return () => clearInterval(interval)
    }
  }, [isAdmin, connected, loadLiquidityInfo])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-2">
            🛡️ Admin Control Panel
          </h1>
          <p className="text-gray-600">Contract Liquidity & Management Dashboard</p>
          <div className="text-sm text-gray-500 mt-2">
            Contract: <span className="font-mono">{formatAddress(CONTRACT_ADDRESS)}</span>
          </div>
        </div>

        {/* Connection Status */}
        {!connected ? (
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white border-2 border-purple-200 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Admin Wallet</h3>
              <p className="text-gray-600 mb-4">Connect your admin wallet to access the control panel</p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        ) : !isAdmin ? (
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-2">This panel is only accessible to admin wallet</p>
              <p className="text-sm text-red-500">
                Connected: {formatAddress(userAddress)}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Admin Info */}
            <div className="bg-white border-2 border-green-200 rounded-lg p-4 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600">✅</span>
                  </div>
                  <div>
                    <div className="font-semibold text-green-800">Admin Access Granted</div>
                    <div className="text-sm text-green-600">{formatAddress(userAddress)}</div>
                  </div>
                </div>
                {lastRefresh && (
                  <div className="text-sm text-gray-500">
                    Last refresh: {lastRefresh.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={loadLiquidityInfo}
                disabled={adminLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {adminLoading ? '⟳' : '🔄'} 
                {adminLoading ? 'Loading...' : 'Refresh All Data'}
              </button>
              <button
                onClick={clearMessages}
                className="bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Clear Messages
              </button>
            </div>

            {/* Messages */}
            {(error || success) && (
              <div className="mb-8">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">❌</span>
                      <span className="text-red-800 font-medium">Error</span>
                    </div>
                    <p className="text-red-700 mt-1">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✅</span>
                      <span className="text-green-800 font-medium">Success</span>
                    </div>
                    <p className="text-green-700 mt-1">{success}</p>
                  </div>
                )}
              </div>
            )}

            {/* Contract Statistics */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📊</span>
                  <h3 className="font-semibold text-blue-800">Active Orders</h3>
                </div>
                <div className="text-3xl font-bold text-blue-900">{contractStats.totalActiveOrders}</div>
              </div>
              <div className="bg-white border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">👥</span>
                  <h3 className="font-semibold text-green-800">Total Users</h3>
                </div>
                <div className="text-3xl font-bold text-green-900">{contractStats.totalUsers}</div>
              </div>
              <div className="bg-white border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💰</span>
                  <h3 className="font-semibold text-purple-800">Total Volume</h3>
                </div>
                <div className="text-3xl font-bold text-purple-900">{contractStats.totalVolume}</div>
              </div>
            </div> */}

            {/* Liquidity Management */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span>💧</span> Liquidity Management
              </h2>
              
              {Object.keys(liquidityInfo).length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(liquidityInfo).map(([tokenAddress, info]) => (
                    <div key={tokenAddress} className="bg-white border-2 border-purple-200 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-xl font-bold text-purple-600">{info.tokenSymbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-purple-800">{info.tokenSymbol}</h3>
                          <div className="text-xs text-gray-500 font-mono">{formatAddress(tokenAddress)}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                          <div className="text-xs font-medium text-purple-600 mb-1">Balance</div>
                          <div className="text-lg font-bold text-purple-900 break-all">{info.contractBalance}</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                          <div className="text-xs font-medium text-orange-600 mb-1">Needed</div>
                          <div className="text-lg font-bold text-orange-900 break-all">{info.liquidityNeeds}</div>
                        </div>
                    
                      </div>

                      <div className="border-t pt-4">
                        <div className="text-sm font-medium text-purple-700 mb-3">💰 Add Liquidity</div>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            value={liquidityAmount}
                            onChange={(e) => setLiquidityAmount(e.target.value)}
                            placeholder={`Amount (${info.tokenSymbol})`}
                            step="0.1"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <button
                            onClick={() => addLiquidity(tokenAddress)}
                            disabled={adminLoading || !liquidityAmount}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                          >
                            {adminLoading ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                        <div className="text-xs text-purple-600 mt-2">
                          ℹ️ Add {info.tokenSymbol} to cover profit payouts
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="text-gray-500 mb-2">No liquidity data available</div>
                  <div className="text-sm text-gray-400 mb-4">
                    Click Refresh All Data to load liquidity information
                  </div>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-12 bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">
                  🔄 Auto-refresh every {REFRESH_INTERVAL / 1000} seconds
                </div>
                <div className="text-xs text-gray-500">
                  Professional Trading Contract Admin Panel
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
