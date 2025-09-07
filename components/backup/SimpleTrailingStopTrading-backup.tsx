
// 'use client'

// import { useState, useEffect, useCallback } from 'react'
// import { SorobanService } from '@/lib/soroban'
// import { WalletService } from '@/lib/wallet'
// import { TrailingOrder } from '@/lib/soroban'
// import AssetPriceDisplay, { ASSETS } from './AssetPriceDisplay'

// const CONTRACT_ADDRESS = 'CDG2XZFKAQJDDRBCPK2AS5STHTSFYMS6J5RLBQUEXUUWLBCZX4VFZHRE'
// const REFRESH_INTERVAL = 10000 // 10 seconds
// const EXECUTE_INTERVAL = 300000 // 5 minutes

// export default function SimpleTrailingStopTrading() {
//   const [sorobanService] = useState(() => new SorobanService(CONTRACT_ADDRESS))
//   const [walletService] = useState(() => WalletService.getInstance())
  
//   // State
//   const [connected, setConnected] = useState(false)
//   const [userAddress, setUserAddress] = useState('')
//   const [userOrders, setUserOrders] = useState<TrailingOrder[]>([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [success, setSuccess] = useState('')
  
//   // Form states
//   const [assetAddress, setAssetAddress] = useState('')
//   const [selectedAssetSymbol, setSelectedAssetSymbol] = useState('')
//   const [amount, setAmount] = useState('')
//   const [trailPercentage, setTrailPercentage] = useState('')
//   const [currentPrice, setCurrentPrice] = useState<string>('')
//   const [priceLoading, setPriceLoading] = useState(false)



//   // Statistics
//   const [totalOrders, setTotalOrders] = useState<bigint>(BigInt(0))
 
// const [filterStatus, setFilterStatus] = useState('Active')
//   const checkWalletConnection = useCallback(async () => {
//     try {
//       const isConnected = await walletService.isWalletConnected()
//       if (isConnected) {
//         const address = await walletService.getAddress()
//         if (address) {
//           setUserAddress(address)
//           setConnected(true)
//           const orders = await sorobanService.getUserOrders(address)
//           setUserOrders(orders)
//           const total = await sorobanService.getTotalOrders()
//           setTotalOrders(total)
//         }
//       }
//     } catch {
//       console.error('Error checking wallet connection')
//     }
//   }, [walletService, sorobanService])

//   // Check wallet connection on component mount
//   useEffect(() => {
//     checkWalletConnection()
//   }, [checkWalletConnection])

//   // Auto-refresh orders
//   useEffect(() => {
//     if (connected && userAddress) {
//       const loadOrders = async () => {
//         try {
//           const orders = await sorobanService.getUserOrders(userAddress)
//           setUserOrders(orders)
//         } catch {
//           console.error('Error loading orders')
//         }
//       }
      
//       const interval = setInterval(loadOrders, REFRESH_INTERVAL)
//       return () => clearInterval(interval)
//     }
//   }, [connected, userAddress, sorobanService])

//   // Auto-execute orders every 5 minutes
//   useEffect(() => {
//     if (connected && userAddress) {
//       const autoExecute = async () => {
//         try {
//           await sorobanService.checkAndExecuteOrders()
//         } catch {
//           console.error('Error in auto-execute')
//         }
//       }
      
//       const interval = setInterval(autoExecute, EXECUTE_INTERVAL)
//       return () => clearInterval(interval)
//     }
//   }, [connected, userAddress, sorobanService])

//   const connectWallet = async () => {
//     try {
//       setLoading(true)
//       setError('')
      
//       const result = await walletService.connectWallet()
      
//       if (result.success && result.address) {
//         setUserAddress(result.address)
//         setConnected(true)
//         setSuccess('Wallet connected successfully!')
        
//         const orders = await sorobanService.getUserOrders(result.address)
//         setUserOrders(orders)
//         const total = await sorobanService.getTotalOrders()
//         setTotalOrders(total)
//       } else {
//         setError(result.error || 'Failed to connect wallet')
//       }
//     } catch {
//       setError('Failed to connect wallet')
//     } finally {
//       setLoading(false)
//     }
//   }
//   const activeCount = userOrders.reduce((count, order) => {
//   const status = Array.isArray(order.status) ? order.status[0] : order.status
//   return status === 'Active' ? count + 1 : count
// }, 0)
//   const cancelCount = userOrders.reduce((count, order) => {
//   const status = Array.isArray(order.status) ? order.status[0] : order.status
//   return status === 'Cancelled' ? count + 1 : count
// }, 0)
//   const executedCount = userOrders.reduce((count, order) => {
//   const status = Array.isArray(order.status) ? order.status[0] : order.status
//   return status === 'Executed' ? count + 1 : count
// }, 0)

