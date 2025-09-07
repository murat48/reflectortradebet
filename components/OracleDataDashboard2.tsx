'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { SorobanService } from '@/lib/soroban'
import { i128 } from '@stellar/stellar-sdk/contract'

// Oracle Contract ID
const ORACLE_CONTRACT_ID = 'CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2'

// Asset definitions
const ASSETS = {
  BTCLN: {
    name: 'Bitcoin Lightning',
    contractId: 'CAWH4XMRQL7AJZCXEJVRHHMT6Y7ZPFCQCSKLIFJL3AVIQNC5TSVWKQOR',
    symbol: 'BTCLN',
    color: '#F7931A'
  },
  AQUA: {
    name: 'Aqua',
    contractId: 'CDJF2JQINO7WRFXB2AAHLONFDPPI4M3W2UM5THGQQ7JMJDIEJYC4CMPG',
    symbol: 'AQUA',
    color: '#00D4FF'
  },
  yUSDC: {
    name: 'Yield USDC',
    contractId: 'CABWYQLGOQ5Y3RIYUVYJZVA355YVX4SPAMN6ORDAVJZQBPPHLHRRLNMS',
    symbol: 'yUSDC',
    color: '#2775CA'
  },
  SSLX: {
    name: 'Stellar Lumen',
    contractId: 'CA4DYJSRG7HPVTPJZAIPNUC3UJCQEZ456GPLYVYR2IATCBAPTQV6UUKZ',
    symbol: 'SSLX',
    color: '#08B5E5'
  },
  EURC: {
    name: 'Euro Coin',
    contractId: 'CCBINL4TCQVEQN2Q2GO66RS4CWUARIECZEJA7JVYQO3GVF4LG6HJN236',
    symbol: 'EURC',
    color: '#003399'
  },
  KALE: {
    name: 'Kale',
    contractId: 'CAOTLCI7DROK3PI4ANOFPHPMBCFWVHURJM2EKQSO725SYCWBWE5U22OG',
    symbol: 'KALE',
    color: '#4CAF50'
  }
}

interface AssetInfo {
  symbol: string
  name: string
  contractId: string
  currentPrice: number | null | undefined
  priceChangePercent: number | null | undefined
  lastUpdate: number | null | undefined
  loading: boolean
  error: string | null
  color: string
}

interface HistoricalData {
  time: string
  timestamp: number
  [key: string]: number | string
}

interface OracleDataDashboardProps {
  sorobanService: SorobanService
}

