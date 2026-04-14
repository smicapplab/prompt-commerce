import { writeFileSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { getUploadDir } from './db.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

export function validateImageFile(file: File): string | null {
    if (file.size > MAX_UPLOAD_BYTES) {
        return `File "${file.name}" exceeds the 10 MB size limit.`;
    }
    const mimeOk = ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p));
    const ext = getFileExtension(file.name);
    const extOk = ALLOWED_EXTENSIONS.has(ext);
    if (!mimeOk || !extOk) {
        return `File "${file.name}" is not an allowed image type (jpeg, png, webp, gif, avif).`;
    }
    return null;
}

export async function saveUploadedFile(file: File, slug?: string): Promise<string> {
    const baseUploadDir = getUploadDir();
    const uploadDir = slug ? join(baseUploadDir, slug) : baseUploadDir;
    
    mkdirSync(uploadDir, { recursive: true });
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = getFileExtension(file.name);
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    const filepath = join(uploadDir, filename);
    
    writeFileSync(filepath, buffer);
    
    return slug ? `/uploads/${slug}/${filename}` : `/uploads/${filename}`;
}
