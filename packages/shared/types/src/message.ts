// Content payloads (discriminated union)
export interface TextContent {
  type: 'text';
  text: string;
}

export interface MediaContent {
  type: 'media';
  media_type: 'image' | 'video' | 'audio' | 'document';
  url: string | { href: string };
  caption?: string;
  filename?: string;
  mime_type?: string;
}

export interface StickerContent {
  type: 'sticker';
  ref: string;
}

export interface ContactContent {
  type: 'contact';
  name: string;
  phone: string;
  org?: string;
}

export interface LocationContent {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
}

export type Content = TextContent | MediaContent | StickerContent | ContactContent | LocationContent;

// Unified message
export interface UnifiedMessage {
  channel: 'whatsapp' | 'telegram' | 'vk';
  recipient_id: string;
  sender_id?: string;
  sender_name?: string;
  content: Content;
  raw?: Record<string, any>;
}

// Message handler type
export type OnMessage = (message: UnifiedMessage) => Promise<void>;

// Adapter capabilities
export type AdapterCapabilities = Set<string>;

// Messenger adapter interface
export interface MessengerAdapter {
  onMessage(cb: OnMessage): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText(recipientId: string, content: TextContent): Promise<void>;
  sendMedia?(recipientId: string, content: MediaContent): Promise<void>;
  sendSticker?(recipientId: string, content: StickerContent): Promise<void>;
  sendContact?(recipientId: string, content: ContactContent): Promise<void>;
  sendLocation?(recipientId: string, content: LocationContent): Promise<void>;
  capabilities(): AdapterCapabilities;
}