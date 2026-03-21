import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';
import { anthropicTools, geminiTools, executeStoreTool } from '$lib/server/chatTools.js';

/**
 * POST /api/ai/chat?store=<slug>
 *
 * Body:
 *   model    — model id (e.g. "claude-sonnet-4-6" or "gemini-2.0-flash")
 *   messages — array of { role: 'user'|'assistant', content: string }
 *   file     — optional { data: base64, mimeType: string, name: string }
 *
 * Returns:
 *   { reply: string }
 *
 * The AI has access to live store tools (search_products, list_orders, etc.)
 * and will automatically call them as needed to answer questions.
 */
export const POST: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store');
  if (!slug) return json({ error: 'store param required' }, { status: 400 });

  const body = await event.request.json().catch(() => null);
  if (!body?.model || !body?.messages) {
    return json({ error: 'model and messages are required' }, { status: 400 });
  }

  const db = getStoreDb(slug);

  function getSetting(key: string): string {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
    return row?.value ?? '';
  }

  const storeName = getSetting('display_name') || slug;
  const defaultPrompt = `You are a helpful store admin assistant for "${storeName}". 
You have access to live store tools — use them proactively to answer questions about products, orders, inventory, promotions, and reviews. 

If a user asks for ideas (like "generate categories for a tech store"), use your general knowledge to brainstorm and propose a comprehensive structure. 

**Crucial Capabilities:**
- You CAN create categories independently of products using the "create_category" tool.
- You CAN build hierarchical structures by using the "parent_id" parameter in "create_category".
- You don't have a live web browser, but you should use your internal training data to suggest best e-commerce practices.

Always look up real data from the store before guessing, but be creative and helpful when the user asks for suggestions or planning assistance.`;

  const systemPrompt = getSetting('ai_system_prompt') || defaultPrompt;

  const isClaude = body.model.startsWith('claude-');

  // ─── Claude (Anthropic) — full tool-use loop ─────────────────────────────
  if (isClaude) {
    const apiKey = getSetting('claude_api_key');
    if (!apiKey) return json({ error: 'Claude API key not configured for this store.' }, { status: 400 });

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      // Build the initial messages array, attaching any file to the last user message
      const msgs: any[] = body.messages.map((m: any, i: number) => {
        if (m.role === 'user' && i === body.messages.length - 1 && body.file) {
          const contentParts: any[] = [];
          
          if (body.file.mimeType.startsWith('image/')) {
            contentParts.push({
              type: 'image',
              source: { type: 'base64', media_type: body.file.mimeType, data: body.file.data },
            });
          } else if (body.file.mimeType === 'text/csv' || body.file.name.endsWith('.csv') || body.file.mimeType.startsWith('text/')) {
            // Decode base64 text/csv content
            const decoded = Buffer.from(body.file.data, 'base64').toString('utf-8');
            contentParts.push({ 
              type: 'text', 
              text: `[Attached File: ${body.file.name}]\n\nFILE CONTENT:\n${decoded}` 
            });
          } else {
            contentParts.push({ type: 'text', text: `[Attached file: ${body.file.name}]` });
          }

          if (m.content) contentParts.push({ type: 'text', text: m.content });
          return { role: 'user', content: contentParts };
        }
        return { role: m.role, content: m.content };
      });

      // Tool-use agentic loop (max 10 rounds to prevent run-away)
      let reply = '';
      for (let round = 0; round < 10; round++) {
        const response = await client.messages.create({
          model: body.model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: anthropicTools as any,
          messages: msgs,
        });

        // Collect any text content for the final reply
        const textParts = response.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text);
        if (textParts.length) reply = textParts.join('');

        if (response.stop_reason === 'end_turn' || !response.content.some((c: any) => c.type === 'tool_use')) {
          break; // done
        }

        // Handle tool calls
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          let toolOutput: string;
          try {
            toolOutput = await executeStoreTool(block.name, block.input ?? {}, db);
          } catch (err: any) {
            toolOutput = `Tool error: ${err.message}`;
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolOutput,
          });
        }

        // Append assistant turn + tool results and loop
        msgs.push({ role: 'assistant', content: response.content });
        msgs.push({ role: 'user', content: toolResults });
      }

      return json({ reply: reply || '(no response)' });
    } catch (err: any) {
      return json({ error: err.message ?? 'Claude API error' }, { status: 502 });
    }
  }

  // ─── Gemini — function-calling loop ─────────────────────────────────────
  const apiKey = getSetting('gemini_api_key');
  if (!apiKey) return json({ error: 'Gemini API key not configured for this store.' }, { status: 400 });

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: body.model,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      tools: [{ functionDeclarations: geminiTools as any }],
    });

    // Build history (everything except the last user message)
    const history = body.messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });

    // Build last user message parts
    const lastMsg = body.messages[body.messages.length - 1];
    const parts: any[] = [{ text: lastMsg.content || '' }];
    if (body.file) {
      if (body.file.mimeType.startsWith('image/')) {
        parts.push({ inlineData: { data: body.file.data, mimeType: body.file.mimeType } });
      } else if (body.file.mimeType === 'text/csv' || body.file.name.endsWith('.csv') || body.file.mimeType.startsWith('text/')) {
        const decoded = Buffer.from(body.file.data, 'base64').toString('utf-8');
        parts.push({ text: `\n\n[Attached File: ${body.file.name}]\nFILE CONTENT:\n${decoded}` });
      } else {
        parts.push({ text: `[Attached file: ${body.file.name}]` });
      }
    }

    // Function-calling loop
    let reply = '';
    let currentParts = parts;
    for (let round = 0; round < 10; round++) {
      const result = await chat.sendMessage(currentParts);
      const response = result.response;

      // Check for function calls
      const fnCalls = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall) ?? [];

      if (fnCalls.length === 0) {
        reply = response.text();
        break;
      }

      // Execute each function call
      const fnResults: any[] = [];
      for (const part of fnCalls) {
        const fc = part.functionCall;
        if (!fc) continue;
        let output: string;
        try {
          output = await executeStoreTool(fc.name, (fc.args as Record<string, any>) ?? {}, db);
        } catch (err: any) {
          output = `Tool error: ${err.message}`;
        }
        fnResults.push({ functionResponse: { name: fc.name, response: { result: output } } });
      }

      // Feed results back
      currentParts = fnResults;
    }

    return json({ reply: reply || '(no response)' });
  } catch (err: any) {
    return json({ error: err.message ?? 'Gemini API error' }, { status: 502 });
  }
};
