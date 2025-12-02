import fetch from 'node-fetch';
import {
  ChatwootClient as IChatwootClient,
  ChatwootContact,
  ChatwootConversationResponse,
  ChatwootMessageResponse
} from '@chatwoot-connectors/shared-types';

export class ChatwootClient implements IChatwootClient {
  private readonly baseUrl: string;
  private readonly accountId: number;
  private readonly accountBase: string;
  private readonly headers: Record<string, string>;

  constructor(apiAccessToken: string, accountId: number, baseUrl: string) {
    // Normalize base_url and store common parts
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accountId = accountId;

    // Precomputed base for account-scoped endpoints
    this.accountBase = `${this.baseUrl}/api/v1/accounts/${this.accountId}`;

    // Static headers with API token (add both headers for compatibility)
    this.headers = {
      'Content-Type': 'application/json',
      'api_access_token': apiAccessToken,
      'Authorization': `Bearer ${apiAccessToken}`,
    };
  }

  // Contacts
  async searchContacts(q: string): Promise<Record<string, any>> {
    const url = `${this.accountBase}/contacts/search`;
    const params = new URLSearchParams({ q });
    
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  async filterContacts(attrs: Record<string, any>): Promise<Record<string, any>> {
    /**
     * Filter contacts by attributes supported by /contacts/filter.
     * attribute_key MUST be the raw key (e.g., "vk_user_id"), not "custom_attribute_*".
     */
    const url = `${this.accountBase}/contacts/filter`;
    const filters = [];
    
    for (const [key, value] of Object.entries(attrs)) {
      filters.push({
        attribute_key: key,
        filter_operator: 'equal_to',
        values: [String(value)],
      });
    }
    
    const payload = { payload: filters };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  async createContact(params: {
    inbox_id: number;
    name?: string;
    phone_number?: string;
    email?: string;
    identifier?: string;
    custom_attributes?: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<Record<string, any>> {
    const url = `${this.accountBase}/contacts`;
    const payload: Record<string, any> = { inbox_id: params.inbox_id };

    if (params.name) payload.name = params.name;
    if (params.phone_number) {
      payload.phone_number = params.phone_number.startsWith('+') 
        ? params.phone_number 
        : `+${params.phone_number}`;
    }
    if (params.email) payload.email = params.email;
    if (params.identifier) payload.identifier = params.identifier;
    if (params.custom_attributes) payload.custom_attributes = params.custom_attributes;
    if (params.additional_attributes) payload.additional_attributes = params.additional_attributes;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  async updateContact(params: {
    contact_id: number;
    name?: string;
    phone_number?: string;
    email?: string;
    identifier?: string;
    custom_attributes?: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<Record<string, any>> {
    const url = `${this.accountBase}/contacts/${params.contact_id}`;
    const payload: Record<string, any> = {};
    
    if (params.name !== undefined) payload.name = params.name;
    if (params.phone_number !== undefined) {
      payload.phone_number = params.phone_number.startsWith('+') 
        ? params.phone_number 
        : `+${params.phone_number}`;
    }
    if (params.email !== undefined) payload.email = params.email;
    if (params.identifier !== undefined) payload.identifier = params.identifier;
    if (params.custom_attributes !== undefined) payload.custom_attributes = params.custom_attributes;
    if (params.additional_attributes !== undefined) payload.additional_attributes = params.additional_attributes;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  // Conversations
  async listConversations(contactId: number): Promise<Record<string, any>> {
    const url = `${this.accountBase}/contacts/${contactId}/conversations`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  async createConversation(params: {
    inbox_id: number;
    source_id: string;
    contact_id?: number;
    custom_attributes?: Record<string, any>;
  }): Promise<Record<string, any>> {
    const url = `${this.accountBase}/conversations`;
    const payload: Record<string, any> = {
      source_id: params.source_id, 
      inbox_id: params.inbox_id
    };
    
    if (params.contact_id) payload.contact_id = params.contact_id;
    if (params.custom_attributes) payload.custom_attributes = params.custom_attributes;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  // Messages
  async sendMessage(params: {
    conversation_id: number;
    content: string;
    message_type?: 'incoming' | 'outgoing';
  }): Promise<Record<string, any>> {
    const url = `${this.accountBase}/conversations/${params.conversation_id}/messages`;
    const payload: Record<string, any> = { 
      content: params.content 
    };
    
    if (params.message_type) payload.message_type = params.message_type;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Record<string, any>;
  }

  // Webhooks
  public async createWebhook(params: {
    webhook_url: string;
    subscriptions: string[];
  }): Promise<Record<string, any>> {
    const url = `${this.accountBase}/webhooks`;
    const payload: Record<string, any> = {
      webhook_url: params.webhook_url,
      subscriptions: params.subscriptions
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    return response.json() as Record<string, any>;
  }
}