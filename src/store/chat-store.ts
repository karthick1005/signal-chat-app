import chatStoreInstance from "@/lib/chatStoreInstance";
import ChatStore from "@/lib/signal/ChatStore";
import { create } from "zustand";


type Message = {
  id: string;
  chatId: string;
  senderId: number;
  text: string;
  _creationTime: number;
  read?: boolean;
   sender:{
      _id:string
      name:string
    };
  status?: "sent" | "delivered" | "read";
  reactions?: { 
    userId: string; 
    emoji: string;
    count?: number;
    users?: string[];
    userReacted?: boolean;
  }[];
};

type ChatMeta = {
  chatId: string;
  _id?: string; // Alias for chatId for compatibility
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  name: string;
  avatar: string;
  isGroup?: boolean;
  groupKey?: string;
};

type ChatState = {
  messages: Message[];
  chats: ChatMeta[];
  activeChatId: string | null;
  selectedChat: ChatMeta | null;
  loading: boolean;
  error: string | null;

  setActiveChat: (chatId: string) => void;
  setSelectedChat: (chat: ChatMeta | null) => void;

  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (message: Message) => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  updateMessageStatus: (
    messageId: string,
    status: "sent" | "delivered" | "read"
  ) => Promise<void>;
};

export const useConversationStore = create<ChatState>((set, get) => {
  const fetchGroups = async (): Promise<ChatMeta[]> => {
    try {
      // WhatsApp approach: Groups exist only locally on devices that are members
      // No central server database, just local device storage
      console.log('📱 Loading groups from local device storage (WhatsApp-style)');
      
      const localGroups = await chatStoreInstance.getAllGroups();
      console.log('📱 Raw groups from storage:', localGroups);
      
      const mappedGroups = localGroups.map((group: any) => {
        const mapped = {
          chatId: group.groupId,
          _id: group.groupId,
          lastMessage: group.lastMessage || "",
          lastTimestamp: group.lastTimestamp || group.lastUpdated,
          unreadCount: group.unreadCount || 0,
          name: group.name,
          avatar: group.avatar || "",
          isGroup: true,
          groupKey: group.groupKey,
          // WhatsApp-style metadata
          members: group.members || [],
          admins: group.admins || [],
          description: group.description || "",
          version: group.version || 1,
          isFromLocalStorage: true
        };
        console.log('📱 Mapped group:', {
          name: mapped.name,
          chatId: mapped.chatId,
          isGroup: mapped.isGroup,
          hasGroupKey: !!mapped.groupKey,
          groupKeyLength: mapped.groupKey?.length
        });
        return mapped;
      });

      // Update store with local groups
      set(state => ({
        ...state,
        chats: [...state.chats.filter(chat => !chat.isGroup), ...mappedGroups]
      }));
      
      console.log(`📱 Loaded ${mappedGroups.length} groups from local storage`);
      return mappedGroups;

    } catch (error) {
      console.error("Error loading groups from local storage:", error);
      return [];
    }
  };
  // === Sync from ChatStore ===
  const unsubscribe = chatStoreInstance.subscribe(async () => {
    try {
      const { activeChatId } = get();
    console.log("Fetching chats and messages after update");
            const [chats, messages] = await Promise.all([
        chatStoreInstance.getAllChats() as Promise<ChatMeta[]>,
        activeChatId ? chatStoreInstance.getMessages(activeChatId) as Promise<Message[]> : Promise.resolve([]),
      ]);

      const selectedChat = activeChatId
        ? chats.find((c) => c.chatId === activeChatId) || null
        : null;
      console.log("Fetched chats:", chats, "and messages:", messages);
      // Update localStorage with selected chat for socket handler access
      if (selectedChat) {
        localStorage.setItem("selectedChat", JSON.stringify(selectedChat));
      } else {
        localStorage.removeItem("selectedChat");
      }
      set({ chats, messages, selectedChat });
    } catch (e: any) {
      set({ error: e.message });
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", unsubscribe);
  }

  return {
    messages: [],
    chats: [],
    activeChatId: null,
    selectedChat: null,
    loading: false,
    error: null,

    setActiveChat: (chatId: string) => {
      const chat = get().chats.find((c) => c.chatId === chatId) || null;
      set({ activeChatId: chatId, selectedChat: chat });
      // Update localStorage with selected chat for socket handler access
      if (chat) {
        localStorage.setItem("selectedChat", JSON.stringify(chat));
      }
      get().fetchMessages(chatId);
    },

    setSelectedChat: (chat: ChatMeta | null) => {
      console.log('🎯 setSelectedChat called with:', chat ? {
        name: chat.name,
        chatId: chat.chatId,
        isGroup: chat.isGroup,
        hasGroupKey: !!(chat as any).groupKey,
        groupKeyLength: (chat as any).groupKey?.length
      } : null);
      
      if (chat) {
        set({ selectedChat: chat, activeChatId: chat.chatId });
        // Update localStorage with selected chat for socket handler access
        localStorage.setItem("selectedChat", JSON.stringify(chat));
        console.log('🎯 Chat stored in localStorage:', JSON.stringify(chat).substring(0, 200) + '...');
        get().fetchMessages(chat.chatId);
      } else {
        set({ selectedChat: null, activeChatId: null, messages: [] });
        localStorage.removeItem("selectedChat");
      }
    },

    fetchMessages: async (chatId: string) => {
      try {
        set({ loading: true, error: null });
        const messages = await chatStoreInstance.getMessages(chatId) as Message[];
        console.log("Fetched messages for chat:", chatId, messages);
        set({ messages });
      } catch (e: any) {
        set({ error: e.message });
      } finally {
        set({ loading: false });
      }
    },

    fetchChats: async () => {
      try {
        set({ loading: true, error: null });
        // Fetch both local chats and groups
        const [localChats, groups] = await Promise.all([
          chatStoreInstance.getAllChats() as Promise<ChatMeta[]>,
          fetchGroups()
        ]);
        
        // Combine local chats and groups
        const allChats = [...localChats, ...groups];
        
        // Remove duplicates based on chatId
        const uniqueChats = allChats.filter((chat, index, self) => 
          index === self.findIndex(c => c.chatId === chat.chatId)
        );
        
        console.log("Fetched all chats:", uniqueChats);
        const { activeChatId } = get();
        const selectedChat = activeChatId
          ? uniqueChats.find((c) => c.chatId === activeChatId) || null
          : null;
        set({ chats: uniqueChats, selectedChat });
      } catch (e: any) {
        console.error("Error fetching chats:", e);
        set({ error: e.message });
      } finally {
        set({ loading: false });
      }
    },

    sendMessage: async (message: Message) => {
      try {
        await chatStoreInstance.saveMessage(message);
        await get().fetchMessages(message.chatId);
        await get().fetchChats();
      } catch (e: any) {
        set({ error: e.message });
      }
    },

    markChatRead: async (chatId: string) => {
      try {
        await chatStoreInstance.markMessagesRead(chatId);
        await chatStoreInstance.updateChatMetaCount(chatId, 0);
        await get().fetchChats();
        await get().fetchMessages(chatId);
      } catch (e: any) {
        set({ error: e.message });
      }
    },

    updateMessageStatus: async (
      messageId: string,
      status: "sent" | "delivered" | "read"
    ) => {
      try {
        await chatStoreInstance.updateMessage(messageId, { status });
        const updatedMessages = get().messages.map((msg) =>
          msg.id === messageId ? { ...msg, status } : msg
        );
        set({ messages: updatedMessages });
      } catch (e: any) {
        set({ error: e.message });
      }
    },
  };
});
