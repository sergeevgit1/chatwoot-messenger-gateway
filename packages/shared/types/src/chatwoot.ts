// Chatwoot webhook types
export interface ChatwootConversationMeta {
  channel?: 'whatsapp' | 'telegram' | 'vk';
  recipient_id?: string;
  sender?: {
    id?: number;
    name?: string;
    email?: string;
    phone_number?: string;
    custom_attributes?: Record<string, any>;
    additional_attributes?: Record<string, any>;
  };
}

export interface ChatwootConversation {
  meta?: ChatwootConversationMeta;
  id?: number;
  messages?: Array<any>;
  status?: string;
}

export interface ChatwootMessageCreatedWebhook {
  event: string;
  message_type?: 'incoming' | 'outgoing';
  private?: boolean;
  content?: string;
  conversation?: ChatwootConversation;
  id?: number;
  created_at?: string;
}

// Chatwoot API response types
export interface ChatwootContact {
  id: number;
  name?: string;
  email?: string;
  phone_number?: string;
  identifier?: string;
  custom_attributes?: Record<string, any>;
  additional_attributes?: Record<string, any>;
  contact_inboxes?: Array<{
    inbox: { id: number };
    source_id: string;
  }>;
}

export interface ChatwootConversationResponse {
  id: number;
  status: string;
  contact_id: number;
  inbox_id: number;
  source_id: string;
}

export interface ChatwootMessageResponse {
  id: number;
  content: string;
  message_type: 'incoming' | 'outgoing';
  conversation_id: number;
}

// Chatwoot client interface
export interface ChatwootClient {
  // Contacts
  searchContacts(q: string): Promise<Record<string, any>>;
  filterContacts(attrs: Record<string, any>): Promise<Record<string, any>>;
  createContact(params: {
    inbox_id: number;
    name?: string;
    phone_number?: string;
    email?: string;
    identifier?: string;
    custom_attributes?: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<Record<string, any>>;
  updateContact(params: {
    contact_id: number;
    name?: string;
    phone_number?: string;
    email?: string;
    identifier?: string;
    custom_attributes?: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<Record<string, any>>;

  // Conversations
  listConversations(contactId: number): Promise<Record<string, any>>;
  createConversation(params: {
    inbox_id: number;
    source_id: string;
    contact_id?: number;
    custom_attributes?: Record<string, any>;
  }): Promise<Record<string, any>>;

  // Messages
  sendMessage(params: {
    conversation_id: number;
    content: string;
    message_type?: 'incoming' | 'outgoing';
  }): Promise<Record<string, any>>;

  // Webhooks
  createWebhook(params: {
    webhook_url: string;
    subscriptions: string[];
  }): Promise<Record<string, any>>;
}

// Chatwoot service interface
export interface ChatwootService {
  ensureContact(params: {
    inbox_id: number;
    search_key: string;
    name?: string;
    phone?: string;
    email?: string;
    custom_attributes: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<{ id: number; source_id: string }>;

  ensureConversation(params: {
    inbox_id: number;
    contact_id: number;
    source_id: string;
    custom_attributes?: Record<string, any>;
  }): Promise<number>;

  createMessage(params: {
    conversation_id: number;
    content: string;
    direction: 'incoming' | 'outgoing';
  }): Promise<number>;
}