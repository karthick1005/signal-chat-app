import { Socket } from "socket.io-client"

export interface SocketInterface{
  socket: Socket | null
  handlemessage: number | null
  setMessages: React.Dispatch<React.SetStateAction<number | null>>
  setSocket?: (socket: Socket | null) => void
  reconnectSocket?: () => void
    connectSocket?: () => void
}
export interface recipientBundle{
    userId: string;
  username: string;
  registrationId: string;
  identityKey: string;
  signedPreKey: {
    keyId: string;
    publicKey: string;
    signature: string;
  };
  preKey: {
    keyId: string;
    publicKey: string;
  };
  socketId: string | null;
  activeRooms: string[];
  lastActive: Date;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export 
interface ChatWindowUser {
    chatId: string;
    lastMessage: string;
    lastTimestamp: number;
    unreadCount: number;
    name: string;
    avatar: string;
}