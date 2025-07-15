import { MessageSeenSvg, MessageSentSvg } from "@/lib/svgs"
import { IMessage, useConversationStore } from "@/store/chat-store"
import ChatBubbleAvatar from "./chat-bubble-avatar"
import DateIndicator from "./date-indicator"
import Image from "next/image"
import { useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription } from "../ui/dialog"
import ReactPlayer from "react-player"
import ChatAvatarActions from "./chat-avatar-actions"
import { Bot } from "lucide-react"
import { decryptFileAndGetUrl, decryptFileFromUrlAndGetUrl } from "@/lib/utils"

type ChatBubbleProps = {
  message: IMessage
  me: any
  previousMessage?: IMessage
}

const ChatBubble = ({ me, message, previousMessage }: ChatBubbleProps) => {
  const date = new Date(message._creationTime)
  const hour = date.getHours().toString().padStart(2, "0")
  const minute = date.getMinutes().toString().padStart(2, "0")
  const time = `${hour}:${minute}`

  const { selectedChat } = useConversationStore()
  const isMember =
    selectedChat?.participants?.includes(message.sender?._id) || false
  const isGroup = selectedChat?.isGroup
  const fromMe = message.sender?._id === me._id
  const fromAI = message.sender?.name === "ChatGPT"
  const bgClass = fromMe
    ? "bg-green-chat"
    : !fromAI
      ? "bg-white dark:bg-gray-primary"
      : "bg-blue-500 text-white"

  console.log(message , "this is message in chat bubble")
  const [open, setOpen] = useState(false)
  const [imagedata,setImagedata]=useState<string>("")
  const message_Json=JSON.parse(message.text)
  const renderMessageContent = () => {
    switch (message_Json.messageType) {
      case "text":
        return <TextMessage message={message_Json} />
      case "image":
        console.log("this is image message", message_Json)
        return (
          <ImageMessage
            message={message_Json}
            handleClick={(data) => {
              console.log("this is image data", data)
              setOpen(true);
              setImagedata(data);
            }}
          />
        );
      case "video":
        return <VideoMessage message={message_Json} />
      default:
        return null
    }
  }

  if (!fromMe) {
    return (
      <>
        <DateIndicator message={message} previousMessage={previousMessage} />
        <div className="flex gap-1 w-2/3">
          <ChatBubbleAvatar
            isGroup={isGroup}
            isMember={isMember}
            message={message}
            // fromAI={fromAI}
          />
          <div
            className={`flex flex-col z-20 max-w-fit px-2 pt-1 rounded-md shadow-md relative ${bgClass}`}
          >
            {!fromAI && <OtherMessageIndicator />}
            {fromAI && (
              <Bot size={16} className="absolute bottom-[2px] left-2" />
            )}
            {<ChatAvatarActions message={message} me={me} />}
            {renderMessageContent()}
            {open && (
              <ImageDialog
                src={imagedata}
                open={open}
                onClose={() => setOpen(false)}
              />
            )}
            <MessageTime time={time} fromMe={fromMe} status={message.status} />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DateIndicator message={message} previousMessage={previousMessage} />

      <div className="flex gap-1 w-2/3 ml-auto">
        <div
          className={`flex  z-20 max-w-fit px-2 pt-1 rounded-md shadow-md ml-auto relative ${bgClass} flex-col`}
        >
          <SelfMessageIndicator />
          {renderMessageContent()}
          {open && (
            <ImageDialog
              src={imagedata}
              open={open}
              onClose={() => setOpen(false)}
            />
          )}
          <MessageTime time={time} fromMe={fromMe} status={message.status} />
        </div>
      </div>
    </>
  )
}
export default ChatBubble

const VideoMessage = ({ message }: { message: IMessage }) => {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)

  // Memoize message signature (so we only decrypt when truly needed)
  const messageSignature = useMemo(
    () => `${message.imgUrl}-${message.key}-${message.iv}-${message.image_type}`,
    [message.imgUrl, message.key, message.iv, message.image_type]
  )

  const lastMessageSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastMessageSignatureRef.current === messageSignature) {
      // Prevent refetching
      return
    }

    let isMounted = true

    const decrypt = async () => {
      const url = await decryptFileFromUrlAndGetUrl({
        encryptedFileUrl: message.imgUrl,
        key: message.key,
        iv: message.iv,
        mimeType: message.image_type,
      })
      if (isMounted) {
        setDecryptedUrl(url)
        lastMessageSignatureRef.current = messageSignature // mark as fetched
      }
    }

    decrypt()

    return () => {
      isMounted = false
    }
  }, [messageSignature])
  return useMemo(() => {
  return (
    <ReactPlayer
      url={decryptedUrl}
      width="250px"
      height="250px"
      controls={true}
      light={true}
      playing={true}

    />
  )
    }, [decryptedUrl])
}

