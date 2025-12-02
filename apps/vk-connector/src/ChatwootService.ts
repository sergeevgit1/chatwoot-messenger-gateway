import { 
  ChatwootService as IChatwootService,
  ChatwootClient,
  ChatwootContact
} from '@chatwoot-connectors/shared-types';
import { fetchVkProfile, formatVkName, extractCityName } from '@chatwoot-connectors/shared-utils';
import { VKConfig } from '@chatwoot-connectors/shared-types';

export class ChatwootService implements IChatwootService {
  private readonly client: ChatwootClient;
  private readonly vkConfig: VKConfig;

  constructor(client: ChatwootClient, vkConfig: VKConfig) {
    this.client = client;
    this.vkConfig = vkConfig;
  }

  async ensureContact(params: {
    inbox_id: number;
    search_key: string;
    name?: string;
    phone?: string;
    email?: string;
    custom_attributes: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<{ id: number; source_id: string }> {
    /**
     * Upsert contact and return {'id', 'source_id'}.
     * Strategy:
     * - If custom_attributes contain platform user ids (vk_user_id), FIRST try /contacts/filter.
     * - Else try /contacts/search with search_key (e.g., phone for WhatsApp).
     * - If found -> update attributes (best effort).
     * - If not found -> create with inbox_id + attributes.
     */
    let contacts = [];

    const vkUserId = params.custom_attributes?.vk_user_id;
    const vkIdentifier = vkUserId ? `vk:${vkUserId}` : undefined;

    // 1) Attribute-based lookup
    const attrLookupKeys = [
      'vk_user_id',
      'telegram_user_id'
    ].filter(key => key in (params.custom_attributes || {}));

    if (attrLookupKeys.length > 0) {
      try {
        const res = await this.client.filterContacts(
          Object.fromEntries(
            attrLookupKeys.map(key => [key, params.custom_attributes[key]])
          )
        );
        contacts = (res || {}).payload || [];
      } catch (e) {
        console.warn('[chatwoot] filter_contacts failed:', e);
      }
    }

    // 2) Fallback search
    if (contacts.length === 0) {
      try {
        const res = await this.client.searchContacts(params.search_key);
        contacts = (res || {}).payload || [];
      } catch (e) {
        console.warn('[chatwoot] search_contacts failed:', e);
      }
    }

    // 3) Update or create
    let contact: ChatwootContact;
    if (contacts.length > 0) {
      contact = contacts[0];
      const contactId = parseInt(String(contact.id));
      
      // Update attributes only if provided
      if (params.custom_attributes || params.additional_attributes !== undefined) {
        try {
          await this.client.updateContact({
            contact_id: contactId,
            name: undefined,
            phone_number: undefined,
            email: undefined,
            identifier: vkIdentifier,
            custom_attributes: params.custom_attributes,
            additional_attributes: params.additional_attributes,
          });
        } catch (e) {
          console.warn('[chatwoot] update_contact skipped:', e);
        }
      }

      // Optionally set name if empty
      if (params.name && !(contact.name || '').trim()) {
        try {
          await this.client.updateContact({
            contact_id: contactId,
            name: params.name,
          });
        } catch (e) {
          console.warn('[chatwoot] update name skipped:', e);
        }
      }
    } else {
      const created = await this.client.createContact({
        inbox_id: params.inbox_id,
        name: params.name || params.search_key,
        phone_number: params.phone,
        email: params.email,
        identifier: vkIdentifier,
        custom_attributes: params.custom_attributes || {},
        additional_attributes: params.additional_attributes || {},
      });
      
      const payload = (created || {}).payload || {};
      contact = payload.contact || (created as any).contact || {};
      
      if (!contact && 'id' in (created || {})) {
        contact = created as any;
      }
    }

    // 4) Extract source_id
    const sourceId = this.extractSourceIdForInbox(contact, params.inbox_id) || params.search_key;
    console.info(
      `[chatwoot] ensure_contact ok id=${contact.id} inbox=${params.inbox_id} source_id=${sourceId}`
    );
    
    return { 
      id: parseInt(String(contact.id)), 
      source_id: sourceId 
    };
  }

  async ensureConversation(params: {
    inbox_id: number;
    contact_id: number;
    source_id: string;
    custom_attributes?: Record<string, any>;
  }): Promise<number> {
    const res = await this.client.listConversations(params.contact_id);
    const conversations = (res || {}).payload || [];

    for (const conv of conversations) {
      if (conv.status !== 'open' && conv.status !== 'pending') {
        continue;
      }
      
      const nestedSourceId = conv.source_id;
      
      if (nestedSourceId === params.source_id) {
        console.info(`[chatwoot] reuse conversation id=${conv.id}`);
        return parseInt(String(conv.id));
      }
    }

    const extra: Record<string, any> = {};
    if (params.custom_attributes) {
      extra.custom_attributes = params.custom_attributes;
    }

    const created = await this.client.createConversation({
      inbox_id: params.inbox_id,
      source_id: params.source_id,
      contact_id: params.contact_id,
      ...extra,
    });
    
    const convId = (created || {}).id || (
      (created || {}).payload || {}
    ).id;
    
    console.info(`[chatwoot] create conversation id=${convId} inbox=${params.inbox_id}`);
    return parseInt(String(convId));
  }

  async createMessage(params: {
    conversation_id: number;
    content: string;
    direction: 'incoming' | 'outgoing';
  }): Promise<number> {
    const messageType = params.direction === 'incoming' ? 'incoming' : 'outgoing';
    const res = await this.client.sendMessage({
      conversation_id: params.conversation_id,
      content: params.content || '',
      message_type: messageType,
    });
    
    const msgId = (res || {}).id || ((res || {}).payload || {}).id;
    console.info(`[chatwoot] create_message id=${msgId} type=${messageType}`);
    return parseInt(String(msgId));
  }

  async enrichVkContact(fromId: string): Promise<{
    name?: string;
    custom_attributes: Record<string, any>;
    additional_attributes: Record<string, any>;
  }> {
    let vkName: string | undefined;
    const customAttributes: Record<string, any> = { vk_user_id: fromId };
    const additionalAttributes: Record<string, any> = {};

    try {
      const profile = await fetchVkProfile(
        this.vkConfig.access_token,
        this.vkConfig.api_version,
        fromId
      );
      
      const firstName = (profile.first_name || '').trim();
      const lastName = (profile.last_name || '').trim();
      const screenName = (profile.screen_name || '').trim();
      const bdate = (profile.bdate || '').trim() || undefined;

      // Extract city from profile
      const cityName = extractCityName(profile.city);
      if (cityName) {
        additionalAttributes.city = cityName;
      }

      vkName = formatVkName(firstName, lastName, screenName);

      if (bdate) {
        customAttributes.vk_bdate = bdate;
      }
    } catch (e) {
      console.warn('[vk] Failed to fetch profile:', e);
    }

    return {
      name: vkName || fromId,
      custom_attributes: customAttributes,
      additional_attributes: additionalAttributes,
    };
  }

  private extractSourceIdForInbox(
    contact: ChatwootContact, 
    inboxId: number
  ): string | undefined {
    /** Find source_id for a specific inbox in contact_inboxes. */
    for (const ci of (contact.contact_inboxes || [])) {
      const inbox = (ci || {}).inbox || {};
      if (parseInt(String(inbox.id || 0)) === inboxId) {
        const sid = ci.source_id;
        if (sid) {
          return sid;
        }
      }
    }
    return undefined;
  }
}