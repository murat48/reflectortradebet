
use soroban_sdk::{Address, Env, Vec, String, symbol_short};
use crate::{types::TrailingOrder, errors::ContractError};

const ADMIN_KEY: &str = "ADMIN";
const ORACLE_KEY: &str = "ORACLE";
const ORDER_COUNTER_KEY: &str = "ORDER_COUNTER";
const PAUSED_KEY: &str = "PAUSED";
const EMERGENCY_COMMISSION_KEY: &str = "EMERGENCY_COMMISSION";

// Admin functions
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&String::from_str(env, ADMIN_KEY), admin);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&String::from_str(env, ADMIN_KEY))
}

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&String::from_str(env, ADMIN_KEY))
}

pub fn require_admin(env: &Env) -> Result<(), ContractError> {
    let admin = get_admin(env).ok_or(ContractError::NotInitialized)?;
    admin.require_auth();
    Ok(())
}

// Oracle functions
pub fn set_oracle_address(env: &Env, oracle: &Address) {
    env.storage().instance().set(&String::from_str(env, ORACLE_KEY), oracle);
}

pub fn get_oracle_address(env: &Env) -> Address {
    env.storage().instance().get(&String::from_str(env, ORACLE_KEY))
        .expect("Oracle not set")
}

// Order counter
pub fn get_order_counter(env: &Env) -> u64 {
    env.storage().instance().get(&String::from_str(env, ORDER_COUNTER_KEY)).unwrap_or(0)
}

pub fn set_order_counter(env: &Env, counter: u64) {
    env.storage().instance().set(&String::from_str(env, ORDER_COUNTER_KEY), &counter);
}

pub fn get_next_order_id(env: &Env) -> u64 {
    let current = get_order_counter(env);
    let next = current + 1;
    set_order_counter(env, next);
    next
}

// Contract state
pub fn set_contract_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&String::from_str(env, PAUSED_KEY), &paused);
}

pub fn is_contract_paused(env: &Env) -> bool {
    env.storage().instance().get(&String::from_str(env, PAUSED_KEY)).unwrap_or(false)
}

// Order storage
pub fn set_order(env: &Env, order_id: u64, order: &TrailingOrder) {
    env.storage().persistent().set(&(symbol_short!("ORDER"), order_id), order);
}

pub fn get_order(env: &Env, order_id: u64) -> Option<TrailingOrder> {
    env.storage().persistent().get(&(symbol_short!("ORDER"), order_id))
}

// User orders
pub fn add_user_order(env: &Env, user: &Address, order_id: u64) {
    let mut orders: Vec<u64> = env.storage().persistent().get(&(symbol_short!("U_ORD"), user)).unwrap_or(Vec::new(env));
    orders.push_back(order_id);
    env.storage().persistent().set(&(symbol_short!("U_ORD"), user), &orders);
}

pub fn get_user_orders_storage(env: &Env, user: &Address) -> Vec<u64> {
    env.storage().persistent().get(&(symbol_short!("U_ORD"), user)).unwrap_or(Vec::new(env))
}

// Active orders
pub fn add_active_order(env: &Env, order_id: u64) {
    let mut active_orders: Vec<u64> = env.storage().instance().get(&String::from_str(env, "ACTIVE_ORDERS"))
        .unwrap_or(Vec::new(env));
    active_orders.push_back(order_id);
    env.storage().instance().set(&String::from_str(env, "ACTIVE_ORDERS"), &active_orders);
}

pub fn remove_active_order(env: &Env, order_id: u64) {
    let active_orders: Vec<u64> = env.storage().instance().get(&String::from_str(env, "ACTIVE_ORDERS"))
        .unwrap_or(Vec::new(env));
    
    // Find and remove the order
    let mut new_orders = Vec::new(env);
    for i in 0..active_orders.len() {
        let existing_id = active_orders.get(i).unwrap();
        if existing_id != order_id {
            new_orders.push_back(existing_id);
        }
    }
    
    env.storage().instance().set(&String::from_str(env, "ACTIVE_ORDERS"), &new_orders);
}

pub fn get_active_orders(env: &Env) -> Vec<u64> {
    env.storage().instance().get(&String::from_str(env, "ACTIVE_ORDERS")).unwrap_or(Vec::new(env))
}

// Emergency sell commission functions
pub fn set_emergency_commission_rate(env: &Env, rate: u32) {
    env.storage().instance().set(&String::from_str(env, EMERGENCY_COMMISSION_KEY), &rate);
}

pub fn get_emergency_commission_rate(env: &Env) -> u32 {
    env.storage().instance().get(&String::from_str(env, EMERGENCY_COMMISSION_KEY)).unwrap_or(0)
}
