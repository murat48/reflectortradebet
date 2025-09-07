#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Env, Vec, Address};
use crate::reflector::{ReflectorClient, Asset as ReflectorAsset, PriceData};

#[contracttype]
pub enum DataKey {
    OracleAddress,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    OracleNotInitialized = 1,
    PriceNotAvailable = 2,
    InsufficientData = 3,
    InvalidThreshold = 4,
}

#[contract]
pub struct OracleContract;

#[contractimpl]
impl OracleContract {
    
    /// Oracle adresini ayarlar (sadece bir kez çağrılmalı)
    pub fn initialize(env: Env, oracle_address: Address) -> Result<(), ContractError> {
        env.storage().instance().set(&DataKey::OracleAddress, &oracle_address);
        Ok(())
    }
    
    /// Kayıtlı oracle adresini getirir
    fn get_oracle_address(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::OracleAddress)
            .ok_or(ContractError::OracleNotInitialized)
    }
    
    /// Token fiyatını getirir
    pub fn get_price(env: Env, token_address: Address) -> Result<i128, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let reflector_asset = ReflectorAsset::Stellar(token_address);
        
        match reflector_client.lastprice(&reflector_asset) {
            Some(price_data) => Ok(price_data.price),
            None => Err(ContractError::PriceNotAvailable),
        }
    }
    
    /// Token için detaylı fiyat bilgisini getirir (fiyat + timestamp)
    pub fn get_price_data(env: Env, token_address: Address) -> Result<PriceData, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let reflector_asset = ReflectorAsset::Stellar(token_address);
        
        reflector_client
            .lastprice(&reflector_asset)
            .ok_or(ContractError::PriceNotAvailable)
    }
    
    /// Token fiyatı ve timestamp'ini ayrı ayrı getirir (CLI için daha uygun)
    pub fn get_price_and_timestamp(env: Env, token_address: Address) -> Result<(i128, u64), ContractError> {
        let price_data = Self::get_price_data(env, token_address)?;
        Ok((price_data.price, price_data.timestamp))
    }
    
    /// Sadece timestamp'i getirir
    pub fn get_price_timestamp(env: Env, token_address: Address) -> Result<u64, ContractError> {
        let price_data = Self::get_price_data(env, token_address)?;
        Ok(price_data.timestamp)
    }
    
    /// Token için belirtilen kayıt sayısına göre TWAP hesaplar
    pub fn get_twap_price(env: Env, token_address: Address, records: u32) -> Result<i128, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let reflector_asset = ReflectorAsset::Stellar(token_address);
        
        reflector_client
            .twap(&reflector_asset, &records)
            .ok_or(ContractError::InsufficientData)
    }
    
    /// Token için geçmiş fiyat verilerini getirir
    pub fn get_historical_prices(env: Env, token_address: Address, records: u32) -> Result<Vec<PriceData>, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let reflector_asset = ReflectorAsset::Stellar(token_address);
        
        reflector_client
            .prices(&reflector_asset, &records)
            .ok_or(ContractError::InsufficientData)
    }
    
    /// Fiyatı USD formatında döndürür (14 decimal varsayımı ile)
    pub fn get_price_usd(env: Env, token_address: Address) -> Result<i128, ContractError> {
        let raw_price = Self::get_price(env, token_address)?;
        // 14 decimal'den 6 decimal'e dönüştür (mikro USD precision)
        Ok(raw_price / 100_000_000) // 10^8
    }
    
    /// TWAP fiyatını USD formatında döndürür
    pub fn get_twap_price_usd(env: Env, token_address: Address, records: u32) -> Result<i128, ContractError> {
        let raw_twap = Self::get_twap_price(env, token_address, records)?;
        // 14 decimal'den 6 decimal'e dönüştür
        Ok(raw_twap / 100_000_000) // 10^8
    }
    
    /// Oracle'ın decimal sayısını getirir
    pub fn get_oracle_decimals(env: Env) -> Result<u32, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        Ok(reflector_client.decimals())
    }
    
    /// Dinamik decimal dönüşümü ile USD fiyat
    pub fn get_price_with_decimals(env: Env, token_address: Address, target_decimals: u32) -> Result<i128, ContractError> {
        let raw_price = Self::get_price(env.clone(), token_address)?;
        let oracle_decimals = Self::get_oracle_decimals(env)?;
        
        if oracle_decimals >= target_decimals {
            Ok(raw_price / (10_i128.pow(oracle_decimals - target_decimals)))
        } else {
            // Overflow kontrolü ile çarpma
            let multiplier = 10_i128.pow(target_decimals - oracle_decimals);
            raw_price.checked_mul(multiplier).ok_or(ContractError::InvalidThreshold)
        }
    }
    
    /// Token fiyatının belirtilen fiyattan yüksek olup olmadığını kontrol eder
    pub fn is_price_above(env: Env, token_address: Address, threshold: i128) -> Result<bool, ContractError> {
        let current_price = Self::get_price(env, token_address)?;
        Ok(current_price > threshold)
    }
    
    /// Token fiyatının belirtilen fiyattan düşük olup olmadığını kontrol eder
    pub fn is_price_below(env: Env, token_address: Address, threshold: i128) -> Result<bool, ContractError> {
        let current_price = Self::get_price(env, token_address)?;
        Ok(current_price < threshold)
    }
    
    /// Fiyat değişim yüzdesini hesaplar (son iki kayıt arasında)
    pub fn get_price_change_percentage(env: Env, token_address: Address) -> Result<i128, ContractError> {
        let historical_prices = Self::get_historical_prices(env, token_address, 2)?;
        
        if historical_prices.len() < 2 {
            return Err(ContractError::InsufficientData);
        }
        
        let current_price = historical_prices.get(0).unwrap().price;
        let previous_price = historical_prices.get(1).unwrap().price;
        
        if previous_price == 0 {
            return Err(ContractError::InvalidThreshold);
        }
        
        // Yüzde değişim hesaplama: ((current - previous) / previous) * 100
        Ok(((current_price - previous_price) * 100) / previous_price)
    }
    
    /// İki farklı asset arasında çapraz fiyat bilgisini getirir
    pub fn get_cross_price(env: Env, base_asset: Address, quote_asset: Address) -> Result<i128, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let base = ReflectorAsset::Stellar(base_asset);
        let quote = ReflectorAsset::Stellar(quote_asset);
        
        reflector_client
            .x_last_price(&base, &quote)
            .map(|data| data.price)
            .ok_or(ContractError::PriceNotAvailable)
    }
    
    /// Belirtilen zaman damgasına göre token fiyatını getirir
    pub fn get_price_at_timestamp(env: Env, token_address: Address, timestamp: u64) -> Result<Option<i128>, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        let reflector_asset = ReflectorAsset::Stellar(token_address);
        
        let price_data = reflector_client.price(&reflector_asset, &timestamp);
        Ok(price_data.map(|data| data.price))
    }
    
    /// Oracle'ın desteklediği tüm asset'leri listeler
    pub fn get_supported_assets(env: Env) -> Result<Vec<ReflectorAsset>, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        Ok(reflector_client.assets())
    }
    
    /// Oracle'ın çözünürlük bilgisini getirir (güncelleme aralığı)
    pub fn get_oracle_resolution(env: Env) -> Result<u32, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        Ok(reflector_client.resolution())
    }
    
    /// Oracle'ın son güncelleme zamanını getirir
    pub fn get_last_update_timestamp(env: Env) -> Result<u64, ContractError> {
        let oracle_address = Self::get_oracle_address(&env)?;
        let reflector_client = ReflectorClient::new(&env, &oracle_address);
        Ok(reflector_client.last_timestamp())
    }
    
    /// Fiyat alarm sistemi - belirtilen eşik değerleri arasında olup olmadığını kontrol eder
    pub fn check_price_alert(env: Env, token_address: Address, min_threshold: i128, max_threshold: i128) -> Result<bool, ContractError> {
        if min_threshold >= max_threshold {
            return Err(ContractError::InvalidThreshold);
        }
        
        let current_price = Self::get_price(env, token_address)?;
        Ok(current_price >= min_threshold && current_price <= max_threshold)
    }
    
    /// Oracle adresini günceller (admin işlemi)
    pub fn update_oracle_address(env: Env, new_oracle_address: Address) -> Result<(), ContractError> {
        env.storage().instance().set(&DataKey::OracleAddress, &new_oracle_address);
        Ok(())
    }
    
    /// Mevcut oracle adresini döndürür
    pub fn get_current_oracle_address(env: Env) -> Result<Address, ContractError> {
        Self::get_oracle_address(&env)
    }
    
    /// Debug bilgileri döndürür (raw_price, decimals, formatted_price)
    pub fn debug_price_info(env: Env, token_address: Address) -> Result<(i128, u32, i128), ContractError> {
        let raw_price = Self::get_price(env.clone(), token_address)?;
        let decimals = Self::get_oracle_decimals(env)?;
        let formatted_price = raw_price / (10_i128.pow(decimals.min(8))); // Max 8 decimal shift
        
        Ok((raw_price, decimals, formatted_price))
    }
    
    /// Fiyat validasyonu - fiyatın makul aralıkta olup olmadığını kontrol eder
    pub fn validate_price(env: Env, token_address: Address, min_price: i128, max_price: i128) -> Result<bool, ContractError> {
        if min_price >= max_price {
            return Err(ContractError::InvalidThreshold);
        }
        
        let current_price = Self::get_price(env, token_address)?;
        Ok(current_price >= min_price && current_price <= max_price)
    }
    
    /// Multiple token fiyatlarını batch olarak getirir
    pub fn get_multiple_prices(env: Env, token_addresses: Vec<Address>) -> Result<Vec<i128>, ContractError> {
        let mut prices = Vec::new(&env);
        
        for token in token_addresses.iter() {
            match Self::get_price(env.clone(), token) {
                Ok(price) => prices.push_back(price),
                Err(_) => prices.push_back(0), // Hatalı fiyatlar için 0 döndür
            }
        }
        
        Ok(prices)
    }
}

