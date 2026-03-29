import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';
import { anthropicTools, geminiTools, openaiTools, executeStoreTool } from '$lib/server/chatTools.js';

const OPENAI_DEFAULT_MODEL = 'gpt-4o';

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
You have access to live store tools — use them proactively. Never ask for permission before using a tool; just use it.

**Image workflow — do this automatically, without asking:**
When the seller asks to "find images", "add images", "download images", or anything similar:
1. Call search_products to get the list of products (or use the ones already mentioned).
2. For each product, call search_images("product name") to find image URLs from the internet.
3. Immediately call download_image(product_id, imageUrl, confirm=true) to attach the best result.
4. Report what you did — do NOT ask the user to pick URLs or confirm each step.

Do the whole thing in one go. The user wants action, not a list of questions.

**Other capabilities:**
- search_images: searches Google Images — use it any time a product needs an image. No Serper key? Tell the user to add one in Settings → AI/LLM.
- fetch_url: fetches any public webpage and returns its text + image URLs. Use for product pages on Amazon, Shopee, Lazada, etc.
- download_image(product_id, url, confirm=true): downloads and attaches an image to a product.
- create_category with parent_id: builds full category hierarchies.

Always look up real store data before guessing. Be creative and action-oriented.`;

  const systemPrompt = getSetting('ai_system_prompt') || defaultPrompt;

  const isClaude = body.model.startsWith('claude-');
  const isGemini = body.model.startsWith('gemini-');
  const isOpenai = !isClaude && !isGemini;

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
      console.error('❌ Claude API Error:', err.response?.data || err.message || err);
      return json({ error: err.message ?? 'Claude API error' }, { status: 502 });
    }
  }

  // ─── OpenAI — function-calling loop ─────────────────────────────────────
  if (isOpenai) {
    const apiKey = getSetting('openai_api_key');
    if (!apiKey) return json({ error: 'OpenAI API key not configured for this store.' }, { status: 400 });

    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });

      const msgs: any[] = body.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

      // ─── o1 family logic ───────────────────────────────────────────────────
      // o1 (latest) supports 'developer' role.
      // o1-mini and o1-preview do NOT support 'system' or 'developer'; instructions
      // must be prepended to the first user message.
      const isO1Mini = body.model.includes('o1-mini') || body.model.includes('o1-preview');
      const isO1Full = body.model === 'o1' || body.model.startsWith('o1-2024');
      const isO1Family = isO1Mini || isO1Full;

      if (isO1Full) {
        msgs.unshift({ role: 'developer', content: systemPrompt });
      } else if (isO1Mini) {
        // Prepend to the first user message
        const firstUserIdx = msgs.findIndex(m => m.role === 'user');
        if (firstUserIdx !== -1) {
          msgs[firstUserIdx].content = `[INSTRUCTIONS]\n${systemPrompt}\n\n[USER MESSAGE]\n${msgs[firstUserIdx].content}`;
        } else {
          msgs.unshift({ role: 'user', content: systemPrompt });
        }
      } else {
        // Standard model (gpt-4o, etc.)
        msgs.unshift({ role: 'system', content: systemPrompt });
      }
      
      // Handle file content for the last user message
      const lastUserMsg = msgs[msgs.length - 1];
      if (body.file) {
        if (body.file.mimeType.startsWith('image/')) {
          lastUserMsg.content = [
            { type: 'text', text: lastUserMsg.content },
            { type: 'image_url', image_url: { url: `data:${body.file.mimeType};base64,${body.file.data}` } },
          ];
        } else if (body.file.mimeType === 'text/csv' || body.file.name.endsWith('.csv') || body.file.mimeType.startsWith('text/')) {
          const decoded = Buffer.from(body.file.data, 'base64').toString('utf-8');
          lastUserMsg.content += `\n\n[Attached File: ${body.file.name}]\nFILE CONTENT:\n${decoded}`;
        } else {
          lastUserMsg.content += `\n\n[Attached file: ${body.file.name}]`;
        }
      }

      for (let round = 0; round < 10; round++) {
        const response = await client.chat.completions.create({
          model: body.model || OPENAI_DEFAULT_MODEL,
          messages: msgs,
          // o1-mini doesn't support tools; o1 supports tools but not tool_choice
          ...(isO1Mini ? {} : { tools: openaiTools as any }),
          ...(isO1Family ? {} : { tool_choice: 'auto' }),
          ...(isO1Family ? { max_completion_tokens: 16384 } : {}),
        });

        const choice = response.choices[0];
        if (!choice.message.tool_calls?.length) {
          return json({ reply: choice.message.content || '(no response)' });
        }

        msgs.push(choice.message); // Add assistant's tool call message

        const toolResults: any[] = [];
        for (const toolCall of choice.message.tool_calls) {
          const tc = toolCall as any;
          let toolOutput: string;
          try {
            toolOutput = await executeStoreTool(
              tc.function.name,
              JSON.parse(tc.function.arguments),
              db
            );
          } catch (err: any) {
            toolOutput = `Tool error: ${err.message}`;
          }
          toolResults.push({
            tool_call_id: tc.id,
            role: 'tool',
            name: tc.function.name,
            content: toolOutput,
          });
        }
        msgs.push(...toolResults); // Add tool results
      }
      
      return json({ reply: '(tool use loop exceeded max rounds)' });

    } catch (err: any) {
      console.error('❌ OpenAI API Error:', err.response?.data || err.message || err);
      return json({ error: err.message ?? 'OpenAI API error' }, { status: 502 });
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
