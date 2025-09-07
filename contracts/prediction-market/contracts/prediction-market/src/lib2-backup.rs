#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Env, Vec, Symbol, 
    Address, contracterror, Map, symbol_short, String
};

// Oracle entegrasyonu için reflector modülü
mod reflector {
    use soroban_sdk::{contracttype, Address, Env, Vec, Symbol};

    #[soroban_sdk::contractclient(name = "ReflectorClient")]
    #[allow(dead_code)]
    pub trait Contract {
        fn base(e: Env) -> Asset;
        fn assets(e: Env) -> Vec<Asset>;
        fn decimals(e: Env) -> u32;
        fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
        fn lastprice(e: Env, asset: Asset) -> Option<PriceData>;
        fn prices(e: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;
        fn twap(e: Env, asset: Asset, records: u32) -> Option<i128>;
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
}

use reflector::{ReflectorClient, Asset as ReflectorAsset};

#[contract]
pub struct PredictionMarket;

// Veri yapıları
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    pub id: u64,
    pub title: String,
    pub token: Address,
    pub target_price: i128,
    pub end_time: u64,
    pub total_yes_bets: i128,
    pub total_no_bets: i128,
    pub is_resolved: bool,
    pub winning_side: Option<bool>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserBet {
    pub user: Address,
    pub market_id: u64,
    pub amount: i128,
    pub prediction: bool,
    pub timestamp: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    MarketNotFound = 1,
    MarketExpired = 2,
    MarketAlreadyResolved = 3,
    InsufficientBalance = 4,
    NotAuthorized = 5,
    InvalidAmount = 6,
}

// Storage anahtarları - symbol_short! makrosunu kullan
const MARKETS: Symbol = symbol_short!("MARKETS");
const MARKET_COUNTER: Symbol = symbol_short!("COUNTER");

// Oracle adresi constant
const ORACLE_ADDRESS_STR: &str = "CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP";

#[contractimpl]
impl PredictionMarket {
    
    
    /// Oracle client'ı oluştur (helper function)
    fn get_oracle_client(env: &Env) -> ReflectorClient<'_> {
        let oracle_address = Address::from_string(&String::from_str(env, ORACLE_ADDRESS_STR));
        ReflectorClient::new(env, &oracle_address)
    }

    /// Oracle'dan fiyat alma (gelişmiş)
    pub fn get_price(env: Env, token: Address) -> i128 {
        let reflector_client = Self::get_oracle_client(&env);
        let reflector_asset = ReflectorAsset::Stellar(token);
        
        match reflector_client.lastprice(&reflector_asset) {
            Some(price_data) => price_data.price,
            None => 0i128, // Varsayılan fiyat
        }
    }

    /// Oracle'dan geçmiş fiyat alma
    pub fn get_price_at_timestamp(env: Env, token: Address, timestamp: u64) -> Option<i128> {
        let reflector_client = Self::get_oracle_client(&env);
        let reflector_asset = ReflectorAsset::Stellar(token);
        
        match reflector_client.price(&reflector_asset, &timestamp) {
            Some(price_data) => Some(price_data.price),
            None => None,
        }
    }

    /// Oracle'dan TWAP (Time Weighted Average Price) alma
    pub fn get_twap(env: Env, token: Address, records: u32) -> Option<i128> {
        let reflector_client = Self::get_oracle_client(&env);
        let reflector_asset = ReflectorAsset::Stellar(token);
        
        reflector_client.twap(&reflector_asset, &records)
    }

    /// Oracle'dan desteklenen asset'leri alma
    pub fn get_supported_assets(env: Env) -> Vec<ReflectorAsset> {
        let reflector_client = Self::get_oracle_client(&env);
        reflector_client.assets()
    }

    /// Oracle'dan base asset alma
    pub fn get_base_asset(env: Env) -> ReflectorAsset {
        let reflector_client = Self::get_oracle_client(&env);
        reflector_client.base()
    }

    /// Oracle decimal precision'u alma
    pub fn get_oracle_decimals(env: Env) -> u32 {
        let reflector_client = Self::get_oracle_client(&env);
        reflector_client.decimals()
    }

    /// Market oluştur
    pub fn create_market(
        env: Env,
        admin: Address,
        title: String,
        token: Address,
        target_price: i128,
        duration_hours: u64,
    ) -> Result<u64, Error> {
        admin.require_auth();
        
        let market_id = env.storage().persistent()
            .get(&MARKET_COUNTER).unwrap_or(0u64) + 1;
        
        let end_time = env.ledger().timestamp() + (duration_hours * 3600);
        
        let market = Market {
            id: market_id,
            title,
            token,
            target_price,
            end_time,
            total_yes_bets: 0,
            total_no_bets: 0,
            is_resolved: false,
            winning_side: None,
        };
        
        let mut markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
        markets.set(market_id, market);
        
        env.storage().persistent().set(&MARKETS, &markets);
        env.storage().persistent().set(&MARKET_COUNTER, &market_id);
        
        Ok(market_id)
    }