//   const disconnectWallet = () => {
//     setConnected(false)
//     setUserAddress('')
//     setUserOrders([])
//     setCurrentPrice('')
//     setSelectedAssetSymbol('')
//     setSuccess('Wallet disconnected')
//   }

//   const handleAssetSelection = async (contractId: string, symbol: string) => {
//     setAssetAddress(contractId)
//     setSelectedAssetSymbol(symbol)
//     setCurrentPrice('')
//     setSuccess(`Selected ${symbol} asset`)
    
//     // Automatically get current price
//     try {
//       setPriceLoading(true)
//       setError('')
      
//       const price = await sorobanService.getCurrentPrice(contractId)
      
//       if (price !== null) {
//         setCurrentPrice(SorobanService.formatAmount(price))
//         setSuccess(`${symbol} selected - Current price: ${SorobanService.formatAmount(price)}`)
//       } else {
//         setError('Price not available for this asset')
//         setCurrentPrice('')
//       }
//     } catch {
//       setError('Failed to get current price')
//       setCurrentPrice('')
//     } finally {
//       setPriceLoading(false)
//     }
//   }
//   const executeOrders = async () => {
//     if (!connected) {
//       setError('Please connect wallet first')
//       return
//     }

//     try {
//       setLoading(true)
//       setError('')
//       setSuccess('')

//       const result = await sorobanService.checkAndExecuteOrders()

//       if (result.success) {
//         setSuccess(`Orders checked and executed successfully!`)
        
//         // Refresh orders after execution
//         const orders = await sorobanService.getUserOrders(userAddress)
//         setUserOrders(orders)
//         const total = await sorobanService.getTotalOrders()
//         setTotalOrders(total)
//       } else {
//         setError(result.error || 'Failed to execute orders')
//       }
//     } catch {
//       setError('Failed to execute orders')
//     } finally {
//       setLoading(false)
//     }
//   }
//   const createOrder = async () => {
//     if (!connected) {
//       setError('Please connect wallet first')
//       return
//     }

//     if (!assetAddress || !amount || !trailPercentage) {
//       setError('Please fill all fields')
//       return
//     }

//     if (parseFloat(trailPercentage) <= 0 || parseFloat(trailPercentage) > 50) {
//       setError('Trail percentage must be between 0.1% and 50%')
//       return
//     }

//     try {
//       setLoading(true)
//       setError('')
//       setSuccess('')

//       const amountInStroops = SorobanService.parseAmount(amount)
//       const trailBasisPoints = Math.floor(parseFloat(trailPercentage))
      
//       const result = await sorobanService.createOrder(
//         userAddress,
//         assetAddress,
//         amountInStroops,
//         trailBasisPoints
//       )

//       if (result.success) {
//         setSuccess(`Order created successfully! ID: ${result.orderId}`)
        
//         // Clear form
//         setAssetAddress('')
//         setSelectedAssetSymbol('')
//         setAmount('')
//         setTrailPercentage('')
//         setCurrentPrice('')
        
//         // Refresh orders
//         const orders = await sorobanService.getUserOrders(userAddress)
//         setUserOrders(orders)
//         const total = await sorobanService.getTotalOrders()
//         setTotalOrders(total)
//       } else {
//         setError(result.error || 'Failed to create order')
//       }
//     } catch {
//       setError('Failed to create order')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const cancelOrder = async (orderId: bigint) => {
//     if (!connected) return

//     try {
//       setLoading(true)
//       setError('')
      
//       const result = await sorobanService.cancelOrder(userAddress, orderId)
      
//       if (result.success) {
//         setSuccess(`Order ${orderId} cancelled successfully!`)
//         const orders = await sorobanService.getUserOrders(userAddress)
//         setUserOrders(orders)
//       } else {
//         setError(result.error || 'Failed to cancel order')
//       }
//     } catch {
//       setError('Failed to cancel order')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const clearMessages = () => {
//     setError('')
//     setSuccess('')
//   }

