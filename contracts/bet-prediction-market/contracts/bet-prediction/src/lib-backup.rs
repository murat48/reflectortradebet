// #![no_std]
// use soroban_sdk::{
//     contract, contractimpl, contracttype, Env, Vec, Symbol, 
//     Address, contracterror, Map, symbol_short, String, token
// };

// // Oracle entegrasyonu için reflector modülü
// mod reflector {
//     use soroban_sdk::{contracttype, Address, Env, Vec, Symbol};

//     #[soroban_sdk::contractclient(name = "ReflectorClient")]
//     #[allow(dead_code)]
//     pub trait Contract {
//         fn base(e: Env) -> Asset;
//         fn assets(e: Env) -> Vec<Asset>;
//         fn decimals(e: Env) -> u32;
//         fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
//         fn lastprice(e: Env, asset: Asset) -> Option<PriceData>;
//         fn prices(e: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;
//         fn twap(e: Env, asset: Asset, records: u32) -> Option<i128>;
//         fn resolution(e: Env) -> u32;
//         fn period(e: Env) -> Option<u64>;
//         fn last_timestamp(e: Env) -> u64;
//         fn version(e: Env) -> u32;
//         fn admin(e: Env) -> Option<Address>;
//     }

//     #[contracttype]
//     #[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
//     pub enum Asset {
//         Stellar(Address),
//         Other(Symbol),
//     }

//     #[contracttype]
//     #[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
//     pub struct PriceData {
//         pub price: i128,
//         pub timestamp: u64,
//     }
// }

// use reflector::{ReflectorClient, Asset as ReflectorAsset};

