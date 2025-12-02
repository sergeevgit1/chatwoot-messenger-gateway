// VK API types
export interface VKMessage {
  id: number;
  from_id: number;
  peer_id: number;
  text: string;
  date: number;
  out?: number;
  attachments?: Array<any>;
  fwd_messages?: Array<any>;
  reply_message?: any;
  important?: boolean;
  random_id?: number;
  conversation_message_id?: number;
  is_hidden?: boolean;
  was_listened?: boolean;
  expire_ttl?: number;
  payload?: string;
  keyboard?: any;
  action?: any;
  update_time?: number;
  source_act?: string;
  source_mid?: number;
  source_message_id?: number;
  source_chat_local_id?: number;
  is_cropped?: boolean;
  members_count?: number;
  admin_author_id?: number;
  is_silent?: boolean;
  is_reply_msg?: boolean;
  is_don?: boolean;
  is_ad?: boolean;
  is_editable?: boolean;
  edit_time?: number;
  is_deleted?: boolean;
  is_pinned?: boolean;
  is_loud?: boolean;
  is_mention?: boolean;
  is_marked_as_spam?: boolean;
  is_subscription_expired?: boolean;
  is_subscription_expired_prolonged?: boolean;
  is_group_channel?: boolean;
  is_sponsored?: boolean;
  is_not_spam?: boolean;
  is_important?: boolean;
  is_hidden_author?: boolean;
  is_expired?: boolean;
  is_expired_ttl?: boolean;
  is_expired_ttl_edit?: boolean;
  is_expired_ttl_delete?: boolean;
  is_expired_ttl_pin?: boolean;
  is_expired_ttl_unpin?: boolean;
  is_expired_ttl_edit_pin?: boolean;
  is_expired_ttl_edit_unpin?: boolean;
  is_expired_ttl_delete_pin?: boolean;
  is_expired_ttl_delete_unpin?: boolean;
  is_expired_ttl_pin_unpin?: boolean;
  is_expired_ttl_edit_pin_unpin?: boolean;
  is_expired_ttl_delete_pin_unpin?: boolean;
  is_expired_ttl_edit_delete_pin?: boolean;
  is_expired_ttl_edit_delete_unpin?: boolean;
  is_expired_ttl_edit_delete_pin_unpin?: boolean;
}

export interface VKCallbackPayload {
  type: string;
  object?: {
    message?: VKMessage;
    client_info?: {
      button_actions: string[];
      keyboard: boolean;
      inline_keyboard: boolean;
      carousel: boolean;
      lang_id: number;
    };
  };
  group_id: number;
  secret?: string;
  event_id?: string;
}

export interface VKUserProfile {
  id: number;
  first_name: string;
  last_name: string;
  screen_name?: string;
  bdate?: string;
  city?: {
    id: number;
    title: string;
  } | string;
  country?: {
    id: number;
    title: string;
  };
  photo_50?: string;
  photo_100?: string;
  photo_200_orig?: string;
  photo_400_orig?: string;
  photo_max?: string;
  photo_max_orig?: string;
  online?: number;
  online_mobile?: number;
  online_app?: number;
  verified?: number;
  trending?: number;
  female?: number;
  has_photo?: number;
  has_mobile?: number;
  is_friend?: number;
  friend_status?: number;
  is_closed?: number;
  can_access_closed?: number;
  university?: number;
  university_name?: string;
  faculty?: number;
  faculty_name?: string;
  graduation?: number;
  education_form?: string;
  education_status?: string;
  home_town?: string;
  relation?: number;
  personal?: {
    political?: number;
    langs?: string[];
    religion?: string;
    inspired_by?: string;
    people_main?: number;
    life_main?: number;
    smoking?: number;
    alcohol?: number;
  };
  universities?: Array<{
    id: number;
    country: number;
    city: number;
    name: string;
    faculty: number;
    faculty_name: string;
    chair: number;
    chair_name: string;
    graduation: number;
    education_form: string;
    education_status: string;
  }>;
  schools?: Array<{
    id: number;
    country: number;
    city: number;
    name: string;
    year_from: number;
    year_to: number;
    year_graduated: number;
    class_letter?: string;
    speciality?: string;
    type?: number;
    type_str?: string;
  }>;
  relatives?: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  occupation?: {
    type?: string;
    id?: number;
    name?: string;
    company?: string;
    position?: string;
  };
  last_seen?: {
    time: number;
    platform: number;
  };
  exports?: string[];
  wall_comments?: number;
  can_post?: number;
  can_see_all_posts?: number;
  can_see_audio?: number;
  can_write_private_message?: number;
  can_friend?: number;
  facebook?: string;
  facebook_name?: string;
  twitter?: string;
  instagram?: string;
  site?: string;
  status?: string;
  status_audio?: {
    id: number;
    owner_id: number;
    artist: string;
    title: string;
    duration: number;
    url?: string;
    lyrics_id?: number;
    album_id?: number;
    genre_id?: number;
    date?: number;
    no_search?: number;
    is_hq?: boolean;
    is_explicit?: boolean;
    is_focus_track?: boolean;
    is_licensed?: boolean;
    content_restricted?: number;
    short_videos_allowed?: number;
    stories_allowed?: number;
    stories_cover_allowed?: number;
  };
  games?: string[];
  is_favorite?: number;
  is_hidden_from_feed?: number;
  timezone?: number;
}

// VK Configuration
export interface VKConfig {
  callback_id: string;
  group_id: number;
  access_token: string;
  secret: string;
  confirmation: string;
  api_version: string;
  inbox_id: number;
}

// VK API response
export interface VKApiResponse<T = any> {
  response: T;
  error?: {
    error_code: number;
    error_msg: string;
    request_params?: Array<{
      key: string;
      value: string;
    }>;
  };
}