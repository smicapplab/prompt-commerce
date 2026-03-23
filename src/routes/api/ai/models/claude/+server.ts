import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth } from '$lib/server/auth.js';

/**
 * GET /api/ai/models/claude?store=<slug>
 * Returns the list of Claude models available via the Anthropic API.
 * (Anthropic doesn't have a list-models endpoint so we return a curated list.)
 */
const CLAUDE_MODELS = [
  { id: 'claude-opus-4-6',          displayName: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6',        displayName: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001',displayName: 'Claude Haiku 4.5' },
];

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  return json({ models: CLAUDE_MODELS });
};