mod reflector {
    use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

    #[soroban_sdk::contractclient(name = "ReflectorClient")]
    #[allow(dead_code)]
    pub trait Contract {
        fn base(e: Env) -> Asset;
        fn assets(e: Env) -> Vec<Asset>;
        fn decimals(e: Env) -> u32;
        fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
        fn lastprice(e: Env, asset: Asset) -> Option<PriceData>;
        fn prices(e: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;
        fn x_last_price(e: Env, base_asset: Asset, quote_asset: Asset) -> Option<PriceData>;
        fn x_price(e: Env, base_asset: Asset, quote_asset: Asset, timestamp: u64) -> Option<PriceData>;
        fn x_prices(e: Env, base_asset: Asset, quote_asset: Asset, records: u32) -> Option<Vec<PriceData>>;
        fn twap(e: Env, asset: Asset, records: u32) -> Option<i128>;
        fn x_twap(e: Env, base_asset: Asset, quote_asset: Asset, records: u32) -> Option<i128>;
        fn resolution(e: Env) -> u32;
        fn period(e: Env) -> Option<u64>;
        fn last_timestamp(e: Env) -> u64;
        fn version(e: Env) -> u32;
        fn admin(e: Env) -> Option<Address>;
    }

    #[contracttype]
    #[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
    pub enum Asset {
        Stellar(Address),
        Other(Symbol),
    }

    #[contracttype]
    #[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
    pub struct PriceData {
        pub price: i128,
        pub timestamp: u64,
    }

    #[soroban_sdk::contracterror(export = false)]
    #[derive(Debug, Copy, Clone, Eq, PartialEq, Ord, PartialOrd)]
    pub enum Error {
        AlreadyInitialized = 0,
        Unauthorized = 1,
        AssetMissing = 2,
        AssetAlreadyExists = 3,
        InvalidConfigVersion = 4,
        InvalidTimestamp = 5,
        InvalidUpdateLength = 6,
        AssetLimitExceeded = 7,
    }
}