// #[contract]
// pub struct PredictionMarket;

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub enum PredictionType {
//     Up,      
//     Down,    
//     Stable,  
// }

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct Market {
//     pub id: u64,
//     pub title: String,
//     pub token: Address,
//     pub betting_token: Address, // Bahis yapılan token (XLM, USDC vs)
//     pub initial_price: i128,
//     pub target_price: i128,
//     pub stable_tolerance: i128,
//     pub start_time: u64,
//     pub end_time: u64,
//     pub total_up_bets: i128,
//     pub total_down_bets: i128,
//     pub total_stable_bets: i128,
//     pub up_betters_count: u32,
//     pub down_betters_count: u32,
//     pub stable_betters_count: u32,
//     pub is_resolved: bool,
//     pub is_paid_out: bool, // Ödemeler yapılmış mı?
//     pub winning_side: Option<u32>, // 0=Up, 1=Down, 2=Stable
//     pub final_price: Option<i128>,
//     pub auto_restart: bool,
//     pub restart_duration: u64,
//     pub house_edge: i128, // Basis points (50 = %0.5)
// }

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct UserBet {
//     pub user: Address,
//     pub market_id: u64,
//     pub amount: i128,
//     pub prediction: u32, // 0=Up, 1=Down, 2=Stable
//     pub timestamp: u64,
//     pub odds_when_placed: i128,
//     pub is_paid_out: bool, // Ödeme yapılmış mı?
//     pub winnings: i128,    // Kazanılan miktar
// }

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct Odds {
//     pub up_odds: i128,      
//     pub down_odds: i128,
//     pub stable_odds: i128,
// }

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct MarketStats {
//     pub total_volume: i128,
//     pub total_betters: u32,
//     pub up_percentage: i128,
//     pub down_percentage: i128,
//     pub stable_percentage: i128,
//     pub prize_pool: i128, // Komisyon sonrası ödül havuzu
//     pub house_commission: i128, // Kesilen komisyon
// }

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct PayoutSummary {
//     pub total_winners: u32,
//     pub total_paid_amount: i128,
//     pub house_commission: i128,
//     pub remaining_balance: i128,
// }

// #[contracterror]
// #[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
// pub enum Error {
//     MarketNotFound = 1,
//     MarketExpired = 2,
//     MarketNotStarted = 3,
//     MarketAlreadyResolved = 4,
//     MarketAlreadyPaidOut = 5,
//     InsufficientBalance = 6,
//     InsufficientContractBalance = 7,
//     NotAuthorized = 8,
//     InvalidAmount = 9,
//     InvalidPrediction = 10,
//     UserAlreadyBet = 11,
//     UserAlreadyPaidOut = 12,
//     PaymentFailed = 13,
//     TokenTransferFailed = 14,
//     CalculationError = 15,
// }

// const MARKETS: Symbol = symbol_short!("MARKETS");
// const MARKET_COUNTER: Symbol = symbol_short!("COUNTER");
// const CONTRACT_BALANCE: Symbol = symbol_short!("BALANCE");
// const MARKET_USERS: Symbol = symbol_short!("MUSERS"); // Market kullanıcıları listesi
// const ORACLE_ADDRESS_STR: &str = "CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP";

// #[contractimpl]
// impl PredictionMarket {
    
//     pub fn hello(env: Env) -> String {
//         String::from_str(&env, "Enhanced Prediction Market v3.0 with Auto Payouts!")
//     }
    
//     fn get_oracle_client(env: &Env) -> ReflectorClient<'_> {
//         let oracle_address = Address::from_string(&String::from_str(env, ORACLE_ADDRESS_STR));
//         ReflectorClient::new(env, &oracle_address)
//     }

//     pub fn get_price(env: Env, token: Address) -> i128 {
//         let reflector_client = Self::get_oracle_client(&env);
//         let reflector_asset = ReflectorAsset::Stellar(token);
        
//         match reflector_client.lastprice(&reflector_asset) {
//             Some(price_data) => price_data.price,
//             None => 0i128,
//         }
//     }

//     /// Gelişmiş market oluştur
//     pub fn create_market(
//         env: Env,
//         admin: Address,
//         title: String,
//         token: Address,
//         betting_token: Address, // Bahis yapılacak token
//         target_price: i128,
//         stable_tolerance: i128,
//         duration_hours: u64,
//         auto_restart: bool,
//         house_edge: i128, // Basis points (50 = %0.5)
//     ) -> Result<u64, Error> {
//         admin.require_auth();
        
//         let market_id = env.storage().persistent()
//             .get(&MARKET_COUNTER).unwrap_or(0u64) + 1;
        
//         let start_time = env.ledger().timestamp();
//         let end_time = start_time + (duration_hours * 3600);
//         let initial_price = Self::get_price(env.clone(), token.clone());
        
//         let market = Market {
//             id: market_id,
//             title,
//             token,
//             betting_token,
//             initial_price,
//             target_price,
//             stable_tolerance,
//             start_time,
//             end_time,
//             total_up_bets: 0,
//             total_down_bets: 0,
//             total_stable_bets: 0,
//             up_betters_count: 0,
//             down_betters_count: 0,
//             stable_betters_count: 0,
//             is_resolved: false,
//             is_paid_out: false,
//             winning_side: None,
//             final_price: None,
//             auto_restart,
//             restart_duration: duration_hours,
//             house_edge,
//         };
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
//         markets.set(market_id, market);
        
//         env.storage().persistent().set(&MARKETS, &markets);
//         env.storage().persistent().set(&MARKET_COUNTER, &market_id);
        
//         Ok(market_id)
//     }

//     /// ADİL ÖDÜL SİSTEMİ - Pool-Based Fair Odds Calculation
//     /// Bu sistem odds'ları pool'daki gerçek para miktarına göre hesaplar
//     pub fn calculate_improved_odds(env: Env, market_id: u64) -> Result<Odds, Error> {
//         let markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
        
//         // Başlangıç odds'ları (hiç bahis yoksa)
//         if total_volume == 0 {
//             return Ok(Odds {
//                 up_odds: 2000,    // 2.0x
//                 down_odds: 2000,  // 2.0x  
//                 stable_odds: 2000, // 2.0x
//             });
//         }
        
//         // Komisyon sonrası ödül havuzu
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         // **YENİ ADİL SİSTEM**: Her taraf için gerçekçi odds hesapla
//         // Formül: Odds = (Ödül Havuzu / Bahis Miktarı) ama maksimum limitle
        
//         let up_odds = if market.total_up_bets > 0 {
//             // Pool'daki para / Up bahisleri = gerçek payout oranı
//             let raw_odds = (prize_pool * 1000) / market.total_up_bets;
//             let max_realistic_odds = 5000i128; // Maksimum 5.0x
//             let min_odds = 1100i128; // Minimum 1.1x (garantili kar)
//             raw_odds.max(min_odds).min(max_realistic_odds)
//         } else {
//             2000 // Default 2.0x
//         };
        
//         let down_odds = if market.total_down_bets > 0 {
//             let raw_odds = (prize_pool * 1000) / market.total_down_bets;
//             let max_realistic_odds = 5000i128;
//             let min_odds = 1100i128;
//             raw_odds.max(min_odds).min(max_realistic_odds)
//         } else {
//             2000
//         };
        
//         let stable_odds = if market.total_stable_bets > 0 {
//             let raw_odds = (prize_pool * 1000) / market.total_stable_bets;
//             let max_realistic_odds = 5000i128;
//             let min_odds = 1100i128;
//             raw_odds.max(min_odds).min(max_realistic_odds)
//         } else {
//             2000
//         };
        
//         Ok(Odds {
//             up_odds,
//             down_odds,
//             stable_odds,
//         })
//     }
//     /// Bahis koy - Token transferi ile
//     pub fn place_bet(
//         env: Env,
//         user: Address,
//         market_id: u64,
//         amount: i128,
//         prediction: u32, // 0=Up, 1=Down, 2=Stable
//     ) -> Result<(), Error> {
//         user.require_auth();
        
//         if amount <= 0 {
//             return Err(Error::InvalidAmount);
//         }
        
//         // Prediction validation
//         if prediction > 2 {
//             return Err(Error::InvalidPrediction);
//         }
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let mut market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let current_time = env.ledger().timestamp();
        
//         if current_time < market.start_time {
//             return Err(Error::MarketNotStarted);
//         }
        
//         if current_time > market.end_time {
//             return Err(Error::MarketExpired);
//         }
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//         if env.storage().persistent().has(&user_bet_key) {
//             return Err(Error::UserAlreadyBet);
//         }
        
//         // Token transferi - kullanıcıdan kontrata
//         let token_client = token::Client::new(&env, &market.betting_token);
//         token_client.transfer(&user, &env.current_contract_address(), &amount);
        
//         // Kullanıcıyı market kullanıcıları listesine ekle
//         let market_users_key = (MARKET_USERS, market_id);
//         let mut market_users: Vec<Address> = env.storage().persistent()
//             .get(&market_users_key).unwrap_or(Vec::new(&env));
//         market_users.push_back(user.clone());
//         env.storage().persistent().set(&market_users_key, &market_users);
        
//         // Mevcut oranları hesapla
//         let current_odds = Self::calculate_improved_odds(env.clone(), market_id)?;
//         let odds_when_placed = match prediction {
//             0 => current_odds.up_odds,    // Up
//             1 => current_odds.down_odds,  // Down
//             2 => current_odds.stable_odds, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         // Bahis kaydet
//         let bet = UserBet {
//             user: user.clone(),
//             market_id,
//             amount,
//             prediction,
//             timestamp: current_time,
//             odds_when_placed,
//             is_paid_out: false,
//             winnings: 0,
//         };
        
//         env.storage().persistent().set(&user_bet_key, &bet);
        
//         // Market güncelle
//         match prediction {
//             0 => { // Up
//                 market.total_up_bets += amount;
//                 market.up_betters_count += 1;
//             },
//             1 => { // Down
//                 market.total_down_bets += amount;
//                 market.down_betters_count += 1;
//             },
//             2 => { // Stable
//                 market.total_stable_bets += amount;
//                 market.stable_betters_count += 1;
//             },
//             _ => return Err(Error::InvalidPrediction),
//         }
        
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         Ok(())
//     }

//     /// Market'ı çöz ve OTOMATİK ÖDEME YAP - Herkese ayrı ayrı
//     pub fn resolve_and_payout_market(
//         env: Env,
//         admin: Address,
//         market_id: u64,
//     ) -> Result<PayoutSummary, Error> {
//         admin.require_auth();
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let mut market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         if market.is_paid_out {
//             return Err(Error::MarketAlreadyPaidOut);
//         }
        
//         let current_price = Self::get_price(env.clone(), market.token.clone());
//         let initial_price = market.initial_price;
        
//         // Kazanan tarafı belirle
//         let price_change_percent = ((current_price - initial_price) * 10000) / initial_price;
        
//         let winning_side = if price_change_percent > market.stable_tolerance {
//             0u32 // Up
//         } else if price_change_percent < -market.stable_tolerance {
//             1u32 // Down
//         } else {
//             2u32 // Stable
//         };
        
//         market.winning_side = Some(winning_side);
//         market.final_price = Some(current_price);
//         market.is_resolved = true;
        
//         // **OTOMATİK ÖDEME SİSTEMİ**: Tüm kazananlara otomatik ödeme yap
//         let payout_summary = Self::process_payouts_improved(env.clone(), admin.clone(), market_id)?;
        
//         market.is_paid_out = true;
//         markets.set(market_id, market.clone());
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         // Otomatik yeniden başlatma
//         if market.auto_restart {
//             Self::create_market(
//                 env,
//                 admin,
//                 market.title,
//                 market.token,
//                 market.betting_token,
//                 current_price,
//                 market.stable_tolerance,
//                 market.restart_duration,
//                 true,
//                 market.house_edge,
//             )?;
//         }
        
//         Ok(payout_summary)
//     }

//     /// **ÖNEMLİ: Otomatik ödeme işlemi**
//     fn process_payouts(
//         env: Env, 
//         market_id: u64, 
//         winning_side: u32 // 0=Up, 1=Down, 2=Stable
//     ) -> Result<PayoutSummary, Error> {
//         let markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let token_client = token::Client::new(&env, &market.betting_token);
        
//         let mut total_winners = 0u32;
//         let mut total_paid_amount = 0i128;
        
//         // Tüm bahisleri kontrol et ve kazananlara ödeme yap
//         let market_counter: u64 = env.storage().persistent().get(&MARKET_COUNTER).unwrap_or(0);
        
//         for i in 1..=market_counter {
//             for j in 0..1000 { // Maksimum 1000 kullanıcı kontrolü (gas limiti için)
//                 let user_bet_key = (symbol_short!("UBET"), market_id, j);
//                 if let Some(mut user_bet) = env.storage().persistent().get::<(Symbol, u64, u64), UserBet>(&user_bet_key) {
//                     if user_bet.prediction == winning_side && !user_bet.is_paid_out {
//                         // Kazanç hesapla
//                         let winnings = (user_bet.amount * user_bet.odds_when_placed) / 1000;
                        
//                         // Token transferi - kontrat'tan kullanıcıya
//                         match token_client.try_transfer(&env.current_contract_address(), &user_bet.user, &winnings) {
//                             Ok(_) => {
//                                 user_bet.winnings = winnings;
//                                 user_bet.is_paid_out = true;
//                                 env.storage().persistent().set(&user_bet_key, &user_bet);
                                
//                                 total_winners += 1;
//                                 total_paid_amount += winnings;
//                             },
//                             Err(_) => {
//                                 return Err(Error::PaymentFailed);
//                             }
//                         }
//                     }
//                 }
//             }
//         }
        
//         // Kalan komisyonu admin'e gönder (opsiyonel)
//         // token_client.transfer(&env.current_contract_address(), &admin, &house_commission);
        
//         Ok(PayoutSummary {
//             total_winners,
//             total_paid_amount,
//             house_commission,
//             remaining_balance: total_volume - total_paid_amount - house_commission,
//         })
//     }

//     /// ADİL MANUEL ÖDEME ALMA - Pool-Based Fair Claim
//     pub fn claim_winnings(env: Env, user: Address, market_id: u64) -> Result<i128, Error> {
//         user.require_auth();
        
//         let market = Self::get_market(env.clone(), market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         if !market.is_resolved {
//             return Err(Error::MarketNotStarted);
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//         let mut user_bet: UserBet = env.storage().persistent()
//             .get(&user_bet_key)
//             .ok_or(Error::MarketNotFound)?;
        
//         if user_bet.is_paid_out {
//             return Err(Error::UserAlreadyPaidOut);
//         }
        
//         // Kazandı mı kontrol et
//         let winning_side = market.winning_side.ok_or(Error::MarketNotStarted)?;
        
//         if user_bet.prediction != winning_side {
//             return Ok(0); // Kaybetti
//         }
        
//         // **YENİ ADİL SİSTEM**: Gerçek ödeme hesaplama
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,
//             1 => market.total_down_bets,
//             2 => market.total_stable_bets,
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         if winning_pool == 0 {
//             return Ok(0);
//         }
        
//         // Adil ödeme hesaplama
//         let user_share_of_winning_pool = (user_bet.amount * 1000) / winning_pool;
//         let fair_winnings = (prize_pool * user_share_of_winning_pool) / 1000;
//         let final_winnings = fair_winnings.max(user_bet.amount); // Minimum garanti
        
//         // Token transferi
//         let token_client = token::Client::new(&env, &market.betting_token);
//         token_client.transfer(&env.current_contract_address(), &user, &final_winnings);
        
//         user_bet.winnings = final_winnings;
//         user_bet.is_paid_out = true;
//         env.storage().persistent().set(&user_bet_key, &user_bet);
        
//         Ok(final_winnings)
//     }

//     /// Gelişmiş market istatistikleri
//     pub fn get_market_stats(env: Env, market_id: u64) -> Result<MarketStats, Error> {
//         let markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let total_betters = market.up_betters_count + market.down_betters_count + market.stable_betters_count;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let (up_pct, down_pct, stable_pct) = if total_volume > 0 {
//             (
//                 (market.total_up_bets * 10000) / total_volume,
//                 (market.total_down_bets * 10000) / total_volume,
//                 (market.total_stable_bets * 10000) / total_volume,
//             )
//         } else {
//             (0, 0, 0)
//         };
        
//         Ok(MarketStats {
//             total_volume,
//             total_betters,
//             up_percentage: up_pct,
//             down_percentage: down_pct,
//             stable_percentage: stable_pct,
//             prize_pool,
//             house_commission,
//         })
//     }

//     /// ADİL KAZANÇ HESAPLAMA - Pool-Based Fair Winnings
//     /// Bu sistem kullanıcının gerçekten alacağı miktarı hesaplar
//     pub fn calculate_user_winnings(env: Env, market_id: u64, user: Address) -> i128 {
//         let market = match Self::get_market(env.clone(), market_id) {
//             Some(m) => m,
//             None => return 0,
//         };
        
//         if !market.is_resolved {
//             return 0;
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user);
//         let user_bet: UserBet = match env.storage().persistent().get(&user_bet_key) {
//             Some(bet) => bet,
//             None => return 0,
//         };
        
//         // Kazanan taraf kontrolü
//         let winning_side = match market.winning_side {
//             Some(side) => side,
//             None => return 0,
//         };
        
//         if user_bet.prediction != winning_side {
//             return 0; // Kaybetti
//         }
        
//         // **YENİ ADİL SİSTEM**: Gerçek ödeme hesaplama
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         // Kazanan pool'u belirle
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,    // Up
//             1 => market.total_down_bets,  // Down
//             2 => market.total_stable_bets, // Stable
//             _ => return 0,
//         };
        
//         if winning_pool == 0 {
//             return 0;
//         }
        
//         // Adil payout hesaplama: Kullanıcının payı kadar ödül havuzundan pay
//         // Formül: (Kullanıcının bahsi / Toplam kazanan bahisleri) * Ödül havuzu
//         let user_share_of_winning_pool = (user_bet.amount * 1000) / winning_pool; // 1000x precision
//         let fair_winnings = (prize_pool * user_share_of_winning_pool) / 1000;
        
//         // Minimum garanti: En azından yatırdığını geri alsın
//         fair_winnings.max(user_bet.amount)
//     }

//     // Diğer fonksiyonlar aynı kalıyor...
//     pub fn get_market(env: Env, market_id: u64) -> Option<Market> {
//         let markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
//         markets.get(market_id)
//     }

//     pub fn get_user_bet(env: Env, market_id: u64, user: Address) -> Option<UserBet> {
//         let user_bet_key = (symbol_short!("UBET"), market_id, user);
//         env.storage().persistent().get(&user_bet_key)
//     }

//     pub fn get_total_markets(env: Env) -> u64 {
//         env.storage().persistent().get(&MARKET_COUNTER).unwrap_or(0u64)
//     }

//     /// Aktif marketleri listele
//     pub fn get_active_markets(env: Env) -> Vec<Market> {
//         let markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
        
//         let mut active_markets = Vec::new(&env);
//         let current_time = env.ledger().timestamp();
        
//         for market in markets.values() {
//             if !market.is_resolved && 
//                market.start_time <= current_time && 
//                market.end_time > current_time {
//                 active_markets.push_back(market);
//             }
//         }
        
//         active_markets
//     }

//     /// Kontrat bakiyesi kontrolü
//     pub fn get_contract_balance(env: Env, token: Address) -> i128 {
//         let token_client = token::Client::new(&env, &token);
//         token_client.balance(&env.current_contract_address())
//     }

//     /// Test bahis koy - Token transferi olmadan (u32 prediction ile)
//     pub fn place_bet_test_u32(
//         env: Env,
//         user: Address,
//         market_id: u64,
//         amount: i128,
//         prediction: u32, // 0=Up, 1=Down, 2=Stable
//     ) -> Result<(), Error> {
//         user.require_auth();
        
//         if amount <= 0 {
//             return Err(Error::InvalidAmount);
//         }
        
//         // Prediction validation
//         if prediction > 2 {
//             return Err(Error::InvalidPrediction);
//         }
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let mut market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let current_time = env.ledger().timestamp();
        
//         if current_time < market.start_time {
//             return Err(Error::MarketNotStarted);
//         }
        
//         if current_time > market.end_time {
//             return Err(Error::MarketExpired);
//         }
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//         if env.storage().persistent().has(&user_bet_key) {
//             return Err(Error::UserAlreadyBet);
//         }
        
//         // Token transferi YOK - sadece test için
        
//         // Kullanıcıyı market kullanıcıları listesine ekle
//         let market_users_key = (MARKET_USERS, market_id);
//         let mut market_users: Vec<Address> = env.storage().persistent()
//             .get(&market_users_key).unwrap_or(Vec::new(&env));
//         market_users.push_back(user.clone());
//         env.storage().persistent().set(&market_users_key, &market_users);
        
//         // Mevcut oranları hesapla
//         let current_odds = Self::calculate_improved_odds(env.clone(), market_id)?;
//         let odds_when_placed = match prediction {
//             0 => current_odds.up_odds,    // Up
//             1 => current_odds.down_odds,  // Down
//             2 => current_odds.stable_odds, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         // Bahis kaydet
//         let bet = UserBet {
//             user: user.clone(),
//             market_id,
//             amount,
//             prediction,
//             timestamp: current_time,
//             odds_when_placed,
//             is_paid_out: false,
//             winnings: 0,
//         };
        
//         env.storage().persistent().set(&user_bet_key, &bet);
        
//         // Market güncelle
//         match prediction {
//             0 => { // Up
//                 market.total_up_bets += amount;
//                 market.up_betters_count += 1;
//             },
//             1 => { // Down
//                 market.total_down_bets += amount;
//                 market.down_betters_count += 1;
//             },
//             2 => { // Stable
//                 market.total_stable_bets += amount;
//                 market.stable_betters_count += 1;
//             },
//             _ => return Err(Error::InvalidPrediction),
//         }
        
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         Ok(())
//     }

//     /// Test bahis koy - Token transferi olmadan
//     pub fn place_bet_test(
//         env: Env,
//         user: Address,
//         market_id: u64,
//         amount: i128,
//         prediction: u32, // 0=Up, 1=Down, 2=Stable
//     ) -> Result<(), Error> {
//         user.require_auth();
        
//         if amount <= 0 {
//             return Err(Error::InvalidAmount);
//         }
        
//         // Prediction validation
//         if prediction > 2 {
//             return Err(Error::InvalidPrediction);
//         }
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
            
//         let mut market = markets.get(market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         let current_time = env.ledger().timestamp();
        
//         if current_time < market.start_time {
//             return Err(Error::MarketNotStarted);
//         }
        
//         if current_time > market.end_time {
//             return Err(Error::MarketExpired);
//         }
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//         if env.storage().persistent().has(&user_bet_key) {
//             return Err(Error::UserAlreadyBet);
//         }
        
//         // Token transferi YOK - sadece test için
        
//         // Kullanıcıyı market kullanıcıları listesine ekle
//         let market_users_key = (MARKET_USERS, market_id);
//         let mut market_users: Vec<Address> = env.storage().persistent()
//             .get(&market_users_key).unwrap_or(Vec::new(&env));
//         market_users.push_back(user.clone());
//         env.storage().persistent().set(&market_users_key, &market_users);
        
//         // Mevcut oranları hesapla
//         let current_odds = Self::calculate_improved_odds(env.clone(), market_id)?;
//         let odds_when_placed = match prediction {
//             0 => current_odds.up_odds,    // Up
//             1 => current_odds.down_odds,  // Down
//             2 => current_odds.stable_odds, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         // Bahis kaydet
//         let bet = UserBet {
//             user: user.clone(),
//             market_id,
//             amount,
//             prediction,
//             timestamp: current_time,
//             odds_when_placed,
//             is_paid_out: false,
//             winnings: 0,
//         };
        
//         env.storage().persistent().set(&user_bet_key, &bet);
        
//         // Market güncelle
//         match prediction {
//             0 => { // Up
//                 market.total_up_bets += amount;
//                 market.up_betters_count += 1;
//             },
//             1 => { // Down
//                 market.total_down_bets += amount;
//                 market.down_betters_count += 1;
//             },
//             2 => { // Stable
//                 market.total_stable_bets += amount;
//                 market.stable_betters_count += 1;
//             },
//             _ => return Err(Error::InvalidPrediction),
//         }
        
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         Ok(())
//     }

//     /// Manuel test için market çözme fonksiyonu + OTOMATİK ÖDEME
//     pub fn resolve_market_manual(env: Env, admin: Address, market_id: u64, final_price: i128) -> Result<u32, Error> {
//         admin.require_auth();
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
        
//         let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         market.final_price = Some(final_price);
        
//         // Kazanan tarafı belirle
//         let winning_side = if final_price > market.target_price + market.stable_tolerance {
//             0u32 // Up
//         } else if final_price < market.target_price - market.stable_tolerance {
//             1u32 // Down
//         } else {
//             2u32 // Stable
//         };
        
//         market.winning_side = Some(winning_side);
//         market.is_resolved = true;
        
//         markets.set(market_id, market.clone());
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         // **OTOMATİK ÖDEME SİSTEMİ**: Market çözüldükten hemen sonra tüm kazananlara ödeme yap
//         match Self::auto_transfer_winnings(env.clone(), market_id, winning_side) {
//             Ok(_) => {
//                 // Ödeme başarılı - market'ı paid_out olarak işaretle
//                 let mut updated_markets: Map<u64, Market> = env.storage().persistent()
//                     .get(&MARKETS).unwrap_or(Map::new(&env));
//                 if let Some(mut updated_market) = updated_markets.get(market_id) {
//                     updated_market.is_paid_out = true;
//                     updated_markets.set(market_id, updated_market);
//                     env.storage().persistent().set(&MARKETS, &updated_markets);
//                 }
//             },
//             Err(_) => {
//                 // Ödeme başarısız olsa bile market çözüldü, manuel claim edilebilir
//             }
//         }
        
//         Ok(winning_side)
//     }

//     /// Manuel market çözme (sadece resolve, ödeme yok)
//     pub fn resolve_market_manual_only(env: Env, admin: Address, market_id: u64, final_price: i128) -> Result<u32, Error> {
//         admin.require_auth();
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
        
//         let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
        
//         if market.is_resolved {
//             return Err(Error::MarketAlreadyResolved);
//         }
        
//         market.final_price = Some(final_price);
        
//         // Kazanan tarafı belirle
//         let winning_side = if final_price > market.target_price + market.stable_tolerance {
//             0u32 // Up
//         } else if final_price < market.target_price - market.stable_tolerance {
//             1u32 // Down
//         } else {
//             2u32 // Stable
//         };
        
//         market.winning_side = Some(winning_side);
//         market.is_resolved = true;
        
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         Ok(winning_side)
//     }

//     /// Düzeltilmiş payout hesaplaması
//     pub fn process_payouts_manual(env: Env, admin: Address, market_id: u64) -> Result<PayoutSummary, Error> {
//         admin.require_auth();
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
        
//         let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
        
//         if !market.is_resolved {
//             return Err(Error::MarketNotStarted);
//         }
        
//         if market.is_paid_out {
//             return Err(Error::MarketAlreadyPaidOut);
//         }
        
//         let winning_side = market.winning_side.as_ref().ok_or(Error::MarketNotStarted)?;
        
//         // Düzeltilmiş payout hesaplaması
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool_after_commission = total_volume - house_commission;
        
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,    // Up
//             1 => market.total_down_bets,  // Down
//             2 => market.total_stable_bets, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         let winning_count = match winning_side {
//             0 => market.up_betters_count,    // Up
//             1 => market.down_betters_count,  // Down
//             2 => market.stable_betters_count, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         let total_actual_payouts = if winning_count > 0 && winning_pool > 0 {
//             // Effective multiplier ile toplam gerçek ödeme hesapla
//             let effective_multiplier = (prize_pool_after_commission * 1000) / winning_pool;
//             (winning_pool * effective_multiplier) / 1000
//         } else {
//             0
//         };
        
//         market.is_paid_out = true;
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         Ok(PayoutSummary {
//             total_winners: winning_count,
//             total_paid_amount: total_actual_payouts,
//             house_commission,
//             remaining_balance: prize_pool_after_commission - total_actual_payouts,
//         })
//     }

//     /// ADİL TEST ÖDEME ALMA - Pool-Based Fair Test Claim  
//     pub fn claim_winnings_test(env: Env, user: Address, market_id: u64) -> Result<i128, Error> {
//         user.require_auth();
        
//         let market = Self::get_market(env.clone(), market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         if !market.is_resolved {
//             return Err(Error::MarketNotStarted);
//         }
        
//         let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//         let mut user_bet: UserBet = env.storage().persistent()
//             .get(&user_bet_key)
//             .ok_or(Error::MarketNotFound)?;
        
//         if user_bet.is_paid_out {
//             return Err(Error::UserAlreadyPaidOut);
//         }
        
//         // Kazandı mı kontrol et
//         let winning_side = market.winning_side.ok_or(Error::MarketNotStarted)?;
        
//         if user_bet.prediction != winning_side {
//             return Ok(0); // Kaybetti
//         }
        
//         // **YENİ ADİL SİSTEM**: Gerçek ödeme hesaplama
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,
//             1 => market.total_down_bets,
//             2 => market.total_stable_bets,
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         if winning_pool == 0 {
//             return Ok(0);
//         }
        
//         // Adil ödeme hesaplama
//         let user_share_of_winning_pool = (user_bet.amount * 1000) / winning_pool;
//         let fair_winnings = (prize_pool * user_share_of_winning_pool) / 1000;
//         let final_winnings = fair_winnings.max(user_bet.amount); // Minimum garanti
        
//         // Token transferi YOK - sadece test için
//         user_bet.winnings = final_winnings;
//         user_bet.is_paid_out = true;
//         env.storage().persistent().set(&user_bet_key, &user_bet);
        
//         Ok(final_winnings)
//     }

//     /// OTOMATİK ADİL ÖDEME SİSTEMİ - Gerçek token transferi ile
//     /// Bu fonksiyon market çözüldükten sonra otomatik olarak tüm kazananlara ödeme yapar
//     pub fn process_payouts_improved(env: Env, _admin: Address, market_id: u64) -> Result<PayoutSummary, Error> {
//         // Auth check kaldırıldı - çünkü bu fonksiyon resolve_market_manual içinden çağrılıyor
        
//         let mut markets: Map<u64, Market> = env.storage().persistent()
//             .get(&MARKETS).unwrap_or(Map::new(&env));
        
//         let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
        
//         if !market.is_resolved {
//             return Err(Error::MarketNotStarted);
//         }
        
//         if market.is_paid_out {
//             return Err(Error::MarketAlreadyPaidOut);
//         }
        
//         let winning_side = market.winning_side.ok_or(Error::MarketNotStarted)?;
        
//         // **ADİL SİSTEM**: Komisyon sonrası ödül havuzu hesaplama
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,    // Up
//             1 => market.total_down_bets,  // Down
//             2 => market.total_stable_bets, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         let winning_count = match winning_side {
//             0 => market.up_betters_count,    // Up
//             1 => market.down_betters_count,  // Down
//             2 => market.stable_betters_count, // Stable
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         let mut total_actual_payouts = 0i128;
//         let mut actual_winners = 0u32;
        
//         if winning_count > 0 && winning_pool > 0 {
//             // Market kullanıcıları listesini al
//             let market_users_key = (MARKET_USERS, market_id);
//             let market_users: Vec<Address> = env.storage().persistent()
//                 .get(&market_users_key).unwrap_or(Vec::new(&env));
            
//             // Token client
//             let token_client = token::Client::new(&env, &market.betting_token);
            
//             // **ADİL ÖDEME**: Her kazanan kullanıcıya payı kadar ödeme yap
//             for user in market_users.iter() {
//                 let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//                 if let Some(mut user_bet) = env.storage().persistent().get::<(Symbol, u64, Address), UserBet>(&user_bet_key) {
//                     if user_bet.prediction == winning_side && !user_bet.is_paid_out {
//                         // Adil ödeme hesaplama
//                         let user_share_of_winning_pool = (user_bet.amount * 1000) / winning_pool;
//                         let fair_winnings = (prize_pool * user_share_of_winning_pool) / 1000;
//                         let final_winnings = fair_winnings.max(user_bet.amount); // Minimum garanti
                        
//                         // Token transferi yap
//                         match token_client.try_transfer(&env.current_contract_address(), &user, &final_winnings) {
//                             Ok(_) => {
//                                 user_bet.winnings = final_winnings;
//                                 user_bet.is_paid_out = true;
//                                 env.storage().persistent().set(&user_bet_key, &user_bet);
                                
//                                 total_actual_payouts += final_winnings;
//                                 actual_winners += 1;
                                
//                                 // Event yayınla
//                                 env.events().publish(
//                                     (symbol_short!("PAYOUT"),), 
//                                     (user.clone(), final_winnings)
//                                 );
//                             },
//                             Err(_) => {
//                                 // Token transfer başarısız - log et ama devam et
//                                 env.events().publish(
//                                     (symbol_short!("PAY_FAIL"),), 
//                                     (user.clone(), final_winnings)
//                                 );
//                                 continue;
//                             }
//                         }
//                     }
//                 }
//             }
//         }
        
//         market.is_paid_out = true;
//         markets.set(market_id, market);
//         env.storage().persistent().set(&MARKETS, &markets);
        
//         // Summary event
//         env.events().publish(
//             (symbol_short!("PAY_DONE"),), 
//             (market_id, actual_winners, total_actual_payouts)
//         );
        
//         Ok(PayoutSummary {
//             total_winners: actual_winners,
//             total_paid_amount: total_actual_payouts,
//             house_commission,
//             remaining_balance: total_volume - total_actual_payouts - house_commission,
//         })
//     }

//     /// Test için otomatik payout (token transfer olmadan)
//     // pub fn process_payouts_improved_test(env: Env, admin: Address, market_id: u64) -> Result<PayoutSummary, Error> {
//     //     admin.require_auth();
        
//     //     let mut markets: Map<u64, Market> = env.storage().persistent()
//     //         .get(&MARKETS).unwrap_or(Map::new(&env));
        
//     //     let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
        
//     //     if !market.is_resolved {
//     //         return Err(Error::MarketNotStarted);
//     //     }
        
//     //     if market.is_paid_out {
//     //         return Err(Error::MarketAlreadyPaidOut);
//     //     }
        
//     //     let winning_side = market.winning_side.as_ref().ok_or(Error::MarketNotStarted)?;
        
//     //     // Hesaplamalar
//     //     let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//     //     let house_commission = (total_volume * market.house_edge) / 10000;
//     //     let prize_pool_after_commission = total_volume - house_commission;
        
//     //     let winning_pool = match winning_side {
//     //         PredictionType::Up => market.total_up_bets,
//     //         PredictionType::Down => market.total_down_bets,
//     //         PredictionType::Stable => market.total_stable_bets,
//     //     };
        
//     //     let winning_count = match winning_side {
//     //         PredictionType::Up => market.up_betters_count,
//     //         PredictionType::Down => market.down_betters_count,
//     //         PredictionType::Stable => market.stable_betters_count,
//     //     };
        
//     //     let mut total_actual_payouts = 0i128;
//     //     let mut actual_winners = 0u32;
        
//     //     if winning_count > 0 && winning_pool > 0 {
//     //         let effective_multiplier = (prize_pool_after_commission * 1000) / winning_pool;
            
//     //         // Market kullanıcıları listesini al
//     //         let market_users_key = (MARKET_USERS, market_id);
//     //         let market_users: Vec<Address> = env.storage().persistent()
//     //             .get(&market_users_key).unwrap_or(Vec::new(&env));
            
//     //         // Her kullanıcıyı kontrol et
//     //         for user in market_users.iter() {
//     //             let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//     //             if let Some(mut user_bet) = env.storage().persistent().get::<(Symbol, u64, Address), UserBet>(&user_bet_key) {
//     //                 if user_bet.prediction == *winning_side && !user_bet.is_paid_out {
//     //                     let winnings = (user_bet.amount * effective_multiplier) / 1000;
                        
//     //                     // Token transferi YOK - sadece test için
//     //                     user_bet.winnings = winnings;
//     //                     user_bet.is_paid_out = true;
//     //                     env.storage().persistent().set(&user_bet_key, &user_bet);
                        
//     //                     total_actual_payouts += winnings;
//     //                     actual_winners += 1;
//     //                 }
//     //             }
//     //         }
//     //     }
        
//     //     market.is_paid_out = true;
//     //     markets.set(market_id, market);
//     //     env.storage().persistent().set(&MARKETS, &markets);
        
//     //     Ok(PayoutSummary {
//     //         total_winners: actual_winners,
//     //         total_paid_amount: total_actual_payouts,
//     //         house_commission,
//     //         remaining_balance: prize_pool_after_commission - total_actual_payouts,
//     //     })
//     // }

//     /// Test için otomatik payout (token transfer olmadan) - DÜZELTİLMİŞ
// pub fn process_payouts_improved_test(env: Env, admin: Address, market_id: u64) -> Result<PayoutSummary, Error> {
//     admin.require_auth();
    
//     let mut markets: Map<u64, Market> = env.storage().persistent()
//         .get(&MARKETS).unwrap_or(Map::new(&env));
    
//     let mut market = markets.get(market_id).ok_or(Error::MarketNotFound)?;
    
//     if !market.is_resolved {
//         return Err(Error::MarketNotStarted);
//     }
    
//     if market.is_paid_out {
//         return Err(Error::MarketAlreadyPaidOut);
//     }
    
//     let winning_side = market.winning_side.as_ref().ok_or(Error::MarketNotStarted)?;
    
//     // Hesaplamalar
//     let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//     let house_commission = (total_volume * market.house_edge) / 10000;
//     let prize_pool_after_commission = total_volume - house_commission;
    
//     let winning_pool = match winning_side {
//         0 => market.total_up_bets,    // Up
//         1 => market.total_down_bets,  // Down
//         2 => market.total_stable_bets, // Stable
//         _ => return Err(Error::InvalidPrediction),
//     };
    
//     let winning_count = match winning_side {
//         0 => market.up_betters_count,    // Up
//         1 => market.down_betters_count,  // Down
//         2 => market.stable_betters_count, // Stable
//         _ => return Err(Error::InvalidPrediction),
//     };
    
//     let mut total_actual_payouts = 0i128;
//     let mut actual_winners = 0u32;
    
//     if winning_count > 0 && winning_pool > 0 {
//         let effective_multiplier = (prize_pool_after_commission * 1000) / winning_pool;
        
//         // Market kullanıcıları listesini al
//         let market_users_key = (MARKET_USERS, market_id);
//         let market_users: Vec<Address> = env.storage().persistent()
//             .get(&market_users_key).unwrap_or(Vec::new(&env));
        
//         // Her kullanıcıyı kontrol et
//         for user in market_users.iter() {
//             let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//             if let Some(mut user_bet) = env.storage().persistent().get::<(Symbol, u64, Address), UserBet>(&user_bet_key) {
//                 if user_bet.prediction == *winning_side && !user_bet.is_paid_out {
//                     let winnings = (user_bet.amount * effective_multiplier) / 1000;
                    
//                     // Token transferi YOK - sadece test için
//                     user_bet.winnings = winnings;
//                     user_bet.is_paid_out = true;
//                     env.storage().persistent().set(&user_bet_key, &user_bet);
                    
//                     total_actual_payouts += winnings;
//                     actual_winners += 1;
//                 }
//             }
//         }
//     }
    
//     market.is_paid_out = true;
//     markets.set(market_id, market);
//     env.storage().persistent().set(&MARKETS, &markets);
    
//     // DÜZELTİLMİŞ KISIM: Doğru remaining_balance hesaplaması
//     let remaining_balance = total_volume - total_actual_payouts - house_commission;
    
//     // Debug için - isteğe bağlı
//     env.events().publish(
//         (symbol_short!("PAYOUT"),), 
//         (
//             symbol_short!("total_vol"), total_volume,
//             symbol_short!("paid"), total_actual_payouts,
//             symbol_short!("comm"), house_commission,
//             symbol_short!("remain"), remaining_balance
//         )
//     );
    
//     Ok(PayoutSummary {
//         total_winners: actual_winners,
//         total_paid_amount: total_actual_payouts,
//         house_commission,
//         remaining_balance, // Artık doğru hesaplanıyor
//     })
// }

//     /// OTOMATİK TRANSFER SİSTEMİ - claim_winnings mantığıyla tüm kazananlara otomatik ödeme
//     /// Bu fonksiyon market çözüldükten sonra otomatik olarak tüm kazananlara claim_winnings mantığıyla ödeme yapar
//     pub fn auto_transfer_winnings(env: Env, market_id: u64, winning_side: u32) -> Result<PayoutSummary, Error> {
//         let market = Self::get_market(env.clone(), market_id)
//             .ok_or(Error::MarketNotFound)?;
        
//         if !market.is_resolved {
//             return Err(Error::MarketNotStarted);
//         }
        
//         // **ADİL SİSTEM**: claim_winnings ile aynı hesaplama
//         let total_volume = market.total_up_bets + market.total_down_bets + market.total_stable_bets;
//         let house_commission = (total_volume * market.house_edge) / 10000;
//         let prize_pool = total_volume - house_commission;
        
//         let winning_pool = match winning_side {
//             0 => market.total_up_bets,
//             1 => market.total_down_bets,
//             2 => market.total_stable_bets,
//             _ => return Err(Error::InvalidPrediction),
//         };
        
//         if winning_pool == 0 {
//             return Ok(PayoutSummary {
//                 total_winners: 0,
//                 total_paid_amount: 0,
//                 house_commission,
//                 remaining_balance: total_volume - house_commission,
//             });
//         }
        
//         let mut total_actual_payouts = 0i128;
//         let mut actual_winners = 0u32;
        
//         // Market kullanıcıları listesini al
//         let market_users_key = (MARKET_USERS, market_id);
//         let market_users: Vec<Address> = env.storage().persistent()
//             .get(&market_users_key).unwrap_or(Vec::new(&env));
        
//         // Token client
//         let token_client = token::Client::new(&env, &market.betting_token);
        
//         // **ADİL TRANSFER**: Her kazanan kullanıcıya claim_winnings mantığıyla ödeme yap
//         for user in market_users.iter() {
//             let user_bet_key = (symbol_short!("UBET"), market_id, user.clone());
//             if let Some(mut user_bet) = env.storage().persistent().get::<(Symbol, u64, Address), UserBet>(&user_bet_key) {
//                 if user_bet.prediction == winning_side && !user_bet.is_paid_out {
//                     // claim_winnings ile aynı hesaplama
//                     let user_share_of_winning_pool = (user_bet.amount * 1000) / winning_pool;
//                     let fair_winnings = (prize_pool * user_share_of_winning_pool) / 1000;
//                     let final_winnings = fair_winnings.max(user_bet.amount); // Minimum garanti
                    
//                     // Token transferi yap
//                     match token_client.try_transfer(&env.current_contract_address(), &user, &final_winnings) {
//                         Ok(_) => {
//                             user_bet.winnings = final_winnings;
//                             user_bet.is_paid_out = true;
//                             env.storage().persistent().set(&user_bet_key, &user_bet);
                            
//                             total_actual_payouts += final_winnings;
//                             actual_winners += 1;
                            
//                             // Başarı event'i
//                             env.events().publish(
//                                 (symbol_short!("AUTO_PAY"),), 
//                                 (user.clone(), final_winnings)
//                             );
//                         },
//                         Err(_) => {
//                             // Token transfer başarısız - log et ama devam et
//                             env.events().publish(
//                                 (symbol_short!("AUTO_FAIL"),), 
//                                 (user.clone(), final_winnings)
//                             );
//                             continue;
//                         }
//                     }
//                 }
//             }
//         }
        
//         // Summary event
//         env.events().publish(
//             (symbol_short!("AUTO_DONE"),), 
//             (market_id, actual_winners, total_actual_payouts)
//         );
        
//         Ok(PayoutSummary {
//             total_winners: actual_winners,
//             total_paid_amount: total_actual_payouts,
//             house_commission,
//             remaining_balance: total_volume - total_actual_payouts - house_commission,
//         })
//     }
// }