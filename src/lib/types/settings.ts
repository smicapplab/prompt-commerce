export interface StoreSettings {
    ai_enabled?: boolean | string;
    ai_provider?: string;
    ai_api_key?: string;
    ai_model?: string;
    ai_system_prompt?: string;
    
    // API Key status flags (set by server)
    claude_api_key_set?: boolean;
    gemini_api_key_set?: boolean;
    openai_api_key_set?: boolean;
    serper_api_key_set?: boolean;
    telegram_bot_token_set?: boolean;
    payment_api_key_set?: boolean;

    telegram_bot_token?: string;
    telegram_notify_chat_id?: string;
    telegram_enabled?: boolean | string;
    
    whatsapp_enabled?: boolean | string;
    whatsapp_notify_number?: string;
    
    google_places_browser_key?: string;
    google_maps_embed_key?: string;
    
    payment_methods?: string[];
    allows_pickup?: boolean | string;

    // Store display settings
    store_display_name?: string;
    store_currency?: string;
    store_timezone?: string;

    [key: string]: any; // Index signature for val() helper and dynamic access
}