//   // Format address for display
//   const formatAddress = (addr: string) => {
//     return addr ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : ''
//   }

//   // Get status badge style
//   const getStatusBadge = (status: string) => {
//     switch (status) {
//       case 'Active': 
//         return 'bg-green-100 text-green-800 border-green-200'
//       case 'Executed': 
//         return 'bg-blue-100 text-blue-800 border-blue-200'
//       case 'Cancelled': 
//         return 'bg-red-100 text-red-800 border-red-200'
//       default: 
//         return 'bg-gray-100 text-gray-800 border-gray-200'
//     }
//   }

//   // Calculate preview prices
//   const calculatePreviewPrices = () => {
//     if (!currentPrice || !trailPercentage) return null
    
//     const price = parseFloat(currentPrice)
//     const trail = parseFloat(trailPercentage) / 100
    
//     const stopPrice = price * (1 - trail)
    
//     return {
//       currentPrice: price.toFixed(14).replace(/\.?0+$/, ''),
//       stopPrice: stopPrice.toFixed(14).replace(/\.?0+$/, ''),
//       trailAmount: (price - stopPrice).toFixed(14).replace(/\.?0+$/, '')
//     }
//   }

//   // Calculate profit/loss for executed orders
//   const calculateProfitLoss = (order: TrailingOrder) => {
//     const status = Array.isArray(order.status) ? order.status[0] : order.status
    
//     if (status !== 'Executed' || !order.execution_price || !order.initial_price) {
//       return null
//     }
    
//     const initialPrice = parseFloat(SorobanService.formatAmount(order.initial_price))
//     const executionPrice = parseFloat(SorobanService.formatAmount(order.execution_price))
//     const amount = parseFloat(SorobanService.formatAmount(order.amount))
    
//     // Calculate percentage change
//     const percentageChange = ((executionPrice - initialPrice) / initialPrice) * 100
    
//     // Calculate absolute profit/loss (simplified - in real scenario would need proper calculation)
//     const profitLoss = (executionPrice - initialPrice) * amount
    
//     return {
//       percentageChange,
//       profitLoss,
//       isProfit: percentageChange > 0
//     }
//   }

//   const previewPrices = calculatePreviewPrices()
//   return (
//     <div className="min-h-screen bg-white">
//       <div className="max-w-6xl mx-auto px-4 py-8">
//         {/* Header */}
//         <header className="text-center mb-12">
//           <h1 className="text-4xl font-bold text-gray-900 mb-4">
//             Trailing Stop Trading
//           </h1>
//           <p className="text-lg text-gray-600 max-w-2xl mx-auto">
//             Automated trailing stop-loss orders on Stellar blockchain using Soroban smart contracts
//           </p>
          
    
//           <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
//  {/* Active Orders */}
//  <button
//    onClick={() => setFilterStatus('Active')}
//    className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow w-full text-left ${
//      filterStatus === 'Active' ? 'ring-2 ring-green-500 border-green-300' : ''
//    }`}
//  >
//    <div className="text-2xl font-bold text-green-600">{activeCount}</div>
//    <div className="text-sm text-gray-500">Active Orders</div>
//  </button>

//  {/* Executed Orders */}
//  <button
//    onClick={() => setFilterStatus('Executed')}
//    className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow w-full text-left ${
//      filterStatus === 'Executed' ? 'ring-2 ring-blue-500 border-blue-300' : ''
//    }`}
//  >
//    <div className="text-2xl font-bold text-blue-600">{executedCount}</div>
//    <div className="text-sm text-gray-500">Executed Orders</div>
//  </button>

//  {/* Cancelled Orders */}
//  <button
//    onClick={() => setFilterStatus('Cancelled')}
//    className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow w-full text-left ${
//      filterStatus === 'Cancelled' ? 'ring-2 ring-red-500 border-red-300' : ''
//    }`}
//  >
//    <div className="text-2xl font-bold text-red-600">{cancelCount}</div>
//    <div className="text-sm text-gray-500">Cancelled Orders</div>
//  </button>
// </div>
//         </header>

