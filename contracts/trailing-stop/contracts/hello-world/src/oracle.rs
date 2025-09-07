use soroban_sdk::{Address, Env, contractclient, contracttype, Vec, String};
use crate::types::PriceData;

// Reflector Oracle interface'ini kendimiz tanımlayalım
#[contractclient(name = "ReflectorClient")]
pub trait ReflectorContract {
    fn lastprice(env: Env, asset: Asset) -> Option<OraclePriceData>;
    fn decimals(env: Env) -> u32;
    fn assets(env: Env) -> Vec<Asset>;
    fn base(env: Env) -> Asset;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}

pub struct OracleClient {
    oracle_address: Address,
    env: Env,
}

impl OracleClient {
    pub fn new(env: &Env, oracle_address: &Address) -> Self {
        Self {
            oracle_address: oracle_address.clone(),
            env: env.clone(),
        }
    }
    
    pub fn get_price(&self, asset: &Address) -> Option<i128> {
        // Reflector Oracle'ı çağır
        let client = ReflectorClient::new(&self.env, &self.oracle_address);
        let asset_param = Asset::Stellar(asset.clone());
        
        match client.lastprice(&asset_param) {
            Some(price_data) => Some(price_data.price),
            None => None,
        }
    }
    
    pub fn get_price_with_timestamp(&self, asset: &Address) -> Option<PriceData> {
        let client = ReflectorClient::new(&self.env, &self.oracle_address);
        let asset_param = Asset::Stellar(asset.clone());
        
        match client.lastprice(&asset_param) {
            Some(oracle_data) => Some(PriceData {
                price: oracle_data.price,
                timestamp: oracle_data.timestamp,
                confidence: 100,
            }),
            None => None,
        }
    }
    
    pub fn get_decimals(&self) -> u32 {
        let client = ReflectorClient::new(&self.env, &self.oracle_address);
        client.decimals()
    }
    
    pub fn get_assets(&self) -> Vec<Asset> {
        let client = ReflectorClient::new(&self.env, &self.oracle_address);
        client.assets()
    }
}