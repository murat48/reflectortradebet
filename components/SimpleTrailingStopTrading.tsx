

'use client'

import { useState, useEffect, useCallback } from 'react'
import { SorobanService } from '@/lib/soroban'
import { WalletService } from '@/lib/wallet'
import { TrailingOrder } from '@/lib/soroban'
import AssetPriceDisplay, { ASSETS } from './AssetPriceDisplay'
import TelegramNotificationPanel from './TelegramNotificationPanel'
import { useTelegramNotifications } from '@/lib/useTelegramNotifications'

const CONTRACT_ADDRESS = 'CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX'
const ADMIN_ADDRESS = 'GALDPLQ62RAX3V7RJE73D3C2F4SKHGCJ3MIYJ4MLU2EAIUXBDSUVS7SA'
const REFRESH_INTERVAL = 30000 // 5 seconds - faster refresh
const EXECUTE_INTERVAL = 60000 // 60 seconds for throttled execution

export default function SimpleTrailingStopTrading() {
  const [sorobanService] = useState(() => new SorobanService(CONTRACT_ADDRESS))
  const [walletService] = useState(() => WalletService.getInstance())
  
  // State
  const [connected, setConnected] = useState(false)
  const [userAddress, setUserAddress] = useState('')
  const [userOrders, setUserOrders] = useState<TrailingOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Admin states
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Form states
  const [assetAddress, setAssetAddress] = useState('')
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState('')
  const [amount, setAmount] = useState('')
  const [trailPercentage, setTrailPercentage] = useState('')
  const [currentPrice, setCurrentPrice] = useState<string>('')
  const [priceLoading, setPriceLoading] = useState(false)

  // Telegram states
  const [telegramId, setTelegramId] = useState('')
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [showTelegramSetup, setShowTelegramSetup] = useState(false)



  // Statistics
const [filterStatus, setFilterStatus] = useState('Active')

  // Telegram notifications
  const { notifyTrailingStopExecuted, checkBotStatus, subscribeUser } = useTelegramNotifications()
  
  // Format address for display - defined early to avoid hoisting issues
  const formatAddress = useCallback((addr: string) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : ''
  }, [])

  // Get asset symbol from contract address - defined early to avoid hoisting issues
  const getAssetSymbol = useCallback((contractId: string) => {
    const asset = Object.values(ASSETS).find(a => a.contractId === contractId)
    return asset ? asset.symbol : formatAddress(contractId)
  }, [formatAddress])

  const checkWalletConnection = useCallback(async () => {
    try {
      const isConnected = await walletService.isWalletConnected()
      if (isConnected) {
        const address = await walletService.getAddress()
        if (address) {
          setUserAddress(address)
          setConnected(true)
          
          // Check if user is admin
          setIsAdmin(address === ADMIN_ADDRESS)
          
          const orders = await sorobanService.getUserOrders(address)
          setUserOrders(orders)
        }
      }
    } catch {
      console.error('Error checking wallet connection')
    }
  }, [walletService, sorobanService])

  // Check wallet connection on component mount - always run when component mounts
  useEffect(() => {
    console.log('🔧 MOUNT: SimpleTrailingStopTrading component mounted, checking wallet connection')
    checkWalletConnection()
  }, [checkWalletConnection])

  // Force re-initialization when component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && connected && userAddress) {
        console.log('🔧 VISIBILITY: Page became visible, refreshing data')
        checkWalletConnection()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [connected, userAddress, checkWalletConnection])

  // Check and ensure Telegram subscription - force re-check on every mount
  useEffect(() => {
    if (connected && userAddress) {
      console.log('🔧 TELEGRAM: Setting up Telegram subscription check for:', userAddress)
      const ensureTelegramSubscription = async () => {
        try {
          console.log('Checking Telegram subscription for user:', userAddress)
          const status = await checkBotStatus(userAddress)
          console.log('Telegram bot status:', status)
          
          if (status && status.botActive) {
            if (!status.userSubscription) {
              console.log('User not subscribed, attempting auto-subscription...')
              const subscribed = await subscribeUser(userAddress, '8211541138', true, true)
              console.log('Auto-subscription result:', subscribed)
            } else {
              console.log('User already subscribed to Telegram notifications')
            }
          } else {
            console.log('Telegram bot not active or status check failed')
          }
        } catch (error) {
          console.error('Error checking/ensuring Telegram subscription:', error)
        }
      }
      
      // Add a small delay to ensure proper initialization
      const timer = setTimeout(ensureTelegramSubscription, 1000)
      return () => clearTimeout(timer)
    }
  }, [connected, userAddress, checkBotStatus, subscribeUser])

  // Auto-refresh orders - force restart when component mounts
  useEffect(() => {
    if (connected && userAddress) {
      console.log('🔧 ORDERS: Setting up auto-refresh for orders:', userAddress)
      
      const loadOrders = async () => {
        try {
          const orders = await sorobanService.getUserOrders(userAddress)
          setUserOrders(orders)
        } catch {
          console.error('Error loading orders')
        }
      }
      
      // Load immediately with a small delay
      const initialTimer = setTimeout(loadOrders, 500)
      
      // Then set up regular interval
      const interval = setInterval(loadOrders, REFRESH_INTERVAL)
      
      return () => {
        clearTimeout(initialTimer)
        clearInterval(interval)
      }
    }
  }, [connected, userAddress, sorobanService])

  // Auto-execute orders every 60 seconds with throttling - ensure restart on mount
  useEffect(() => {
    if (connected && userAddress) {
      console.log('🔧 AUTO-EXECUTE: Starting auto-execute interval for user:', userAddress)
      
      let isExecuting = false // Prevent multiple simultaneous executions
      let lastExecutionTime = 0
      const EXECUTION_COOLDOWN = 60000 // 60 seconds minimum between executions

      const autoExecute = async () => {
        const now = Date.now()
        
        // Check if already executing or in cooldown period
        if (isExecuting || (now - lastExecutionTime) < EXECUTION_COOLDOWN) {
          console.log('🔧 AUTO-EXECUTE: Skipping execution - already running or in cooldown')
          return
        }
        
        isExecuting = true
        lastExecutionTime = now
        
        try {
          console.log('🤖 AUTO-EXECUTE: Starting auto-execution for user:', userAddress)
          
          // Store orders before execution to detect newly executed ones
    

          // First update order prices
          console.log('🤖 AUTO-EXECUTE: Updating order prices...')
          await sorobanService.updateOrderPrices()
              
          // Then check and execute orders
          console.log('🤖 AUTO-EXECUTE: Checking and executing orders...')
          const executeResult = await sorobanService.checkAndExecuteOrders()
          
          // Check if any orders were executed
          if (executeResult.success && executeResult.executedOrderIds && executeResult.executedOrderIds.length > 0) {
            console.log('🤖 AUTO-EXECUTE: Orders executed successfully, IDs:', executeResult.executedOrderIds.map(id => id.toString()))
            
            // Refresh orders to get updated data
            const ordersAfter = await sorobanService.getUserOrders(userAddress)
            setUserOrders(ordersAfter)
            
            // Show alert for executed orders
     
            
            console.log('🤖 AUTO-EXECUTE: Processing', executeResult.executedOrderIds.length, 'executed orders for Telegram notifications')
            
            // Get executed orders details
            const executedOrders = ordersAfter.filter(order => 
              executeResult.executedOrderIds!.some(executedId => executedId === order.id)
            )
            // Send telegram notifications for executed orders
            for (const order of executedOrders) {
              try {   
                console.log('🤖 AUTO-EXECUTE: Processing order for Telegram notification:', order.id.toString())
                const assetSymbol = getAssetSymbol(order.asset)
                const originalAmount = SorobanService.formatAmount(order.amount,7)
            
                // Calculate detailed P&L like emergency sell
                if (order.execution_price && order.initial_price) {
                  const initialPrice = parseFloat(SorobanService.formatAmount(order.initial_price))
                  const execPrice = parseFloat(SorobanService.formatAmount(order.execution_price))
                  const priceChangePercent = ((execPrice - initialPrice) / initialPrice) * 100
                  const isProfit = priceChangePercent > 0
                  
                  // Get commission rate from smart contract
                  let commissionAmount = 0
                  let commissionPercent = 0
                  let netProfit = 0
                  
                  try {
                    const commissionRateResponse = await sorobanService.getEmergencyCommissionRate()
                    const commissionRateBP = commissionRateResponse || 50
                    commissionPercent = commissionRateBP / 100
                    
                    if (isProfit) {
                      const orderAmountFloat = parseFloat(originalAmount)
                      const grossProfit = (execPrice - initialPrice) * orderAmountFloat
                      commissionAmount = grossProfit * (commissionPercent / 100)
                      netProfit = grossProfit - commissionAmount
                    }
                  } catch (error) {
                    console.log('Error getting commission rate for trailing executed notification:', error)
                    commissionPercent = 0.5 // Default fallback
                    if (isProfit) {
                      const orderAmountFloat = parseFloat(originalAmount)
                      const grossProfit = (execPrice - initialPrice) * orderAmountFloat
                      commissionAmount = grossProfit * (commissionPercent / 100)
                      netProfit = grossProfit - commissionAmount
                    }
                  }

                  // Direct API call with detailed data
                  const telegramResponse = await fetch('/api/telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'notify_trailing_executed',
                      userId: userAddress,
                      data: {
                        orderId: order.id.toString(),
                        asset: assetSymbol,
                        originalAmount: originalAmount,
                        initialPrice: SorobanService.formatAmount(BigInt(order.initial_price)),
                        executionPrice: SorobanService.formatAmount(BigInt(order.execution_price)),
                        priceChangePercent: priceChangePercent.toFixed(2),
                        isProfit,
                        commissionPercent: isProfit ? commissionPercent : 0,
                        commissionAmount: isProfit ? commissionAmount.toFixed(7) : '0',
                        netProfit: isProfit ? netProfit.toFixed(7) : '0',
                        executedAt: new Date().toLocaleString()
                      }
                    })
                  })

                  const telegramResult = await telegramResponse.json()
                  
                  if (telegramResult.success) {
                    console.log('✅ AUTO-EXECUTE: Detailed Telegram notification sent successfully for order:', order.id.toString())
                  } else {
                    console.log('❌ AUTO-EXECUTE: Telegram notification failed for order:', order.id.toString())
                    console.log('❌ AUTO-EXECUTE: Error details:', telegramResult)
                  }
                } else {
                  console.log('⚠️ AUTO-EXECUTE: Missing price data for order:', order.id.toString())
                }
              } catch (notificationError) {
                console.error('❌ AUTO-EXECUTE: Failed to send telegram notification:', notificationError)
              }
            }
          } else {
            console.log('🤖 AUTO-EXECUTE: No orders were executed')
            // Still refresh orders to show any price updates
            const ordersAfter = await sorobanService.getUserOrders(userAddress)
            setUserOrders(ordersAfter)
          }
          
        } catch (error) {
          console.error('❌ AUTO-EXECUTE: Error in auto-execute:', error)
        } finally {
          isExecuting = false
        }
        
        // Her auto-execute sonunda durumu raporla
        console.log('🔧 AUTO-EXECUTE: Completed auto-execution cycle at', new Date().toLocaleTimeString())
      }
      
      console.log('🔧 Setting up auto-execute interval with', EXECUTE_INTERVAL, 'ms interval')
      
      // İlk çalıştırmayı biraz gecikmeyle yap
      const initialTimer = setTimeout(autoExecute, 3000)
      
      const interval = setInterval(autoExecute, EXECUTE_INTERVAL)
      return () => {
        console.log('🔧 Cleaning up auto-execute interval')
        clearTimeout(initialTimer)
        clearInterval(interval)
      }
    } else {
      console.log('🔧 Auto-execute not started - Connected:', connected, 'UserAddress:', userAddress)
    }
  }, [connected, userAddress, sorobanService, notifyTrailingStopExecuted, getAssetSymbol, formatAddress])

  // Setup Telegram connection
  const setupTelegramConnection = async (telegramUserId: string) => {
    if (!connected || !userAddress) {
      setError('Please connect wallet first')
      return
    }

    if (!telegramUserId.trim()) {
      setError('Please enter your Telegram User ID')
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('Setting up Telegram connection:', {
        walletAddress: userAddress,
        telegramId: telegramUserId
      })

      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_subscription',
          data: {
            walletAddress: userAddress,
            telegramId: telegramUserId
          }
        })
      })

      const result = await response.json()

      if (result.success) {
        setTelegramConnected(true)
        setShowTelegramSetup(false)
        setSuccess(`Telegram notifications set up successfully! Messages will be sent to ${telegramUserId}`)
        
        // Store in localStorage for future use
        localStorage.setItem(`telegram_id_${userAddress}`, telegramUserId)
      } else {
        setError('Failed to setup Telegram connection')
      }
    } catch (error) {
      console.error('Error setting up Telegram:', error)
      setError('Failed to setup Telegram connection')
    } finally {
      setLoading(false)
    }
  }

  // Send test message to Telegram
  const sendTestMessage = async () => {
    if (!connected || !userAddress) {
      setError('Please connect wallet first')
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('Sending test message to:', userAddress)

      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify_trailing_executed',
          userId: userAddress,
          data: {
            orderId: 'TEST-ORDER-123',
            asset: 'BTC',
            originalAmount: '1000.0000000',
            initialPrice: '50000.0000000',
            executionPrice: '51000.0000000',
            priceChangePercent: '2.00',
            isProfit: true,
            commissionPercent: 0.5,
            commissionAmount: '5.0000000',
            netProfit: '995.0000000',
            executedAt: new Date().toLocaleString()
          }
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Test message sent successfully to Telegram!')
      } else {
        setError('Failed to send test message: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error sending test message:', error)
      setError('Failed to send test message')
    } finally {
      setLoading(false)
    }
  }

  // Check if Telegram is already connected
  useEffect(() => {
    if (connected && userAddress) {
      const storedTelegramId = localStorage.getItem(`telegram_id_${userAddress}`)
      if (storedTelegramId) {
        setTelegramId(storedTelegramId)
        setTelegramConnected(true)
      } else {
        setShowTelegramSetup(true)
      }
    }
  }, [connected, userAddress])

  const connectWallet = async () => {
    try {
      setLoading(true)
      setError('')
      
      const result = await walletService.connectWallet()
      
      if (result.success && result.address) {
        setUserAddress(result.address)
        setConnected(true)
        setSuccess('Wallet connected successfully!')
        
        const orders = await sorobanService.getUserOrders(result.address)
        setUserOrders(orders)
      } else {
        setError(result.error || 'Failed to connect wallet')
      }
    } catch {
      setError('Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }
  const activeCount = userOrders.reduce((count, order) => {
  const status = Array.isArray(order.status) ? order.status[0] : order.status
  return status === 'Active' ? count + 1 : count
}, 0)
  const executedCount = userOrders.reduce((count, order) => {
  const status = Array.isArray(order.status) ? order.status[0] : order.status
  return status === 'Executed' ? count + 1 : count
}, 0)

  const disconnectWallet = () => {
    setConnected(false)
    setUserAddress('')
    setUserOrders([])
    setCurrentPrice('')
    setSelectedAssetSymbol('')
    setSuccess('Wallet disconnected')
  }

  const handleAssetSelection = async (contractId: string, symbol: string) => {
    setAssetAddress(contractId)
    setSelectedAssetSymbol(symbol)
    setCurrentPrice('')
    setSuccess(`Selected ${symbol} asset`)
    
    // Automatically get current price
    try {
      setPriceLoading(true)
      setError('')
      
      const price = await sorobanService.getCurrentPrice(contractId)
      
      if (price !== null) {
        setCurrentPrice(SorobanService.formatAmount(price))
        setSuccess(`${symbol} selected - Current price: ${SorobanService.formatAmount(price)}`)
      } else {
        setError('Price not available for this asset')
        setCurrentPrice('')
      }
    } catch {
      setError('Failed to get current price')
      setCurrentPrice('')
    } finally {
      setPriceLoading(false)
    }
  }
  const executeOrders = async () => {
    if (!connected) {
      setError('Please connect wallet first')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      // First update order prices
      console.log('Updating order prices...')
      const updateResult = await sorobanService.updateOrderPrices()
      
      if (updateResult.success) {
        console.log('✅ Order prices updated successfully')
      } else {
        console.log('⚠️ Price update failed:', updateResult.error)
      }

      // Then check and execute orders
      console.log('Checking and executing orders...')
      const result = await sorobanService.checkAndExecuteOrders()

      if (result.success) {
        // Check if any orders were executed
        if (result.executedOrderIds && result.executedOrderIds.length > 0) {
          setSuccess(`Orders checked and executed successfully! ${result.executedOrderIds.length} orders executed.`)
          
          // Refresh orders after execution
          const ordersAfter = await sorobanService.getUserOrders(userAddress)
          setUserOrders(ordersAfter)

          // Get executed orders details using the returned IDs
          const executedOrders = ordersAfter.filter(order => 
            result.executedOrderIds!.some(executedId => executedId === order.id)
          )

          console.log('Orders executed:', result.executedOrderIds.map(id => id.toString()))
          console.log('Executed orders details found:', executedOrders.length)

        // Send telegram notifications for executed orders
        for (const order of executedOrders) {
          try {
            debugger;
            console.log('📧 MANUAL-EXECUTE: Processing executed order for Telegram notification:', order.id.toString())
            
            const assetSymbol = getAssetSymbol(order.asset)
            const originalAmount = SorobanService.formatAmount(order.amount)
            
            // Calculate detailed P&L like emergency sell
            if (order.execution_price && order.initial_price) {
              const initialPrice = parseFloat(SorobanService.formatAmount(order.initial_price))
              const execPrice = parseFloat(SorobanService.formatAmount(order.execution_price))
              const priceChangePercent = ((execPrice - initialPrice) / initialPrice) * 100
              const isProfit = priceChangePercent > 0
              
              // Get commission rate from smart contract
              let commissionAmount = 0
              let commissionPercent = 0
              let netProfit = 0
              
              try {
                const commissionRateResponse = await sorobanService.getEmergencyCommissionRate()
                const commissionRateBP = commissionRateResponse || 50
                commissionPercent = commissionRateBP / 100
                
                if (isProfit) {
                  const orderAmountFloat = parseFloat(originalAmount)
                  const grossProfit = (execPrice - initialPrice) * orderAmountFloat
                  commissionAmount = grossProfit * (commissionPercent / 100)
                  netProfit = grossProfit - commissionAmount
                }
              } catch (error) {
                console.log('Error getting commission rate for manual executed notification:', error)
                commissionPercent = 0.5 // Default fallback
              }

              console.log('📧 MANUAL-EXECUTE: Sending detailed Telegram API call with data:', {
                orderId: order.id.toString(),
                asset: assetSymbol,
                originalAmount: originalAmount,
                initialPrice: SorobanService.formatAmount(order.initial_price),
                executionPrice: SorobanService.formatAmount(order.execution_price),
                priceChangePercent: priceChangePercent.toFixed(2),
                isProfit,
                commissionPercent: isProfit ? commissionPercent : 0,
                commissionAmount: isProfit ? commissionAmount.toFixed(7) : '0',
                netProfit: isProfit ? netProfit.toFixed(7) : '0'
              })

              // Direct API call with detailed data
              const telegramResponse = await fetch('/api/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'notify_trailing_executed',
                  userId: userAddress,
                  data: {
                    orderId: order.id.toString(),
                    asset: assetSymbol,
                    originalAmount: originalAmount,
                    initialPrice: SorobanService.formatAmount(order.initial_price),
                    executionPrice: SorobanService.formatAmount(order.execution_price),
                    priceChangePercent: priceChangePercent.toFixed(2),
                    isProfit,
                    commissionPercent: isProfit ? commissionPercent : 0,
                    commissionAmount: isProfit ? commissionAmount.toFixed(7) : '0',
                    netProfit: isProfit ? netProfit.toFixed(7) : '0',
                    executedAt: new Date().toLocaleString()
                  }
                })
              })

              const telegramResult = await telegramResponse.json()
              
              if (telegramResult.success) {
                console.log('✅ MANUAL-EXECUTE: Detailed Telegram notification sent successfully for order:', order.id.toString())
              } else {
                console.log('❌ MANUAL-EXECUTE: Telegram notification failed for order:', order.id.toString())
                console.log('❌ MANUAL-EXECUTE: Error details:', telegramResult)
              }
            } else {
              console.log('⚠️ MANUAL-EXECUTE: Missing price data for order:', order.id.toString())
            }
          } catch (notificationError) {
            console.error('❌ MANUAL-EXECUTE: Failed to send telegram notification for order:', order.id.toString(), notificationError)
          }
        }
        } else {
          setSuccess('Orders checked successfully - no orders were executed.')
          
          // Still refresh orders to show any price updates
          const ordersAfter = await sorobanService.getUserOrders(userAddress)
          setUserOrders(ordersAfter)
        }
      } else {
        setError(result.error || 'Failed to execute orders')
      }
    } catch {
      setError('Failed to execute orders')
    } finally {
      setLoading(false)
    }
  }
  const createOrder = async () => {
    if (!connected) {
      setError('Please connect wallet first')
      return
    }

    if (!assetAddress || !amount || !trailPercentage) {
      setError('Please fill all fields')
      return
    }

    if (parseFloat(trailPercentage) <= 0 || parseFloat(trailPercentage) > 50) {
      setError('Trail percentage must be between 0.1% and 50%')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const amountInStroops = SorobanService.parseAmountfortoken(amount)
      const trailBasisPoints = Math.floor(parseFloat(trailPercentage))
      
      // Get token address from ASSETS
      const selectedAsset = Object.values(ASSETS).find(a => a.contractId === assetAddress)
      const tokenAddress = selectedAsset?.token || assetAddress
      
      console.log('Creating order with params:', {
        userAddress,
        assetAddress,
        tokenAddress,
        amountInStroops: amountInStroops.toString(),
        trailBasisPoints
      });
      
      const result = await sorobanService.createOrder(
        userAddress,
        assetAddress,
        tokenAddress,
        amountInStroops,
        trailBasisPoints
      )

      if (result.success) {
        setSuccess(`Order created successfully! ID: ${result.orderId}`)
        
        // Clear form
        setAssetAddress('')
        setSelectedAssetSymbol('')
        setAmount('')
        setTrailPercentage('')
        setCurrentPrice('')
        
        // Refresh orders
        const orders = await sorobanService.getUserOrders(userAddress)
        setUserOrders(orders)
      } else {
        setError(result.error || 'Failed to create order')
      }
    } catch {
      setError('Failed to create order')
    } finally {
      setLoading(false)
    }
  }



  const emergencySellOrder = async (orderId: bigint) => {
    if (!connected) return

    // Show confirmation dialog
    const confirmSell = window.confirm(
      `Are you sure you want to emergency sell this order at current market price? This action cannot be undone.`
    )
    
    if (!confirmSell) return

    try {
      setLoading(true)
      setError('')
      
      // Get the order details before execution for P&L calculation
      const orderBefore = userOrders.find(order => order.id === orderId)
      
      const result = await sorobanService.emergencySellOrder(userAddress, orderId)
      
      if (result.success) {
        // Get updated orders to see the executed order
        const orders = await sorobanService.getUserOrders(userAddress)
        setUserOrders(orders)
        
        // Find the executed order for P&L calculation
        const executedOrder = orders.find(order => order.id === orderId)
        
        if (orderBefore && executedOrder && executedOrder.execution_price && executedOrder.executed_at) {
          const initialPrice = Number(orderBefore.initial_price)
          const executionPrice = Number(executedOrder.execution_price)
          const originalAmount = Number(orderBefore.amount)
          
          // Calculate P&L percentage
          const priceChangePercent = ((executionPrice - initialPrice) / initialPrice) * 100
          const isProfit = priceChangePercent > 0
          
          // Get commission rate from smart contract (basis points)
          let commissionAmount = 0
          let commissionPercent = 0
          let netProfit = 0
          
          try {
            const commissionRateResponse = await sorobanService.getEmergencyCommissionRate()
            const commissionRateBP = commissionRateResponse || 50 // Default to 0.5% if not available
            commissionPercent = commissionRateBP / 100 // Convert basis points to percentage
            
            if (isProfit) {
              const grossProfit = (executionPrice - initialPrice) * originalAmount
              commissionAmount = grossProfit * (commissionPercent / 100)
              netProfit = grossProfit - commissionAmount
              
              console.log('💰 Emergency Sell Commission Calculation:', {
                grossProfit: grossProfit.toFixed(7),
                commissionPercent: commissionPercent + '%',
                commissionAmount: commissionAmount.toFixed(7),
                netProfit: netProfit.toFixed(7),
                rateBasisPoints: commissionRateBP
              })
            }
          } catch (error) {
            console.log('Error getting commission rate, using default 0.5%:', error)
            commissionPercent = 0.5 // Default fallback
            if (isProfit) {
              const grossProfit = (executionPrice - initialPrice) * originalAmount
              commissionAmount = grossProfit * (commissionPercent / 100)
              netProfit = grossProfit - commissionAmount
            }
          }
          
          // Send Telegram notification with P&L and commission details
          try {
            await fetch('/api/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'emergency_sell',
                userId: userAddress,
                data: {
                  orderId: orderId.toString(),
                  asset: getAssetSymbol(orderBefore.asset),
                  originalAmount: SorobanService.formatAmount(BigInt(originalAmount)),
                  initialPrice: SorobanService.formatAmount(BigInt(initialPrice)),
                  executionPrice: SorobanService.formatAmount(BigInt(executionPrice)),
                  priceChangePercent: priceChangePercent.toFixed(2),
                  isProfit,
                  commissionPercent: isProfit ? commissionPercent : 0,
                  commissionAmount: isProfit ? commissionAmount.toFixed(7) : '0',
                  netProfit: isProfit ? netProfit.toFixed(7) : '0',
                  executedAt: new Date().toLocaleString()
                }
              })
            })
          } catch (error) {
            console.log('Telegram notification error:', error)
          }
          
          let profitLossText = ''
          if (isProfit) {
            const grossProfitPercent = priceChangePercent
            const netProfitPercent = (netProfit / (initialPrice * originalAmount)) * 100
            profitLossText = `📈 PROFIT: +${grossProfitPercent.toFixed(2)}% (Gross) | Net: +${netProfitPercent.toFixed(2)}% (After ${commissionPercent}% commission)`
          } else {
            profitLossText = `📉 LOSS: ${priceChangePercent.toFixed(2)}% (No commission on losses)`
          }
          
          setSuccess(`Emergency sell executed successfully! ${profitLossText}`)
        } else {
          setSuccess(`Emergency sell executed successfully for order ${orderId}!`)
        }
      } else {
        setError(result.error || 'Failed to execute emergency sell')
      }
    } catch {
      setError('Failed to execute emergency sell')
    } finally {
      setLoading(false)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  // Get status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': 
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Executed': 
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default: 
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Calculate preview prices
  const calculatePreviewPrices = () => {
    if (!currentPrice || !trailPercentage) return null
    
    const price = parseFloat(currentPrice)
    const trail = parseFloat(trailPercentage) / 100
    
    const stopPrice = price * (1 - trail)
    
    return {
      currentPrice: price.toFixed(14).replace(/\.?0+$/, ''),
      stopPrice: stopPrice.toFixed(14).replace(/\.?0+$/, ''),
      trailAmount: (price - stopPrice).toFixed(14).replace(/\.?0+$/, '')
    }
  }

  // Calculate profit/loss for executed orders
  const calculateProfitLoss = (order: TrailingOrder) => {
    const status = Array.isArray(order.status) ? order.status[0] : order.status
    
    if (status !== 'Executed' || !order.execution_price || !order.initial_price) {
      return null
    }
    
    const initialPrice = parseFloat(SorobanService.formatAmount(order.initial_price))
    const executionPrice = parseFloat(SorobanService.formatAmount(order.execution_price))
    const amount = parseFloat(SorobanService.formatAmount(order.amount))
    
    // Calculate percentage change
    const percentageChange = ((executionPrice - initialPrice) / initialPrice) * 100
    
    // Calculate absolute profit/loss (simplified - in real scenario would need proper calculation)
    const profitLoss = (executionPrice - initialPrice) * amount
    
    return {
      percentageChange,
      profitLoss,
      isProfit: percentageChange > 0
    }
  }

  const previewPrices = calculatePreviewPrices()
  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation with Wallet Connection */}
      <div className="w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-xl font-bold text-gray-900">
            Reflector Trading
          </div>
          
          {/* Wallet Connection in Top Right */}
          <div>
            {!connected ? (
              <button
                onClick={connectWallet}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Connecting...' : 'Connect Freighter'}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Connected:</span>
                  <span className="font-mono ml-1">{formatAddress(userAddress)}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Reflector Trading Platform
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced automated trading orders on Stellar blockchain using Soroban smart contracts
          </p>
          
    
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
 {/* Active Orders */}
 <button
   onClick={() => setFilterStatus('Active')}
   className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow w-full text-left ${
     filterStatus === 'Active' ? 'ring-2 ring-green-500 border-green-300' : ''
   }`}
 >
   <div className="text-2xl font-bold text-green-600">{activeCount}</div>
   <div className="text-sm text-gray-500">Active Orders</div>
 </button>

 {/* Executed Orders */}
 <button
   onClick={() => setFilterStatus('Executed')}
   className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow w-full text-left ${
     filterStatus === 'Executed' ? 'ring-2 ring-blue-500 border-blue-300' : ''
   }`}
 >
   <div className="text-2xl font-bold text-blue-600">{executedCount}</div>
   <div className="text-sm text-gray-500">Executed Orders</div>
 </button>
</div>
        </header>

        {/* Telegram Setup Panel */}
        {connected && showTelegramSetup && (
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="text-xl font-bold text-blue-800 mb-2">📱 Setup Telegram Notifications</div>
                <p className="text-sm text-blue-600">
                  To receive auto-execute notifications, please enter your Telegram User ID
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Your Telegram User ID
                  </label>
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="8211541138"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="mt-2 text-xs text-blue-600">
                    💡 To get your Telegram ID: Message @userinfobot on Telegram
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setupTelegramConnection(telegramId)}
                    disabled={loading || !telegramId.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {loading ? 'Setting up...' : 'Connect Telegram'}
                  </button>
                  <button
                    onClick={() => setShowTelegramSetup(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
                
                {/* Test Message Button */}
                {telegramId.trim() && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <button
                      onClick={sendTestMessage}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      {loading ? 'Sending...' : '📱 Send Test Message'}
                    </button>
                    <div className="mt-2 text-xs text-green-600">
                      💡 Test notification using your wallet address as userId
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Telegram Status */}
        {connected && telegramConnected && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600">📱</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-800">
                    Telegram Notifications Active
                  </div>
                  <div className="text-xs text-green-700">
                    Auto-execute notifications will be sent to Telegram ID: {telegramId}
                  </div>
                </div>
                <button
                  onClick={sendTestMessage}
                  disabled={loading}
                  className="mr-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                >
                  {loading ? 'Sending...' : '📱 Test'}
                </button>
                <div className="text-xs text-green-600 font-semibold">
                  ✓ Connected
                </div>
                <button
                  onClick={() => {
                    setShowTelegramSetup(true)
                    setTelegramConnected(false)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

    
        
        {/* Detailed Telegram Panel (hidden by default) */}
        <div className="mb-8 max-w-4xl mx-auto" style={{ display: 'none' }}>
          <TelegramNotificationPanel 
            userAddress={userAddress}
            isConnected={connected}
          />
        </div>

        {/* Admin Access Link
        {isAdmin && connected && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xl">⚙️</span>
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-purple-800">Admin Access</div>
                  <div className="text-sm text-purple-600">Access the full admin control panel</div>
                </div>
                <a
                  href="/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <span>🚀</span>
                  Open Admin Panel
                </a>
              </div>
              <div className="mt-4 text-xs text-purple-600 bg-purple-100 rounded-lg p-3">
                ℹ️ The admin panel will open in a new tab with full liquidity management and contract monitoring capabilities
              </div>
            </div>
          </div>
        )} */}

        {/* Asset Price Display */}
        <AssetPriceDisplay 
          sorobanService={sorobanService}
          onAssetSelect={handleAssetSelection}
          selectedAssetAddress={assetAddress}
        />

        {/* Auto-execution Info Banner */}
        {connected && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600">🤖</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-800">
                    Automated Order Execution Active
                  </div>
                  <div className="text-xs text-green-700">
                    Your orders are automatically checked and executed every 60 seconds. You can also manually trigger execution using the buttons below.
                  </div>
                </div>
                <div className="text-xs text-green-600 font-mono">
                  Auto-execution every 60s
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {(error || success) && (
          <div className="mb-8 max-w-2xl mx-auto">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div className="text-red-800">{error}</div>
                  <button 
                    onClick={clearMessages}
                    className="text-red-600 hover:text-red-800 ml-4"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="text-green-800">{success}</div>
                  <button 
                    onClick={clearMessages}
                    className="text-green-600 hover:text-green-800 ml-4"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Create Order Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Order</h2>
              
              <div className="space-y-4" >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Asset Selection
                  </label>
                  <select
                    value={assetAddress}
                    onChange={(e) => {
                      const value = e.target.value
                      const asset = Object.values(ASSETS).find(a => a.contractId === value)
                      if (asset) {
                        handleAssetSelection(value, asset.symbol)
                      } else {
                        setAssetAddress('')
                        setSelectedAssetSymbol('')
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an asset...</option>
                    {Object.entries(ASSETS).map(([key, asset]) => (
                      <option key={key} value={asset.contractId}>
                        {asset.symbol} - {asset.name}
                      </option>
                    ))}
                  </select>
                  
                  {selectedAssetSymbol && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm text-blue-800">
                        <strong>Selected:</strong> {selectedAssetSymbol}
                      </div>
                      <div className="text-xs text-blue-600 font-mono break-all">
                        {assetAddress}
                      </div>
                    </div>
                  )}
                  
                  {currentPrice && !priceLoading && (
                    <div className="mt-2 text-sm text-green-600 font-medium">
                      Current Price: {currentPrice}
                    </div>
                  )}
                  
                  {priceLoading && (
                    <div className="mt-2 text-sm text-blue-600">
                      Loading price...
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0000000"
                    step="0.0000001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trail Percentage (%)
                  </label>
                  <input
                    type="number"
                    value={trailPercentage}
                    onChange={(e) => setTrailPercentage(e.target.value)}
                    placeholder="5"
                    min="1"
                    max="50"
                    step="0.5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    Between 1% and 25%
                  </div>
                  
                  {/* Price Preview */}
                  {previewPrices && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 mb-2">💡 Order Preview</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-blue-600">Amount:</span>
                          <span className="font-medium text-blue-900">{amount} tokens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Commission (2%):</span>
                          <span className="font-medium text-red-700">{(parseFloat(amount || '0') * 0.02).toFixed(2)} tokens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Net Amount:</span>
                          <span className="font-medium text-green-700">{(parseFloat(amount || '0') * 0.98).toFixed(2)} tokens</span>
                        </div>
                        <div className="border-t border-blue-200 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-blue-600">Current Price:</span>
                            <span className="font-medium text-blue-900">{previewPrices.currentPrice}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Stop Price ({trailPercentage}% below):</span>
                            <span className="font-medium text-blue-900">{previewPrices.stopPrice}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Trail Amount:</span>
                            <span className="font-medium text-green-700">{previewPrices.trailAmount}</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200 text-blue-700">
                          <div className="text-xs">ℹ️ Maximum profit limited to 200%. Minimum loss protection: {trailPercentage} %</div>
                          <div className="text-xs mt-1">💰 Commission helps maintain contract liquidity</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={createOrder}
                  disabled={loading || !connected}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Creating Order...' : 'Create Trailing Stop Order'}
                </button>
                
               
                
            
                
                <div className="text-xs text-gray-500 text-center">
                  💡 Orders are automatically checked every 60 seconds
                </div>
              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={executeOrders}
                    disabled={loading || !connected}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <span>🔄</span>
                    {loading ? 'Executing...' : 'Check & Execute'}
                  </button>
                  <div className="text-sm text-gray-500">
                    Auto-refresh every {REFRESH_INTERVAL / 1000}s
                  </div>
                </div>
              </div>

              {loading && userOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Loading orders...
                </div>
              ) : userOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No orders yet. Create your first trailing stop order!
                </div>
              ) :(
             
                <div className="space-y-4">
 {userOrders.map((order) => {
   const status = Array.isArray(order.status) ? order.status[0] : order.status
   const shouldShow = filterStatus === 'All' || status === filterStatus
   const profitLoss = calculateProfitLoss(order)
   
   return shouldShow && (
     <div
       key={order.id.toString()}
       className={`rounded-xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl border-2 ${
         status === 'Executed' && profitLoss 
           ? profitLoss.isProfit 
             ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:from-green-100 hover:to-green-150' 
             : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 hover:from-red-100 hover:to-red-150'
           : status === 'Active'
             ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:from-blue-100 hover:to-blue-150'
             : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 hover:from-gray-100 hover:to-gray-150'
       }`}
     >
       <div className="flex justify-between items-start mb-4">
         <div>
           <div className={`font-bold text-xl ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-800' : 'text-red-800'
               : status === 'Active' ? 'text-blue-800' : 'text-gray-800'
           }`}>
             Order #{order.id.toString()}
           </div>
           <div className={`text-sm font-medium ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-600' : 'text-red-600'
               : status === 'Active' ? 'text-blue-600' : 'text-gray-600'
           }`}>
             Asset: {getAssetSymbol(order.asset)}
           </div>
         </div>
         <div className="flex items-center gap-3">
           <span className={`px-3 py-2 rounded-full text-sm font-bold border-2 ${getStatusBadge(order.status)}`}>
             {order.status}
           </span>
           {/* {shouldShow && status === "Active" && (
             <button
               onClick={() => cancelOrder(order.id)}
               disabled={loading}
               className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md"
             >
               Cancel
             </button>
           )} */}
         </div>
       </div>
       
       {/* Basic Order Info */}
       <div className="grid grid-cols-2 md:grid-cols-2 gap-6 text-sm mb-6">
         <div className="text-center">
           <div className={`text-xs font-semibold uppercase tracking-wide ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
               : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
           }`}>Amount</div>
           <div className={`font-bold text-base ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
               : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
           }`}>{SorobanService.formatAmount(order.amount,7)}</div>
           <div className={`text-xs font-medium ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-600' : 'text-red-600'
               : status === 'Active' ? 'text-blue-600' : 'text-gray-600'
           }`}>{getAssetSymbol(order.asset)}</div>
         </div>
         <div className="text-center">
           <div className={`text-xs font-semibold uppercase tracking-wide ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
               : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
           }`}>Trail %</div>
           <div className={`font-bold text-base ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
               : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
           }`}>{order.trail_percentage}%</div>
         </div>
         <div className="text-center">
           <div className={`text-xs font-semibold uppercase tracking-wide ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
               : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
           }`}>Initial Price</div>
           <div className={`font-bold text-base ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
               : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
           }`}>{SorobanService.formatAmount(order.initial_price)}</div>
         </div>
         <div className="text-center">
           <div className={`text-xs font-semibold uppercase tracking-wide ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
               : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
           }`}>Highest Price</div>
           <div className={`font-bold text-base ${
             status === 'Executed' && profitLoss 
               ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
               : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
           }`}>{SorobanService.formatAmount(order.highest_price)}</div>
         </div>
       </div>

       {/* Executed Order Details */}
       { status === 'Executed' && order.execution_price && profitLoss && (
         <div className={`mt-4 p-3 rounded-lg border-l-4 ${profitLoss.isProfit ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
           <div className="flex items-center justify-between mb-2">
             <div className="text-sm font-medium text-gray-700">📊 Execution Details</div>
             <div className="text-xs text-gray-500">
               {order.executed_at ? new Date(Number(order.executed_at) * 1000).toLocaleString() : 'N/A'}
             </div>
           </div>
           
           {/* Sale Summary */}
           <div className={`mb-4 p-3 rounded-lg border ${profitLoss.isProfit ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
             <div className={`text-sm font-medium mb-2 ${profitLoss.isProfit ? 'text-green-800' : 'text-red-800'}`}>
               💰 Sale Summary - {profitLoss.isProfit ? '🎉 PROFIT' : '📉 LOSS'}
             </div>
             <div className="text-sm">
               <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}>Sold </span>
               <span className={`font-bold ${profitLoss.isProfit ? 'text-green-900' : 'text-red-900'}`}>
                 {SorobanService.formatAmount(order.amount)} {getAssetSymbol(order.asset)}
               </span>
               <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}> at </span>
               <span className={`font-bold ${profitLoss.isProfit ? 'text-green-900' : 'text-red-900'}`}>
                 {SorobanService.formatAmount(order.execution_price)}
               </span>
               <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}> per unit</span>
             </div>
             <div className={`text-xs mt-1 ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
               Total Value: {(parseFloat(SorobanService.formatAmount(order.amount)) * parseFloat(SorobanService.formatAmount(order.execution_price))).toFixed(14)}
             </div>
           </div>
           
           {/* Price and P&L Details */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
             <div>
               <div className="text-gray-500 text-xs">Initial Price</div>
               <div className="font-medium text-gray-900 text-sm">
                 {SorobanService.formatAmount(order.initial_price)}
               </div>
             </div>
             
             <div>
               <div className="text-gray-500 text-xs">Sale Price</div>
               <div className={`font-bold text-base ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                 {SorobanService.formatAmount(order.execution_price)}
               </div>
             </div>
             
             <div>
               <div className="text-gray-500 text-xs">Price Change</div>
               <div className={`font-medium text-sm ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                 {profitLoss.isProfit ? '+' : ''}{profitLoss.percentageChange.toFixed(4)}%
               </div>
             </div>
             
             <div>
               <div className="text-gray-500 text-xs">Profit/Loss</div>
               <div className={`font-bold text-base ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                 {profitLoss.isProfit ? '+' : ''}{profitLoss.profitLoss.toFixed(14)}
                 <span className="text-xs ml-1">
                   {profitLoss.isProfit ? '📈' : '📉'}
                 </span>
               </div>
             </div>
           </div>
           
           {/* Performance Indicator */}
           <div className="mt-3 flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full ${profitLoss.isProfit ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <div className={`text-sm font-medium ${profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}`}>
               {profitLoss.isProfit ? '🎉 Profitable Trade' : '⚠️ Loss Trade'}
             </div>
             <div className="text-xs text-gray-500 ml-auto">
               Stop triggered at {SorobanService.formatAmount(order.stop_price)}
             </div>
           </div>
         </div>
       )}

       {/* Active Order Info */}
       {status === 'Active' && (
         <div className="mt-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
           <div className="text-sm font-medium text-green-700 mb-3">🟢 Active Order</div>
           <div className="grid grid-cols-2 gap-4 text-sm mb-4">
             <div>
               <div className="text-green-600">Current Stop Price</div>
               <div className="font-medium text-green-800">{SorobanService.formatAmount(order.stop_price)}</div>
             </div>
             <div>
               <div className="text-green-600">Potential Gain</div>
               <div className="font-medium text-green-800">
                 {((parseFloat(SorobanService.formatAmount(order.highest_price)) - parseFloat(SorobanService.formatAmount(order.initial_price))) / parseFloat(SorobanService.formatAmount(order.initial_price)) * 100).toFixed(2)}%
               </div>
             </div>
           </div>
           
           {/* Emergency Sell Button */}
           <div className="border-t border-green-200 pt-3">
             <div className="flex items-center justify-between">
               <div className="text-xs text-green-600">
                 💡 Emergency sell at current market price
               </div>
               <button
                 onClick={() => emergencySellOrder(order.id)}
                 disabled={loading}
                 className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
               >
                 <span>⚡</span>
                 {loading ? 'Selling...' : 'Emergency Sell'}
               </button>
             </div>
             <div className="text-xs text-orange-600 mt-1">
               ⚠️ Sells immediately at current market price, bypassing trailing stop
             </div>
           </div>
         </div>
       )}
     </div>
   )
 })}
</div>
              )}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16 bg-gray-50 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📈</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Price Tracking</h4>
              <p className="text-gray-600">
                Smart contract continuously monitors asset prices and updates the highest price seen.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📉</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Trailing Stop</h4>
              <p className="text-gray-600">
                Stop price automatically trails below the highest price by your specified percentage.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Auto Execute</h4>
              <p className="text-gray-600">
                When price hits the stop level, your order executes automatically to protect profits.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500">
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-700 mb-2">Powered by Stellar Network & Soroban</div>
            <div className="text-sm space-y-1">
              <p>Contract: CAZWLEBJI6...YDMN7GX (v2 with Commission System)</p>
              <p>Network: Stellar Testnet</p>
              <p>Emergency Commission: 0.5% on profits only</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}