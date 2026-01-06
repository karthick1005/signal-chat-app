/**
 * WhatsApp-like Reaction Component
 * Shows reactions on messages with local-first updates
 */

import React, { useState, useEffect } from 'react';
import { reactionService } from '../../lib/signal/ReactionService';

interface ReactionPickerProps {
  messageId: string;
  currentUserId: string;
  onReactionAdd?: (emoji: string) => void;
  className?: string;
}

const COMMON_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '😢', '🙏', '👏'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  messageId,
  currentUserId,
  onReactionAdd,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reactions, setReactions] = useState<any[]>([]);

  useEffect(() => {
    loadReactions();
  }, [messageId]);

  const loadReactions = async () => {
    try {
      const reactionSummary = await reactionService.getReactionSummary(messageId, currentUserId);
      setReactions(reactionSummary);
    } catch (error) {
      console.error('Failed to load reactions:', error);
    }
  };

  const handleEmojiClick = async (emoji: string) => {
    try {
      await reactionService.toggleReaction(messageId, emoji, currentUserId);
      await loadReactions(); // Refresh reactions
      onReactionAdd?.(emoji);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const handleRemoveReaction = async () => {
    try {
      await reactionService.removeReaction(messageId, currentUserId);
      await loadReactions();
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Reaction Display */}
      {reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {reactions.map((reaction, index) => (
            <button
              key={index}
              onClick={() => reaction.userReacted ? handleRemoveReaction() : handleEmojiClick(reaction.emoji)}
              className={`
                flex items-center gap-1 px-2 py-1 rounded-full text-xs
                ${reaction.userReacted 
                  ? 'bg-blue-100 border-blue-300 text-blue-700' 
                  : 'bg-gray-100 border-gray-300 text-gray-700'
                } border hover:bg-opacity-80 transition-colors
              `}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Reaction Picker Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        title="Add reaction"
      >
        <span className="text-gray-500">😊</span>
      </button>

      {/* Emoji Picker Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="grid grid-cols-4 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
  reactions?: Array<{
    userId: string;
    emoji: string;
    count?: number;
    users?: string[];
    userReacted?: boolean;
  }>;
  className?: string;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  currentUserId,
  reactions = [],
  className = ''
}) => {
  const [localReactions, setLocalReactions] = useState(reactions);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  const refreshReactions = async () => {
    try {
      const summary = await reactionService.getReactionSummary(messageId, currentUserId);
      // Convert to message format
      const converted = summary.map(s => ({
        userId: s.users[0] || '', // Just use first user for display
        emoji: s.emoji,
        count: s.count,
        users: s.users,
        userReacted: s.userReacted
      }));
      setLocalReactions(converted);
    } catch (error) {
      console.error('Failed to refresh reactions:', error);
    }
  };

  const handleReactionToggle = async (emoji: string) => {
    try {
      // Optimistic update
      const existing = localReactions.find(r => r.emoji === emoji);
      if (existing?.userReacted) {
        // Remove reaction
        await reactionService.removeReaction(messageId, currentUserId);
      } else {
        // Add reaction
        await reactionService.addReaction(messageId, emoji, currentUserId);
      }
      
      // Refresh from local storage
      await refreshReactions();
      setShowPicker(false);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  // Group reactions by emoji
  const groupedReactions = localReactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        userReacted: false
      };
    }
    acc[reaction.emoji].count += reaction.count || 1;
    acc[reaction.emoji].users.push(...(reaction.users || [reaction.userId]));
    if (reaction.userReacted || reaction.userId === currentUserId) {
      acc[reaction.emoji].userReacted = true;
    }
    return acc;
  }, {} as Record<string, any>);

  const reactionArray = Object.values(groupedReactions);

  return (
    <div className={`relative ${className}`}>
      {/* Display Reactions */}
      <div className="flex items-center gap-2">
        {reactionArray.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reactionArray.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReactionToggle(reaction.emoji)}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-full text-xs border
                  ${reaction.userReacted 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                  } hover:bg-opacity-80 transition-all duration-200
                `}
                title={`${reaction.emoji} (${reaction.count}): ${reaction.users.slice(0, 3).join(', ')}${reaction.users.length > 3 ? '...' : ''}`}
              >
                <span>{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Add Reaction Button */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100"
          title="Add reaction"
        >
          <span className="text-sm">😊+</span>
        </button>
      </div>

      {/* Emoji Picker */}
      {showPicker && (
        <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
          <div className="grid grid-cols-4 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReactionToggle(emoji)}
                className="p-2 hover:bg-gray-100 rounded transition-colors text-lg"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageReactions;
