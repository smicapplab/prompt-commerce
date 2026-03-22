/**
 * API: GET /api/ai/models/openai
 *
 * Returns a list of the recommended, latest OpenAI models.
 * We hardcode these because the API returns hundreds of model variants.
 *
 * https://platform.openai.com/docs/models
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';

const OPENAI_MODELS = [
  { id: 'gpt-4o',             displayName: 'GPT-4o' },
  { id: 'gpt-4o-mini',        displayName: 'GPT-4o mini (Fast)' },
  { id: 'o1',                 displayName: 'o1' },
  { id: 'o1-mini',            displayName: 'o1-mini' },
  { id: 'gpt-4-turbo',        displayName: 'GPT-4 Turbo (Legacy)' },
  { id: 'gpt-3.5-turbo',      displayName: 'GPT-3.5 Turbo (Legacy)' },
];

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  return json({ models: OPENAI_MODELS });
};
