
use soroban_sdk::{
    contract, contractimpl, Address, Env, Vec,
    token::TokenClient, log
};
use crate::{
    types::{TrailingOrder, OrderStatus},
    oracle::OracleClient,
    storage::*,
    errors::ContractError
};

#[contract]
pub struct TrailingStopContract;

#[contractimpl]
impl TrailingStopContract {
    
    /// Initialize the contract with oracle address
    pub fn initialize(env: Env, admin: Address, oracle_address: Address) -> Result<(), ContractError> {
        if has_admin(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        
        set_admin(&env, &admin);
        set_oracle_address(&env, &oracle_address);
        set_order_counter(&env, 0);
        
        log!(&env, "Contract initialized with admin: {} and oracle: {}", admin, oracle_address);
        Ok(())
    }
    
    /// Create a new trailing stop-loss order
    pub fn create_order(
        env: Env,
        user: Address,
        asset: Address,
        token: Address,        // Token contract address for transfers
        amount: i128,
        trail_percentage: u32  // Basis points (e.g., 1000 = 10%)
    ) -> Result<u64, ContractError> {
        // Validate inputs
        user.require_auth();
        
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        
        if trail_percentage == 0 || trail_percentage > 5000 { // Max 50%
            return Err(ContractError::InvalidTrailPercentage);
        }
        
        // Calculate commission (2% fee)
        let commission_rate = 200; // 2% in basis points
        let commission = (amount * commission_rate) / 10000;
        let net_amount = amount - commission;
        
        // Transfer full amount to contract (commission stays in contract as liquidity)
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);
        
        // Get current price from oracle
        let oracle_client = OracleClient::new(&env, &get_oracle_address(&env));
        let current_price = oracle_client.get_price(&asset)
            .ok_or(ContractError::PriceNotAvailable)?;
        
        // Calculate initial stop price
        let trail_amount = (current_price * trail_percentage as i128) / 10000;
        let initial_stop_price = current_price - trail_amount;
        
        // Generate order ID
        let order_id = get_next_order_id(&env);
        
        // Create order with net amount (after commission)
        let order = TrailingOrder {
            id: order_id,
            user: user.clone(),
            asset: asset.clone(),
            token: token.clone(),
            amount: net_amount, // Store net amount after commission
            trail_percentage,
            initial_price: current_price,
            highest_price: current_price,
            current_stop_price: initial_stop_price,
            status: OrderStatus::Active,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
            executed_at: None,
            execution_price: None,
        };
        
        // Store order
        set_order(&env, order_id, &order);
        add_user_order(&env, &user, order_id);
        add_active_order(&env, order_id);
        
        log!(&env, "Order {} created for user {} - Asset: {}, Token: {}, Gross: {}, Commission: {}, Net: {}, Trail: {}bp", 
             order_id, user, asset, token, amount, commission, net_amount, trail_percentage);
        
        Ok(order_id)
    }
    
    /// Emergency sell - immediately execute order at current market price (user can trigger)
    pub fn emergency_sell_order(env: Env, user: Address, order_id: u64) -> Result<(), ContractError> {
        user.require_auth();
        
        let mut order = get_order(&env, order_id)
            .ok_or(ContractError::OrderNotFound)?;
        
        // Verify ownership
        if order.user != user {
            return Err(ContractError::Unauthorized);
        }
        
        // Can only emergency sell active orders
        if order.status != OrderStatus::Active {
            return Err(ContractError::OrderNotActive);
        }
        
        // Get current market price
        let oracle_client = OracleClient::new(&env, &get_oracle_address(&env));
        let current_price = oracle_client.get_price(&order.asset)
            .ok_or(ContractError::PriceNotAvailable)?;
        
        // Execute order immediately at current market price with commission calculation
        match Self::execute_emergency_order_internal(&env, &mut order, current_price) {
            Ok(_) => {
                set_order(&env, order_id, &order);
                log!(&env, "Emergency sell executed for order {} at price {}", order_id, current_price);
                Ok(())
            }
            Err(e) => {
                log!(&env, "Failed to execute emergency sell for order {}: {:?}", order_id, e);
                Err(e)
            }
        }
    }

    /// Cancel an active order
    pub fn cancel_order(env: Env, user: Address, order_id: u64) -> Result<(), ContractError> {
        user.require_auth();
        
        let mut order = get_order(&env, order_id)
            .ok_or(ContractError::OrderNotFound)?;
        
        // Verify ownership
        if order.user != user {
            return Err(ContractError::Unauthorized);
        }
        
        // Can only cancel active orders
        if order.status != OrderStatus::Active {
            return Err(ContractError::OrderNotActive);
        }
        
        // Update order status
        order.status = OrderStatus::Cancelled;
        order.updated_at = env.ledger().timestamp();
        
        // Return tokens to user (REAL TRANSFER)
        let token_client = TokenClient::new(&env, &order.token);
        token_client.transfer(&env.current_contract_address(), &user, &order.amount);
        
        // Update storage
        set_order(&env, order_id, &order);
        remove_active_order(&env, order_id);
        
        log!(&env, "Order {} cancelled by user {}", order_id, user);
        Ok(())
    }
    
