import { NextRequest, NextResponse } from 'next/server';
import TelegramBotService from '../../../lib/telegram-bot';

interface UserSubscription {
  userId: string;
  chatId: string;
  subscribedToTrailing: boolean;
  subscribedToBetting: boolean;
  createdAt: Date;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, chatId, data } = body;

    console.log('Telegram API called with:', { action, userId, chatId, data });

    const telegramBot = TelegramBotService.getInstance();

    switch (action) {
      case 'add_subscription':
        // Add manual subscription for wallet address -> telegram ID mapping
        const { walletAddress, telegramId } = data;
        const addResult = telegramBot.addUserSubscription(walletAddress, telegramId);
        return NextResponse.json({ success: addResult });

      case 'subscribe':
        const subscribed = telegramBot.subscribeUser(
          userId,
          chatId,
          data?.trailingStop ?? true,
          data?.betting ?? true
        );
        
        // Removed automatic subscription message - user doesn't want it
        console.log('User subscribed silently:', subscribed);

        return NextResponse.json({ success: subscribed });

      case 'unsubscribe':
        const unsubscribed = telegramBot.unsubscribeUser(userId);
        
        if (unsubscribed) {
          const messageResult = await telegramBot.sendMessage(
            chatId,
            '❌ Successfully unsubscribed from all notifications.'
          );
          console.log('Unsubscribe message sent:', messageResult);
        }

        return NextResponse.json({ success: unsubscribed });

      case 'notify_trailing_executed':
        console.log('Sending trailing stop notification for user:', userId);
        const trailingResult = await telegramBot.notifyTrailingStopExecuted(userId, data);
        console.log('Trailing notification result:', trailingResult);
        return NextResponse.json({ success: trailingResult });

      case 'emergency_sell':
        console.log('Sending emergency sell notification for user:', userId);
        const emergencyResult = await telegramBot.notifyEmergencySell(userId, data);
        console.log('Emergency sell notification result:', emergencyResult);
        return NextResponse.json({ success: emergencyResult });

      case 'notify_market_created':
        console.log('Sending market created notification:', data);
        await telegramBot.notifyMarketCreated(data);
        console.log('Market created notification sent');
        return NextResponse.json({ success: true });

      case 'notify_market_resolved':
        console.log('Sending market resolved notification:', data);
        await telegramBot.notifyMarketResolved(data);
        console.log('Market resolved notification sent');
        return NextResponse.json({ success: true });

      case 'check_status':
        const status = await telegramBot.checkBotStatus();
        return NextResponse.json({ 
          success: true, 
          botActive: status,
          subscriber: telegramBot.isUserSubscribed(userId)
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Telegram API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const telegramBot = TelegramBotService.getInstance();
    const status = await telegramBot.checkBotStatus();
    
    const response: {
      botActive: boolean;
      totalSubscribers: number;
      userSubscription?: UserSubscription | null;
    } = {
      botActive: status,
      totalSubscribers: telegramBot.getAllSubscribers().length
    };

    if (userId) {
      response.userSubscription = telegramBot.isUserSubscribed(userId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Telegram API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
