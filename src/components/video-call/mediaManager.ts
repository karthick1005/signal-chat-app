// mediaManager.ts

let localStream: MediaStream | null = null;
let streamPromise: Promise<MediaStream> | null = null;
let usageCount = 0;

export async function getLocalStream(): Promise<MediaStream> {
  if (localStream) {
    usageCount++;
    console.log("🔁 Reusing MediaStreams:", localStream.id, `(users: ${usageCount})`);
    return localStream;
  }

  if (!streamPromise) {
    console.log("🎥 Creating new MediaStreams (audio + video)");
    streamPromise = navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStream = stream;
        usageCount = 1;
        console.log("🎥 Created new MediaStreams:", stream.id);
        return stream;
      })
      .catch((err) => {
        console.error("❌ Failed to get user media:", err);
        streamPromise = null;
        throw err;
      });
  } else {
    console.log("⏳ Waiting for pending MediaStreams creation...");
    usageCount++;
  }

  return streamPromise;
}

export function stopLocalStream(): void {
  if (usageCount > 0) usageCount--;
  console.log(`🔽 MediaStreams usage count: ${usageCount}`);

  if (usageCount <= 0 && localStream) {
    console.log("🛑 Stopping all tracks of MediaStreams:", localStream.id);
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    streamPromise = null;
    usageCount = 0;
  }
}
