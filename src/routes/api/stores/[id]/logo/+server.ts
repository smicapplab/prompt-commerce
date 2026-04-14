import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { validateImageFile, saveUploadedFile } from '$lib/server/uploads.js';

export const POST: any = async (event: any) => {
  const user = requireAuth(event) as any;
  if (user instanceof Response) return user;

  // Only global admins can update store branding in registry
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number(event.params.id);
  const formData = await event.request.formData();
  const file = formData.get('logo') as File;

  if (!file || file.size === 0) {
    return json({ error: 'No logo file provided' }, { status: 400 });
  }

  const validationError = validateImageFile(file);
  if (validationError) {
    return json({ error: validationError }, { status: 422 });
  }

  try {
    const db = getDb();
    const store = db.prepare('SELECT id, slug FROM stores WHERE id = ?').get(id) as { id: number, slug: string } | undefined;
    if (!store) {
      return json({ error: 'Store not found' }, { status: 404 });
    }

    const logoUrl = await saveUploadedFile(file, store.slug);
    
    db.prepare('UPDATE stores SET logo_url = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(logoUrl, id);

    // ── Fire-and-forget: push new logo to gateway ─────────────────────────────
    void (async () => {
      try {
        const gatewayUrlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('gateway_url') as { value: string } | undefined;
        const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');

        const sellerUrlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('seller_public_url') as { value: string } | undefined;
        let sellerUrl = sellerUrlRow?.value?.replace(/\/$/, '') || process.env.SELLER_PUBLIC_URL?.replace(/\/$/, '') || process.env.ORIGIN?.replace(/\/$/, '') || '';
        
        const storeInfo = db.prepare('SELECT gateway_key FROM stores WHERE id = ?').get(id) as { gateway_key: string | null } | undefined;
        
        if (gatewayUrl && storeInfo?.gateway_key) {
          const absoluteLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${sellerUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;

          await fetch(`${gatewayUrl}/api/stores/${store.slug}/store-config`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-gateway-key': storeInfo.gateway_key,
            },
            body: JSON.stringify({
              logoUrl: absoluteLogoUrl,
            }),
            signal: AbortSignal.timeout(5000)
          });
        }
      } catch (e) {
        console.error('[logo] Failed to push to gateway:', e);
      }
    })();

    return json({ logo_url: logoUrl });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
};
