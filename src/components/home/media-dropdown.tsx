import { useContext, useEffect, useRef, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { ImageIcon, Plus, Video } from "lucide-react"
import { Dialog, DialogContent, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import Image from "next/image"
import ReactPlayer from "react-player"
import toast from "react-hot-toast"
import { useConversationStore } from "@/store/chat-store"
import {  encryptFileAES, getMe, HandleSendMessage } from "@/lib/utils"
import { sendMessage } from "@/lib/signal/signal"
import chatStoreInstance from "@/lib/chatStoreInstance"
import { SocketInterface } from "@/lib/types"
import { SocketContext } from "@/hooks/socket"
const MediaDropdown = () => {
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
  const me=getMe()
  const [isLoading, setIsLoading] = useState(false)
const { socket, handlemessage, setMessages: setMessagesInContext } =
    useContext<SocketInterface | null>(SocketContext) || {};
  // const generateUploadUrl = useMutation(api.conversations.generateUploadUrl)
  // const sendImage = useMutation(api.messages.sendImage)
  // const sendVideo = useMutation(api.messages.sendVideo)
 

  const { selectedChat } = useConversationStore()

  const handleSendImage = async () => {
    setIsLoading(true);
    try {
      // Step 1: Get a short-lived upload URL
      const { encryptedData, iv, key } = await encryptFileAES(selectedImage);
      const encryptedFile = new File(
        [encryptedData.buffer],
        "encrypted_image.enc",
        {
          type: "application/octet-stream",
        }
      );

      const formData = new FormData();
      formData.append("file", encryptedFile);
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const result = await fetch(`${url}/api/user/media-upload`, {
        method: "POST",
        body: formData,
      });

      const response = await result.json();
      console.log("this is response", response, iv, key);
      const data = {
        imgUrl: response.url,
        image_type: selectedImage?.type,
        iv,
        key,
        messageType: "image",
        text: "",
      };

      HandleSendMessage(selectedChat, JSON.stringify(data), socket,"direct_message");

      // Step 3: Save the newly allocated storage id to the database
      // await sendImage({
      //   conversation: selectedChat!._id,
      //   imgId: storageId,
      //   sender: me!._id,
      // });

      setSelectedImage(null);
    } catch (err) {
      toast.error("Failed to send image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVideo = async () => {
    setIsLoading(true)
    try {
        const { encryptedData, iv, key } = await encryptFileAES(selectedVideo);
      const encryptedFile = new File(
        [encryptedData.buffer],
        "encrypted_video.enc",
        {
          type: "application/octet-stream",
        }
      );

      const formData = new FormData();
      formData.append("file", encryptedFile);
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const result = await fetch(`${url}/api/user/media-upload`, {
        method: "POST",
        body: formData,
      });

      const response = await result.json();
      console.log("this is response", response, iv, key);
      const data = {
        imgUrl: response.url,
        image_type: selectedVideo?.type,
        iv,
        key,
        messageType: "video",
        text: "",
      };

      HandleSendMessage(selectedChat, JSON.stringify(data), socket,"direct_message");


      setSelectedVideo(null)
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <input
        type="file"
        ref={imageInput}
        accept="image/*"
        onChange={(e) => setSelectedImage(e.target.files![0])}
        hidden
      />

      <input
        type="file"
        ref={videoInput}
        accept="video/*"
        onChange={(e) => setSelectedVideo(e.target?.files![0])}
        hidden
      />

      {selectedImage && (
        <MediaImageDialog
          isOpen={selectedImage !== null}
          onClose={() => setSelectedImage(null)}
          selectedImage={selectedImage}
          isLoading={isLoading}
          handleSendImage={handleSendImage}
        />
      )}

      {selectedVideo && (
        <MediaVideoDialog
          isOpen={selectedVideo !== null}
          onClose={() => setSelectedVideo(null)}
          selectedVideo={selectedVideo}
          isLoading={isLoading}
          handleSendVideo={handleSendVideo}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Plus className="text-gray-600 dark:text-gray-400" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => imageInput.current!.click()}>
            <ImageIcon size={18} className="mr-1" /> Photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => videoInput.current!.click()}>
            <Video size={20} className="mr-1" />
            Video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
export default MediaDropdown

type MediaImageDialogProps = {
  isOpen: boolean
  onClose: () => void
  selectedImage: File
  isLoading: boolean
  handleSendImage: () => void
}

const MediaImageDialog = ({
  isOpen,
  onClose,
  selectedImage,
  isLoading,
  handleSendImage,
}: MediaImageDialogProps) => {
  const [renderedImage, setRenderedImage] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedImage) return
    const reader = new FileReader()
    reader.onload = (e) => setRenderedImage(e.target?.result as string)
    reader.readAsDataURL(selectedImage)
  }, [selectedImage])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogDescription className="flex flex-col gap-10 justify-center items-center">
          {renderedImage && (
            <Image
              src={renderedImage}
              width={300}
              height={300}
              alt="selected image"
            />
          )}
          <Button
            className="w-full"
            disabled={isLoading}
            onClick={handleSendImage}
          >
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

type MediaVideoDialogProps = {
  isOpen: boolean
  onClose: () => void
  selectedVideo: File
  isLoading: boolean
  handleSendVideo: () => void
}

const MediaVideoDialog = ({
  isOpen,
  onClose,
  selectedVideo,
  isLoading,
  handleSendVideo,
}: MediaVideoDialogProps) => {
  const renderedVideo = URL.createObjectURL(
    new Blob([selectedVideo], { type: "video/*" })
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogDescription>Video</DialogDescription>
        <div className="w-full">
          {renderedVideo && (
            <ReactPlayer url={renderedVideo} controls width="100%" />
          )}
        </div>
        <Button
          className="w-full"
          disabled={isLoading}
          onClick={handleSendVideo}
        >
          {isLoading ? "Sending..." : "Send"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
