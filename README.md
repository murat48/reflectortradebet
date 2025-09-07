# 🚀 Reflector TradeBet
<br>
<img src="/logo.jpg" alt="reflectortradebet" width="400"/><br> <br>

This platform is a comprehensive DeFi trading infrastructure built on the Stellar blockchain that redefines automated cryptocurrency trading. Traders can pre-set profit-taking and stop-loss orders, and the system executes them automatically 24/7 based on market movements—without the need for constant monitoring.

The platform leverages a decentralized Oracle infrastructure to deliver a real-time data dashboard with interactive charts and historical analysis, enabling users to track price movements and gain deeper market insights. Users can also join prediction markets, where they bet on price directions with a fair refund system that protects them from complete losses.

Developed with Next.js, TypeScript, and Rust-based Soroban smart contracts, the system ensures secure automated transaction signing through advanced key management. The integrated Telegram bot provides instant notifications for trade executions, detailed profit and loss reports, and live market updates.

Key features include continuous hands-free trading, emergency sell functionality, a comprehensive admin panel for system management, and risk-free prediction markets with automatic resolution. Stellar’s low fees and fast transaction speeds combine with memory-safe Rust contracts to deliver enterprise-grade security.

This open-source platform is designed for active crypto traders seeking automation, DeFi enthusiasts interested in prediction markets, and developers aiming to build on modern blockchain trading infrastructure. With cutting-edge technology and a user-friendly design, it brings the future of automated cryptocurrency trading to life today.

## Active Contract Addresses

