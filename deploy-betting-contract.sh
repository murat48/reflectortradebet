#!/bin/bash

# Deploy and setup prediction market contract

# Contract build
echo "Building contract..."
cd bet-prediction-market
cargo build --target wasm32-unknown-unknown --release

# Deploy contract using soroban CLI
echo "Deploying contract..."
soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/bet_prediction.wasm \
    --source alice \
    --network testnet

echo "Contract deployed successfully!"

# You can test the contract with:
# soroban contract invoke \
#     --id CONTRACT_ID \
#     --source alice \
#     --network testnet \
#     -- hello