//         {/* Wallet Connection */}
//         <div className="mb-8">
//           <div className="max-w-md mx-auto">
//             {!connected ? (
//               <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
//                 <div className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet</div>
//                 <p className="text-gray-600 mb-4">Connect your Freighter wallet to start trading</p>
//                 <button
//                   onClick={connectWallet}
//                   disabled={loading}
//                   className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
//                 >
//                   {loading ? 'Connecting...' : 'Connect Freighter Wallet'}
//                 </button>
//               </div>
//             ) : (
//               <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
//                 <div className="text-green-800 font-medium mb-2">✓ Wallet Connected</div>
//                 <div className="text-sm text-green-700 font-mono mb-2">
//                   {formatAddress(userAddress)}
//                 </div>
//                 <button
//                   onClick={disconnectWallet}
//                   className="text-red-600 hover:text-red-700 text-sm font-medium"
//                 >
//                   Disconnect
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Asset Price Display */}
//         <AssetPriceDisplay 
//           sorobanService={sorobanService}
//           onAssetSelect={handleAssetSelection}
//           selectedAssetAddress={assetAddress}
//         />

//         {/* Auto-execution Info Banner */}
//         {connected && (
//           <div className="mb-8 max-w-4xl mx-auto">
//             <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
//               <div className="flex items-center gap-3">
//                 <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
//                   <span className="text-green-600">🤖</span>
//                 </div>
//                 <div className="flex-1">
//                   <div className="text-sm font-medium text-green-800">
//                     Automated Order Execution Active
//                   </div>
//                   <div className="text-xs text-green-700">
//                     Your orders are automatically checked and executed every 5 minutes. You can also manually trigger execution using the buttons below.
//                   </div>
//                 </div>
//                 <div className="text-xs text-green-600 font-mono">
//                   Next check in ~{Math.ceil((EXECUTE_INTERVAL - (Date.now() % EXECUTE_INTERVAL)) / 60000)}min
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Messages */}
//         {(error || success) && (
//           <div className="mb-8 max-w-2xl mx-auto">
//             {error && (
//               <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//                 <div className="flex justify-between items-start">
//                   <div className="text-red-800">{error}</div>
//                   <button 
//                     onClick={clearMessages}
//                     className="text-red-600 hover:text-red-800 ml-4"
//                   >
//                     ✕
//                   </button>
//                 </div>
//               </div>
//             )}
//             {success && (
//               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//                 <div className="flex justify-between items-start">
//                   <div className="text-green-800">{success}</div>
//                   <button 
//                     onClick={clearMessages}
//                     className="text-green-600 hover:text-green-800 ml-4"
//                   >
//                     ✕
//                   </button>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         <div className="grid lg:grid-cols-5 gap-8">
//           {/* Create Order Form */}
//           <div className="lg:col-span-2">
//             <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
//               <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Order</h2>
              
//               <div className="space-y-4" >
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Asset Selection
//                   </label>
//                   <select
//                     value={assetAddress}
//                     onChange={(e) => {
//                       const value = e.target.value
//                       const asset = Object.values(ASSETS).find(a => a.contractId === value)
//                       if (asset) {
//                         handleAssetSelection(value, asset.symbol)
//                       } else {
//                         setAssetAddress('')
//                         setSelectedAssetSymbol('')
//                       }
//                     }}
//                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                   >
//                     <option value="">Select an asset...</option>
//                     {Object.entries(ASSETS).map(([key, asset]) => (
//                       <option key={key} value={asset.contractId}>
//                         {asset.symbol} - {asset.name}
//                       </option>
//                     ))}
//                   </select>
                  
//                   {selectedAssetSymbol && (
//                     <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
//                       <div className="text-sm text-blue-800">
//                         <strong>Selected:</strong> {selectedAssetSymbol}
//                       </div>
//                       <div className="text-xs text-blue-600 font-mono break-all">
//                         {assetAddress}
//                       </div>
//                     </div>
//                   )}
                  
//                   {currentPrice && !priceLoading && (
//                     <div className="mt-2 text-sm text-green-600 font-medium">
//                       Current Price: {currentPrice}
//                     </div>
//                   )}
                  
