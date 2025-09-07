interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
}

interface UserSubscription {
  userId: string;
  chatId: string;
  subscribedToTrailing: boolean;
  subscribedToBetting: boolean;
  createdAt: Date;
}

class TelegramBotService {
  private static instance: TelegramBotService;
  private botToken: string;
  private subscribers: Map<string, UserSubscription> = new Map();

  private constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!this.botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not found in environment variables');
    }
    this.loadSubscribers();
  }

  static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  private loadSubscribers() {
    // localStorage'dan aboneleri yükle (gerçek uygulamada database kullanın)
    // Server-side rendering'de çalışmaz, sadece client-side'da çalışır
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('telegramSubscribers');
        if (stored) {
          const data = JSON.parse(stored);
          this.subscribers = new Map(Object.entries(data));
        }
      }
    } catch (error) {
      console.error('Error loading subscribers:', error);
    }
    
    // Default users - ADD YOUR TELEGRAM INFO HERE
    this.addDefaultSubscribers();
  }

  private addDefaultSubscribers() {
    // Add default subscribers for known wallet addresses
    // Format: wallet address -> telegram user ID
    const defaultSubscribers: Record<string, string> = {
      // Add your wallet address and telegram ID here
      // Example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX': '8211541138'
    };

    for (const [walletAddress, telegramId] of Object.entries(defaultSubscribers)) {
      if (!this.subscribers.has(walletAddress)) {
        this.subscribers.set(walletAddress, {
          userId: walletAddress,
          chatId: telegramId,
          subscribedToTrailing: true,
          subscribedToBetting: true,
          createdAt: new Date()
        });
        console.log(`Added default subscriber: ${walletAddress} -> ${telegramId}`);
      }
    }
  }

  // Method to manually add a user subscription
  addUserSubscription(walletAddress: string, telegramId: string): boolean {
    try {
      this.subscribers.set(walletAddress, {
        userId: walletAddress,
        chatId: telegramId,
        subscribedToTrailing: true,
        subscribedToBetting: true,
        createdAt: new Date()
      });
      this.saveSubscribers();
      console.log(`Manually added subscription: ${walletAddress} -> ${telegramId}`);
      return true;
    } catch (error) {
      console.error('Error adding user subscription:', error);
      return false;
    }
  }

  private saveSubscribers() {
    // localStorage'a aboneleri kaydet (gerçek uygulamada database kullanın)
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const data = Object.fromEntries(this.subscribers);
        localStorage.setItem('telegramSubscribers', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving subscribers:', error);
    }
  }

  async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.botToken) {
      console.error('Telegram bot token not configured');
      return false;
    }

    console.log('Sending message to chat:', chatId);
    console.log('Bot token exists:', !!this.botToken);
    console.log('Message preview:', message.substring(0, 100) + '...');

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        } as TelegramMessage),
      });

      const result = await response.json();
      
      console.log('Telegram API response status:', response.status);
      console.log('Telegram API response:', result);
      
      if (!response.ok) {
        console.error('Telegram API error:', result);
        return false;
      }

      return result.ok;
    } catch (error) {
      console.error('Error sending telegram message:', error);
      return false;
    }
  }

  // Kullanıcı aboneliği ekleme
  subscribeUser(userId: string, chatId: string, trailingStop = true, betting = true): boolean {
    try {
      const subscription: UserSubscription = {
        userId,
        chatId,
        subscribedToTrailing: trailingStop,
        subscribedToBetting: betting,
        createdAt: new Date(),
      };

      this.subscribers.set(userId, subscription);
      this.saveSubscribers();
      return true;
    } catch (error) {
      console.error('Error subscribing user:', error);
      return false;
    }
  }

  // Kullanıcı aboneliğini kaldırma
  unsubscribeUser(userId: string): boolean {
    try {
      this.subscribers.delete(userId);
      this.saveSubscribers();
      return true;
    } catch (error) {
      console.error('Error unsubscribing user:', error);
      return false;
    }
  }

  // Trailing stop bildirimini gönder
  async notifyTrailingStopExecuted(userId: string, orderDetails: {
    orderId: string;
    asset: string;
    originalAmount: string;
    initialPrice: string;
    executionPrice: string;
    priceChangePercent: string;
    isProfit: boolean;
    commissionPercent?: number;
    commissionAmount?: string;
    netProfit?: string;
    executedAt: string;
  }): Promise<boolean> {
    console.log('notifyTrailingStopExecuted called for user:', userId);
    console.log('Trailing stop execution details:', orderDetails);
    
    const subscriber = this.subscribers.get(userId);
    
    if (!subscriber) {
      console.log('No subscriber found for user:', userId);
      return false;
    }
    
    if (!subscriber.subscribedToTrailing) {
      console.log('User not subscribed to trailing notifications:', userId);
      return false;
    }

    console.log('Sending detailed trailing stop notification to chat:', subscriber.chatId);

    const profitIcon = orderDetails.isProfit ? '📈' : '📉';
    const profitText = orderDetails.isProfit ? 'PROFIT' : 'LOSS';
    const profitColor = orderDetails.isProfit ? '🟢' : '🔴';
    
    let commissionSection = '';
    if (orderDetails.isProfit && orderDetails.commissionPercent && orderDetails.commissionPercent > 0) {
      commissionSection = `
💼 <b>Commission Details:</b>
   • Rate: ${orderDetails.commissionPercent}%
   • Amount: ${orderDetails.commissionAmount || '0'}
   • Net Profit: ${orderDetails.netProfit || '0'}`;
    }

    const message = `
🎯 <b>Trailing Stop Order Executed!</b>

${profitColor} <b>${profitText}: ${orderDetails.priceChangePercent}%</b>

📋 <b>Order Details:</b>
   • Order ID: #${orderDetails.orderId}
   • Asset: ${orderDetails.asset}
   • Amount: ${orderDetails.originalAmount}

� <b>Price Action:</b>
   • Initial Price: ${orderDetails.initialPrice}
   • Execution Price: ${orderDetails.executionPrice}
   • Change: ${orderDetails.priceChangePercent}% ${profitIcon}
${commissionSection}

⏰ <b>Executed At:</b> ${orderDetails.executedAt}

${orderDetails.isProfit ? '🎉 Congratulations on your profit!' : '💪 Better luck next time!'}

🔗 Check your dashboard for full details.
    `.trim();

    const result = await this.sendMessage(subscriber.chatId, message);
    console.log('Detailed trailing stop notification sent, result:', result);
    return result;
  }

  // Emergency sell bildirimini gönder
  async notifyEmergencySell(userId: string, orderDetails: {
    orderId: string;
    asset: string;
    originalAmount: string;
    initialPrice: string;
    executionPrice: string;
    priceChangePercent: string;
    isProfit: boolean;
    commissionPercent?: number;
    commissionAmount?: string;
    netProfit?: string;
    executedAt: string;
  }): Promise<boolean> {
    console.log('notifyEmergencySell called for user:', userId);
    console.log('Emergency sell details:', orderDetails);
    
    const subscriber = this.subscribers.get(userId);
    
    if (!subscriber) {
      console.log('No subscriber found for user:', userId);
      return false;
    }
    
    if (!subscriber.subscribedToTrailing) {
      console.log('User not subscribed to trailing notifications:', userId);
      return false;
    }

    console.log('Sending emergency sell notification to chat:', subscriber.chatId);

    const profitLossIcon = orderDetails.isProfit ? '📈' : '📉';
    const profitLossText = orderDetails.isProfit ? 'PROFIT' : 'LOSS';
    const changeSign = orderDetails.isProfit ? '+' : '';

    let commissionSection = '';
    if (orderDetails.isProfit && orderDetails.commissionPercent && orderDetails.commissionAmount && orderDetails.netProfit) {
      commissionSection = `
💰 <b>Gross Profit:</b> ${changeSign}${orderDetails.priceChangePercent}%
💳 <b>Commission (${orderDetails.commissionPercent}%):</b> -${orderDetails.commissionAmount}
💎 <b>Net Profit:</b> ${orderDetails.netProfit}`;
    }

    const message = `
🚨 <b>Emergency Sell Order Executed!</b>

📋 <b>Order ID:</b> ${orderDetails.orderId}
💰 <b>Asset:</b> ${orderDetails.asset}
📊 <b>Original Amount:</b> ${orderDetails.originalAmount}

💵 <b>Initial Price:</b> ${orderDetails.initialPrice}
💸 <b>Execution Price:</b> ${orderDetails.executionPrice}

${profitLossIcon} <b>${profitLossText}:</b> ${changeSign}${orderDetails.priceChangePercent}%${commissionSection}

⏰ <b>Executed At:</b> ${orderDetails.executedAt}

🔗 Check your dashboard for complete transaction details.
    `.trim();

    const result = await this.sendMessage(subscriber.chatId, message);
    console.log('Emergency sell notification sent, result:', result);
    return result;
  }

  // Betting market oluşturma bildirimini gönder
  async notifyMarketCreated(marketDetails: {
    marketId: string;
    title: string;
    creator: string;
    targetPrice: string;
    duration: string;
  }): Promise<void> {
    console.log('notifyMarketCreated called with:', marketDetails);
    console.log('Current subscribers count:', this.subscribers.size);
    
    const message = `
🎲 <b>New Prediction Market Created!</b>

🆔 <b>Market ID:</b> ${marketDetails.marketId}
📝 <b>Title:</b> ${marketDetails.title}
👤 <b>Creator:</b> ${marketDetails.creator.slice(0, 8)}...${marketDetails.creator.slice(-8)}
🎯 <b>Target Price:</b> ${marketDetails.targetPrice}
⏱️ <b>Duration:</b> ${marketDetails.duration}

⏰ <b>Created:</b> ${new Date().toLocaleString()}

🎯 Place your bets now!
    `.trim();

    // Betting market'lere abone olan tüm kullanıcılara gönder
    const bettingSubscribers = Array.from(this.subscribers.values())
      .filter(sub => sub.subscribedToBetting);
    
    console.log('Betting subscribers found:', bettingSubscribers.length);
    
    const promises = bettingSubscribers.map(async (sub) => {
      console.log('Sending market created notification to:', sub.chatId);
      const result = await this.sendMessage(sub.chatId, message);
      console.log('Message sent result for', sub.chatId, ':', result);
      return result;
    });

    const results = await Promise.allSettled(promises);
    console.log('All market created notifications sent. Results:', results);
  }

  // Betting market sonuçlandırma bildirimini gönder
  async notifyMarketResolved(marketDetails: {
    marketId: string;
    title: string;
    winningSide: string;
    finalPrice: string;
    winnerCount: number;
  }): Promise<void> {
    const message = `
🏆 <b>Market Resolved!</b>

🆔 <b>Market ID:</b> ${marketDetails.marketId}
📝 <b>Title:</b> ${marketDetails.title}
🎯 <b>Winner:</b> ${marketDetails.winningSide}
💰 <b>Final Price:</b> ${marketDetails.finalPrice}
👥 <b>Winners:</b> ${marketDetails.winnerCount} users

⏰ <b>Resolved:</b> ${new Date().toLocaleString()}

💸 Payouts are being distributed automatically.
    `.trim();

    // Betting market'lere abone olan tüm kullanıcılara gönder
    const promises = Array.from(this.subscribers.values())
      .filter(sub => sub.subscribedToBetting)
      .map(sub => this.sendMessage(sub.chatId, message));

    await Promise.allSettled(promises);
  }

  // Kullanıcının abonelik durumunu kontrol et
  isUserSubscribed(userId: string): UserSubscription | null {
    return this.subscribers.get(userId) || null;
  }

  // Tüm aboneleri listele
  getAllSubscribers(): UserSubscription[] {
    return Array.from(this.subscribers.values());
  }

  // Bot durumunu kontrol et
  async checkBotStatus(): Promise<boolean> {
    if (!this.botToken) return false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error('Error checking bot status:', error);
      return false;
    }
  }
}

export default TelegramBotService;
