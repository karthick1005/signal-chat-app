"use client";

import chatStoreInstance from "../chatStoreInstance";
import { recipientBundle } from "../types";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../utils";
import ChatStore from "./ChatStore";
import { LibSignal } from "./interface";
import MySignalProtocolStore from "./SignalProtocolStore";
// import { arrayBufferToBase64,base64ToArrayBuffer } from "../utils";
import { v4 as uuidv4 } from "uuid";
declare global {
  interface Window {
    libsignal: LibSignal;
  }
}
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};
export const Libinit=async()=>{
 loadScript("./libsignal-protocol.js")
  .then(async() => {
    console.log("Script loaded!");
  })
  .catch(console.error);
}
export const keyInitialize = async () => {
  const store = new MySignalProtocolStore();
  const libsignal: LibSignal = window.libsignal;
  const KeyHelper = libsignal.KeyHelper;

  // Generate registration ID
  const registrationId: number = KeyHelper.generateRegistrationId();
  await store.put("registrationId", registrationId);

  // Generate identity key pair
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  await store.put("identityKey", identityKeyPair);

  // Generate signed prekey
  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, registrationId);
  await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

   const preKeyStartId = Math.floor(Math.random() * 1000000);
  const preKeyCount = 20;
  await generateAndStorePreKeys(preKeyStartId, preKeyCount);

  // ✅ Extract public preKeys to upload
  const preKeysToUpload = [];
  for (let i = 0; i < preKeyCount; i++) {
    const keyId = preKeyStartId + i;
    const keyPair  = await store.loadPreKey(keyId);
    console.log("PreKey check:", keyPair)
    preKeysToUpload.push({
      keyId,
      publicKey: arrayBufferToBase64(keyPair.pubKey)
    });
  }

  // Construct the preKey bundle
  const preKeyBundle = {
    registrationId,
    identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
    signedPreKey: {
      keyId: Number(signedPreKey.keyId),
      publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      signature: arrayBufferToBase64(signedPreKey.signature),
    },
    preKeys: preKeysToUpload
  };

  // Store locally for session creation
  const myLocalData = {
    identityKeyPair: {
      pubKey: arrayBufferToBase64(identityKeyPair.pubKey),
      privKey: arrayBufferToBase64(identityKeyPair.privKey),
    },
    signedPreKey: {
      keyId:Number(signedPreKey.keyId),
      pubKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      privKey: arrayBufferToBase64(signedPreKey.keyPair.privKey),
      signature: arrayBufferToBase64(signedPreKey.signature),
    },
    preKeys: preKeysToUpload,
    registrationId,
  };

  localStorage.setItem("preKeyBundle", JSON.stringify(myLocalData));

  console.log("Key Initialization Complete:", preKeyBundle);
  return preKeyBundle;
};


