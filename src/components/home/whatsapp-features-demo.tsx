/**
 * WhatsApp-like Features Demo
 * Demonstrates the new group and reaction mechanisms
 */

import React, { useState, useEffect } from 'react';
import { MessageReactions } from './message-reactions';
import useWhatsAppServices from '../../hooks/useWhatsAppServices';
import { useConversationStore } from '../../store/chat-store';

interface DemoMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  reactions?: any[];
}

export const WhatsAppFeaturesDemo: React.FC = () => {
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([
    {
      id: 'demo-1',
      text: 'Hey everyone! 👋 This is a demo of WhatsApp-like features',
      sender: 'Alice',
      timestamp: Date.now() - 60000,
      reactions: []
    },
    {
      id: 'demo-2', 
      text: 'Try clicking the reaction buttons below! They work offline too 📱',
      sender: 'Bob',
      timestamp: Date.now() - 30000,
      reactions: []
    },
    {
      id: 'demo-3',
      text: 'Groups and reactions are cached locally and sync in the background ⚡',
      sender: 'Charlie',
      timestamp: Date.now(),
      reactions: []
    }
  ]);

  const [currentUserId] = useState(() => localStorage.getItem('userId') || 'demo-user');
  const [status, setStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    groupCount: number;
    pendingReactions: number;
  }>({
    isOnline: true,
    isSyncing: false,
    groupCount: 0,
    pendingReactions: 0
  });

  // Initialize WhatsApp-like services
  const whatsappServices = useWhatsAppServices({
    enableBackgroundSync: true,
    enableReactions: true,
    enablePeerToPeerGroups: true, // Enable WhatsApp-style groups
    syncInterval: 10000 // 10 seconds for demo
  });

  const { fetchChats } = useConversationStore();

  useEffect(() => {
    // Update status periodically
    const updateStatus = () => {
      const syncStatus = whatsappServices.getSyncStatus();
      setStatus(prev => ({
        ...prev,
        isOnline: syncStatus.isOnline,
        isSyncing: syncStatus.isSyncing
      }));
    };

    const interval = setInterval(updateStatus, 1000);
    updateStatus(); // Initial update

    return () => clearInterval(interval);
  }, [whatsappServices]);

  const handleForceSync = async () => {
    try {
      await whatsappServices.forceSync();
      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
    }
  };

  const handleRetryFailedSyncs = async () => {
    try {
      await whatsappServices.retryFailedSyncs();
      console.log('✅ Failed syncs retried');
    } catch (error) {
      console.error('❌ Retry failed:', error);
    }
  };

  const handleCleanupOldData = async () => {
    try {
      await whatsappServices.cleanupOldData();
      console.log('✅ Old data cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          🚀 WhatsApp-like Features Demo
        </h1>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">System Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${status.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>{status.isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${status.isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
              <span>{status.isSyncing ? 'Syncing...' : 'Idle'}</span>
            </div>
            <div className="text-gray-600">
              Groups: {status.groupCount}
            </div>
            <div className="text-gray-600">
              Pending: {status.pendingReactions}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleForceSync}
            disabled={status.isSyncing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔄 Force Sync
          </button>
          
          <button
            onClick={handleRetryFailedSyncs}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            🔁 Retry Failed
          </button>
          
          <button
            onClick={fetchChats}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            📱 Load Local Groups
          </button>
          
          <button
            onClick={() => whatsappServices.createGroup('Demo Group', ['user1', 'user2'], currentUserId, 'A demo group')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            👥 Create Demo Group
          </button>
          
          <button
            onClick={handleCleanupOldData}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            🧹 Cleanup
          </button>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">✨ WhatsApp-like Architecture</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• <strong>No Central DB:</strong> Groups exist only on member devices</li>
            <li>• <strong>Peer-to-peer sync:</strong> Group metadata shared between members</li>
            <li>• <strong>Local-first:</strong> All data stored locally in IndexedDB</li>
            <li>• <strong>Version control:</strong> Conflict resolution using version numbers</li>
            <li>• <strong>Offline support:</strong> Works completely offline</li>
            <li>• <strong>Device-only storage:</strong> No server-side group database</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">💬 Demo Messages</h2>
        <p className="text-gray-600 text-sm mb-4">
          Try adding reactions to these messages. They'll be stored locally and sync in the background!
        </p>
        
        <div className="space-y-4">
          {demoMessages.map((message) => (
            <div
              key={message.id}
              className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-400"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{message.sender}</span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              
              <p className="text-gray-700 mb-3">{message.text}</p>
              
              <MessageReactions
                messageId={message.id}
                currentUserId={currentUserId}
                reactions={message.reactions}
                className="mt-2"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🛠 Technical Details</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Group Management (WhatsApp-style)</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Groups stored only on member devices</li>
              <li>• Peer-to-peer metadata synchronization</li>
              <li>• Version-based conflict resolution</li>
              <li>• No central server database</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Reaction System</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Instant local storage</li>
              <li>• Peer-to-peer real-time sync</li>
              <li>• Per-message reaction tracking</li>
              <li>• Emoji aggregation</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-500 text-sm">
        <p>🔧 Open browser DevTools → Console to see detailed sync logs</p>
      </div>
    </div>
  );
};

export default WhatsAppFeaturesDemo;