export default function OracleDataDashboard({ sorobanService }: OracleDataDashboardProps) {
  const [assets, setAssets] = useState<{ [key: string]: AssetInfo }>({})
  const [selectedAsset, setSelectedAsset] = useState<string>('BTCLN')
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [oracleInfo, setOracleInfo] = useState({
    decimals: null as number | null,
    resolution: null as number | null,
    lastUpdate: null as number | null,
    loading: true
  })
  const [refreshInterval, setRefreshInterval] = useState(30000)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [alerts, setAlerts] = useState<{ [key: string]: { min: number; max: number; active: boolean } }>({})

  // Helper method to call oracle contract methods
  const callOracleContract = useCallback(async (methodName: string, args: (string | number)[] = []) => {
    try {
      return await sorobanService.callOracleContract(ORACLE_CONTRACT_ID, methodName, args)
    } catch (error) {
      console.error(`Error calling ${methodName}:`, error)
      throw error
    }
  }, [sorobanService])
   const callOracleContractHistory = useCallback(async (methodName: string, args: (string | number)[] = []) => {
    try {
      return await sorobanService.callOracleContractHistory(ORACLE_CONTRACT_ID, methodName, args)
    } catch (error) {
      console.error(`Error calling ${methodName}:`, error)
      throw error
    }
  }, [sorobanService])

  // Initialize assets
  useEffect(() => {
    const initialAssets: { [key: string]: AssetInfo } = {}
    Object.entries(ASSETS).forEach(([key, asset]) => {
      initialAssets[key] = {
        symbol: asset.symbol,
        name: asset.name,
        contractId: asset.contractId,
        currentPrice: undefined,
        priceChangePercent: undefined,
        lastUpdate: undefined,
        loading: true,
        error: null,
        color: asset.color
      }
    })
    setAssets(initialAssets)
  }, [])

  // Fetch oracle information
  const fetchOracleInfo = useCallback(async () => {
    try {
      setOracleInfo(prev => ({ ...prev, loading: true }))
      
      const decimals = await callOracleContract('get_oracle_decimals', [])
      const resolution = await callOracleContract('get_oracle_resolution', [])
      const lastUpdate = await callOracleContract('get_last_update_timestamp', [])
      
      setOracleInfo({
        decimals: Number(decimals),
        resolution: Number(resolution),
        lastUpdate: Number(lastUpdate),
        loading: false
      })
    } catch (error) {
      console.error('Error fetching oracle info:', error)
      setOracleInfo(prev => ({ ...prev, loading: false }))
    }
  }, [callOracleContract])

  // Fetch current prices
  const fetchCurrentPrices = useCallback(async () => {
    setAssets(prevAssets => {
      const updatedAssets = { ...prevAssets }
      
      // Process each asset sequentially to avoid overwhelming the API
      Object.entries(ASSETS).forEach(async ([key, asset]) => {
        try {
          updatedAssets[key] = { ...updatedAssets[key], loading: true, error: null }
          setAssets(current => ({ ...current, [key]: updatedAssets[key] }))
          
          // Get current price and timestamp
          const priceResult = await callOracleContract('get_price_and_timestamp', [asset.contractId]) as [number, number]
          const rawPrice = Number(priceResult[0])
          const currentPrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice / Math.pow(10, 14) : undefined
          const timestamp = Number(priceResult[1])
          
          let priceChangePercent: number | undefined = undefined
          try {
            const changePercent = await callOracleContract('get_price_change_percentage', [asset.contractId]) as number
            const rawChangePercent = Number(changePercent)
            priceChangePercent = !isNaN(rawChangePercent) ? rawChangePercent : undefined
          } catch {
            console.log(`Price change not available for ${asset.symbol}`)
          }
          
          const finalAssetData = {
            ...updatedAssets[key],
            currentPrice,
            priceChangePercent,
            lastUpdate: timestamp,
            loading: false
          }
          
          setAssets(current => ({ ...current, [key]: finalAssetData }))
          
        } catch (error) {
          console.error(`Error fetching price for ${asset.symbol}:`, error)
          const errorAssetData = {
            ...updatedAssets[key],
            loading: false,
            error: `Failed to fetch ${asset.symbol} price`
          }
          setAssets(current => ({ ...current, [key]: errorAssetData }))
        }
      })
      
      return updatedAssets
    })
  }, [callOracleContract])

  // Fetch historical data
  const fetchHistoricalData = useCallback(async () => {
    if (!selectedAsset) return
    
    try {
      const asset = ASSETS[selectedAsset as keyof typeof ASSETS]
      console.log(`📊 Fetching historical data for ${asset.symbol}...`)
      
      const historicalPrices = await callOracleContractHistory('get_historical_prices', [asset.contractId, 20]) as Array<{ timestamp: bigint; price: bigint }>
      
      const formattedData: HistoricalData[] = historicalPrices.map((item: { timestamp: bigint; price: bigint }, index: number) => ({
        time: new Date(Number(item.timestamp) * 1000).toLocaleTimeString(),
        timestamp: Number(item.timestamp),
        [asset.symbol]: Number(item.price) / Math.pow(10, 14),
        index
      }))
      
      console.log(`✅ Historical data loaded for ${asset.symbol}: ${formattedData.length} records`)
      setHistoricalData(formattedData.reverse())
    } catch (error) {
      console.error('Error fetching historical data:', error)
      setHistoricalData([])
    }
  }, [selectedAsset, callOracleContractHistory])

  // Auto refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchCurrentPrices()
        if (selectedAsset) {
          fetchHistoricalData()
        }
      }, refreshInterval)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, fetchCurrentPrices, fetchHistoricalData, selectedAsset])

  // Initial data fetch
  useEffect(() => {
    fetchOracleInfo()
    fetchCurrentPrices()
  }, [fetchOracleInfo, fetchCurrentPrices])

  // Fetch historical data when selected asset changes
  useEffect(() => {
    if (selectedAsset) {
      fetchHistoricalData()
    }
  }, [selectedAsset, fetchHistoricalData])


  
  // Helper function to format amounts - supports both bigint and number
  const formatAmount = (amount: i128 | number | null | undefined, decimals: number = 14): string => {
    if (amount === null || amount === undefined) return 'N/A'
    
    // If it's a number, format directly
    if (typeof amount === 'number') {
      if (isNaN(amount)) return 'N/A'
      return amount.toFixed(decimals).replace(/\.?0+$/, '')
    }
    
    // If it's a bigint, use the original logic
    const divisor = BigInt(10 ** decimals)
    const whole = Number(amount / divisor)
    const fraction = Number(amount % divisor)
    
    if (fraction === 0) {
      return whole.toString()
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0')
    return `${whole}.${fractionStr}`.replace(/\.?0+$/, '')
  }
  const formatPercentage = (percent: number | null | undefined) => {
    if (percent === null || percent === undefined || isNaN(percent)) return 'N/A'
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  const setAlert = (assetKey: string, min: number, max: number) => {
    setAlerts(prev => ({
      ...prev,
      [assetKey]: { min, max, active: true }
    }))
  }

  const toggleAlert = (assetKey: string) => {
    setAlerts(prev => ({
      ...prev,
      [assetKey]: { ...prev[assetKey], active: !prev[assetKey]?.active }
    }))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Oracle Data Dashboard</h1>
        <p className="text-gray-600">Real-time price data from Stellar Oracle</p>
        
        {/* Oracle Info */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
         
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-black">Resolution</h3>
            <p className="text-black">{oracleInfo.resolution ? `${oracleInfo.resolution}s` : 'Loading...'}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-black">Last Update</h3>
            <p className="text-black">
              {oracleInfo.lastUpdate ? new Date(oracleInfo.lastUpdate * 1000).toLocaleString() : 'Loading...'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              fetchCurrentPrices()
              fetchHistoricalData()
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Refresh Data
          </button>
          
         
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-black">Auto Refresh</span>
          </label>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-black bg-white"
          >
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
          </select>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(assets).map(([key, asset]) => (
          <div
            key={key}
            className={`bg-white rounded-lg shadow-lg p-6 cursor-pointer transition-all ${
              selectedAsset === key ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:shadow-xl'
            }`}
            onClick={() => {
              console.log(`🎯 Asset selected: ${asset.symbol}`)
              setSelectedAsset(key)
              // Trigger historical data fetch immediately
              setTimeout(() => {
                const asset = ASSETS[key as keyof typeof ASSETS]
                console.log(`📊 Triggering historical data fetch for ${asset.symbol}`)
              }, 100)
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: asset.color }}>
                  {asset.symbol}
                </h3>
                <p className="text-sm text-black">{asset.name}</p>
              </div>
              {asset.loading && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-black">Current Price:</span>
                <span className="font-semibold text-black">{formatAmount(asset.currentPrice,14)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-black">Change:</span>
                <span className={`font-semibold ${
                  asset.priceChangePercent === null || asset.priceChangePercent === undefined ? 'text-gray-500' :
                  asset.priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercentage(asset.priceChangePercent)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-black">Historical Trend:</span>
                <span className="font-semibold text-black">
                  {historicalData.length > 0 ? `${historicalData.length} records` : 
                   <span className="text-gray-400 text-xs">No historical data</span>}
                </span>
              </div>
              
              {asset.lastUpdate && (
                <div className="text-xs text-black">
                  Last update: {new Date(asset.lastUpdate * 1000).toLocaleTimeString()}
                </div>
              )}
              
              {asset.error && (
                <div className="text-xs text-red-500">{asset.error}</div>
              )}
            </div>

            {/* Alert Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-md font-medium text-black">Price Alert</span>
                {alerts[key] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleAlert(key)
                    }}
                    className={`text-xs px-2 py-1 rounded ${
                      alerts[key].active 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {alerts[key].active ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  step="0.000001"
                  className="w-20 text-md border rounded px-2 py-1 text-black bg-white"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const min = parseFloat(e.target.value)
                    const max = alerts[key]?.max || min + 0.01
                    if (!isNaN(min)) setAlert(key, min, max)
                  }}
                />
                <input
                  type="number"
                  placeholder="Max"
                  step="0.000001"
                  className="w-20 text-xs border rounded px-2 py-1 text-black bg-white"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const max = parseFloat(e.target.value)
                    const min = alerts[key]?.min || max - 0.01
                    if (!isNaN(max)) setAlert(key, min, max)
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      {selectedAsset && historicalData.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-black">
            {ASSETS[selectedAsset as keyof typeof ASSETS].name} Price History
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium mb-2 text-black">Price Trend</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={['dataMin', 'dataMax']} />
                  <Tooltip
                  formatter={(value, name) => [value as number, name]} 
                    // formatter={(value, name) => [formatPrice(value as number), name]}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={ASSETS[selectedAsset as keyof typeof ASSETS].symbol}
                    stroke={ASSETS[selectedAsset as keyof typeof ASSETS].color}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Area Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium mb-2 text-black">Price Area</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={['dataMin', 'dataMax']} />
                  <Tooltip 
                    formatter={(value, name) => [value as number, name]}
                    // formatter={(value, name) => [formatPrice(value as number), name]}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey={ASSETS[selectedAsset as keyof typeof ASSETS].symbol}
                    stroke={ASSETS[selectedAsset as keyof typeof ASSETS].color}
                    fill={`${ASSETS[selectedAsset as keyof typeof ASSETS].color}30`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Historical Price Comparison Chart */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 text-black">
          {selectedAsset 
            ? `${ASSETS[selectedAsset as keyof typeof ASSETS].name} Historical Price Chart`
            : 'Historical Price Comparison'
          }
        </h2>
        
        {/* Info message */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            📈 {selectedAsset 
              ? `${ASSETS[selectedAsset as keyof typeof ASSETS].symbol} Showing the last 20 price data for.`
              : 'Select an asset to view the historical price chart.'
            }
          </p>
        </div>
        
        {selectedAsset && historicalData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${value.toFixed(4)}`}
                />
                <Tooltip 
                formatter={(value, name) => [value as number, name]}
                //   formatter={(value, name) => [formatPrice(value as number), name]}
                  labelStyle={{ color: '#000' }}
                  contentStyle={{ color: '#000', backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={ASSETS[selectedAsset as keyof typeof ASSETS].symbol}
                  stroke={ASSETS[selectedAsset as keyof typeof ASSETS].color}
                  strokeWidth={3}
                  dot={{
                    fill: ASSETS[selectedAsset as keyof typeof ASSETS].color,
                    strokeWidth: 2,
                    r: 4
                  }}
                  activeDot={{
                    r: 6,
                    fill: ASSETS[selectedAsset as keyof typeof ASSETS].color
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <p className="text-gray-600 text-lg">
                {selectedAsset 
                  ? 'Historical data yükleniyor...'
                  : 'Bir asset kartına tıklayın ve price history grafiğini görün'
                }
              </p>
              {selectedAsset && (
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Historical Data Stats */}
        {selectedAsset && historicalData.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data Points:</span>
                <span className="font-medium text-black ml-2">{historicalData.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Highest:</span>
                <span className="font-medium text-green-600 ml-2">
                  {formatAmount(Math.max(...historicalData.map(item => 
                    item[ASSETS[selectedAsset as keyof typeof ASSETS].symbol] as number
                  )))}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Lowest:</span>
                <span className="font-medium text-red-600 ml-2">
                  {formatAmount(Math.min(...historicalData.map(item => 
                    item[ASSETS[selectedAsset as keyof typeof ASSETS].symbol] as number
                  )))}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Latest:</span>
                <span className="font-medium text-black ml-2">
                  {historicalData.length > 0 
                    ? formatAmount(historicalData[historicalData.length - 1][ASSETS[selectedAsset as keyof typeof ASSETS].symbol] as number)
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Debug info for Historical Prices */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-700 font-medium">
              🔍 Historical Price Debug Information (Developer)
            </summary>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium">Selected Asset:</span> {selectedAsset || 'None'}
              </div>
              <div>
                <span className="font-medium">Historical Data Count:</span> {historicalData.length}
              </div>
              {selectedAsset && (
                <div>
                  <span className="font-medium">Contract ID:</span> {ASSETS[selectedAsset as keyof typeof ASSETS]?.contractId}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500">
                  You can see more detailed historical price debug messages in the Console.
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