export const createSession = async (recipientBundle: recipientBundle) => {
  const libsignal: LibSignal =window.libsignal;
  const store = new MySignalProtocolStore();

  // // Retrieve stored key bundle from localStorage
  // const storedData = JSON.parse(localStorage.getItem("preKeyBundle") || "{}");

  // if (!storedData.identityKeyPair || !storedData.signedPreKey || !storedData.preKey) {
  //   console.error("❌ Missing stored key data.");
  //   return;
  // }

  // Ensure recipientId is a number
  const recipientId = typeof recipientBundle.registrationId === 'string'
    ? parseInt(recipientBundle.registrationId, 10)
    : recipientBundle.registrationId;

  if (isNaN(recipientId)) {
    console.error("❌ Invalid recipientId:", recipientBundle.registrationId);
    return;
  }

  console.log("✅ Store initialized with pre-keys.");
  console.log("Recipient bundle:", {
    registrationId: recipientId,
    originalType: typeof recipientBundle.registrationId,
    convertedType: typeof recipientId
  });

  try {
    const address = new libsignal.SignalProtocolAddress(recipientId, 1);
    const existingSession = await store.loadSession(address.toString());

    if (existingSession) {
      console.log("✅ Session already exists for:", recipientId);

      // decryptMessage()
      // sendMessage(recipientId, "Hello world! how are you bro are you fine");
      return recipientId;
    }

    console.log("⚡ No existing session found. Creating new one...");

    const sessionBuilder = new libsignal.SessionBuilder(store, address);
    await sessionBuilder.processPreKey({
      registrationId: recipientId, // Use the converted numeric value
      identityKey: base64ToArrayBuffer(recipientBundle.identityKey),
      signedPreKey: {
        keyId: Number(recipientBundle.signedPreKey.keyId), // Ensure numeric type
        publicKey: base64ToArrayBuffer(recipientBundle.signedPreKey.publicKey),
        signature: base64ToArrayBuffer(recipientBundle.signedPreKey.signature),
      },
      preKey: recipientBundle.preKey
        ? {
            keyId: Number(recipientBundle.preKey.keyId), // Ensure numeric type
            publicKey: base64ToArrayBuffer(recipientBundle.preKey.publicKey),
          }
        : undefined,
    });

    console.log("✅ Session successfully established for:", recipientId);
    
    // Try sending a test message
    // sendMessage(recipientId, "Hello world!");
    return recipientId
  } catch (error) {
    console.error("❌ Error creating session:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
};

export const sendMessage = async (recipientId: string | number, plaintext: string,senderId: string | number,recipientUserId:string,iscall=false) => {
  const libsignal: LibSignal = window.libsignal;
  const store = new MySignalProtocolStore();
  // Ensure recipientId is a number
  const recipientIdNumber = typeof recipientId === "string" ? parseInt(recipientId, 10) : recipientId;
  if (isNaN(recipientIdNumber)) {
    console.error("❌ Invalid recipientId:", recipientId);
    return;
  }

  const address = new libsignal.SignalProtocolAddress(recipientIdNumber, 1);
  console.log("📌 Using recipient ID:", recipientIdNumber, "with type:", typeof recipientIdNumber);

  const existingSession = await store.loadSession(address.toString());
  if (!existingSession) {
    console.error("❌ No session found for", recipientIdNumber);
    return;
  }

  const sessionCipher = new libsignal.SessionCipher(store, address);
  console.log("📌 SessionCipher initialized");

  try {
    // // Convert string to ArrayBuffer
    // const encoder = new TextEncoder();
    // const plaintextArray = encoder.encode(plaintext);
    
    
    console.log("📌 About to encrypt:", {
      plaintextType: plaintext,
      plaintextLength: plaintext.length,
      // arrayType: plaintextArray.constructor.name,
      // arrayLength: plaintextArray.length
    });
    
    // Try both approaches to see which works
    // let ciphertext;
    // try {
    //   // Approach 1: Use Uint8Array directly
    //   ciphertext = await sessionCipher.encrypt(plaintext);
    // } catch (e) {
    //   console.log("First encryption approach failed, trying alternative...");
    //   // Approach 2: Use ArrayBuffer
    //   ciphertext = await sessionCipher.encrypt(plaintextArray.buffer);
    // }
    const id=uuidv4()
    let ciphertext = await sessionCipher.encrypt(plaintext);
    ciphertext.messageId=id
    if(!iscall){
    await chatStoreInstance.saveMessage({
      id: id, // Generate a unique ID for the message
      chatId: recipientUserId,
      senderId:Number(senderId),
      text: plaintext,
      _creationTime: Date.now(),
      read: false,
      sender:{
        _id: localStorage.getItem("userId")!,
        name: localStorage.getItem("username")!
      },
    })
  }
    // console.log("📩 Encrypted Message:", ciphertext);
    console.log(typeof ciphertext.body)
    // ciphertext.body = uint8ArrayToBase64(ciphertext.body);

    console.log("📩 Encrypted Message:", ciphertext);
    return ciphertext;
  } catch (error) {
    console.error("❌ Error encrypting message:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Log session information for debugging
    console.log("Session data for debugging:", existingSession);
  }
};
 const generateAndStorePreKeys = async (startId = 1000, count = 20) => {
  const libsignal: LibSignal = window.libsignal;
  const store = new MySignalProtocolStore();

  for (let i = 0; i < count; i++) {
    const keyId = startId + i;
    const preKey = await libsignal.KeyHelper.generatePreKey(keyId);
   await store.storePreKey(preKey.keyId, preKey.keyPair);
  }

  console.log(`✅ ${count} PreKeys generated and stored starting from ID ${startId}`);
};
export const generatePreKey= async (startId = 1000, count = 20) => {
  const libsignal: LibSignal = window.libsignal;
  const store = new MySignalProtocolStore();
  const prekeys=[]
  for (let i = 0; i < count; i++) {
    const keyId = startId + i;
    const preKey = await libsignal.KeyHelper.generatePreKey(keyId);
   await store.storePreKey(preKey.keyId, preKey.keyPair);
    prekeys.push({
      keyId:preKey.keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey)
    });
  }

  return prekeys
};
// export const decryptMessage = async (encryptedMessage: {
//   body: ArrayBuffer | Uint8Array | string;
//   type: number; // 1 for WhisperMessage, 3 for PreKeyWhisperMessage
//   messageId: string;
// }, senderId: string,senderName:string,senderUserId:string) => {
//   const libsignal: LibSignal = window.libsignal;
//   const store = new MySignalProtocolStore();
//   const chatStoreInstance=new ChatStore()

//   const senderIdNumber = typeof senderId === "string" ? parseInt(senderId, 10) : senderId;
//   if (isNaN(senderIdNumber)) {
//     console.error("❌ Invalid senderId:", senderId);
//     return;
//   }

//   const address = new libsignal.SignalProtocolAddress(senderIdNumber, 1);
//   console.log("📩 Decrypting message from:", senderIdNumber);

//   // Ensure there's a session or create a new one from PreKey
//   const sessionCipher = new libsignal.SessionCipher(store, address);
//   console.log("📌 SessionCipher initialized for decryption.");

//   try {
//     const messageBody = encryptedMessage.body
//     const messageType = encryptedMessage.type;

//     if (!messageBody || typeof messageType !== "number") {
//       console.error("❌ Invalid encrypted message format.");
//       return;
//     }

//     let decryptedArrayBuffer;

//     if (messageType === 3) {
//       console.log("🔓 Decrypting PreKeyWhisperMessage");
//       decryptedArrayBuffer = await sessionCipher.decryptPreKeyWhisperMessage(messageBody, 'binary');
//     } else if (messageType === 1) {
//       console.log("🔓 Decrypting WhisperMessage");
//       decryptedArrayBuffer = await sessionCipher.decryptWhisperMessage(messageBody, 'binary');
//     } else {
//       console.error("❌ Unsupported message type:", messageType);
//       return;
//     }

//     const decryptedText = new TextDecoder().decode(decryptedArrayBuffer);
    
//      chatstore.saveMessage({
//       id:encryptedMessage.messageId,
//       chatId: senderUserId,
//       senderId:Number(senderId),
//       text: decryptedText,
//       timestamp: Date.now(),
//       read: false,
//       senderName: senderName
//     })
//     console.log("✅ Decrypted Message:", decryptedText);
    
//     return { decryptedText, messageId: encryptedMessage.messageId };

//   } catch (error) {
//     console.error("❌ Error decrypting message:", error);
//     throw new Error(error instanceof Error ? error.message : JSON.stringify(error));
//   }
// };
export const decryptMessage = async (
  encryptedMessage: {
    body: ArrayBuffer | Uint8Array | string;
    type: number; // 1 = WhisperMessage, 3 = PreKeyWhisperMessage
    messageId: string;
  },
  senderId: string,
  senderName: string,
  senderUserId: string,
  call = false
) => {
  const libsignal: LibSignal = window.libsignal;
  const store = new MySignalProtocolStore();

  const senderIdNumber = typeof senderId === "string" ? parseInt(senderId, 10) : senderId;
  if (isNaN(senderIdNumber)) {
    console.error("❌ Invalid senderId:", senderId);
    return;
  }

  const address = new libsignal.SignalProtocolAddress(senderIdNumber, 1);
  const messageType = encryptedMessage.type;
  const messageBody = encryptedMessage.body;

  if (!messageBody || typeof messageType !== "number") {
    console.error("❌ Invalid encrypted message format.");
    return;
  }

  console.log("📩 Decrypting message from:", senderIdNumber);
// const preKey = await store.loadPreKey(27860);

// console.log("PreKey check:", {
//   pubKey: preKey?.keyPair?.pubKey?.byteLength,
//   privKey: preKey?.keyPair?.privKey?.byteLength
// });
  const tryDecrypt = async (sessionCipher: any) => {
    if (messageType === 3) {
      console.log("🔓 Decrypting PreKeyWhisperMessage");
      return await sessionCipher.decryptPreKeyWhisperMessage(messageBody, 'binary');
    } else if (messageType === 1) {
      console.log("🔓 Decrypting WhisperMessage");
      return await sessionCipher.decryptWhisperMessage(messageBody, 'binary');
    } else {
      throw new Error("Unsupported message type: " + messageType);
    }
  };

  try {
    const sessionCipher = new libsignal.SessionCipher(store, address);
    const decryptedArrayBuffer = await tryDecrypt(sessionCipher);
    const decryptedText = new TextDecoder().decode(decryptedArrayBuffer);
    if(!call){
    chatStoreInstance.saveMessage({
      id: encryptedMessage.messageId,
      chatId: senderUserId,
      senderId: senderIdNumber,
      text: decryptedText,
      _creationTime: Date.now(),
      read: false,
      sender:{
        _id: senderUserId,
        name: senderName
      }
    });
  }
    console.log("✅ Decrypted Message:", decryptedText);
    return { decryptedText, messageId: encryptedMessage.messageId };

  } catch (error: any) {
    console.error("❌ Initial decryption failed:", error);

    const errorMsg = (error instanceof Error ? error.message : JSON.stringify(error)) || "";

    const isSessionIssue = [
      "Missing Signed PreKey",
      "Bad MAC",
      "Untrusted identity key",
      "No record",
      "Session key not found"
    ].some(msg => errorMsg.includes(msg));

    if (messageType === 3 && isSessionIssue) {
      console.warn("⚠️ Resetting session due to decryption issue...");
      await store.removeSession(address.toString());
await store.removeIdentityKey(address.toString());
      try {
        const freshCipher = new libsignal.SessionCipher(store, address);
        const decryptedArrayBuffer = await tryDecrypt(freshCipher);
        const decryptedText = new TextDecoder().decode(decryptedArrayBuffer);
        if(!call){
        chatStoreInstance.saveMessage({
          id: encryptedMessage.messageId,
          chatId: senderUserId,
          senderId: senderIdNumber,
          text: decryptedText,
          _creationTime: Date.now(),
          read: false,
          sender: {
            _id: senderUserId,
            name: senderName
          }
        });
      }
        console.log("✅ Decrypted after session reset:", decryptedText);
        return { decryptedText, messageId: encryptedMessage.messageId };

      } catch (retryError) {
        console.error("❌ Retry decryption failed:", retryError);
        throw new Error(retryError instanceof Error ? retryError.message : JSON.stringify(retryError));
      }
    } else {
      throw new Error(errorMsg);
    }
  }
};

// MySignalProtocolStore class should be defined elsewhere in your code





{

// export const createSession = async (preKeyBundle: any) => {
//   const libsignal: any = (window as any).libsignal;

//   // Retrieve stored key bundle from localStorage
//   const storedData = JSON.parse(localStorage.getItem("preKeyBundle") || "{}");

//   if (!storedData.identityKeyPair || !storedData.signedPreKey || !storedData.preKey) {
//     console.error("Missing stored key data.");
//     return;
//   }

//   // Initialize Signal Protocol Store
//   const store = new MySignalProtocolStore();
//   await store.put("identityKey", {
//     pubKey: base64ToArrayBuffer(storedData.identityKeyPair.pubKey),
//     privKey: base64ToArrayBuffer(storedData.identityKeyPair.privKey),
//   });

//   await store.put("registrationId", storedData.registrationId);

//   await store.storeSignedPreKey(storedData.signedPreKey.keyId, {
//     pubKey: base64ToArrayBuffer(storedData.signedPreKey.pubKey),
//     privKey: base64ToArrayBuffer(storedData.signedPreKey.privKey),
//   });

//   await store.storePreKey(storedData.preKey.keyId, {
//     pubKey: base64ToArrayBuffer(storedData.preKey.pubKey),
//     privKey: base64ToArrayBuffer(storedData.preKey.privKey),
//   });

//   console.log("Store initialized with prekeys.");

//   try {
//     // Generate Ephemeral Key for the session
//     const ephemeralKeyPair = await libsignal.KeyHelper.generatePreKey(0);
//     const identityKeyPair = {
//       pubKey: base64ToArrayBuffer(storedData.identityKeyPair.pubKey),
//       privKey: base64ToArrayBuffer(storedData.identityKeyPair.privKey),
//     };

//     // Compute X3DH shared secrets using ECDH
//     const sharedSecret1 = await libsignal.Curve.calculateAgreement(
//       base64ToArrayBuffer(preKeyBundle.identityKey),
//       ephemeralKeyPair.keyPair.privKey
//     );

//     const sharedSecret2 = await libsignal.Curve.calculateAgreement(
//       base64ToArrayBuffer(preKeyBundle.signedPreKey.publicKey),
//       identityKeyPair.privKey
//     );

//     const sharedSecret3 = await libsignal.Curve.calculateAgreement(
//       base64ToArrayBuffer(preKeyBundle.signedPreKey.publicKey),
//       ephemeralKeyPair.keyPair.privKey
//     );

//     // Concatenate shared secrets
//      // 🔹 Manually concatenate shared secrets
//      const combinedSecrets = new Uint8Array(
//       sharedSecret1.byteLength + sharedSecret2.byteLength + sharedSecret3.byteLength
//     );

//     combinedSecrets.set(new Uint8Array(sharedSecret1), 0);
//     combinedSecrets.set(new Uint8Array(sharedSecret2), sharedSecret1.byteLength);
//     combinedSecrets.set(new Uint8Array(sharedSecret3), sharedSecret1.byteLength + sharedSecret2.byteLength);


//     // Generate a random 32-byte salt
//     const salt = new Uint8Array(32);
//     crypto.getRandomValues(salt);

//     // Derive session key from shared secrets using HKDF
//     const masterSecret = await hkdf(combinedSecrets, salt, "X3DH Key Derivation", 32);

//     // Store the session key
//     localStorage.setItem(
//       `session-key-${preKeyBundle.registrationId}`,
//       arrayBufferToBase64(masterSecret)
//     );

//     console.log("✅ X3DH session key established!",arrayBufferToBase64(masterSecret));
//     // return masterSecret;
//   } catch (error) {
//     console.error("❌ Error creating session:", error);
//   }
// };

// // 🔹 HKDF (HMAC-based Extract-and-Expand Key Derivation Function)
// async function hkdf(
//   inputKey: ArrayBuffer,
//   salt: Uint8Array,
//   info: string,
//   length: number = 32
// ) {
//   const keyMaterial = await crypto.subtle.importKey(
//     "raw",
//     inputKey,
//     { name: "HMAC", hash: "SHA-256" },
//     false,
//     ["sign"]
//   );

//   // Extract step: PRK = HMAC(salt, inputKey)
//   const prk = await crypto.subtle.sign({ name: "HMAC" }, keyMaterial, salt);

//   // Expand step
//   let output = new Uint8Array();
//   let previous = new Uint8Array();
//   const infoBuffer = new TextEncoder().encode(info);

//   for (let i = 1; output.byteLength < length; i++) {
//     const hmacKey = await crypto.subtle.importKey(
//       "raw",
//       prk,
//       { name: "HMAC", hash: "SHA-256" },
//       false,
//       ["sign"]
//     );

//     const message = new Uint8Array([...previous, ...infoBuffer, i]);
//     previous = new Uint8Array(await crypto.subtle.sign({ name: "HMAC" }, hmacKey, message));
//     output = new Uint8Array([...output, ...previous]);
//   }

//   return output.slice(0, length);
// }
}




