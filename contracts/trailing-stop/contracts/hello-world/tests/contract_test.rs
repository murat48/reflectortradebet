#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};
use trailing_stop_loss::{TrailingStopContract, TrailingStopContractClient};

#[test]
fn test_contract_initialization() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TrailingStopContract);
    let client = TrailingStopContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    
    client.initialize(&admin, &oracle);
    
    // Test that contract is initialized
    assert_eq!(client.get_total_orders(), 0);
}

#[test]
fn test_order_creation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TrailingStopContract);
    let client = TrailingStopContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let user = Address::generate(&env);
    let asset = Address::generate(&env);
    
    // Initialize contract
    client.initialize(&admin, &oracle);
    
    // Create order
    let order_id = client.create_order(&user, &asset, &1000, &1000); // 10% trail
    
    assert_eq!(order_id, 1);
    assert_eq!(client.get_total_orders(), 1);
}