    /// Check all active orders and execute if needed
    pub fn check_and_execute_orders(env: Env) -> Vec<u64> {
        let active_orders = get_active_orders(&env);
        let mut executed_orders = Vec::new(&env);
        
        // Get oracle client
        let oracle_address = get_oracle_address(&env);
        let oracle_client = OracleClient::new(&env, &oracle_address);
        
        for i in 0..active_orders.len() {
            let order_id = active_orders.get(i).unwrap();
            
            if let Some(mut order) = get_order(&env, order_id) {
                // Get current price
                if let Some(current_price) = oracle_client.get_price(&order.asset) {
                    
                    // Check if price increased (update trailing stop)
                    if current_price > order.highest_price {
                        order.highest_price = current_price;
                        
                        // Calculate new stop price
                        let trail_amount = (current_price * order.trail_percentage as i128) / 10000;
                        let new_stop_price = current_price - trail_amount;
                        
                        // Only update if new stop is higher
                        if new_stop_price > order.current_stop_price {
                            order.current_stop_price = new_stop_price;
                            order.updated_at = env.ledger().timestamp();
                            
                            log!(&env, "Order {} stop updated to {}", order_id, new_stop_price);
                        }
                    }
                    
                    // Check if stop price hit (execute order)
                    if current_price <= order.current_stop_price {
                        // Execute the order
                        match Self::execute_order_internal(&env, &mut order, current_price) {
                            Ok(_) => {
                                executed_orders.push_back(order_id);
                                log!(&env, "Order {} executed at price {}", order_id, current_price);
                            }
                            Err(e) => {
                                log!(&env, "Failed to execute order {}: {:?}", order_id, e);
                            }
                        }
                    }
                    
                    // Save updated order
                    set_order(&env, order_id, &order);
                }
            }
        }
        
        executed_orders
    }
    
    /// Internal order execution logic
    fn execute_order_internal(
        env: &Env, 
        order: &mut TrailingOrder, 
        execution_price: i128
    ) -> Result<(), ContractError> {
        
        // Update order status
        order.status = OrderStatus::Executed;
        order.executed_at = Some(env.ledger().timestamp());
        order.execution_price = Some(execution_price);
        order.updated_at = env.ledger().timestamp();
        
        // Get contract's current token balance
        let token_client = TokenClient::new(env, &order.token);
        let contract_balance = token_client.balance(&env.current_contract_address());
        
        // Calculate P&L based on price change
        let initial_price = order.initial_price;
        let price_change_percentage = if initial_price > 0 {
            // Calculate percentage change: (current - initial) / initial * 100
            ((execution_price - initial_price) * 10000) / initial_price // Using basis points
        } else {
            0 // No change if initial price is invalid
        };
        
        // Apply maximum profit limit of 200% (20000 basis points)
        let max_profit_bp = 20000; // 200%
        let limited_price_change = if price_change_percentage > max_profit_bp {
            max_profit_bp
        } else if price_change_percentage < -5000 { // Max loss 50%
            -5000
        } else {
            price_change_percentage
        };
        
        // Calculate theoretical amount user deserves (with limits)
        let theoretical_amount = order.amount + ((order.amount * limited_price_change) / 10000);
        
        // Professional P&L: Ensure we have enough balance, if not auto-add liquidity
        let final_amount = if theoretical_amount > 0 {
            if theoretical_amount <= contract_balance {
                theoretical_amount
            } else {
                // Auto-liquidity: Use available balance and log shortage
                log!(env, "Insufficient balance for order {}: needed={}, available={}", 
                     order.id, theoretical_amount, contract_balance);
                contract_balance
            }
        } else {
            // Even in loss, give minimum 5% of original amount
            order.amount / 20
        };
        
        // Final safety check - ensure positive amount
        let transfer_amount = if final_amount > 0 {
            final_amount
        } else {
            1 // Absolute minimum: 1 token
        };
        
        // Transfer the calculated amount to user
        token_client.transfer(&env.current_contract_address(), &order.user, &transfer_amount);
        
        // Log detailed execution information
        log!(env, "Order {} executed: initial_price={}, execution_price={}, raw_change={}bp, limited_change={}bp, original={}, theoretical={}, contract_balance={}, final_paid={}", 
             order.id, initial_price, execution_price, price_change_percentage, limited_price_change, order.amount, theoretical_amount, contract_balance, transfer_amount);
        
        // Remove from active orders
        remove_active_order(env, order.id);
        
        Ok(())
    }
    
