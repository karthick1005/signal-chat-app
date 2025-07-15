interface KeyPair {
  pubKey: ArrayBuffer;
  privKey: ArrayBuffer;
}

interface PreKey {
  keyId: number;
  keyPair: KeyPair;
}

interface SignedPreKey {
  keyId: number;
  keyPair: KeyPair;
  signature: ArrayBuffer;
}

interface SignalProtocolAddress {
  getName(): string;
  getDeviceId(): number;
  toString(): string;
  equals(other: SignalProtocolAddress): boolean;
}

interface LibSignal {
  KeyHelper: {
    generateRegistrationId(unsigned?: boolean): number;
    generateIdentityKeyPair(): Promise<KeyPair>;
    generatePreKey(keyId: number): Promise<PreKey>;
    generateSignedPreKey(identityKeyPair: KeyPair, keyId: number): Promise<SignedPreKey>;
  };

  SignalProtocolAddress: {
    new(name: number, deviceId: number): SignalProtocolAddress;
    fromString(encodedAddress: string): SignalProtocolAddress;
  };

  SessionBuilder: new (store: any, address: SignalProtocolAddress) => {
    processPreKey(device: any): Promise<void>;
    processV3(record: any, message: any): Promise<void>;
  };

  SessionCipher: new (store: any, address: SignalProtocolAddress) => {
    encrypt(buffer: string, encoding?: string): Promise<any>;
    decryptPreKeyWhisperMessage(ciphertext: any, encoding?: string): Promise<ArrayBuffer>;
    decryptWhisperMessage(ciphertext: any, encoding?: string): Promise<ArrayBuffer>;
    getRemoteRegistrationId(): Promise<number | null | undefined>;
    hasOpenSession(): Promise<boolean>;
    closeOpenSessionForDevice(): Promise<void>;
    deleteAllSessionsForDevice(): Promise<void>;
  };
}

  export type { KeyPair, PreKey, SignedPreKey, LibSignal };