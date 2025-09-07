// Debug environment variables
// console.log('🔧 Environment Debug:');
// console.log('  NODE_ENV:', process.env.NODE_ENV);
// console.log('  NEXT_PUBLIC_ENVIRONMENT:', process.env.NEXT_PUBLIC_ENVIRONMENT);
// console.log('  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:', process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE);
// console.log('  NEXT_PUBLIC_STELLAR_RPC_URL:', process.env.NEXT_PUBLIC_STELLAR_RPC_URL);
// console.log('  NEXT_PUBLIC_LENDING_CONTRACT_ID:', process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID);
// console.log('  NEXT_PUBLIC_SALARY_STREAMING_CONTRACT_ID:', process.env.NEXT_PUBLIC_SALARY_STREAMING_CONTRACT_ID);
// console.log('  NEXT_PUBLIC_WORK_PROFILE_CONTRACT_ID:', process.env.NEXT_PUBLIC_WORK_PROFILE_CONTRACT_ID);

// Contract addresses from environment variables
export const CONTRACT_ADDRESSES = {
  // LENDING: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || 'CCZLYFUU2F4PWDEXQ4TD2K4LXFY7N2ACMC7V6XXVLIDKSWXWB56E537C',
  SimpleTrailingStopTrading: 'CAW5MCRVXEBE4ZQKJFSALJOVCJEVYSEDTTZQZNZAZ2XQC5XACBECNBTV',
  // WORK_PROFILE: process.env.NEXT_PUBLIC_WORK_PROFILE_CONTRACT_ID || 'CCAHTMF7PDOB2KM4SIDDHBW2AMVGEWCTLKG3BSYJNTFGMASSGMKO6OKT',
  // Betting Market Contract - UPDATED!
  BETTING_MARKET: 'CBJU447ZOL2XDSVK63XFPYRFQDDDS63WC66Q56MMDYQYYXR73QQVR7M3',
  // Oracle Contract
  ORACLE: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID || 'CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2',
};

export const NETWORK_CONFIG = {
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'testnet',
};

// Validate required environment variables
if (typeof window === 'undefined') {
  // Only validate on server side to avoid hydration issues
  const requiredEnvVars = [
    'NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE',
    'NEXT_PUBLIC_STELLAR_RPC_URL',
    'NEXT_PUBLIC_LENDING_CONTRACT_ID',
    'NEXT_PUBLIC_SALARY_STREAMING_CONTRACT_ID',
    'NEXT_PUBLIC_WORK_PROFILE_CONTRACT_ID',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using fallback contract addresses...');
  }
}