- **Trailing Stop**  
  [CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX](https://stellar.expert/explorer/testnet/contract/CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX)

- **Betting Market**  
  [CBJU447ZOL2XDSVK63XFPYRFQDDDS63WC66Q56MMDYQYYXR73QQVR7M3](https://stellar.expert/explorer/testnet/contract/CBJU447ZOL2XDSVK63XFPYRFQDDDS63WC66Q56MMDYQYYXR73QQVR7M3)

- **Oracle (Prediction Market)**  
  [CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2](https://stellar.expert/explorer/testnet/contract/CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2)

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-SDK_14.1-7B2CBF?style=flat-square&logo=stellar)](https://stellar.org/)
[![Rust](https://img.shields.io/badge/Rust-Soroban-orange?style=flat-square&logo=rust)](https://soroban.stellar.org/)

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Project Structure](#️-project-structure)
- [🚀 Installation](#-installation)
- [📖 Usage](#-usage)
- [🔧 Smart Contracts](#-smart-contracts)
- [🌐 Frontend Components](#-frontend-components)
- [📊 Oracle Integration](#-oracle-integration)
- [🎯 TradeBet Market](#-tradebet-market)
- [👨‍💼 Admin Panel](#-admin-panel)
- [📱 Telegram Bot](#-telegram-bot)
- [🔐 Security](#-security)
- [🛠️ Development](#️-development)
- [📈 Roadmap](#-roadmap)

## ✨ Features

### 🎯 Core Features

- **Reflector Trading**: Advanced automated trading with intelligent stop-loss orders
- **Oracle Data Dashboard**: Real-time price tracking and analysis
- **TradeBet Market**: Prediction market for crypto price betting
- **Admin Panel**: System management and liquidity control
- **Multi-Asset Support**: BTCLN, AQUA, yUSDC, SSLX, EURC, KALE
- **Automated Trading**: Automatic transaction signing without user intervention

### 🔗 Blockchain Integration

- **Stellar Network**: Testnet support
- **Soroban Smart Contracts**: Secure contracts developed with Rust
- **Freighter Wallet**: Secure wallet integration
- **Reflector Oracle**: Real-time price data

### 🎨 User Experience

- **Responsive Design**: Mobile and desktop compatible
- **Real-time Updates**: Live data streaming
- **Interactive Charts**: Advanced charts with Recharts
- **Auto-refresh**: Automatic data updates

## 🏗️ Project Structure

```
reflectortradebet/
├── 📁 app/                       # Next.js App Router
│   ├── page.tsx                 # Main page (tabbed interface)
│   ├── layout.tsx               # Root layout
│   ├── admin/                   # Admin panel
│   │   └── page.tsx             # Admin dashboard
│   └── api/                     # API routes
│       ├── debug/               # Debug endpoint
│       └── telegram/            # Telegram bot API
├── 📁 components/               # React components
│   ├── SimpleTrailingStopTrading.tsx    # Main trading component
│   ├── OracleDataDashboard2.tsx         # Oracle dashboard
│   ├── BettingMarketDashboard.tsx       # Betting market dashboard
│   ├── AssetPriceDisplay.tsx            # Asset price display
│   ├── TelegramNotificationPanel.tsx    # Telegram panel
│   └── backup/                          # Backup files
├── 📁 contracts/                        # Smart Contracts
│   ├── trailing-stop/                   # Trailing stop contract
│   │   └── contracts/hello-world/       # Main contract code
│   ├── prediction-market/               # Oracle contract
│   │   └── contracts/prediction-market/ # Oracle implementation
│   └── bet-prediction-market/           # Betting contract
│       └── contracts/bet-prediction/    # Betting implementation
├── 📁 lib/                      # Utility libraries
│   ├── soroban.ts              # Soroban service (Trailing Stop)
│   ├── betting-market.ts       # Betting market service
│   ├── wallet.ts               # Wallet management
│   ├── contracts.ts            # Contract addresses
│   ├── stellar-manager.ts      # Stellar network management
│   └── telegram-bot.ts         # Telegram integration
├── 📁 telegram-bot/             # Standalone Telegram bot
│   ├── bot.js                  # Bot main code
│   └── package.json            # Bot dependencies
└── 📁 public/                   # Static files
```

## 🚀 Installation

### Requirements

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Freighter Wallet** browser extension
- **Stellar Account** (You can create one for Testnet with friendbot)

### 1. Clone the Project

```bash
git clone <repository-url>
cd reflectortradebet
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file:

```env
# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# API Keys (Optional)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 4. Start Development Server

```bash
npm run dev
```

The application will run at [http://localhost:3000](http://localhost:3000).

## 📖 Usage

### 1. Wallet Connection

1. Install [Freighter Wallet](https://freighter.app/) extension
2. Create or import a testnet account
3. Click "Connect Wallet" button in the application

### 2. Reflector Trading

- **Order Creation**: Select asset, set amount and trailing percentage
- **Order Tracking**: Monitor your active orders in real-time
- **Automatic Execution**: Automatic transactions when price conditions are met
- **Emergency Sell**: Manual order closure
- **Hands-Free Trading**: Automatic transaction signing without user being at PC
- **24/7 Monitoring**: System continuously monitors market and takes automatic action
- **Real-time Notifications**: Instant Telegram notifications for Emergency Sell and Automatic Execution
- **Profit/Loss Tracking**: Display profit/loss status with executed values

### 3. Oracle Dashboard

- **Real-time Prices**: Live prices for 6 different assets
- **Historical Charts**: Historical price charts
- **Price Change**: Price change percentages
- **Auto-refresh**: 5-60 second update intervals

### 4. TradeBet Market

- **Market Creation**: Open new betting markets
- **Bet Placement**: Make price direction predictions (Up/Down/Stable)
- **Winnings**: Automatic payout system
- **Market Resolution**: Manual and automatic resolution
- **Fair Refund System**: Bets are refunded with commission deducted if there are no winners
- **Risk-Free Betting**: Guaranteed fair distribution betting system
- **Instant Notifications**: Instant Telegram notifications for market creation and winnings distribution
- **Winner Alerts**: Automatic notifications when winners are determined

## 🔧 Smart Contracts

### Trailing Stop Contract

```rust
// Core functions
pub fn create_trailing_order(...)    // Create order
pub fn update_order_prices(...)      // Update prices
pub fn check_and_execute_orders(...) // Check and execute orders
pub fn emergency_sell_order(...)     // Emergency sell
```

**Contract ID**: `CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX`

### Oracle Contract (Prediction Market)

```rust
// Oracle functions
pub fn get_price_and_timestamp(...)  // Price and timestamp
pub fn get_twap_price(...)           // Calculate TWAP
pub fn get_historical_prices(...)    // Historical data
pub fn get_price_data(...)           // Detailed price info
```

**Contract ID**: `CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2` (Oracle address)

### Betting Market Contract

```rust
// Betting functions
pub fn create_market(...)     // Create market
pub fn place_bet(...)         // Place bet
pub fn resolve_market(...)    // Resolve market
pub fn claim_winnings(...)    // Claim winnings
```

**Contract ID**: `CBJU447ZOL2XDSVK63XFPYRFQDDDS63WC66Q56MMDYQYYXR73QQVR7M3`

## 🌐 Frontend Components

### 🎯 SimpleTrailingStopTrading

- Order creation and management
- Real-time order tracking
- Balance checking
- Execution history
- Emergency sell functionality
- Telegram notifications
- **Automated Trading**: Automatic transaction signing (no user intervention required)
- **Secure Key Management**: Secure key management for 24/7 trading
- **P&L Dashboard**: Profit/loss analysis for executed orders
- **Instant Alerts**: Instant notifications for emergency sell and automatic execution

### 📊 OracleDataDashboard2

- Real-time prices for 6 assets
- Interactive price charts
- Historical data visualization
- Price change indicators
- Auto-refresh functionality
- **Note**: TWAP calculations are available in the backend but not yet implemented in the frontend

### 🎲 BettingMarketDashboard

- Market list and details
- Bet placement interface
- Winnings tracking
- Market statistics
- Real-time odds
- **Refund System**: Automatic refund system if there are no winners
- **Fair Distribution**: Fair profit distribution algorithm
- **Market Notifications**: New market creation notifications
- **Winner Announcements**: Instant Telegram notifications for profit distribution

### 🛡️ Admin Panel

- System statistics
- Liquidity management
- User management
- Contract operations
- Emergency controls

## 📊 Oracle Integration

### Supported Assets

| Symbol | Name              | Contract ID                                                |
| ------ | ----------------- | ---------------------------------------------------------- |
| BTCLN  | Bitcoin Lightning | `CAWH4XMRQL7AJZCXEJVRHHMT6Y7ZPFCQCSKLIFJL3AVIQNC5TSVWKQOR` |
| AQUA   | Aqua              | `CDJF2JQINO7WRFXB2AAHLONFDPPI4M3W2UM5THGQQ7JMJDIEJYC4CMPG` |
| yUSDC  | Yield USDC        | `CABWYQLGOQ5Y3RIYUVYJZVA355YVX4SPAMN6ORDAVJZQBPPHLHRRLNMS` |
| SSLX   | Stellar Lumen     | `CA4DYJSRG7HPVTPJZAIPNUC3UJCQEZ456GPLYVYR2IATCBAPTQV6UUKZ` |
| EURC   | Euro Coin         | `CCBINL4TCQVEQN2Q2GO66RS4CWUARIECZEJA7JVYQO3GVF4LG6HJN236` |
| KALE   | Kale              | `CAOTLCI7DROK3PI4ANOFPHPMBCFWVHURJM2EKQSO725SYCWBWE5U22OG` |

### Oracle Methods (Available in Smart Contract)

```rust
// Basic price operations
get_price_and_timestamp(token_address) -> (i128, u64)
get_price_data(token_address) -> PriceData
get_price_timestamp(token_address) -> u64

// TWAP calculations (Available in backend)
get_twap_price(token_address, records) -> i128
get_twap_price_usd(token_address, records) -> i128

// Historical data
get_historical_prices(token_address, records) -> Vec<PriceData>
get_price_at_timestamp(token_address, timestamp) -> Option<i128>

// Oracle information
get_oracle_decimals() -> u32
get_oracle_resolution() -> u32
get_supported_assets() -> Vec<Asset>
```

### Methods Used in Frontend

```typescript
// Currently active methods in frontend
await oracleService.getPriceAndTimestamp(tokenAddress);
await oracleService.getHistoricalPrices(tokenAddress, count);
await oracleService.getPriceChangePercentage(tokenAddress);

// TWAP - Available in smart contract, not yet implemented in frontend
// await oracleService.getTwapPrice(tokenAddress, records)
```

## 🎯 TradeBet Market

### Market Types

- **Price Direction**: Price direction predictions (Up/Down/Stable)
- **Target Price**: Specific price targets
- **Time-based**: Time-based bets
- **Auto-restart**: Automatic market restart

### Bet Placement

```typescript
const betResult = await bettingService.placeBet(
  marketId,
  prediction, // 'Up' | 'Down' | 'Stable'
  amount
);
```

### Market Features

- **Dynamic Odds**: Odds based on pool size
- **House Edge**: Adjustable platform commission
- **Fair Distribution**: Fair distribution of winnings
- **Stable Tolerance**: Stable price range definition
- **No Winner Refund**: Bets are refunded with system commission deducted if there are no winners
- **Automatic Resolution**: Automatic market resolution system

## 👨‍💼 Admin Panel

### Admin Authorization

```typescript
const ADMIN_ADDRESS =
  "GALDPLQ62RAX3V7RJE73D3C2F4SKHGCJ3MIYJ4MLU2EAIUXBDSUVS7SA";
```

### Admin Functions

- **System Statistics**: Platform statistics
- **Liquidity Management**: Liquidity control and management
- **User Management**: User operations
- **Emergency Controls**: Emergency controls
- **Commission Management**: Commission rates

### Admin Dashboard Access

The admin panel is accessible only with the specified admin wallet address. The admin button on the main page is visible only to admin users and opens in a new tab.

## 📱 Telegram Bot

### Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Add the bot token to `.env.local` file
3. Users are automatically subscribed

### Bot Features

- **Order Notifications**: Trailing stop execution notifications
- **Detailed P&L Reports**: Detailed profit/loss reports
- **Real-time Updates**: Instant transaction notifications
- **Auto-subscription**: Automatic user registration system
- **Emergency Sell Alerts**: Manual order closure notifications
- **Market Creation Alerts**: New betting market notifications
- **Winner Notifications**: Betting market profit distribution notifications
- **Execution Reports**: Detailed automatic execution reports

### Telegram Integration

- Automatic Telegram ID detection in frontend
- Automatic notifications on order execution
- Detailed P&L calculations
- Commission and net profit reporting
- **Real-time Trading Alerts**: Emergency sell and automatic execution notifications
- **Betting Market Updates**: Market creation and profit notifications
- **Comprehensive Reports**: Detailed profit/loss reports for all transactions

## 🔐 Security

### Smart Contract Security

- **Rust development**: Memory-safe programming
- **Soroban runtime**: Stellar's secure execution environment
- **Access Control**: Admin and user permission control
- **Emergency Functions**: Emergency functions

### Frontend Security

- **Client-side validation**: Form validation
- **Wallet integration**: Secure signing with Freighter
- **API rate limiting**: DDoS protection
- **Environment variables**: Sensitive information protection

### Operational Security

- **Testnet environment**: Secure test environment
- **Admin controls**: Emergency stop mechanism
- **Audit trails**: Transaction logs
- **Secure key management**: Secure key management

## 🛠️ Development

### Development Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
```

### Smart Contract Development

```bash
# Trailing Stop Contract
cd contracts/trailing-stop/contracts/hello-world
cargo build --target wasm32v1-none --release

# Oracle Contract
cd contracts/prediction-market/contracts/prediction-market
cargo build --target wasm32v1-none --release

# Betting Contract
cd contracts/bet-prediction-market/contracts/bet-prediction
cargo build --target wasm32v1-none --release
```

### Testing

```bash
# Frontend tests
npm run test

# Contract tests
cd contracts/trailing-stop/contracts/hello-world
cargo test

cd contracts/prediction-market/contracts/prediction-market
cargo test
```

### Deployment

```bash
# Frontend deployment
npm run build
npm run start

# Contract deployment bet-prediction-market
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bet_prediction.wasm \
  --network testnet

# Contract deployment prediction-market
stellar contract deploy \
  --wasm target/wasm32v1-none/release/prediction_market.wasm \
  --network testnet

# Contract deployment trailing-stop
stellar contract deploy \
  --wasm target/wasm32v1-none/release/trailing_stop_loss.wasm \
  --network testnet

```
### Initialize 

```bash
soroban contract invoke --id yourcontractid --source alice(yoursecretkey) --network testnet -- initialize --admin GALDPLQ62RAX3V7RJE73D3C2F4SKHGCJ3MIYJ4MLU2EAIUXBDSUVS7SA(your admin addres) --oracle_address CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP
```
## 📈 Roadmap

### Phase 1: Core Features ✅

- [x] Trailing Stop Trading
- [x] Oracle Data Dashboard
- [x] Betting Market
- [x] Admin Panel
- [x] Wallet Integration
- [x] Telegram Bot Integration

### Phase 2: Enhanced Features 🚧

- [ ] TWAP calculations integration to frontend
- [ ] Advanced charting tools
- [ ] Mobile app development
- [ ] Multi-language support
- [ ] Advanced order types

### Phase 3: DeFi Integration 📅

- [ ] Liquidity pools
- [ ] Yield farming
- [ ] Cross-chain bridges
- [ ] Governance token

### Phase 4: Enterprise Features 📅

- [ ] API for third parties
- [ ] White-label solutions
- [ ] Institutional features
- [ ] Compliance tools

## 🎯 Known Status

### TWAP Implementation

- ✅ **Smart Contract**: TWAP calculations fully implemented
- ⚠️ **Frontend**: TWAP functions not yet used in OracleDataDashboard2.tsx
- 📝 **TODO**: Planning to add TWAP visualization to frontend

### Automated Trading System

- ✅ **Automated Signing**: System automatically signs transactions
- ✅ **24/7 Operation**: Runs continuously without user being at PC
- ✅ **Secure Key Management**: Secure key management with SecureStellarManager
- ✅ **Background Execution**: Continuous monitoring with auto-execute loop

### Telegram Notification System

- ✅ **Trading Alerts**: Instant notifications for emergency sell and automatic execution
- ✅ **P&L Reporting**: Detailed profit/loss calculations and reporting
- ✅ **Betting Notifications**: Market creation and profit distribution notifications
- ✅ **Real-time Updates**: Instant notifications for all important transactions
- ✅ **Auto-subscription**: Users are automatically included in the notification system

### Trading Dashboard Features

- ✅ **Executed Orders Display**: Display of completed orders
- ✅ **Profit/Loss Tracking**: Profit/loss status analysis for each order
- ✅ **Real-time P&L**: Instant profit/loss calculations
- ✅ **Commission Transparency**: Commission details in net profit calculations

### Betting Market Features

- ✅ **Fair Refund**: Bets are refunded with system commission deducted if there are no winners
- ✅ **Automatic Resolution**: System automatically resolves markets
- ✅ **Risk Protection**: Users never lose completely
- ✅ **Commission Transparency**: Clear commission structure
- ✅ **Market Creation Alerts**: Telegram notification when new market is created
- ✅ **Winner Notifications**: Instant notification when winners are determined

### Active Contract Addresses

- **Trailing Stop**: `CAZWLEBJI6PGUVK2WA4QFXEUYKXYQSDFXMLFZ2LGGSP4GZFTZYDMN7GX`
- **Betting Market**: `CBJU447ZOL2XDSVK63XFPYRFQDDDS63WC66Q56MMDYQYYXR73QQVR7M3`
- **Oracle (Prediction Market)**: `CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2`

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## 📞 Contact

- **Developer**: Murat Keskin
- **Email**: [info@yazilimciburada.com]
- **GitHub**: [github.com/murat48]
- **Telegram**: [@mrtksknyzlm]

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org/) - Blockchain infrastructure
- [Soroban Team](https://soroban.stellar.org/) - Smart contract platform
- [Next.js Team](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Reflector Oracle](https://reflector.stellar.org/) - Price feed oracle

---

⭐ If you like this project, please give it a star!

🐛 Use GitHub Issues for bug reports and feature requests.
