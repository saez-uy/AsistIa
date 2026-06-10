import OpenAI from 'openai';
import { env } from '../config/env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Genera una respuesta con gpt-4o-mini usando el historial de la conversación.
 * El nodeInstructions se agrega al system prompt para personalizar cada nodo.
 */
export async function generateAiResponse(
  systemPrompt: string,
  history: Array<{ direction: string; content: string }>,
  nodeInstructions: string,
  maxTokens = 500
): Promise<string> {
  const fullSystem = [systemPrompt, nodeInstructions ? `\nInstrucciones adicionales: ${nodeInstructions}` : '']
    .filter(Boolean)
    .join('\n');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = history.slice(-20).map((m) => ({
    role: m.direction === 'INBOUND' ? 'user' : 'assistant',
    content: m.content,
  }));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: fullSystem }, ...messages],
  });

  return response.choices[0]?.message?.content ?? 'No pude generar una respuesta. Intentá de nuevo.';
}
