import type { Category, ProductVariant } from './catalog.js';

export interface ProductModalProps {
    store: string;
    isEditing: boolean;
    productId: number | null;
    categories: Category[];
    onClose: () => void;
    onSave: () => void;
}

export interface VariantsTableProps {
    store: string;
    productId: number;
    productTitle: string;
    productType: string;
}

export interface VariantRowFormProps {
    store: string;
    productId: number;
    productTitle: string;
    productType: string;
    variant?: ProductVariant | null;
    onSave: (v: ProductVariant) => void;
    onCancel: () => void;
}

export interface MetadataFormProps {
    type: string;
    metadata: Record<string, unknown>;
    onChange: (newMetadata: Record<string, unknown>) => void;
}

export interface AttributeFieldsProps {
    id?: string;
    type: string;
    attributes: Record<string, string | number | boolean>;
    onChange: (newAttributes: Record<string, string | number | boolean>) => void;
}

export interface ProductTypeSelectorProps {
    value: string;
    onSelect: (type: string) => void;
}

export interface SyncBannerProps {
    onSyncComplete?: () => void;
    dirtyBreakdown?: { deletedCount: number; activeDirty: number };
}

export interface SyncBannerInstance {
    loadDirtyCount: () => Promise<void>;
}

export interface StoreSettingsProps {
    serverSettings: Record<string, string>;
}