    /// Internal emergency order execution logic with commission
    fn execute_emergency_order_internal(
        env: &Env, 
        order: &mut TrailingOrder, 
        execution_price: i128
    ) -> Result<(), ContractError> {
        
        // Update order status
        order.status = OrderStatus::Executed;
        order.executed_at = Some(env.ledger().timestamp());
        order.execution_price = Some(execution_price);
        order.updated_at = env.ledger().timestamp();
        
        // Get contract's current token balance
        let token_client = TokenClient::new(env, &order.token);
        let contract_balance = token_client.balance(&env.current_contract_address());
        
        // Calculate P&L based on price change
        let initial_price = order.initial_price;
        let price_change_percentage = if initial_price > 0 {
            // Calculate percentage change: (current - initial) / initial * 100
            ((execution_price - initial_price) * 10000) / initial_price // Using basis points
        } else {
            0 // No change if initial price is invalid
        };
        
        // Apply maximum profit limit of 200% (20000 basis points)
        let max_profit_bp = 20000; // 200%
        let limited_price_change = if price_change_percentage > max_profit_bp {
            max_profit_bp
        } else if price_change_percentage < -5000 { // Max loss 50%
            -5000
        } else {
            price_change_percentage
        };
        
        // Calculate theoretical amount user deserves (with limits)
        let theoretical_amount = order.amount + ((order.amount * limited_price_change) / 10000);
        
        // Apply emergency commission if profitable
        let emergency_commission_rate = get_emergency_commission_rate(env); // Basis points (e.g., 50 = 0.5%)
        let (final_theoretical_amount, commission_taken) = if limited_price_change > 0 && emergency_commission_rate > 0 {
            // Calculate profit
            let profit = (order.amount * limited_price_change) / 10000;
            
            // Calculate commission on profit only
            let commission = (profit * emergency_commission_rate as i128) / 10000;
            
            // Net amount = original + profit - commission
            let net_amount = order.amount + profit - commission;
            
            log!(env, "Emergency sell commission: profit={}, commission_rate={}bp, commission={}, net={}", 
                 profit, emergency_commission_rate, commission, net_amount);
            
            (net_amount, commission)
        } else {
            // No commission on losses or if rate is 0
            (theoretical_amount, 0)
        };
        
        // Professional P&L: Ensure we have enough balance, if not auto-add liquidity
        let final_amount = if final_theoretical_amount > 0 {
            if final_theoretical_amount <= contract_balance {
                final_theoretical_amount
            } else {
                // Auto-liquidity: Use available balance and log shortage
                log!(env, "Insufficient balance for emergency order {}: needed={}, available={}", 
                     order.id, final_theoretical_amount, contract_balance);
                contract_balance
            }
        } else {
            // Even in loss, give minimum 5% of original amount
            order.amount / 20
        };
        
        // Final safety check - ensure positive amount
        let transfer_amount = if final_amount > 0 {
            final_amount
        } else {
            1 // Absolute minimum: 1 token
        };
        
        // Transfer the calculated amount to user
        token_client.transfer(&env.current_contract_address(), &order.user, &transfer_amount);
        
        // Log detailed execution information
        log!(env, "Emergency order {} executed: initial_price={}, execution_price={}, raw_change={}bp, limited_change={}bp, original={}, theoretical={}, commission={}, contract_balance={}, final_paid={}", 
             order.id, initial_price, execution_price, price_change_percentage, limited_price_change, order.amount, final_theoretical_amount, commission_taken, contract_balance, transfer_amount);
        
        // Remove from active orders
        remove_active_order(env, order.id);
        
        Ok(())
    }
    
    /// Get user's orders (all statuses)
    pub fn get_user_orders(env: Env, user: Address) -> Vec<TrailingOrder> {
        let user_order_ids = get_user_orders_storage(&env, &user);
        let mut orders = Vec::new(&env);
        
        for i in 0..user_order_ids.len() {
            let order_id = user_order_ids.get(i).unwrap();
            if let Some(order) = get_order(&env, order_id) {
                orders.push_back(order);
            }
        }
        
        orders
    }
    
    /// Get active orders for a user
    pub fn get_user_active_orders(env: Env, user: Address) -> Vec<TrailingOrder> {
        let user_orders = Self::get_user_orders(env.clone(), user);
        let mut active_orders = Vec::new(&env);
        
        for i in 0..user_orders.len() {
            let order = user_orders.get(i).unwrap();
            if order.status == OrderStatus::Active {
                active_orders.push_back(order);
            }
        }
        
        active_orders
    }
    
