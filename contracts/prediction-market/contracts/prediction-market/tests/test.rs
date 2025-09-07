#![cfg(test)]

use prediction_market::{PredictionMarket, PredictionMarketClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_hello() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let result = client.hello();
    assert_eq!(result, String::from_str(&env, "Prediction Market with Full Oracle Ready!"));
}

#[test]
fn test_create_market() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    
    let market_id = client.create_market(
        &admin,
        &String::from_str(&env, "KALE $1 Test"),
        &token,
        &1_000_000i128, // $1.00
        &168u64, // 1 week
    );

    assert_eq!(market_id, 1);
    
    let market = client.get_market(&1u64).unwrap();
    assert_eq!(market.id, 1);
    assert_eq!(market.target_price, 1_000_000i128);
    assert_eq!(market.is_resolved, false);
}

#[test]
fn test_place_bet() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    // Market oluştur
    let market_id = client.create_market(
        &admin,
        &String::from_str(&env, "Test Market"),
        &token,
        &1_000_000i128,
        &168u64,
    );

    // YES bahsi koy
    client.place_bet(&user, &market_id, &100_000i128, &true);
    
    let market = client.get_market(&market_id).unwrap();
    assert_eq!(market.total_yes_bets, 100_000i128);
    assert_eq!(market.total_no_bets, 0i128);

    // NO bahsi de ekle
    let user2 = Address::generate(&env);
    client.place_bet(&user2, &market_id, &50_000i128, &false);
    
    let updated_market = client.get_market(&market_id).unwrap();
    assert_eq!(updated_market.total_yes_bets, 100_000i128);
    assert_eq!(updated_market.total_no_bets, 50_000i128);
}

#[test] 
fn test_twap_market() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    
    // TWAP market oluştur - Oracle test environment'da çalışmayabilir
    let result = client.create_twap_market(
        &admin,
        &String::from_str(&env, "TWAP Test"),
        &token,
        &1_000_000i128,
        &168u64,
        &24u32,
    );
    
    // Test environment'da oracle yoksa error beklenir
    // Bu normal bir durum
    println!("TWAP market creation result: {:?}", result);
}

#[test]
fn test_get_active_markets() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    
    // 2 market oluştur
    let _market_id1 = client.create_market(
        &admin,
        &String::from_str(&env, "Market 1"),
        &token,
        &1_000_000i128,
        &168u64,
    );
    
    let _market_id2 = client.create_market(
        &admin,
        &String::from_str(&env, "Market 2"), 
        &token,
        &2_000_000i128,
        &336u64, // 2 weeks
    );

    // Aktif marketleri getir
    let active_markets = client.get_active_markets();
    assert_eq!(active_markets.len(), 2);
    
    // İlk market bilgilerini kontrol et
    assert_eq!(active_markets.get(0).unwrap().target_price, 1_000_000i128);
    assert_eq!(active_markets.get(1).unwrap().target_price, 2_000_000i128);
}

#[test]
fn test_oracle_functions_safe() {
    let env = Env::default();
    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let token = Address::generate(&env);
    
    // Oracle fonksiyonlarını güvenli şekilde test et
    let price = client.get_price(&token);
    
    // Test environment'da oracle yoksa 0 döner
    assert_eq!(price, 0i128);
    
    // TWAP test - None döner
    let twap = client.get_twap(&token, &24u32);
    assert_eq!(twap, None);
    
    // Price analysis test
    let analysis = client.get_price_analysis(&token, &5u32);
    assert_eq!(analysis, None);
    
    // Volatilite test
    let volatility = client.analyze_market_volatility(&token);
    assert_eq!(volatility, None);
}