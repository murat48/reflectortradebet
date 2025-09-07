'use client'

import React, { useState, useEffect } from 'react'
import { BettingMarketService, Market, UserBet, Odds } from '../lib/betting-market'
import { WalletService } from '../lib/wallet'
import { ASSETS } from './AssetPriceDisplay'
import { useTelegramNotifications } from '../lib/useTelegramNotifications'
import { SorobanService } from '@/lib/sorobanbet'

interface BettingMarketProps {
  contractAddress: string
}

export default function BettingMarketDashboard({ contractAddress }: BettingMarketProps) {
  const [service] = useState(() => new BettingMarketService(contractAddress))
  const [walletService] = useState(() => WalletService.getInstance())
  
  // State
  const [isConnected, setIsConnected] = useState(false)
  const [userAddress, setUserAddress] = useState<string>('')
  const [markets, setMarkets] = useState<Market[]>([])
  const [resolvedMarkets, setResolvedMarkets] = useState<Market[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [userBet, setUserBet] = useState<UserBet | null>(null)
  const [odds, setOdds] = useState<Odds | null>(null)
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [resolvedMarketsLoading, setResolvedMarketsLoading] = useState(false)
  const [resolvedMarketsLoaded, setResolvedMarketsLoaded] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [viewMode, setViewMode] = useState<'active' | 'resolved'>('active')

  // Asset selection states
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>('BTCLN')

  // Form states
  const [betAmount, setBetAmount] = useState('')
  const [selectedPrediction, setSelectedPrediction] = useState<'Up' | 'Down' | 'Stable'>('Up')
  const [showCreateMarket, setShowCreateMarket] = useState(false)
  const [newMarket, setNewMarket] = useState({
    title: '',
    token: '',
    bettingToken: '',
    targetPrice: '',
    stableTolerance: '',
    durationHours: '',
    houseEdge: '50' // 0.5%
  })

  // Telegram notifications
  const { notifyMarketCreated } = useTelegramNotifications()

  // Connect wallet (check if already connected from SimpleTrailingStopTrading)
  const checkExistingConnection = async () => {
    try {
      const isConnected = await walletService.isWalletConnected()
      if (isConnected) {
        const address = await walletService.getAddress()
        if (address) {
          setIsConnected(true)
          setUserAddress(address)
          setSuccess('Wallet already connected!')
          
          // Test contract connection
          const testResult = await service.testConnection()
          if (testResult.success) {
            setSuccess(`Wallet connected! ${testResult.message}`)
          }
        }
      }
    } catch (err) {
      console.error('Error checking existing connection:', err)
    }
  }

  // Load resolved markets
  const loadResolvedMarkets = async (forceRefresh = false) => {
    if (!isConnected) return

    // Return cached data if available and not forcing refresh
    if (!forceRefresh && resolvedMarketsLoaded && resolvedMarkets.length > 0) {
      console.log('🔧 HISTORY: Using cached resolved markets')
      return
    }

    try {
      setResolvedMarketsLoading(true)
      setError('')
      setLoadingProgress({ current: 0, total: 0 })
      console.log('🔧 HISTORY: Loading resolved markets...')
      console.log('🔧 HISTORY: Contract Address:', contractAddress)
      
      // Get total markets first to show progress
      const totalMarkets = await service.getTotalMarkets()
      console.log('🔧 HISTORY: Total markets count:', totalMarkets.toString())
      setLoadingProgress({ current: 0, total: Number(totalMarkets) })
      
      // Create a custom version of getResolvedMarkets with progress tracking
      const resolvedMarketsData: Market[] = []
      const allMarketsData: Array<{
        id: number
        title?: string
        is_resolved?: boolean
        exists: boolean
        error?: string
      }> = [] // For debugging
      
      // Alternative approach: Try to find the actual range of market IDs
      // Since market IDs might not be sequential, let's check a wider range
      const maxMarketId = Math.max(Number(totalMarkets), 50) // Check at least up to 50
      console.log('🔧 HISTORY: Checking market IDs from 1 to', maxMarketId)
      
      // Process markets in smaller batches for better error tracking
      const batchSize = 3
      let processed = 0
      
      for (let i = 1; i <= maxMarketId; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, maxMarketId - i + 1) }, (_, idx) => i + idx)
        console.log('🔧 HISTORY: Processing batch:', batch)
        
        const batchResults = await Promise.allSettled(
          batch.map(async (marketId) => {
            try {
              console.log(`🔧 HISTORY: Fetching market ${marketId}...`)
              const market = await service.getMarket(BigInt(marketId))
              
              if (market) {
                allMarketsData.push({
                  id: marketId,
                  title: market.title,
                  is_resolved: market.is_resolved,
                  exists: true
                })
                
                if (market.is_resolved) {
                  resolvedMarketsData.push(market)
                  console.log('✅ HISTORY: Found resolved market:', marketId, market.title)
                } else {
                  console.log('� HISTORY: Found active market:', marketId, market.title)
                }
              } else {
                console.log(`❌ HISTORY: Market ${marketId} returned null`)
                allMarketsData.push({
                  id: marketId,
                  exists: false,
                  error: 'Market returned null'
                })
              }
              
              return { marketId, success: true, market }
            } catch (error) {
              console.log(`� HISTORY: Error fetching market ${marketId}:`, error)
              allMarketsData.push({
                id: marketId,
                exists: false,
                error: error instanceof Error ? error.message : String(error)
              })
              return { marketId, success: false, error }
            }
          })
        )
        
        // Log batch results for debugging
        batchResults.forEach((result, index) => {
          const marketId = batch[index]
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              console.log(`✅ Market ${marketId}: Success`)
            } else {
              console.log(`❌ Market ${marketId}: ${result.value.error}`)
            }
          } else {
            console.log(`💥 Market ${marketId}: Promise rejected:`, result.reason)
          }
        })
        
        processed += batch.length
        setLoadingProgress({ current: processed, total: maxMarketId })
        
        // Small delay to allow UI updates and prevent overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Log comprehensive debug info
      console.log('🔧 HISTORY: All markets debug info:', allMarketsData)
      const existingMarkets = allMarketsData.filter(m => m.exists)
      const missingMarkets = allMarketsData.filter(m => !m.exists)
      const resolvedCount = existingMarkets.filter(m => m.is_resolved).length
      const activeCount = existingMarkets.filter(m => !m.is_resolved).length
      
      console.log('🔧 HISTORY: Summary:')
      console.log('  - Total markets checked:', allMarketsData.length)
      console.log('  - Found markets:', existingMarkets.length)
      console.log('  - Missing markets:', missingMarkets.length)
      console.log('  - Resolved markets:', resolvedCount)
      console.log('  - Active markets:', activeCount)
      console.log('  - Market ID range that exists:', existingMarkets.map(m => m.id).sort((a, b) => a - b))
      
      if (missingMarkets.length > 0) {
        console.log('🔧 HISTORY: Missing market IDs:', missingMarkets.map(m => m.id))
      }
      
      // Sort by market ID (newest first) to maintain creation order
      resolvedMarketsData.sort((a, b) => Number(b.id) - Number(a.id))
      
      setResolvedMarkets(resolvedMarketsData)
      setResolvedMarketsLoaded(true)
      console.log('🔧 HISTORY: Final resolved markets loaded:', resolvedMarketsData.length)
      console.log('🔧 HISTORY: Resolved market IDs:', resolvedMarketsData.map(m => m.id.toString()))
      
      if (resolvedMarketsData.length === 0) {
        setSuccess(`No historical markets found (Checked ${allMarketsData.length} IDs, found ${existingMarkets.length} markets)`)
      } else {
        setSuccess(`Loaded ${resolvedMarketsData.length} historical markets (Found ${existingMarkets.length} total markets)`)
      }
    } catch (error) {
      console.error('Failed to load resolved markets:', error)
      setError('Geçmiş marketler yüklenirken hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setResolvedMarketsLoading(false)
      setLoadingProgress({ current: 0, total: 0 })
    }
  }

  // Load markets
  const loadMarkets = async () => {
    setLoading(true)
    try {
      console.log('🔧 ACTIVE: Loading active markets from contract:', contractAddress)
      const activeMarkets = await service.getActiveMarkets()
      console.log('🔧 ACTIVE: Raw active markets received:', activeMarkets.length)
      
      // Sort active markets by ID (newest first) to maintain proper order
      activeMarkets.sort((a, b) => Number(b.id) - Number(a.id))
      
      setMarkets(activeMarkets)
      console.log('🔧 ACTIVE: Loaded active market IDs:', activeMarkets.map(m => `${m.id.toString()}(${m.title})`))
      
      if (activeMarkets.length > 0 && !selectedMarket) {
        setSelectedMarket(activeMarkets[0])
      }
    } catch (err) {
      console.error('🔧 ACTIVE: Error loading markets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load markets')
    } finally {
      setLoading(false)
    }
  }

  // Load market details
  const loadMarketDetails = async (market: Market) => {
    if (!market) return
    
    setLoading(true)
    try {
      // Load odds
      const marketOdds = await service.calculateOdds(market.id)
      setOdds(marketOdds)
      
      // Load current price
      const price = await service.getCurrentPrice(market.token)
      setCurrentPrice(price)
      
      // Load user bet if connected
      if (userAddress) {
        const bet = await service.getUserBet(market.id, userAddress)
        setUserBet(bet)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market details')
    } finally {
      setLoading(false)
    }
  }

  // Debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
  }

  // Asset selection handler
  const handleAssetSelection = async (assetSymbol: string) => {
    setSelectedAssetSymbol(assetSymbol)
    const selectedAsset = ASSETS[assetSymbol as keyof typeof ASSETS]
    if (selectedAsset) {
      // Update the newMarket state with selected asset tokens
      setNewMarket(prev => ({
        ...prev,
        token: selectedAsset.contractId,
        bettingToken: selectedAsset.token
      }))
    }
  }

  // Place bet
  const placeBet = async () => {
    if (!selectedMarket || !userAddress || !betAmount) {
      setError('Please fill all required fields')
      return
    }

    // Check if market has at least 5 minutes remaining
    const now = Math.floor(Date.now() / 1000)
    const timeRemaining = Number(selectedMarket.end_time) - now
    const fiveMinutesInSeconds = 5 * 60 // 5 minutes = 300 seconds

    if (timeRemaining < fiveMinutesInSeconds) {
      const remainingMinutes = Math.floor(timeRemaining / 60)
      const remainingSeconds = timeRemaining % 60
      setError(`Cannot place bet! Market ends in ${remainingMinutes}m ${remainingSeconds}s. Minimum 5 minutes required.`)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const amount = BettingMarketService.parseAmount(betAmount)
      const result = await service.placeBetTest(
        userAddress,
        selectedMarket.id,
        amount,
        selectedPrediction
      )
      
      if (result.success) {
        setSuccess('Bet placed successfully!')
        setBetAmount('')
        
        // Refresh market details AND markets list to update betting stats
        await loadMarketDetails(selectedMarket)
        await loadMarkets()
        
        // Find and update the selected market with fresh data
        const updatedMarkets = await service.getActiveMarkets()
        const updatedSelectedMarket = updatedMarkets.find(m => m.id === selectedMarket.id)
        if (updatedSelectedMarket) {
          setSelectedMarket(updatedSelectedMarket)
        }
      } else {
        setError(result.error || 'Failed to place bet')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet')
    } finally {
      setLoading(false)
    }
  }

  // Create market
  const createMarket = async () => {
    debugger;
    if (!userAddress) {
      setError('Please connect wallet first')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const result = await service.createMarket(
        userAddress,
        newMarket.title,
        newMarket.token,
        newMarket.bettingToken,
        BettingMarketService.parseAmount(newMarket.targetPrice),
        BettingMarketService.parseAmount(newMarket.stableTolerance),
        BigInt(newMarket.durationHours),
        false, // auto_restart
        BigInt(newMarket.houseEdge)
      )
      
      if (result.success) {
        setSuccess(`Market created successfully! ID: ${result.marketId}`)
        
        // Send telegram notification for new market
        try {
          const selectedAsset = ASSETS[selectedAssetSymbol as keyof typeof ASSETS]
          await notifyMarketCreated({
            marketId: result.marketId ? result.marketId.toString() : 'Unknown',
            title: newMarket.title,
            creator: userAddress,
            targetPrice: `${newMarket.targetPrice} ${selectedAsset?.symbol || 'Token'}`,
            duration: `${newMarket.durationHours} hours`
          })
        } catch (notificationError) {
          console.error('Failed to send telegram notification for new market:', notificationError)
        }
        
        setShowCreateMarket(false)
        setNewMarket({
          title: '',
          token: '',
          bettingToken: '',
          targetPrice: '',
          stableTolerance: '',
          durationHours: '24',
          houseEdge: '50'
        })
        await loadMarkets()
      } else {
        setError(result.error || 'Failed to create market')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create market')
    } finally {
      setLoading(false)
    }
  }

  // Format time
  const formatTime = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString()
  }

  // Format winning side
  const formatWinningSide = (side: number | string | undefined) => {
    if (side === undefined || side === null) return 'Unknown'
    
    // Handle different formats
    const sideStr = side.toString()
    switch (sideStr) {
      case '0': return 'Up'
      case '1': return 'Down' 
      case '2': return 'Stable'
      case 'Up': return 'Up'
      case 'Down': return 'Down'
      case 'Stable': return 'Stable'
      default: return sideStr
    }
  }

  // Get winner count for resolved market
  const getWinnerCount = (market: Market) => {
    if (!market.is_resolved || market.winning_side === undefined) return 0
    
    switch (market.winning_side) {
      case 'Up': return market.up_betters_count
      case 'Down': return market.down_betters_count  
      case 'Stable': return market.stable_betters_count
      default: return 0
    }
  }

  // Calculate time remaining
  const getTimeRemaining = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const remaining = Number(endTime) - now
    
    if (remaining <= 0) return 'Expired'
    
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    return `${hours}h ${minutes}m`
  }

  // Auto resolve expired markets with retry mechanism
  const checkAndResolveExpiredMarkets = async () => {
    if (!isConnected || !userAddress) {
      addDebugLog('Skipping auto-resolve: not connected or no user address')
      return
    }
    
    const now = Math.floor(Date.now() / 1000)
    addDebugLog(`Checking for expired markets at ${new Date().toISOString()}`)
    
    for (const market of markets) {
      if (!market.is_resolved && Number(market.end_time) <= now) {
        try {
          addDebugLog(`Found expired market: ${market.title} (ID: ${market.id})`)
          setSuccess(`Auto-resolving expired market: ${market.title}`)
          
          // Get current price
          addDebugLog(`Getting current price for token: ${market.token}`)
          const currentPrice = await service.getCurrentPrice(market.token)
          
          // Check if price is available
          if (currentPrice === null) {
            const errorMsg = `Failed to get current price for market ${market.id} (token: ${market.token})`
            addDebugLog(`ERROR: ${errorMsg}`)
            setError(errorMsg)
            continue
          }
          
          addDebugLog(`Current price for market ${market.id}: ${currentPrice}`)
          
          // Resolve market with automatic payout and retry mechanism
          addDebugLog(`Attempting to resolve market ${market.id} with price ${currentPrice}`)
          
          let retryCount = 0
          const maxRetries = 3
          let result
          
          while (retryCount < maxRetries) {
            try {
              result = await service.resolveMarketManual(
                userAddress,
                market.id,
                currentPrice
              )
              
              // If successful, break out of retry loop
              if (result.success) {
                break
              }
              
              // Check if error is TRY_AGAIN_LATER
              if (result.error && result.error.includes('TRY_AGAIN_LATER')) {
                retryCount++
                addDebugLog(`Market ${market.id} - TRY_AGAIN_LATER error, retry ${retryCount}/${maxRetries}`)
                
                if (retryCount < maxRetries) {
                  // Wait before retry (exponential backoff)
                  const waitTime = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s
                  addDebugLog(`Waiting ${waitTime}ms before retry...`)
                  await new Promise(resolve => setTimeout(resolve, waitTime))
                  continue
                }
              } else {
                // Different error, don't retry
                break
              }
            } catch (retryErr) {
              retryCount++
              addDebugLog(`Market ${market.id} - Retry ${retryCount} failed: ${retryErr}`)
              
              if (retryCount >= maxRetries) {
                result = { success: false, error: `Max retries exceeded: ${retryErr}` }
                break
              }
              
              // Wait before retry
              const waitTime = Math.pow(2, retryCount) * 1000
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
          
          addDebugLog(`Resolve result for market ${market.id} (after ${retryCount} retries): ${JSON.stringify(result)}`)
          
          if (result && result.success) {
            const winningSide = result.winningSide ? parseInt(result.winningSide) : 0
            const winnerText = winningSide === 0 ? 'UP' : winningSide === 1 ? 'DOWN' : 'STABLE'
            const successMsg = `Market "${market.title}" auto-resolved! Winner: ${winnerText}${retryCount > 0 ? ` (succeeded after ${retryCount} retries)` : ''}`
            addDebugLog(`SUCCESS: ${successMsg}`)
            setSuccess(successMsg)
            
            // Send telegram notification for resolved market
            try {
              const winnerCount = winningSide === 0 ? market.up_betters_count : 
                                winningSide === 1 ? market.down_betters_count : 
                                market.stable_betters_count
              
              // Direct API call to ensure userId is properly passed
              const telegramResponse = await fetch('/api/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'notify_market_resolved',
                  userId: userAddress, // Ensure userAddress is passed
                  data: {
                    marketId: market.id.toString(),
                    title: market.title,
                    winningSide: winnerText,
                    finalPrice: currentPrice ? BettingMarketService.formatAmount(currentPrice) : 'N/A',
                    winnerCount: winnerCount || 0
                  }
                })
              })

              const telegramResult = await telegramResponse.json()
              
              if (telegramResult.success) {
                console.log('✅ AUTO-RESOLVE: Telegram notification sent successfully for market:', market.id.toString())
              } else {
                console.log('❌ AUTO-RESOLVE: Telegram notification failed for market:', market.id.toString())
                console.log('❌ AUTO-RESOLVE: Error details:', telegramResult)
              }
            } catch (notificationError) {
              console.error('Failed to send telegram notification for resolved market:', notificationError)
            }
            
            // Reload markets to reflect changes
            await loadMarkets()
          } else {
            // Check if this is a TRY_AGAIN_LATER that we couldn't resolve
            if (result && result.error && result.error.includes('TRY_AGAIN_LATER')) {
              const warningMsg = `Market ${market.id} resolution postponed due to network congestion. Will retry automatically.`
              addDebugLog(`WARNING: ${warningMsg}`)
              setSuccess(warningMsg) // Show as success since it's just a delay
            } else {
              const errorMsg = `Failed to auto-resolve market ${market.id}: ${result?.error || 'Unknown error'}`
              addDebugLog(`ERROR: ${errorMsg}`)
              setError(errorMsg)
            }
          }
        } catch (err) {
          const errorMsg = `Error auto-resolving market ${market.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
          addDebugLog(`EXCEPTION: ${errorMsg}`)
          
          // Don't show TRY_AGAIN_LATER as an error to user
          if (!errorMsg.includes('TRY_AGAIN_LATER')) {
            setError(errorMsg)
          } else {
            addDebugLog(`TRY_AGAIN_LATER error for market ${market.id}, will retry in next cycle`)
            setSuccess(`Market ${market.id} resolution delayed due to network congestion, will retry automatically`)
          }
        }
      }
    }
  }

  // View mode handler
  const handleViewModeChange = async (mode: 'active' | 'resolved') => {
    setViewMode(mode)
    if (mode === 'resolved') {
      await loadResolvedMarkets()
    } else {
      await loadMarkets()
    }
  }

  // Effects - force initialization on every mount
  useEffect(() => {
    console.log('🔧 MOUNT: BettingMarketDashboard component mounted')
    // Check for existing wallet connection on mount
    checkExistingConnection()
    loadMarkets()
    
    // Add visibility change handler for better page switching
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔧 VISIBILITY: BettingMarket page became visible, refreshing data')
        checkExistingConnection()
        loadMarkets()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedMarket) {
      console.log('🔧 MARKET: Loading market details for:', selectedMarket.id)
      loadMarketDetails(selectedMarket)
    }
  }, [selectedMarket, userAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto refresh every 30 seconds and check for expired markets - ensure restart on mount
  useEffect(() => {
    if (selectedMarket || isConnected) {
      console.log('🔧 REFRESH: Setting up auto-refresh interval')
      
      const interval = setInterval(async () => {
        if (selectedMarket) {
          console.log('🔧 REFRESH: Auto-refreshing market details')
          loadMarketDetails(selectedMarket)
        }
        
        // Check and auto-resolve expired markets every 30 seconds
        console.log('🔧 REFRESH: Checking for expired markets')
        await checkAndResolveExpiredMarkets()
      }, 30000)

      return () => {
        console.log('🔧 REFRESH: Cleaning up auto-refresh interval')
        clearInterval(interval)
      }
    }
  }, [selectedMarket, markets, isConnected, userAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // More frequent check for expired markets (every 10 seconds) - ensure proper setup
  useEffect(() => {
    if (!isConnected) {
      console.log('🔧 QUICK-CHECK: Not connected, skipping quick check setup')
      return
    }
    
    console.log('🔧 QUICK-CHECK: Setting up quick check interval for expired markets')
    
    const quickCheckInterval = setInterval(async () => {
      console.log('🔧 QUICK-CHECK: Running quick check for expired markets')
      await checkAndResolveExpiredMarkets()
    }, 10000) // Check every 10 seconds

    return () => {
      console.log('🔧 QUICK-CHECK: Cleaning up quick check interval')
      clearInterval(quickCheckInterval)
    }
  }, [markets, isConnected, userAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize asset selection on component mount - force initialization
  useEffect(() => {
    console.log('🔧 ASSET: Initializing asset selection:', selectedAssetSymbol)
    handleAssetSelection(selectedAssetSymbol)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Prediction Market</h1>
        
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}



        {/* Wallet Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Status</h2>
          {!isConnected ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">⚠️ Wallet Not Connected</p>
              <p className="text-sm text-yellow-700 mt-1">
                Please connect your Freighter wallet in the &quot;Trailing Stop Trading&quot; section to use prediction markets.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-green-600 font-medium">✓ Wallet Connected</p>
              <p className="text-sm text-gray-600 mt-1">Address: {userAddress}</p>
              <p className="text-xs text-green-600 mt-2">
                🔗 Connected via Trailing Stop Trading section
              </p>
            </div>
          )}
        </div>

        {/* Markets List */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {/* <h2 className="text-xl font-semibold">Active Markets</h2> */}
            {isConnected && (
              <button
                onClick={() => setShowCreateMarket(!showCreateMarket)}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                {showCreateMarket ? 'Cancel' : 'Create Market'}
              </button>
            )}
          </div>

          {/* Create Market Form */}
          {showCreateMarket && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 text-black">
              <h3 className="text-lg font-medium mb-3">Create New Market</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Market Title"
                  value={newMarket.title}
                  onChange={(e) => setNewMarket({...newMarket, title: e.target.value})}
                  className="border rounded px-3 py-2"
                />
                
                {/* Asset Selection Dropdown */}
                <div className="relative">
                  <select
                    value={selectedAssetSymbol}
                    onChange={(e) => handleAssetSelection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    {Object.entries(ASSETS).map(([symbol, asset]) => (
                      <option key={symbol} value={symbol}>
                        {asset.name} ({symbol})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-500">
                    Selected: {ASSETS[selectedAssetSymbol as keyof typeof ASSETS]?.name}
                  </div>
                </div>
                
                <input
                  type="text"
                  placeholder="Target Price"
                  value={newMarket.targetPrice}
                  onChange={(e) => setNewMarket({...newMarket, targetPrice: e.target.value})}
                  className="border rounded px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Stable Tolerance"
                  value={newMarket.stableTolerance}
                  onChange={(e) => setNewMarket({...newMarket, stableTolerance: e.target.value})}
                  className="border rounded px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Duration (hours)"
                  value={newMarket.durationHours}
                  onChange={(e) => setNewMarket({...newMarket, durationHours: e.target.value})}
                  className="border rounded px-3 py-2"
                />
              </div>
              <button
                onClick={createMarket}
                disabled={loading}
                className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Market'}
              </button>
         
            </div>
          )}

          {/* View Mode Switch and Markets Grid */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {viewMode === 'active' ? 'Active Markets' : 'Historical Markets'}
              </h3>
              <div className="flex items-center space-x-3">
                {/* Refresh button for historical markets */}
                {viewMode === 'resolved' && (
                  <button
                    onClick={() => loadResolvedMarkets(true)}
                    disabled={resolvedMarketsLoading}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded disabled:opacity-50"
                    title="Refresh historical markets"
                  >
                    {resolvedMarketsLoading ? '⟳' : '↻'}
                  </button>
                )}
                
                <div className="bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeChange('active')}
                    disabled={loading || resolvedMarketsLoading}
                    className={`px-4 py-2 rounded ${
                      viewMode === 'active' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => handleViewModeChange('resolved')}
                    disabled={loading || resolvedMarketsLoading}
                    className={`px-4 py-2 rounded ${
                      viewMode === 'resolved' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {resolvedMarketsLoading ? 'Loading...' : 'History'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Markets Grid */}
          {resolvedMarketsLoading && viewMode === 'resolved' ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center space-x-2 mb-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="text-gray-600">Loading historical markets...</span>
              </div>
              {loadingProgress.total > 0 && (
                <div className="max-w-md mx-auto">
                  <div className="bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Processing {loadingProgress.current} of {loadingProgress.total} markets
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                This may take a moment as we fetch all resolved markets
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(viewMode === 'active' ? markets : resolvedMarkets).map((market) => {
                  const timeRemaining = getTimeRemaining(market.end_time)
                  const isExpired = timeRemaining === 'Expired'
                  
                  return (
                    <div
                      key={market.id.toString()}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedMarket?.id === market.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : isExpired && !market.is_resolved
                            ? 'border-orange-500 bg-orange-50 hover:border-orange-600'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedMarket(market)}
                    >
                      <h3 className="font-medium text-lg mb-2">{market.title}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Draw Number: {market.id.toString()}</p>
                        <p>Target Price: {BettingMarketService.formatAmountTarget(market.target_price, 7)}</p>
                        
                        {/* Show time info based on view mode */}
                        {viewMode === 'active' ? (
                          <p className={isExpired && !market.is_resolved ? 'text-orange-600 font-medium' : ''}>
                            Time Left: {timeRemaining}
                          </p>
                        ) : (
                          <p className="text-gray-500">
                            Ended: {formatTime(BigInt(market.end_time))}
                          </p>
                        )}
                        
                        {/* Show winner info for resolved markets */}
                        {viewMode === 'resolved' && market.is_resolved && (
                          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-green-800 font-medium text-xs">
                              🏆 Winning Side: {formatWinningSide(market.winning_side)}
                            </p>
                            <p className="text-green-700 text-xs">
                              👥 Number of Winners: {getWinnerCount(market)} person
                            </p>
                            <p className="text-green-700 text-xs">
                              Market #{market.id.toString().slice(-6)}
                            </p>
                            <p className="text-green-600 text-xs">
                              Final Price: {market.final_price ? SorobanService.formatAmount(market.final_price, 14) : 'N/A'}
                            </p>
                          </div>
                        )}
                        
                        {/* Auto-resolve status */}
                        {isExpired && !market.is_resolved && (
                          <p className="text-orange-600 text-xs font-medium">
                            🤖 Auto-resolving...
                          </p>
                        )}
                        
                        <div className="flex justify-between">
                          <span className={`px-2 py-1 rounded text-xs ${
                            market.is_resolved 
                              ? 'bg-green-100 text-green-800' 
                              : isExpired 
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {market.is_resolved ? 'Resolved' : isExpired ? 'Expired' : 'Active'}
                          </span>
                          {market.winning_side !== undefined && market.winning_side !== null && (
                            <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                              Winner: {formatWinningSide(market.winning_side)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {(viewMode === 'active' ? markets : resolvedMarkets).length === 0 && !resolvedMarketsLoading && (
                <p className="text-gray-600 text-center py-8">
                  {viewMode === 'active' ? 'No active markets found' : 'No historical markets found'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Selected Market Details */}
        {selectedMarket && (() => {
          const now = Math.floor(Date.now() / 1000)
          const isExpired = Number(selectedMarket.end_time) <= now
          const isActive = !selectedMarket.is_resolved && !isExpired
          
          // If market is not active (resolved or expired), show simple status
          if (!isActive) {
            return (
              <div className="bg-gray-50 rounded-lg shadow p-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-4 text-gray-700">
                    {selectedMarket.is_resolved ? '✅ Market Resolved' : '⏰ Market Expired'}
                  </h2>
                  <div className="space-y-2">
                    <p className="text-gray-600">
                      <span className="font-medium">Title:</span> {selectedMarket.title}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Status:</span> {
                        selectedMarket.is_resolved ? 'Resolved' : 'Expired (Auto-resolving...)'
                      }
                    </p>
                    {selectedMarket.is_resolved && (
                      <>
                        <p className="text-green-600 font-medium">
                          🏆 Winner: {formatWinningSide(selectedMarket.winning_side)}
                        </p>
                        <p className="text-gray-600">
                          <span className="font-medium">Final Price:</span> {
                            selectedMarket.final_price ? 
                            BettingMarketService.formatAmount(selectedMarket.final_price) : 'N/A'
                          }
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          }
          
          // Active market - show full details and betting interface
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Info */}
              <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Market Details</h2>
              <div className="space-y-3">
                <div>
                  <span className="font-medium">Title:</span> {selectedMarket.title}
                </div>
                <div>
                  <span className="font-medium">Initial Price:</span> {BettingMarketService.formatAmount(selectedMarket.initial_price)}
                </div>
                <div>
                  <span className="font-medium">Target Price:</span> {BettingMarketService.formatAmountTarget(selectedMarket.target_price,7)}
                </div>
                <div>
                  <span className="font-medium">Current Price:</span> {currentPrice ? BettingMarketService.formatAmount(currentPrice) : 'Loading...'}
                </div>
             
                <div>
                  <span className="font-medium">End Time:</span> {formatTime(selectedMarket.end_time)}
                </div>
               
                
                {/* Betting Stats */}
                <div className="border-t pt-3 mt-4">
                  <h3 className="font-medium mb-2">Betting Stats</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-green-600">UP</div>
                      <div>{BettingMarketService.formatAmount(selectedMarket.total_up_bets)}</div>
                      <div>({selectedMarket.up_betters_count} bets)</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-600">DOWN</div>
                      <div>{BettingMarketService.formatAmount(selectedMarket.total_down_bets)}</div>
                      <div>({selectedMarket.down_betters_count} bets)</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-blue-600">STABLE</div>
                      <div>{BettingMarketService.formatAmount(selectedMarket.total_stable_bets)}</div>
                      <div>({selectedMarket.stable_betters_count} bets)</div>
                    </div>
                  </div>
                </div>

                {/* Winner Info for Resolved Markets */}
                {selectedMarket.is_resolved && (
                  <div className="border-t pt-3 mt-4">
                    <h3 className="font-medium mb-2 text-green-800">🏆 Market Results</h3>
                    <div className="bg-green-50 rounded p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Winning Side:</span>
                        <span className="text-sm text-green-700 font-bold">
                          {formatWinningSide(selectedMarket.winning_side)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Winning Count:</span>
                        <span className="text-sm text-green-700 font-bold">
                          {getWinnerCount(selectedMarket)} person
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Final Price:</span>
                        <span className="text-sm text-green-700">
                          {selectedMarket.final_price ? BettingMarketService.formatAmountTarget(selectedMarket.final_price, 7) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total Participants:</span>
                        <span className="text-sm text-gray-600">
                          {selectedMarket.up_betters_count + selectedMarket.down_betters_count + selectedMarket.stable_betters_count} person
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Odds */}
                {odds && (
                  <div className="border-t pt-3 mt-4">
                    <h3 className="font-medium mb-2">Current Odds</h3>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-green-600">UP</div>
                        <div>{BettingMarketService.formatOdds(odds.up_odds)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-600">DOWN</div>
                        <div>{BettingMarketService.formatOdds(odds.down_odds)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-blue-600">STABLE</div>
                        <div>{BettingMarketService.formatOdds(odds.stable_odds)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Resolve Button for Expired Markets */}
                {!selectedMarket.is_resolved && getTimeRemaining(selectedMarket.end_time) === 'Expired' && isConnected && (
                  <div className="border-t pt-3 mt-4">
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true)
                          setError('')
                          setSuccess('')
                          
                          addDebugLog(`Manual resolve started for market ${selectedMarket.id}`)
                          
                          const currentPrice = await service.getCurrentPrice(selectedMarket.token)
                          
                          // Check if price is available
                          if (currentPrice === null) {
                            const errorMsg = 'Failed to get current price for market resolution'
                            addDebugLog(`ERROR: ${errorMsg}`)
                            setError(errorMsg)
                            return
                          }
                          
                          addDebugLog(`Got current price: ${currentPrice}, calling resolveMarketManual...`)
                          
                          // Implement retry mechanism for manual resolve too
                          let retryCount = 0
                          const maxRetries = 3
                          let result
                          
                          while (retryCount < maxRetries) {
                            try {
                              setSuccess(`Resolving market... ${retryCount > 0 ? `(Retry ${retryCount}/${maxRetries})` : ''}`)
                              
                              result = await service.resolveMarketManual(
                                userAddress,
                                selectedMarket.id,
                                currentPrice
                              )
                              
                              // If successful, break out of retry loop
                              if (result.success) {
                                break
                              }
                              
                              // Check if error is TRY_AGAIN_LATER
                              if (result.error && result.error.includes('TRY_AGAIN_LATER')) {
                                retryCount++
                                addDebugLog(`Manual resolve - TRY_AGAIN_LATER error, retry ${retryCount}/${maxRetries}`)
                                
                                if (retryCount < maxRetries) {
                                  // Wait before retry (exponential backoff)
                                  const waitTime = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s
                                  addDebugLog(`Waiting ${waitTime}ms before retry...`)
                                  setSuccess(`Network congestion detected. Retrying in ${waitTime/1000} seconds... (${retryCount}/${maxRetries})`)
                                  await new Promise(resolve => setTimeout(resolve, waitTime))
                                  continue
                                }
                              } else {
                                // Different error, don't retry
                                break
                              }
                            } catch (retryErr) {
                              retryCount++
                              addDebugLog(`Manual resolve retry ${retryCount} failed: ${retryErr}`)
                              
                              if (retryCount >= maxRetries) {
                                result = { success: false, error: `Max retries exceeded: ${retryErr}` }
                                break
                              }
                              
                              // Wait before retry
                              const waitTime = Math.pow(2, retryCount) * 1000
                              setSuccess(`Retry ${retryCount} failed. Waiting ${waitTime/1000} seconds...`)
                              await new Promise(resolve => setTimeout(resolve, waitTime))
                            }
                          }
                          
                          addDebugLog(`Manual resolve result: ${JSON.stringify(result)}`)
                          
                          if (result && result.success) {
                            const winningSide = result.winningSide ? parseInt(result.winningSide) : 0
                            const winnerText = winningSide === 0 ? 'UP' : winningSide === 1 ? 'DOWN' : 'STABLE'
                            const successMsg = `Market resolved! Winner: ${winnerText}. Payouts distributed automatically.${retryCount > 0 ? ` (Succeeded after ${retryCount} retries)` : ''}`
                            addDebugLog(`SUCCESS: ${successMsg}`)
                            setSuccess(successMsg)
                            
                            // Send telegram notification for manually resolved market
                            try {
                              const winnerCount = winningSide === 0 ? selectedMarket.up_betters_count : 
                                                winningSide === 1 ? selectedMarket.down_betters_count : 
                                                selectedMarket.stable_betters_count
                              
                              // Direct API call to ensure userId is properly passed
                              const telegramResponse = await fetch('/api/telegram', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'notify_market_resolved',
                                  userId: userAddress, // Ensure userAddress is passed
                                  data: {
                                    marketId: selectedMarket.id.toString(),
                                    title: selectedMarket.title,
                                    winningSide: winnerText,
                                    finalPrice: currentPrice ? BettingMarketService.formatAmount(currentPrice) : 'N/A',
                                    winnerCount: winnerCount || 0
                                  }
                                })
                              })

                              const telegramResult = await telegramResponse.json()
                              
                              if (telegramResult.success) {
                                console.log('✅ MANUAL-RESOLVE: Telegram notification sent successfully for market:', selectedMarket.id.toString())
                              } else {
                                console.log('❌ MANUAL-RESOLVE: Telegram notification failed for market:', selectedMarket.id.toString())
                                console.log('❌ MANUAL-RESOLVE: Error details:', telegramResult)
                              }
                            } catch (notificationError) {
                              console.error('Failed to send telegram notification for manually resolved market:', notificationError)
                            }
                            
                            await loadMarkets()
                            await loadMarketDetails(selectedMarket)
                          } else {
                            // Check if this is a persistent TRY_AGAIN_LATER error
                            if (result && result.error && result.error.includes('TRY_AGAIN_LATER')) {
                              const warningMsg = `Market resolution delayed due to network congestion. The transaction may still be processing. Please check back in a few minutes.`
                              addDebugLog(`WARNING: ${warningMsg}`)
                              setSuccess(warningMsg)
                            } else {
                              const errorMsg = result?.error || 'Failed to resolve market'
                              addDebugLog(`ERROR: ${errorMsg}`)
                              setError(errorMsg)
                            }
                          }
                        } catch (err) {
                          const errorMsg = err instanceof Error ? err.message : 'Failed to resolve market'
                          addDebugLog(`EXCEPTION: ${errorMsg}`)
                          
                          // Don't show TRY_AGAIN_LATER as an error to user
                          if (!errorMsg.includes('TRY_AGAIN_LATER')) {
                            setError(errorMsg)
                          } else {
                            setSuccess('Network congestion detected. The transaction may still be processing. Please check back in a few minutes.')
                          }
                        } finally {
                          setLoading(false)
                        }
                      }}
                      disabled={loading}
                      className="w-full bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                    >
                      {loading ? 'Resolving...' : '🤖 Resolve Market & Distribute Payouts'}
                    </button>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      💡 If you see &quot;TRY_AGAIN_LATER&quot; errors, the system will automatically retry with exponential backoff
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Betting Interface */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Place Bet</h2>
              
              {/* User's existing bet */}
              {userBet && (
                <div className="mb-4 p-3 bg-blue-50 rounded border">
                  <h3 className="font-medium text-blue-800 mb-2">Your Current Bet</h3>
                  <div className="text-sm space-y-1">
                    <p>Prediction: <span className="font-medium">{userBet.prediction}</span></p>
                    <p>Amount: <span className="font-medium">{BettingMarketService.formatAmount(userBet.amount, 7)}</span></p>
                    <p>Odds when placed: <span className="font-medium">{BettingMarketService.formatOdds(userBet.odds_when_placed)}</span></p>
                    <p>Status: <span className={`font-medium ${
                      !selectedMarket.is_resolved 
                        ? 'text-blue-600' 
                        : userBet.is_paid_out && userBet.winnings > 0
                          ? 'text-green-600'
                          : userBet.is_paid_out && userBet.winnings === BigInt(0)
                            ? 'text-red-600'
                            : 'text-orange-600'
                    }`}>
                      {!selectedMarket.is_resolved 
                        ? 'Active' 
                        : userBet.is_paid_out 
                          ? userBet.winnings > 0 
                            ? 'Won & Paid Out' 
                            : 'Lost'
                          : 'Pending Payout'
                      }
                    </span></p>
                    {selectedMarket.is_resolved && userBet.is_paid_out && (
                      <>
                        {userBet.winnings > 0 ? (
                          <p>Winnings: <span className="font-medium text-green-600">
                            {BettingMarketService.formatAmount(userBet.winnings, 7)}
                          </span></p>
                        ) : (
                          <p className="text-red-600 text-sm">
                            💔 Better luck next time!
                          </p>
                        )}
                      </>
                    )}
                    {selectedMarket.is_resolved && !userBet.is_paid_out && (
                      <p className="text-orange-600 text-sm">
                        ⏳ Payout processing...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!selectedMarket.is_resolved && !userBet && isConnected && (() => {
                // Check time remaining for betting eligibility
                const now = Math.floor(Date.now() / 1000)
                const timeRemaining = Number(selectedMarket.end_time) - now
                const fiveMinutesInSeconds = 5 * 60
                const canPlaceBet = timeRemaining >= fiveMinutesInSeconds
                const remainingMinutes = Math.floor(timeRemaining / 60)
                const remainingSeconds = timeRemaining % 60
                
                return (
                  <div className="space-y-4">
                    {/* Time remaining warning */}
                    {!canPlaceBet && timeRemaining > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-yellow-800 font-medium text-sm">
                          ⚠️ Betting Closed
                        </p>
                        <p className="text-yellow-700 text-xs">
                          Cannot place bets with less than 5 minutes remaining. 
                          Time left: {remainingMinutes}m {remainingSeconds}s
                        </p>
                      </div>
                    )}
                    
                    {/* Time remaining info */}
                    {canPlaceBet && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-green-800 font-medium text-sm">
                          ✅ Betting Open
                        </p>
                        <p className="text-green-700 text-xs">
                          Time remaining: {remainingMinutes}m {remainingSeconds}s
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prediction
                      </label>
                      <select
                        value={selectedPrediction}
                        onChange={(e) => setSelectedPrediction(e.target.value as 'Up' | 'Down' | 'Stable')}
                        className="w-full border rounded px-3 py-2"
                        disabled={!canPlaceBet}
                      >
                        <option value="Up">Price will go UP</option>
                        <option value="Down">Price will go DOWN</option>
                        <option value="Stable">Price will stay STABLE</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bet Amount
                      </label>
                      <input
                        type="text"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full border rounded px-3 py-2"
                        disabled={!canPlaceBet}
                      />
                    </div>

                    <button
                      onClick={placeBet}
                      disabled={loading || !betAmount || !canPlaceBet}
                      className={`w-full font-bold py-2 px-4 rounded disabled:opacity-50 ${
                        canPlaceBet 
                          ? 'bg-blue-500 hover:bg-blue-700 text-white' 
                          : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {loading ? 'Placing Bet...' : canPlaceBet ? 'Place Bet' : 'Betting Closed (< 5min)'}
                    </button>
                  </div>
                )
              })()}

              {!isConnected && (
                <p className="text-gray-600 text-center">Connect wallet to place bets</p>
              )}

              {selectedMarket.is_resolved && (
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-800 mb-2">Market Resolved</p>
                  <p className="text-green-600 font-medium">
                    Winner: {selectedMarket.winning_side}
                  </p>
                  <p className="text-sm text-gray-600">
                    Final Price: {selectedMarket.final_price ? BettingMarketService.formatAmount(selectedMarket.final_price) : 'N/A'}
                  </p>
                </div>
              )}

              {userBet && !selectedMarket.is_resolved && (
                <p className="text-center text-gray-600">
                  You already have a bet on this market
                </p>
              )}
            </div>
          </div>
          )
        })()}
      </div>
    </div>
  )
}
