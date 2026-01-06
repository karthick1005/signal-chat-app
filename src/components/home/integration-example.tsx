/**
 * Integration Example - How to add WhatsApp-like features to existing components
 * This shows how to integrate the new services into your existing chat components
 */

import React, { useEffect } from 'react';
import { MessageReactions } from './message-reactions';
import useWhatsAppServices from '../../hooks/useWhatsAppServices';

// Example: Enhanced Chat Bubble with Reactions
export const EnhancedChatBubble: React.FC<{
  message: any;
  currentUserId: string;
  isFromCurrentUser: boolean;
}> = ({ message, currentUserId, isFromCurrentUser }) => {
  return (
    <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative
          ${isFromCurrentUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-800'
          }
        `}
      >
        {/* Message content */}
        <p className="mb-2">{message.text}</p>
        
        {/* WhatsApp-like reactions */}
        <MessageReactions
          messageId={message.id}
          currentUserId={currentUserId}
          reactions={message.reactions}
          className="mt-2"
        />
        
        {/* Message status/timestamp */}
        <div className="text-xs opacity-75 mt-1">
          {new Date(message._creationTime).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

// Example: App Component with WhatsApp Services
export const WhatsAppEnabledApp: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize WhatsApp-like services
  const whatsappServices = useWhatsAppServices({
    enableBackgroundSync: true,
    enableReactions: true,
    enableGroupCache: true,
    syncInterval: 30000 // 30 seconds
  });

  useEffect(() => {
    console.log('🚀 WhatsApp-like services initialized!');
    
    // Optional: Show sync status in UI
    const logSyncStatus = () => {
      const status = whatsappServices.getSyncStatus();
      console.log('📊 Sync Status:', status);
    };

    const interval = setInterval(logSyncStatus, 10000); // Log every 10 seconds
    return () => clearInterval(interval);
  }, [whatsappServices]);

  return (
    <div className="whatsapp-enabled-app">
      {children}
    </div>
  );
};

// Example: Group List with Local Caching
export const CachedGroupList: React.FC = () => {
  const [groups, setGroups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isFromCache, setIsFromCache] = React.useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      
      // This will load from cache first, then update with server data
      // Following the WhatsApp pattern we implemented
      const response = await fetch('/api/groups');
      
      if (!response.ok) {
        // Fallback to cached data
        const cachedGroups = localStorage.getItem('groups');
        if (cachedGroups) {
          setGroups(JSON.parse(cachedGroups));
          setIsFromCache(true);
        }
        return;
      }

      const serverGroups = await response.json();
      setGroups(serverGroups);
      setIsFromCache(false);
      
      // Cache for offline use
      localStorage.setItem('groups', JSON.stringify(serverGroups));
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading groups...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Status indicator */}
      {isFromCache && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800">
          📱 Showing cached groups (offline mode)
        </div>
      )}
      
      {/* Group list */}
      {groups.map(group => (
        <div key={group.groupId} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
          <div className="font-medium">{group.name}</div>
          <div className="text-sm text-gray-500">
            {group.lastMessage || 'No messages yet'}
          </div>
        </div>
      ))}
    </div>
  );
};

// Example: Message Input with Reaction Shortcuts
export const EnhancedMessageInput: React.FC<{
  onSendMessage: (text: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
}> = ({ onSendMessage, onAddReaction }) => {
  const [message, setMessage] = React.useState('');
  const [showEmojiShortcuts, setShowEmojiShortcuts] = React.useState(false);

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-white p-4">
      {/* Quick emoji shortcuts */}
      {showEmojiShortcuts && (
        <div className="flex gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
          {quickEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => setMessage(prev => prev + emoji)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setShowEmojiShortcuts(!showEmojiShortcuts)}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          😊
        </button>
        
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

// Usage Example Component
export const IntegrationExample: React.FC = () => {
  const currentUserId = 'demo-user';
  
  const demoMessage = {
    id: 'integration-demo',
    text: 'This message demonstrates the enhanced chat bubble with reactions! 🎉',
    sender: { _id: 'demo-sender', name: 'Demo User' },
    _creationTime: Date.now(),
    reactions: [
      { userId: 'user1', emoji: '👍', count: 1, users: ['user1'], userReacted: false },
      { userId: 'user2', emoji: '❤️', count: 1, users: ['user2'], userReacted: false }
    ]
  };

  return (
    <WhatsAppEnabledApp>
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-6">Integration Example</h2>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Enhanced Chat Bubble</h3>
          <EnhancedChatBubble
            message={demoMessage}
            currentUserId={currentUserId}
            isFromCurrentUser={false}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Cached Group List</h3>
          <CachedGroupList />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Enhanced Message Input</h3>
          <EnhancedMessageInput
            onSendMessage={(text) => console.log('Send message:', text)}
            onAddReaction={(messageId, emoji) => console.log('Add reaction:', { messageId, emoji })}
          />
        </div>
      </div>
    </WhatsAppEnabledApp>
  );
};

export default IntegrationExample;
