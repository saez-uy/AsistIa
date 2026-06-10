import { decrypt } from './crypto.service.js';
import type { Connection } from '@prisma/client';

const BASE_URL = 'https://graph.facebook.com/v19.0';

async function callApi(phoneNumberId: string, token: string, body: object): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function sendText(connection: Connection, to: string, text: string) {
  const token = decrypt(connection.accessToken);
  return callApi(connection.phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

export async function sendButtons(
  connection: Connection,
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  const token = decrypt(connection.accessToken);
  return callApi(connection.phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  });
}
