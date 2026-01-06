/**
 * ReactionService - WhatsApp-like Reaction Management
 * Handles adding, removing, and syncing message reactions with local-first approach
 */

import chatStoreInstance from '../chatStoreInstance';
import { useConversationStore } from '../../store/chat-store';

interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  timestamp: number;
  syncStatus: 'local' | 'syncing' | 'synced';
}

interface ReactionSummary {
  emoji: string;
  count: number;
  users: string[];
  userReacted: boolean;
}

class ReactionService {
  private socket: any = null;

  setSocket(socket: any) {
    this.socket = socket;
  }

  /**
   * Add a reaction with WhatsApp-like optimistic updates
   */
  async addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    try {
      // 1. Store locally first (optimistic update)
      await chatStoreInstance.saveReaction(messageId, userId, emoji);
      
      // 2. Update UI immediately
      this.updateUIReactions(messageId);
      
      // 3. Send to server in background
      this.syncReactionToServer(messageId, userId, emoji, 'add');
      
      console.log(`👍 Reaction ${emoji} added locally for message ${messageId}`);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      throw error;
    }
  }

  /**
   * Remove a reaction with optimistic updates
   */
  async removeReaction(messageId: string, userId: string): Promise<void> {
    try {
      // 1. Remove from local storage first
      await chatStoreInstance.removeReaction(messageId, userId);
      
      // 2. Update UI immediately
      this.updateUIReactions(messageId);
      
      // 3. Sync removal to server
      this.syncReactionToServer(messageId, userId, '', 'remove');
      
      console.log(`👎 Reaction removed locally for message ${messageId}`);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      throw error;
    }
  }

  /**
   * Toggle reaction (add if not exists, remove if exists)
   */
  async toggleReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    try {
      const existingReactions = await chatStoreInstance.getReactionsForMessage(messageId);
      const userReaction = existingReactions.find(r => r.userId === userId);
      
      if (userReaction) {
        if (userReaction.emoji === emoji) {
          // Same emoji - remove reaction
          await this.removeReaction(messageId, userId);
        } else {
          // Different emoji - update reaction
          await this.addReaction(messageId, emoji, userId);
        }
      } else {
        // No existing reaction - add new
        await this.addReaction(messageId, emoji, userId);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      throw error;
    }
  }

  /**
   * Get reaction summary for a message (WhatsApp style)
   */
  async getReactionSummary(messageId: string, currentUserId: string): Promise<ReactionSummary[]> {
    try {
      const reactions = await chatStoreInstance.getReactionsForMessage(messageId);
      
      // Group reactions by emoji
      const reactionMap = new Map<string, { users: string[], count: number }>();
      
      reactions.forEach(reaction => {
        if (!reactionMap.has(reaction.emoji)) {
          reactionMap.set(reaction.emoji, { users: [], count: 0 });
        }
        const group = reactionMap.get(reaction.emoji)!;
        group.users.push(reaction.userId);
        group.count++;
      });

      // Convert to summary format
      const summary: ReactionSummary[] = [];
      reactionMap.forEach((data, emoji) => {
        summary.push({
          emoji,
          count: data.count,
          users: data.users,
          userReacted: data.users.includes(currentUserId)
        });
      });

      // Sort by count (most popular first)
      return summary.sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Failed to get reaction summary:', error);
      return [];
    }
  }

  /**
   * Update UI with latest reactions for a message
   */
  private async updateUIReactions(messageId: string): Promise<void> {
    try {
      const userId = localStorage.getItem('userId') || '';
      const reactions = await chatStoreInstance.getReactionsForMessage(messageId);
      
      // Convert to the format expected by the Message type
      const reactionData = reactions.map(reaction => ({
        userId: reaction.userId,
        emoji: reaction.emoji,
        count: 1, // This will be aggregated in the summary
        users: [reaction.userId],
        userReacted: reaction.userId === userId
      }));
      
      // Update the conversation store with new reactions
      const store = useConversationStore.getState();
      const updatedMessages = store.messages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: reactionData
          };
        }
        return msg;
      });

      useConversationStore.setState({ messages: updatedMessages });
    } catch (error) {
      console.error('Failed to update UI reactions:', error);
    }
  }

  /**
   * Sync reaction to server (background operation)
   */
  private async syncReactionToServer(
    messageId: string, 
    userId: string, 
    emoji: string, 
    action: 'add' | 'remove'
  ): Promise<void> {
    try {
      // Mark as syncing
      if (action === 'add') {
        await chatStoreInstance.updateReactionSyncStatus(messageId, userId, 'syncing');
      }

      // Send via socket if available
      if (this.socket && this.socket.connected) {
        this.socket.emit('reaction', {
          messageId,
          userId,
          emoji: action === 'add' ? emoji : '',
          action,
          timestamp: Date.now()
        });
        
        // Mark as synced after socket emission
        if (action === 'add') {
          await chatStoreInstance.updateReactionSyncStatus(messageId, userId, 'synced');
        }
        
        console.log(`📡 Reaction ${action} sent via socket for message ${messageId}`);
        return;
      }

      // Fallback to REST API
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${url}/api/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          userId,
          emoji: action === 'add' ? emoji : '',
          action,
          timestamp: Date.now()
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Mark as synced
      if (action === 'add') {
        await chatStoreInstance.updateReactionSyncStatus(messageId, userId, 'synced');
      }
      
      console.log(`📡 Reaction ${action} sent via API for message ${messageId}`);
    } catch (error) {
      console.error(`Failed to sync reaction ${action}:`, error);
      
      // Mark as local again for retry
      if (action === 'add') {
        await chatStoreInstance.updateReactionSyncStatus(messageId, userId, 'local');
      }
      
      // Don't throw error - this is background sync
    }
  }

  /**
   * Handle incoming reaction from server
   */
  async handleIncomingReaction(data: {
    messageId: string;
    userId: string;
    emoji: string;
    action: 'add' | 'remove';
    timestamp: number;
  }): Promise<void> {
    try {
      if (data.action === 'add' && data.emoji) {
        await chatStoreInstance.saveReaction(
          data.messageId, 
          data.userId, 
          data.emoji, 
          data.timestamp
        );
        
        // Mark as synced since it came from server
        await chatStoreInstance.updateReactionSyncStatus(
          data.messageId, 
          data.userId, 
          'synced'
        );
      } else if (data.action === 'remove') {
        await chatStoreInstance.removeReaction(data.messageId, data.userId);
      }

      // Update UI
      await this.updateUIReactions(data.messageId);
      
      console.log(`📥 Received reaction ${data.action} from server:`, data);
    } catch (error) {
      console.error('Failed to handle incoming reaction:', error);
    }
  }

  /**
   * Get all pending reactions that need to be synced
   */
  async getPendingReactions(): Promise<Reaction[]> {
    return await chatStoreInstance.getAllPendingReactions();
  }

  /**
   * Retry failed reaction syncs
   */
  async retryFailedSyncs(): Promise<void> {
    try {
      const pendingReactions = await this.getPendingReactions();
      
      for (const reaction of pendingReactions) {
        await this.syncReactionToServer(
          reaction.messageId,
          reaction.userId,
          reaction.emoji,
          'add'
        );
      }
      
      console.log(`🔄 Retried ${pendingReactions.length} pending reactions`);
    } catch (error) {
      console.error('Failed to retry reaction syncs:', error);
    }
  }

  /**
   * Get reaction statistics for a chat
   */
  async getChatReactionStats(chatId: string): Promise<{
    totalReactions: number;
    mostUsedEmoji: string;
    reactionCount: Record<string, number>;
  }> {
    // This would require extending the ChatStore to filter by chatId
    // For now, return basic stats
    const allReactions = await chatStoreInstance.getAllReactions();
    
    const emojiCount: Record<string, number> = {};
    allReactions.forEach(reaction => {
      emojiCount[reaction.emoji] = (emojiCount[reaction.emoji] || 0) + 1;
    });

    const mostUsed = Object.entries(emojiCount)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      totalReactions: allReactions.length,
      mostUsedEmoji: mostUsed ? mostUsed[0] : '❤️',
      reactionCount: emojiCount
    };
  }
}

export const reactionService = new ReactionService();
export default reactionService;
