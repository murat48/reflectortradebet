'use client'

import { useState, useEffect } from 'react'
import { SorobanService } from '@/lib/soroban'

const ASSETS = {
  BTCLN: {
    name: 'BTCLN',
    contractId: 'CAWH4XMRQL7AJZCXEJVRHHMT6Y7ZPFCQCSKLIFJL3AVIQNC5TSVWKQOR',
    token: 'CAWH4XMRQL7AJZCXEJVRHHMT6Y7ZPFCQCSKLIFJL3AVIQNC5TSVWKQOR',
    symbol: 'BTCLN'
  },
  AQUA: {
    name: 'AQUA',
    contractId: 'CDJF2JQINO7WRFXB2AAHLONFDPPI4M3W2UM5THGQQ7JMJDIEJYC4CMPG',
        token: 'CDNVQW44C3HALYNVQ4SOBXY5EWYTGVYXX6JPESOLQDABJI5FC5LTRRUE',
    symbol: 'AQUA'
  },
  yUSDC: {
    name: 'yUSDC',
    contractId: 'CABWYQLGOQ5Y3RIYUVYJZVA355YVX4SPAMN6ORDAVJZQBPPHLHRRLNMS',   
     token: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA', 
    symbol: 'yUSDC'
  },
  SSLX: {
    name: 'SSLX',
    contractId: 'CA4DYJSRG7HPVTPJZAIPNUC3UJCQEZ456GPLYVYR2IATCBAPTQV6UUKZ',
        token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', 
    symbol: 'SSLX'
  },
  EURC: {
    name: 'EURC',
    contractId: 'CCBINL4TCQVEQN2Q2GO66RS4CWUARIECZEJA7JVYQO3GVF4LG6HJN236',
        token: 'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ', 
    symbol: 'EURC'
  },
  KALE: {
    name: 'KALE',
    contractId: 'CAOTLCI7DROK3PI4ANOFPHPMBCFWVHURJM2EKQSO725SYCWBWE5U22OG',
        token: 'CAAVU2UQJLMZ3GUZFM56KVNHLPA3ZSSNR4VP2U53YBXFD2GI3QLIVHZZ', 
    symbol: 'KALE'
  }
}

const PRICE_REFRESH_INTERVAL = 10000 // 10 seconds

interface AssetPrice {
  symbol: string
  price: string | null
  loading: boolean
  error: boolean
}

interface AssetPriceDisplayProps {
  sorobanService: SorobanService
  onAssetSelect?: (contractId: string, symbol: string) => void
  selectedAssetAddress?: string
}

export default function AssetPriceDisplay({ sorobanService, onAssetSelect, selectedAssetAddress }: AssetPriceDisplayProps) {
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>(() => {
    const initialPrices: Record<string, AssetPrice> = {}
    Object.entries(ASSETS).forEach(([key, asset]) => {
      initialPrices[key] = {
        symbol: asset.symbol,
        price: null,
        loading: false,
        error: false
      }
    })
    return initialPrices
  })

  const fetchPrice = async (assetKey: string, contractId: string) => {
    try {
      const price = await sorobanService.getCurrentPrice(contractId)
      
      setAssetPrices(prev => ({
        ...prev,
        [assetKey]: {
          ...prev[assetKey],
          price: price !== null ? SorobanService.formatAmount(price) : null,
          loading: false,
          error: price === null
        }
      }))
    } catch {
      setAssetPrices(prev => ({
        ...prev,
        [assetKey]: { ...prev[assetKey], loading: false, error: true, price: null }
      }))
    }
  }

  const fetchAllPrices = async () => {
    const promises = Object.entries(ASSETS).map(([key, asset]) => 
      fetchPrice(key, asset.contractId)
    )
    await Promise.all(promises)
  }

  // Initial price fetch
  useEffect(() => {
    fetchAllPrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh prices every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllPrices, PRICE_REFRESH_INTERVAL)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAssetClick = (contractId: string, symbol: string) => {
    if (onAssetSelect) {
      onAssetSelect(contractId, symbol)
    }
  }

  return (
    <div className="mb-8">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Live Asset Prices</h2>
          <div className="text-sm text-gray-500">
            Updates every {PRICE_REFRESH_INTERVAL / 1000}s
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(ASSETS).map(([key, asset]) => {
            const priceData = assetPrices[key]
            const isSelected = selectedAssetAddress === asset.contractId
            
            return (
              <div
                key={key}
                onClick={() => handleAssetClick(asset.contractId, asset.symbol)}
                className={`rounded-lg p-4 cursor-pointer transition-all duration-200 group ${
                  isSelected 
                    ? 'bg-blue-100 border-2 border-blue-500 shadow-md' 
                    : 'bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="text-center">
                  <div className={`font-bold mb-1 ${
                    isSelected 
                      ? 'text-blue-800' 
                      : 'text-gray-900 group-hover:text-blue-700'
                  }`}>
                    {asset.symbol}
                    {isSelected && <span className="ml-1 text-blue-600">✓</span>}
                  </div>
                  <div className={`text-sm mb-2 ${
                    isSelected ? 'text-blue-700' : 'text-gray-600'
                  }`}>
                    {asset.name}
                  </div>
                  
                  {priceData.error ? (
                    <div className="text-sm text-red-600">Error</div>
                  ) : priceData.price ? (
                    <div className={`text-sm font-medium break-all ${
                      isSelected ? 'text-green-700' : 'text-green-600'
                    }`}>
                      {priceData.price}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">N/A</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {onAssetSelect && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              💡 Click on any asset to use it in your trading order
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export { ASSETS }
