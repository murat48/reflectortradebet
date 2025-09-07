import { useState, useCallback } from 'react';

interface TelegramSubscription {
  userId: string;
  chatId: string;
  subscribedToTrailing: boolean;
  subscribedToBetting: boolean;
  createdAt: Date;
}

interface TelegramStatus {
  botActive: boolean;
  totalSubscribers: number;
  userSubscription: TelegramSubscription | null;
}

interface NotifyTrailingStopData {
  orderId: string;
  asset: string;
  amount: string;
  executionPrice: string;
  profitLoss?: string;
}

interface NotifyMarketCreatedData {
  marketId: string;
  title: string;
  creator: string;
  targetPrice: string;
  duration: string;
}

interface NotifyMarketResolvedData {
  marketId: string;
  title: string;
  winningSide: string;
  finalPrice: string;
  winnerCount: number;
}

export const useTelegramNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  // Telegram bot durumunu kontrol et
  const checkBotStatus = useCallback(async (userId?: string): Promise<TelegramStatus | null> => {
    try {
      setLoading(true);
      setError('');

      const url = userId ? `/api/telegram?userId=${userId}` : '/api/telegram';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to check bot status');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check bot status';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Kullanıcıyı bildirimlere abone et
  const subscribeUser = useCallback(async (
    userId: string, 
    chatId: string, 
    trailingStop = true, 
    betting = true
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'subscribe',
          userId,
          chatId,
          data: { trailingStop, betting }
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Successfully subscribed to Telegram notifications!');
        return true;
      } else {
        setError('Failed to subscribe to notifications');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Kullanıcının aboneliğini iptal et
  const unsubscribeUser = useCallback(async (userId: string, chatId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unsubscribe',
          userId,
          chatId
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Successfully unsubscribed from notifications');
        return true;
      } else {
        setError('Failed to unsubscribe');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unsubscribe';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Trailing stop executed bildirimini gönder
  const notifyTrailingStopExecuted = useCallback(async (
    userId: string, 
    data: NotifyTrailingStopData
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'notify_trailing_executed',
          userId,
          data
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to send trailing stop notification:', err);
      return false;
    }
  }, []);

  // Market created bildirimini gönder
  const notifyMarketCreated = useCallback(async (data: NotifyMarketCreatedData): Promise<boolean> => {
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'notify_market_created',
          data
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to send market created notification:', err);
      return false;
    }
  }, []);

  // Market resolved bildirimini gönder
  const notifyMarketResolved = useCallback(async (data: NotifyMarketResolvedData): Promise<boolean> => {
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'notify_market_resolved',
          data
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to send market resolved notification:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    success,
    clearMessages,
    checkBotStatus,
    subscribeUser,
    unsubscribeUser,
    notifyTrailingStopExecuted,
    notifyMarketCreated,
    notifyMarketResolved,
  };
};
