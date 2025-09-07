
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // Initialization errors
    AlreadyInitialized = 1,
    NotInitialized = 2,
    
    // Authentication errors
    Unauthorized = 10,
    
    // Order errors
    OrderNotFound = 20,
    OrderNotActive = 21,
    InvalidAmount = 22,
    InvalidTrailPercentage = 23,
    InsufficientBalance = 24,
    
    // Oracle errors
    PriceNotAvailable = 30,
    StalePrice = 31,
    
    // Contract state errors
    ContractPaused = 40,
    
    // General errors
    InternalError = 99,
}