    /// Get specific order by ID
    pub fn get_order_by_id(env: Env, order_id: u64) -> Option<TrailingOrder> {
        get_order(&env, order_id)
    }
    
    /// Get current price for an asset
    pub fn get_current_price(env: Env, asset: Address) -> Option<i128> {
        let oracle_address = get_oracle_address(&env);
        let oracle_client = OracleClient::new(&env, &oracle_address);
        oracle_client.get_price(&asset)
    }
    
    /// Get total number of orders
    pub fn get_total_orders(env: Env) -> u64 {
        get_order_counter(&env)
    }
    
    /// Get all active order IDs (admin only)
    pub fn get_all_active_orders(env: Env) -> Vec<u64> {
        require_admin(&env).unwrap();
        get_active_orders(&env)
    }
    
    /// Update oracle address (admin only)
    pub fn set_oracle(env: Env, new_oracle: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        set_oracle_address(&env, &new_oracle);
        log!(&env, "Oracle address updated to {}", new_oracle);
        Ok(())
    }
    
    /// Pause/unpause contract (admin only)
    pub fn set_paused(env: Env, paused: bool) -> Result<(), ContractError> {
        require_admin(&env)?;
        set_contract_paused(&env, paused);
        log!(&env, "Contract paused status: {}", paused);
        Ok(())
    }
    
    /// Emergency withdraw (admin only, for upgrades)
    pub fn emergency_withdraw(
        env: Env, 
        asset: Address, 
        to: Address, 
        amount: i128
    ) -> Result<(), ContractError> {
        require_admin(&env)?;
        
        let token_client = TokenClient::new(&env, &asset);
        token_client.transfer(&env.current_contract_address(), &to, &amount);
        
        log!(&env, "Emergency withdraw: {} {} to {}", amount, asset, to);
        Ok(())
    }
    
    /// Add liquidity to contract (admin only) - for funding P&L payouts
    pub fn add_liquidity(
        env: Env,
        from: Address,
        token: Address,
        amount: i128
    ) -> Result<(), ContractError> {
        require_admin(&env)?;
        from.require_auth();
        
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&from, &env.current_contract_address(), &amount);
        
        log!(&env, "Liquidity added: {} {} from {}", amount, token, from);
        Ok(())
    }
    
    /// Get contract token balance (public view)
    pub fn get_contract_balance(env: Env, token: Address) -> i128 {
        let token_client = TokenClient::new(&env, &token);
        token_client.balance(&env.current_contract_address())
    }
    
    /// Check if contract needs liquidity and return required amount
    pub fn check_liquidity_needs(env: Env, token: Address) -> i128 {
        let active_orders = get_active_orders(&env);
        let mut total_potential_payout = 0i128;
        
        // Calculate maximum potential payout for all active orders
        for i in 0..active_orders.len() {
            let order_id = active_orders.get(i).unwrap();
            if let Some(order) = get_order(&env, order_id) {
                // Assume maximum 200% profit for each order
                let max_payout = order.amount * 3; // 300% of original (200% profit + 100% original)
                total_potential_payout += max_payout;
            }
        }
        
        let current_balance = Self::get_contract_balance(env, token);
        let needed_liquidity = if total_potential_payout > current_balance {
            total_potential_payout - current_balance
        } else {
            0
        };
        
        needed_liquidity
    }
    
    /// Get commission earned (for admin withdrawal)
    pub fn get_commission_info(env: Env, token: Address) -> (i128, i128) {
        let total_balance = Self::get_contract_balance(env.clone(), token.clone());
        let needed_for_orders = Self::check_liquidity_needs(env, token);
        let available_commission = if total_balance > needed_for_orders {
            total_balance - needed_for_orders
        } else {
            0
        };
        
        (total_balance, available_commission)
    }
    
    /// Set emergency sell commission rate (admin only)
    pub fn set_emergency_commission_rate(env: Env, rate: u32) -> Result<(), ContractError> {
        require_admin(&env)?;
        
        // Maximum 10% commission (1000 basis points)
        if rate > 1000 {
            return Err(ContractError::InvalidTrailPercentage);
        }
        
        set_emergency_commission_rate(&env, rate);
        log!(&env, "Emergency sell commission rate set to {}bp", rate);
        Ok(())
    }
    
    /// Get current emergency sell commission rate (public view)
    pub fn get_emergency_commission_rate(env: Env) -> u32 {
        get_emergency_commission_rate(&env)
    }
}
