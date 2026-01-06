import { Laugh, Mic, Plus, Send } from "lucide-react"
import { Input } from "../ui/input"
import { useContext, useState } from "react"
import { Button } from "../ui/button"
import { api } from "@/convex/_generated/api"
import { useConversationStore } from "@/store/chat-store"
import toast from "react-hot-toast"
import useComponentVisible from "@/hooks/useComponentVisible"
import EmojiPicker, { Theme } from "emoji-picker-react"
import MediaDropdown from "./media-dropdown"
import { sendMessage } from "@/lib/signal/signal"
import chatStoreInstance from "@/lib/chatStoreInstance"
import { SocketInterface } from "@/lib/types"
import { SocketContext } from "@/hooks/socket"
import { HandleSendMessage } from "@/lib/utils"
const MessageInput = () => {
  const [msgText, setMsgText] = useState("")
  const { selectedChat } = useConversationStore()
  const { socket, handlemessage, setMessages: setMessagesInContext } =
    useContext<SocketInterface | null>(SocketContext) || {};
  const { ref, isComponentVisible, setIsComponentVisible } =
    useComponentVisible(false)

  const handleSendTextMsg = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
  //     const recipientid = await chatStoreInstance.getRegistrationId(selectedChat?.chatId);
  //     const cipher_text = await sendMessage(
  //       recipientid,
  //       JSON.stringify({
  //         text: msgText,
  //         messageType:"text"
  //       }),
  //       JSON.parse(localStorage.getItem("preKeyBundle") || "{}")
  //         .registrationId,
  //      selectedChat?.chatId,
  //     //  "text"
  //     );
  //       socket?.emit("direct_message", {
  //       encryptedMessage: cipher_text,
  //       receiverId: selectedChat?.chatId,
  //       senderId: localStorage.getItem("userId"),
  //       senderName: localStorage.getItem("username"),
  //       // messageType: "text"
  //     });
  // await chatStoreInstance.updateMessage(cipher_text.messageId, {
  //       status: "sent",
  //     });

  HandleSendMessage(selectedChat, msgText, socket, "direct_message")
      // await sendTextMsg({
      //   content: msgText,
      //   conversation: selectedChat!._id,
      //   sender: me!._id,
      // })
      setMsgText("")
    } catch (error: any) {
      toast.error(error.message)
      console.log(error)
    }
  }

  return (
    <div className="bg-gray-primary p-2 flex gap-4 items-center">
      <div className="relative flex gap-2 ml-2">
        {/* EMOJI PICKER WILL GO HERE */}
        <div ref={ref} onClick={() => setIsComponentVisible(true)}>
          {isComponentVisible && (
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={(emojiObject) => {
                setMsgText((prev) => prev + emojiObject.emoji)
              }}
              style={{
                position: "absolute",
                bottom: "1.5rem",
                left: "1rem",
                zIndex: 50,
              }}
            />
          )}
          <Laugh className="text-gray-600 dark:text-gray-400" />
        </div>
        <MediaDropdown />
      </div>
      <form onSubmit={handleSendTextMsg} className="w-full flex gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Type a message"
            className="py-2 text-sm w-full rounded-lg shadow-sm bg-gray-tertiary focus-visible:ring-transparent"
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
          />
        </div>
        <div className="mr-4 flex items-center gap-3">
          {msgText.length > 0 ? (
            <Button
              type="submit"
              size={"sm"}
              className="bg-transparent text-foreground hover:bg-transparent"
            >
              <Send />
            </Button>
          ) : (
            <Button
              type="submit"
              size={"sm"}
              className="bg-transparent text-foreground hover:bg-transparent"
            >
              <Mic />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
export default MessageInput