    /// Gelişmiş market oluştur (TWAP tabanlı)
    pub fn create_twap_market(
        env: Env,
        admin: Address,
        title: String,
        token: Address,
        target_price: i128,
        duration_hours: u64,
        twap_records: u32, // TWAP hesabında kullanılacak kayıt sayısı
    ) -> Result<u64, Error> {
        admin.require_auth();
        
        let market_id = env.storage().persistent()
            .get(&MARKET_COUNTER).unwrap_or(0u64) + 1;
        
        let end_time = env.ledger().timestamp() + (duration_hours * 3600);
        
        // TWAP ile güncel fiyatı kontrol et
        let current_twap = Self::get_twap(env.clone(), token.clone(), twap_records);
        if current_twap.is_none() {
            return Err(Error::InvalidAmount); // Oracle veri yok
        }
        
        let market = Market {
            id: market_id,
            title,
            token,
            target_price,
            end_time,
            total_yes_bets: 0,
            total_no_bets: 0,
            is_resolved: false,
            winning_side: None,
        };
        
        let mut markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
        markets.set(market_id, market);
        
        env.storage().persistent().set(&MARKETS, &markets);
        env.storage().persistent().set(&MARKET_COUNTER, &market_id);
        
        Ok(market_id)
    }

    /// Bahis koy
    pub fn place_bet(
        env: Env,
        user: Address,
        market_id: u64,
        amount: i128,
        prediction: bool,
    ) -> Result<(), Error> {
        user.require_auth();
        
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let mut markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
            
        let mut market = markets.get(market_id)
            .ok_or(Error::MarketNotFound)?;
        
        if env.ledger().timestamp() > market.end_time {
            return Err(Error::MarketExpired);
        }
        
        if market.is_resolved {
            return Err(Error::MarketAlreadyResolved);
        }
        
        // Bahis kaydet - tuple key kullan
        let bet = UserBet {
            user: user.clone(),
            market_id,
            amount,
            prediction,
            timestamp: env.ledger().timestamp(),
        };
        
        // Unique key oluştur: (bet, market_id, sequence)
        let bet_key = (symbol_short!("BET"), market_id, env.ledger().sequence());
        env.storage().persistent().set(&bet_key, &bet);
        
        // Market totals güncelle
        if prediction {
            market.total_yes_bets += amount;
        } else {
            market.total_no_bets += amount;
        }
        
        markets.set(market_id, market);
        env.storage().persistent().set(&MARKETS, &markets);
        
        Ok(())
    }

    /// Market'ı çöz
    pub fn resolve_market(
        env: Env,
        admin: Address,
        market_id: u64,
    ) -> Result<bool, Error> {
        admin.require_auth();
        
        let mut markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
            
        let mut market = markets.get(market_id)
            .ok_or(Error::MarketNotFound)?;
        
        if market.is_resolved {
            return Err(Error::MarketAlreadyResolved);
        }
        
        let current_price = Self::get_price(env.clone(), market.token.clone());
        let result = current_price >= market.target_price;
        
        market.winning_side = Some(result);
        market.is_resolved = true;
        
        markets.set(market_id, market);
        env.storage().persistent().set(&MARKETS, &markets);
        
        Ok(result)
    }

    /// TWAP ile market'ı çöz (daha doğru fiyat)
    pub fn resolve_market_with_twap(
        env: Env,
        admin: Address,
        market_id: u64,
        twap_records: u32,
    ) -> Result<bool, Error> {
        admin.require_auth();
        
        let mut markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
            
        let mut market = markets.get(market_id)
            .ok_or(Error::MarketNotFound)?;
        
        if market.is_resolved {
            return Err(Error::MarketAlreadyResolved);
        }
        
        // TWAP ile daha doğru fiyat al
        let current_price = match Self::get_twap(env.clone(), market.token.clone(), twap_records) {
            Some(twap_price) => twap_price,
            None => Self::get_price(env.clone(), market.token.clone()), // Fallback
        };
        
        let result = current_price >= market.target_price;
        
        market.winning_side = Some(result);
        market.is_resolved = true;
        
        markets.set(market_id, market);
        env.storage().persistent().set(&MARKETS, &markets);
        
        Ok(result)
    }

    /// Market bilgilerini getir
    pub fn get_market(env: Env, market_id: u64) -> Option<Market> {
        let markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
        markets.get(market_id)
    }

    /// Aktif marketleri listele
    pub fn get_active_markets(env: Env) -> Vec<Market> {
        let markets: Map<u64, Market> = env.storage().persistent()
            .get(&MARKETS).unwrap_or(Map::new(&env));
        
        let mut active_markets = Vec::new(&env);
        let current_time = env.ledger().timestamp();
        
        for market in markets.values() {
            if !market.is_resolved && market.end_time > current_time {
                active_markets.push_back(market);
            }
        }
        
        active_markets
    }

    /// Fiyat geçmişi analizi
    pub fn get_price_analysis(env: Env, token: Address, records: u32) -> Option<Vec<reflector::PriceData>> {
        let reflector_client = Self::get_oracle_client(&env);
        let reflector_asset = ReflectorAsset::Stellar(token);
        
        reflector_client.prices(&reflector_asset, &records)
    }

    /// Market volatilite analizi - Basitleştirilmiş versiyon
    pub fn analyze_market_volatility(env: Env, token: Address) -> Option<i128> {
        // Son 5 kayıt ile basit volatilite hesapla
        match Self::get_price_analysis(env.clone(), token, 5) {
            Some(prices) => {
                if prices.len() < 2 {
                    return None;
                }
                
                // İlk ve son fiyat arasındaki farkı al
                let first_price = prices.get(0).unwrap().price;
                let last_price = prices.get(prices.len() - 1).unwrap().price;
                let price_diff = (last_price - first_price).abs();
                
                // Basit volatilite: fiyat farkı / ortalama fiyat * 10000 (bps)
                let avg_price = (first_price + last_price) / 2;
                if avg_price > 0 {
                    Some((price_diff * 10000) / avg_price)
                } else {
                    None
                }
            },
            None => None,
        }
    }
}