import { useEffect } from "react"

const ImageMessage = ({
  message,
  handleClick,
}: {
  message: IMessage
  handleClick: (data: string) => void
}) => {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)

  // Memoize message signature (so we only decrypt when truly needed)
  const messageSignature = useMemo(
    () => `${message.imgUrl}-${message.key}-${message.iv}-${message.image_type}`,
    [message.imgUrl, message.key, message.iv, message.image_type]
  )

  const lastMessageSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastMessageSignatureRef.current === messageSignature) {
      // Prevent refetching
      return
    }

    let isMounted = true

    const decrypt = async () => {
      const url = await decryptFileFromUrlAndGetUrl({
        encryptedFileUrl: message.imgUrl,
        key: message.key,
        iv: message.iv,
        mimeType: message.image_type,
      })
      if (isMounted) {
        setDecryptedUrl(url)
        lastMessageSignatureRef.current = messageSignature // mark as fetched
      }
    }

    decrypt()

    return () => {
      isMounted = false
    }
  }, [messageSignature])

  return useMemo(() => {
    return (
      <div className="w-[250px] h-[250px] m-2 relative">
        {decryptedUrl && (
          <Image
            src={decryptedUrl}
            fill
            className="cursor-pointer object-cover rounded"
            alt="image"
            onClick={()=>handleClick(decryptedUrl)}
          />
        )}
      </div>
    )
  }, [decryptedUrl, handleClick])
}

const ImageDialog = ({
  src,
  onClose,
  open,
}: {
  open: boolean
  src: string
  onClose: () => void
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="min-w-[750px]">
        <DialogDescription className="relative h-[450px] flex justify-center">
          <Image
            src={src}
            fill
            className="rounded-lg object-contain"
            alt="image"
          />
        </DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

const MessageTime = ({ time, fromMe,status }: { time: string; fromMe: boolean; status: string }) => {
  console.log("Message status:", status)
  return (
    <p className="text-[10px] mt-2 mb-2 self-end flex gap-1 items-center">
      {time} {fromMe && (status === "sent" ? <MessageSentSvg /> : status==="delivered" ? <MessageSeenSvg /> : "hello")}
    </p>
  )
}

const OtherMessageIndicator = () => (
  <div className="absolute bg-white dark:bg-gray-primary top-0 -left-[4px] w-3 h-3 rounded-bl-full" />
)

const SelfMessageIndicator = () => (
  <div className="absolute bg-green-chat top-0 -right-[3px] w-3 h-3 rounded-br-full overflow-hidden" />
)

const TextMessage = ({ message }: { message: IMessage }) => {
  const isLink = /^(ftp|http|https):\/\/[^ "]+$/.test(message.text) // Check if the content is a URL

  return (
    <div>
      {isLink ? (
        <a
          href={message.text}
          target="_blank"
          rel="noopener noreferrer"
          className={`mr-2 text-sm font-light text-blue-400 underline`}
        >
          {message.text}
        </a>
      ) : (
        <p className={`mr-2 text-sm font-light`}>{message.text}</p>
      )}
    </div>
  )
}
