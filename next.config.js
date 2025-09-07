/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle node modules that need to be polyfilled in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        url: require.resolve('url'),
      }
    }
    
    // Suppress sodium-native and require-addon warnings
    config.ignoreWarnings = [
      { module: /sodium-native/ },
      { module: /require-addon/ },
      { message: /Critical dependency/ },
      { message: /the request of a dependency is an expression/ },
      { message: /require function is used in a way in which dependencies cannot be statically extracted/ },
    ]
    
    // Add externals to reduce bundle size
    config.externals = config.externals || []
    if (!isServer) {
      config.externals.push({
        'sodium-native': 'sodium-native',
        'require-addon': 'require-addon',
      })
    }
    
    return config
  },
  env: {
    STELLAR_NETWORK: process.env.STELLAR_NETWORK || 'TESTNET',
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || 'CDG2XZFKAQJDDRBCPK2AS5STHTSFYMS6J5RLBQUEXUUWLBCZX4VFZHRE',
    RPC_URL: process.env.RPC_URL || 'https://soroban-testnet.stellar.org',
  },
  // Suppress build warnings
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