//                   {priceLoading && (
//                     <div className="mt-2 text-sm text-blue-600">
//                       Loading price...
//                     </div>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Amount
//                   </label>
//                   <input
//                     type="number"
//                     value={amount}
//                     onChange={(e) => setAmount(e.target.value)}
//                     placeholder="0.0000000"
//                     step="0.0000001"
//                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                   />
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Trail Percentage (%)
//                   </label>
//                   <input
//                     type="number"
//                     value={trailPercentage}
//                     onChange={(e) => setTrailPercentage(e.target.value)}
//                     placeholder="10"
//                     min="0.1"
//                     max="50"
//                     step="0.1"
//                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                   />
//                   <div className="mt-1 text-xs text-gray-500">
//                     Between 0.1% and 50%
//                   </div>
                  
//                   {/* Price Preview */}
//                   {previewPrices && (
//                     <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//                       <div className="text-sm font-medium text-blue-800 mb-2">💡 Order Preview</div>
//                       <div className="space-y-2 text-xs">
//                         <div className="flex justify-between">
//                           <span className="text-blue-600">Current Price:</span>
//                           <span className="font-medium text-blue-900">{previewPrices.currentPrice}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-blue-600">Stop Price ({trailPercentage}% below):</span>
//                           <span className="font-medium text-blue-900">{previewPrices.stopPrice}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-blue-600">Trail Amount:</span>
//                           <span className="font-medium text-green-700">{previewPrices.trailAmount}</span>
//                         </div>
//                         <div className="mt-2 pt-2 border-t border-blue-200 text-blue-700">
//                           <div className="text-xs">ℹ️ Order will execute when price drops to stop price</div>
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                 </div>

//                 <button
//                   onClick={createOrder}
//                   disabled={loading || !connected}
//                   className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
//                 >
//                   {loading ? 'Creating Order...' : 'Create Trailing Stop Order'}
//                 </button>
                
//                 <button
//                   onClick={executeOrders}
//                   disabled={loading || !connected}
//                   className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
//                 >
//                   {loading ? 'Executing...' : '🔄 Check & Execute Orders'}
//                 </button>
                
//                 <div className="text-xs text-gray-500 text-center">
//                   💡 Orders are automatically checked every 5 minutes
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Orders List */}
//           <div className="lg:col-span-3">
//             <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
//               <div className="flex justify-between items-center mb-6">
//                 <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
//                 <div className="flex items-center gap-4">
//                   <button
//                     onClick={executeOrders}
//                     disabled={loading || !connected}
//                     className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
//                   >
//                     <span>🔄</span>
//                     {loading ? 'Executing...' : 'Check & Execute'}
//                   </button>
//                   <div className="text-sm text-gray-500">
//                     Auto-refresh every {REFRESH_INTERVAL / 1000}s
//                   </div>
//                 </div>
//               </div>

//               {loading && userOrders.length === 0 ? (
//                 <div className="text-center py-8 text-gray-500">
//                   Loading orders...
//                 </div>
//               ) : userOrders.length === 0 ? (
//                 <div className="text-center py-8 text-gray-500">
//                   No orders yet. Create your first trailing stop order!
//                 </div>
//               ) :(
             
//                 <div className="space-y-4">
//  {userOrders.map((order) => {
//    const status = Array.isArray(order.status) ? order.status[0] : order.status
//    const shouldShow = filterStatus === 'All' || status === filterStatus
//    const profitLoss = calculateProfitLoss(order)
   
//    return shouldShow && (
//      <div
//        key={order.id.toString()}
//        className={`rounded-xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl border-2 ${
//          status === 'Executed' && profitLoss 
//            ? profitLoss.isProfit 
//              ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:from-green-100 hover:to-green-150' 
//              : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 hover:from-red-100 hover:to-red-150'
//            : status === 'Active'
//              ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:from-blue-100 hover:to-blue-150'
//              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 hover:from-gray-100 hover:to-gray-150'
//        }`}
//      >
//        <div className="flex justify-between items-start mb-4">
//          <div>
//            <div className={`font-bold text-xl ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-800' : 'text-red-800'
//                : status === 'Active' ? 'text-blue-800' : 'text-gray-800'
//            }`}>
//              Order #{order.id.toString()}
//            </div>
//            <div className={`text-sm font-medium ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-600' : 'text-red-600'
//                : status === 'Active' ? 'text-blue-600' : 'text-gray-600'
//            }`}>
//              Asset: {formatAddress(order.asset)}
//            </div>
//          </div>
//          <div className="flex items-center gap-3">
//            <span className={`px-3 py-2 rounded-full text-sm font-bold border-2 ${getStatusBadge(order.status)}`}>
//              {order.status}
//            </span>
//            {shouldShow && status === "Active" && (
//              <button
//                onClick={() => cancelOrder(order.id)}
//                disabled={loading}
//                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md"
//              >
//                Cancel
//              </button>
//            )}
//          </div>
//        </div>
       
