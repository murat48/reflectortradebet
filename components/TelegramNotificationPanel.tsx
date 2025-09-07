'use client'

import { useState, useEffect } from 'react';
import { useTelegramNotifications } from '../lib/useTelegramNotifications';

interface TelegramNotificationPanelProps {
  userAddress: string;
  isConnected: boolean;
}

export default function TelegramNotificationPanel({ userAddress, isConnected }: TelegramNotificationPanelProps) {
  const [chatId, setChatId] = useState('8211541138'); // Otomatik chat ID
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [botStatus, setBotStatus] = useState(false);
  const [autoSubscribed, setAutoSubscribed] = useState(false);

  const {
    loading,
    error,
    success,
    clearMessages,
    checkBotStatus,
    subscribeUser,
    unsubscribeUser
  } = useTelegramNotifications();

  // Bot durumunu kontrol et ve otomatik subscribe yap
  useEffect(() => {
    if (isConnected && userAddress && !autoSubscribed) {
      checkBotStatus(userAddress).then(async (status) => {
        if (status) {
          setBotStatus(status.botActive);
          const isCurrentlySubscribed = !!status.userSubscription;
          setIsSubscribed(isCurrentlySubscribed);
          
          // Eğer henüz subscribe olmamışsa otomatik subscribe yap
          if (!isCurrentlySubscribed && status.botActive) {
            try {
              const success = await subscribeUser(userAddress, chatId, true, true);
              if (success) {
                setIsSubscribed(true);
                setAutoSubscribed(true);
                console.log('Otomatik Telegram bildirimleri aktifleştirildi:', chatId);
              }
            } catch (error) {
              console.error('Otomatik subscription hatası:', error);
            }
          } else if (isCurrentlySubscribed) {
            setAutoSubscribed(true);
          }
        }
      });
    }
  }, [isConnected, userAddress, checkBotStatus, subscribeUser, chatId, autoSubscribed]);

  const handleSubscribe = async () => {
    if (!chatId.trim()) {
      return;
    }

    const success = await subscribeUser(userAddress, chatId, true, true);
    if (success) {
      setIsSubscribed(true);
    }
  };

  const handleUnsubscribe = async () => {
    const success = await unsubscribeUser(userAddress, chatId);
    if (success) {
      setIsSubscribed(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
          isSubscribed 
            ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' 
            : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div className="text-left">
            <div className="font-medium">
              Telegram Notifications
              {isSubscribed && <span className="ml-2 text-xs px-2 py-1 bg-green-200 rounded-full">Active</span>}
              {!botStatus && <span className="ml-2 text-xs px-2 py-1 bg-red-200 rounded-full">Bot Offline</span>}
            </div>
            <div className="text-sm opacity-75">
              {isSubscribed 
                ? 'Get instant notifications for your trades' 
                : 'Set up Telegram notifications for trading updates'
              }
            </div>
          </div>
        </div>
        <span className={`transform transition-transform ${showPanel ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {/* Panel Content */}
      {showPanel && (
        <div className="mt-4 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Telegram Bot Setup
          </h3>

          {/* Bot Status */}
          <div className="mb-4 p-3 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${botStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="font-medium">
                Bot Status: {botStatus ? 'Online' : 'Offline'}
              </span>
            </div>
            {!botStatus && (
              <div className="text-sm text-red-600">
                ⚠️ Telegram bot is not configured or offline. Please contact administrator.
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">📋 Setup Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Search for our bot on Telegram: <code className="bg-blue-100 px-1 rounded">@YourBotName</code></li>
              <li>Start a conversation with the bot by sending <code className="bg-blue-100 px-1 rounded">/start</code></li>
              <li>Get your Chat ID by sending <code className="bg-blue-100 px-1 rounded">/mychatid</code></li>
              <li>Copy the Chat ID and paste it below</li>
              <li>Click Subscribe to enable notifications</li>
            </ol>
          </div>

          {/* Chat ID Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Enter your Telegram Chat ID (e.g., 123456789)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <div className="mt-1 text-xs text-gray-500">
              You can get this from our Telegram bot by sending /mychatid
            </div>
          </div>

          {/* Notification Types */}
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Notification Types:</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-4 h-4 bg-green-100 rounded border border-green-300 flex items-center justify-center">
                  ✓
                </span>
                Trailing Stop Order Executions
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-4 h-4 bg-green-100 rounded border border-green-300 flex items-center justify-center">
                  ✓
                </span>
                New Prediction Markets Created
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-4 h-4 bg-green-100 rounded border border-green-300 flex items-center justify-center">
                  ✓
                </span>
                Market Resolutions & Payouts
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="text-red-800 text-sm">{error}</div>
                <button 
                  onClick={clearMessages}
                  className="text-red-600 hover:text-red-800 ml-4"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="text-green-800 text-sm">{success}</div>
                <button 
                  onClick={clearMessages}
                  className="text-green-600 hover:text-green-800 ml-4"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isSubscribed ? (
              <button
                onClick={handleSubscribe}
                disabled={loading || !chatId.trim() || !botStatus}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Subscribing...' : '📱 Subscribe to Notifications'}
              </button>
            ) : (
              <div className="flex gap-3 w-full">
                <div className="flex-1 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg font-medium text-center">
                  ✅ Subscribed & Active
                </div>
                <button
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
              </div>
            )}
          </div>

          {/* Test Button for Subscribed Users */}
          {isSubscribed && botStatus && (
            <button
              onClick={async () => {
                try {
                  console.log('Sending test notification...');
                  
                  // Test notification gönder
                  const testData = {
                    orderId: 'TEST_123',
                    asset: 'BTC',
                    amount: '1.0000000',
                    executionPrice: '50000.0000000',
                    profitLoss: '+$500.00'
                  };
                  
                  const response = await fetch('/api/telegram', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      action: 'notify_trailing_executed',
                      userId: userAddress,
                      data: testData
                    }),
                  });
                  
                  const result = await response.json();
                  console.log('Test notification result:', result);
                  
                  if (result.success) {
                    alert('Test notification sent successfully! Check your Telegram.');
                  } else {
                    alert('Failed to send test notification. Check console for details.');
                  }
                } catch (error) {
                  console.error('Error sending test notification:', error);
                  alert('Error sending test notification. Check console for details.');
                }
              }}
              disabled={loading}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              🧪 Send Test Notification
            </button>
          )}
        </div>
      )}
    </div>
  );
}
