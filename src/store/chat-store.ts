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
};

type ChatMeta = {
  chatId: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  name: string;
  avatar: string;
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
  // === Sync from ChatStore ===
  const unsubscribe = chatStoreInstance.subscribe(async () => {
    try {
      const { activeChatId } = get();
    console.log("Fetching chats and messages after update");
      const [chats, messages] = await Promise.all([
        chatStoreInstance.getAllChats(),
        activeChatId ? chatStoreInstance.getMessages(activeChatId) : Promise.resolve([]),
      ]);

      const selectedChat = activeChatId
        ? chats.find((c) => c.chatId === activeChatId) || null
        : null;
      console.log("Fetched chats:", chats, "and messages:", messages);
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
      get().fetchMessages(chatId);
    },

    setSelectedChat: (chat: ChatMeta | null) => {
      if (chat) {
        set({ selectedChat: chat, activeChatId: chat.chatId });
        get().fetchMessages(chat.chatId);
      } else {
        set({ selectedChat: null, activeChatId: null, messages: [] });
      }
    },

    fetchChats: async () => {
      try {
        set({ loading: true, error: null });
        const chats = await chatStoreInstance.getAllChats();
        const { activeChatId } = get();
        const selectedChat = activeChatId
          ? chats.find((c) => c.chatId === activeChatId) || null
          : null;
        set({ chats, selectedChat });
      } catch (e: any) {
        set({ error: e.message });
      } finally {
        set({ loading: false });
      }
    },

    fetchMessages: async (chatId: string) => {
      try {
        set({ loading: true, error: null });
        const messages = await chatStoreInstance.getMessages(chatId);
        console.log("Fetched messages for chat:", chatId, messages);
        set({ messages });
      } catch (e: any) {
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