//        {/* Basic Order Info */}
//        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm mb-6">
//          <div className="text-center">
//            <div className={`text-xs font-semibold uppercase tracking-wide ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
//                : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
//            }`}>Amount</div>
//            <div className={`font-bold text-lg ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
//                : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
//            }`}>{SorobanService.formatAmount(order.amount)}</div>
//          </div>
//          <div className="text-center">
//            <div className={`text-xs font-semibold uppercase tracking-wide ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
//                : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
//            }`}>Trail %</div>
//            <div className={`font-bold text-lg ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
//                : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
//            }`}>{order.trail_percentage}%</div>
//          </div>
//          <div className="text-center">
//            <div className={`text-xs font-semibold uppercase tracking-wide ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
//                : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
//            }`}>Initial Price</div>
//            <div className={`font-bold text-lg ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
//                : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
//            }`}>{SorobanService.formatAmount(order.initial_price)}</div>
//          </div>
//          <div className="text-center">
//            <div className={`text-xs font-semibold uppercase tracking-wide ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-500' : 'text-red-500'
//                : status === 'Active' ? 'text-blue-500' : 'text-gray-500'
//            }`}>Highest Price</div>
//            <div className={`font-bold text-lg ${
//              status === 'Executed' && profitLoss 
//                ? profitLoss.isProfit ? 'text-green-900' : 'text-red-900'
//                : status === 'Active' ? 'text-blue-900' : 'text-gray-900'
//            }`}>{SorobanService.formatAmount(order.highest_price)}</div>
//          </div>
//        </div>

//        {/* Executed Order Details */}
//        { status === 'Executed' && order.execution_price && profitLoss && (
//          <div className={`mt-4 p-3 rounded-lg border-l-4 ${profitLoss.isProfit ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
//            <div className="flex items-center justify-between mb-2">
//              <div className="text-sm font-medium text-gray-700">📊 Execution Details</div>
//              <div className="text-xs text-gray-500">
//                {order.executed_at ? new Date(Number(order.executed_at) * 1000).toLocaleString() : 'N/A'}
//              </div>
//            </div>
           
//            {/* Sale Summary */}
//            <div className={`mb-4 p-3 rounded-lg border ${profitLoss.isProfit ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
//              <div className={`text-sm font-medium mb-2 ${profitLoss.isProfit ? 'text-green-800' : 'text-red-800'}`}>
//                💰 Sale Summary - {profitLoss.isProfit ? '🎉 PROFIT' : '📉 LOSS'}
//              </div>
//              <div className="text-sm">
//                <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}>Sold </span>
//                <span className={`font-bold ${profitLoss.isProfit ? 'text-green-900' : 'text-red-900'}`}>
//                  {SorobanService.formatAmount(order.amount)} assets
//                </span>
//                <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}> at </span>
//                <span className={`font-bold ${profitLoss.isProfit ? 'text-green-900' : 'text-red-900'}`}>
//                  {SorobanService.formatAmount(order.execution_price)}
//                </span>
//                <span className={profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}> per unit</span>
//              </div>
//              <div className={`text-xs mt-1 ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
//                Total Value: {(parseFloat(SorobanService.formatAmount(order.amount)) * parseFloat(SorobanService.formatAmount(order.execution_price))).toFixed(7)}
//              </div>
//            </div>
           
//            {/* Price and P&L Details */}
//            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
//              <div>
//                <div className="text-gray-500">Initial Price</div>
//                <div className="font-medium text-gray-900">
//                  {SorobanService.formatAmount(order.initial_price)}
//                </div>
//              </div>
             
//              <div>
//                <div className="text-gray-500">Sale Price</div>
//                <div className={`font-bold text-lg ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
//                  {SorobanService.formatAmount(order.execution_price)}
//                </div>
//              </div>
             
//              <div>
//                <div className="text-gray-500">Price Change</div>
//                <div className={`font-medium ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
//                  {profitLoss.isProfit ? '+' : ''}{profitLoss.percentageChange.toFixed(2)}%
//                </div>
//              </div>
             
