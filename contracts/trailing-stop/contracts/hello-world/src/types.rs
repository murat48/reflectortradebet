use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrailingOrder {
    pub id: u64,
    pub user: Address,
    pub asset: Address,
    pub token: Address,             // Token contract address for transfers
    pub amount: i128,
    pub trail_percentage: u32,      // Basis points (1000 = 10%)
    pub initial_price: i128,        // Price when order was created
    pub highest_price: i128,        // Highest price seen since creation
    pub current_stop_price: i128,   // Current trailing stop level
    pub status: OrderStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub executed_at: Option<u64>,
    pub execution_price: Option<i128>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderStatus {
    Active,
    Executed,
    Cancelled,
    Paused,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
    pub confidence: u32,
}