//              <div>
//                <div className="text-gray-500">Profit/Loss</div>
//                <div className={`font-bold text-lg ${profitLoss.isProfit ? 'text-green-600' : 'text-red-600'}`}>
//                  {profitLoss.isProfit ? '+' : ''}{profitLoss.profitLoss.toFixed(7)}
//                  <span className="text-xs ml-1">
//                    {profitLoss.isProfit ? '📈' : '📉'}
//                  </span>
//                </div>
//              </div>
//            </div>
           
//            {/* Performance Indicator */}
//            <div className="mt-3 flex items-center gap-2">
//              <div className={`w-3 h-3 rounded-full ${profitLoss.isProfit ? 'bg-green-500' : 'bg-red-500'}`}></div>
//              <div className={`text-sm font-medium ${profitLoss.isProfit ? 'text-green-700' : 'text-red-700'}`}>
//                {profitLoss.isProfit ? '🎉 Profitable Trade' : '⚠️ Loss Trade'}
//              </div>
//              <div className="text-xs text-gray-500 ml-auto">
//                Stop triggered at {SorobanService.formatAmount(order.stop_price)}
//              </div>
//            </div>
//          </div>
//        )}

//        {/* Active Order Info */}
//        {status === 'Active' && (
//          <div className="mt-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
//            <div className="text-sm font-medium text-green-700 mb-2">🟢 Active Order</div>
//            <div className="grid grid-cols-2 gap-4 text-sm">
//              <div>
//                <div className="text-green-600">Current Stop Price</div>
//                <div className="font-medium text-green-800">{SorobanService.formatAmount(order.stop_price)}</div>
//              </div>
//              <div>
//                <div className="text-green-600">Potential Gain</div>
//                <div className="font-medium text-green-800">
//                  {((parseFloat(SorobanService.formatAmount(order.highest_price)) - parseFloat(SorobanService.formatAmount(order.initial_price))) / parseFloat(SorobanService.formatAmount(order.initial_price)) * 100).toFixed(2)}%
//                </div>
//              </div>
//            </div>
//          </div>
//        )}

//        {/* Cancelled Order Info */}
//        {status === 'Cancelled' && (
//          <div className="mt-4 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
//            <div className="text-sm font-medium text-red-700">❌ Order Cancelled</div>
//            <div className="text-xs text-red-600 mt-1">
//              This order was manually cancelled and no execution occurred.
//            </div>
//          </div>
//        )}
//      </div>
//    )
//  })}
// </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* How It Works */}
//         <div className="mt-16 bg-gray-50 rounded-lg p-8">
//           <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h3>
//           <div className="grid md:grid-cols-3 gap-8">
//             <div className="text-center">
//               <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
//                 <span className="text-2xl">📈</span>
//               </div>
//               <h4 className="text-lg font-semibold text-gray-900 mb-2">Price Tracking</h4>
//               <p className="text-gray-600">
//                 Smart contract continuously monitors asset prices and updates the highest price seen.
//               </p>
//             </div>
//             <div className="text-center">
//               <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
//                 <span className="text-2xl">📉</span>
//               </div>
//               <h4 className="text-lg font-semibold text-gray-900 mb-2">Trailing Stop</h4>
//               <p className="text-gray-600">
//                 Stop price automatically trails below the highest price by your specified percentage.
//               </p>
//             </div>
//             <div className="text-center">
//               <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
//                 <span className="text-2xl">⚡</span>
//               </div>
//               <h4 className="text-lg font-semibold text-gray-900 mb-2">Auto Execute</h4>
//               <p className="text-gray-600">
//                 When price hits the stop level, your order executes automatically to protect profits.
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <footer className="mt-16 text-center text-gray-500">
//           <div className="mb-4">
//             <div className="text-lg font-semibold text-gray-700 mb-2">Powered by Stellar Network & Soroban</div>
//             <div className="text-sm space-y-1">
//               <p>Contract: {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-8)}</p>
//               <p>Network: Stellar Testnet</p>
//             </div>
//           </div>
//           <p className="text-orange-600 font-medium">⚠️ This is for testnet use only. Do not use real funds.</p>
//         </footer>
//       </div>
//     </div>
//   )
// }