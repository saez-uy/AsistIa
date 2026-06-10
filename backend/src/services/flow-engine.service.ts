/**
 * Motor de ejecución de flujos.
 *
 * Lógica principal:
 * 1. Identificar el contacto por número de teléfono
 * 2. Buscar si hay una conversación ACTIVE para ese contacto
 *    a. Si hay → continuar desde el nodo actual con el mensaje como input
 *    b. Si no → buscar flujo activo cuyo triggerKeyword coincida
 * 3. Ejecutar nodos hasta encontrar uno que requiera input del usuario o llegar a 'end'
 */

import { prisma } from './prisma.service.js';
import { delayQueue, type IncomingMessageJob } from './queue.service.js';
import { sendText, sendButtons } from './whatsapp.service.js';
import { generateAiResponse } from './ai.service.js';
import type { Conversation, Flow, Connection } from '@prisma/client';

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface FlowNode {
  id:   string;
  type: string;
  data: Record<string, unknown>;
}

interface FlowEdge {
  id:           string;
  source:       string;
  target:       string;
  sourceHandle: string | null | undefined;
}

type Variables = Record<string, string>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getNodes(flow: Flow): FlowNode[] {
  return (flow.nodes as FlowNode[]) ?? [];
}

function getEdges(flow: Flow): FlowEdge[] {
  return (flow.edges as FlowEdge[]) ?? [];
}

function findNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return getNodes(flow).find((n) => n.id === nodeId);
}

/** Devuelve el nodeId del siguiente nodo dado un handle opcional (para ramas). */
function getNextNodeId(flow: Flow, currentNodeId: string, handle?: string): string | null {
  const edges = getEdges(flow);
  const edge = edges.find(
    (e) => e.source === currentNodeId && (handle == null || e.sourceHandle === handle || e.sourceHandle == null)
  );
  return edge?.target ?? null;
}

/** Reemplaza {{variable}} en el texto con los valores capturados. */
function interpolate(text: string, variables: Variables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

async function saveMessage(conversationId: string, direction: 'INBOUND' | 'OUTBOUND', content: string, waMessageId?: string) {
  return prisma.message.create({
    data: { conversationId, direction, content, waMessageId },
  });
}

async function getConversationHistory(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'asc' },
    take: 40,
    select: { direction: true, content: true },
  });
}

// ── Punto de entrada principal ─────────────────────────────────────────────────

export async function processIncomingMessage(job: IncomingMessageJob) {
  const { connectionId, fromPhone, contactName, messageText, waMessageId, buttonPayload } = job;

  // 1. Obtener la conexión con el token
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection || !connection.isActive) return;

  // 2. Upsert del contacto
  const contact = await prisma.contact.upsert({
    where: { userId_phone: { userId: connection.userId, phone: fromPhone } },
    update: { lastSeen: new Date(), ...(contactName && { name: contactName }) },
    create: { userId: connection.userId, phone: fromPhone, name: contactName, lastSeen: new Date() },
  });

  // 3. Buscar conversación activa
  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, status: 'ACTIVE' },
    include: { flow: true },
  });

  // 4. Si no hay conversación activa, buscar flujo por keyword
  if (!conversation) {
    const keyword = messageText.trim().toLowerCase();
    const flow = await prisma.flow.findFirst({
      where: {
        connectionId,
        isActive: true,
        OR: [
          { triggerKeyword: { equals: keyword, mode: 'insensitive' } },
          { triggerKeyword: null }, // flujo sin keyword = responde siempre
        ],
      },
      orderBy: { triggerKeyword: 'desc' }, // keyword explícito tiene prioridad
    });

    if (!flow) return; // Sin flujo que responda → silencio

    // Crear nueva conversación
    const startNode = getNodes(flow).find((n) => n.type === 'start');
    conversation = await prisma.conversation.create({
      data: {
        flowId:        flow.id,
        contactId:     contact.id,
        currentNodeId: startNode?.id ?? null,
        variables:     {},
      },
      include: { flow: true },
    });

    // Guardar el mensaje entrante
    await saveMessage(conversation.id, 'INBOUND', messageText, waMessageId);

    // Ejecutar desde el nodo start
    await executeFlow(connection, conversation as ConvWithFlow, flow, null, messageText, buttonPayload);
    return;
  }

  // Hay conversación activa — guardar el mensaje y continuar
  await saveMessage(conversation.id, 'INBOUND', messageText, waMessageId);
  await executeFlow(connection, conversation as ConvWithFlow, conversation.flow!, messageText, messageText, buttonPayload);
}

/** Reanuda una conversación tras un nodo 'delay'. */
export async function resumeAfterDelay(conversationId: string, nextNodeId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { flow: { include: { connection: true } } },
  });
  if (!conversation || conversation.status !== 'ACTIVE') return;
  if (!conversation.flow) return;

  await executeFromNode(
    conversation.flow.connection,
    conversation as ConvWithFlow,
    conversation.flow,
    nextNodeId,
    null,
    null
  );
}

// ── Ejecución del flujo ────────────────────────────────────────────────────────

type ConvWithFlow = Conversation & { flow: Flow | null };

async function executeFlow(
  connection: Connection,
  conversation: ConvWithFlow,
  flow: Flow,
  userInput: string | null,
  _rawMessage: string,
  buttonPayload: string | null
) {
  const variables = (conversation.variables as Variables) ?? {};
  const currentNodeId = conversation.currentNodeId;

  // Si no hay currentNodeId, empezar desde 'start'
  if (!currentNodeId) {
    const startNode = getNodes(flow).find((n) => n.type === 'start');
    if (!startNode) return;
    await executeFromNode(connection, conversation, flow, startNode.id, userInput, buttonPayload);
    return;
  }

  const currentNode = findNode(flow, currentNodeId);
  if (!currentNode) return;

  // El nodo actual estaba esperando input — procesarlo
  if (currentNode.type === 'question') {
    const varName = (currentNode.data.variableName as string) || 'respuesta';
    variables[varName] = userInput ?? '';
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { variables },
    });
    const nextId = getNextNodeId(flow, currentNodeId);
    if (nextId) await executeFromNode(connection, { ...conversation, variables }, flow, nextId, null, null);

  } else if (currentNode.type === 'buttons') {
    // buttonPayload es el ID del botón presionado, o el texto si no hay payload
    const buttons = (currentNode.data.buttons as Array<{ id: string; title: string }>) ?? [];
    const pressed = buttons.find(
      (b) => b.id === buttonPayload || b.title.toLowerCase() === (userInput ?? '').toLowerCase()
    );
    const handle = pressed?.id ?? buttons[0]?.id;
    const nextId = getNextNodeId(flow, currentNodeId, handle);
    if (nextId) await executeFromNode(connection, conversation, flow, nextId, null, null);
  }
}

/**
 * Ejecuta nodos en secuencia empezando desde startNodeId.
 * Se detiene cuando un nodo requiere input del usuario o llegamos a 'end'.
 */
async function executeFromNode(
  connection: Connection,
  conversation: Conversation,
  flow: Flow,
  startNodeId: string,
  _userInput: string | null,
  _buttonPayload: string | null
) {
  let nodeId: string | null = startNodeId;
  let variables = (conversation.variables as Variables) ?? {};

  // Límite de seguridad para evitar loops infinitos
  for (let step = 0; step < 50 && nodeId; step++) {
    const node = findNode(flow, nodeId);
    if (!node) break;

    switch (node.type) {

      case 'start': {
        // El nodo start no hace nada — avanzar
        nodeId = getNextNodeId(flow, node.id);
        break;
      }

      case 'message': {
        const text = interpolate((node.data.text as string) ?? '', variables);
        await sendText(connection, conversation.contactId, text);
        // Nota: contactId aquí es en realidad el phone, pero necesitamos el phone del contacto
        // Se resuelve más abajo con la consulta al contacto
        await saveOutboundMessage(conversation.id, text);
        nodeId = getNextNodeId(flow, node.id);
        break;
      }

      case 'question': {
        const text = interpolate((node.data.text as string) ?? '', variables);
        await sendTextToConversation(connection, conversation, text);
        await saveOutboundMessage(conversation.id, text);
        // Guardar estado y detenerse
        await prisma.conversation.update({ where: { id: conversation.id }, data: { currentNodeId: node.id } });
        return;
      }

      case 'buttons': {
        const bodyText = interpolate((node.data.text as string) ?? '', variables);
        const buttons = (node.data.buttons as Array<{ id: string; title: string }>) ?? [];
        await sendButtonsToConversation(connection, conversation, bodyText, buttons);
        await saveOutboundMessage(conversation.id, `${bodyText} [${buttons.map((b) => b.title).join(' / ')}]`);
        await prisma.conversation.update({ where: { id: conversation.id }, data: { currentNodeId: node.id } });
        return;
      }

      case 'condition': {
        const varName = (node.data.variable as string) ?? '';
        const operator = (node.data.operator as string) ?? 'eq';
        const compareValue = ((node.data.value as string) ?? '').toLowerCase();
        const actualValue = (variables[varName] ?? '').toLowerCase();

        let result = false;
        switch (operator) {
          case 'eq':       result = actualValue === compareValue; break;
          case 'neq':      result = actualValue !== compareValue; break;
          case 'contains': result = actualValue.includes(compareValue); break;
          case 'gt':       result = parseFloat(actualValue) > parseFloat(compareValue); break;
          case 'lt':       result = parseFloat(actualValue) < parseFloat(compareValue); break;
        }

        nodeId = getNextNodeId(flow, node.id, result ? 'true' : 'false');
        break;
      }

      case 'ai_response': {
        const instructions = (node.data.instructions as string) ?? '';
        const maxTokens    = (node.data.maxTokens as number) ?? 500;
        const systemPrompt = flow.aiSystemPrompt ?? 'Sos un asistente útil y amable.';
        const history      = await getConversationHistory(conversation.id);
        const reply        = await generateAiResponse(systemPrompt, history, instructions, maxTokens);
        await sendTextToConversation(connection, conversation, reply);
        await saveOutboundMessage(conversation.id, reply);
        nodeId = getNextNodeId(flow, node.id);
        break;
      }

      case 'delay': {
        const seconds = Math.min((node.data.seconds as number) ?? 3, 30);
        const nextId  = getNextNodeId(flow, node.id);
        if (nextId) {
          // Guardar a dónde retomar y encolar con delay
          await prisma.conversation.update({ where: { id: conversation.id }, data: { currentNodeId: node.id } });
          await delayQueue.add(
            'resume',
            { conversationId: conversation.id, nextNodeId: nextId },
            { delay: seconds * 1000 }
          );
        }
        return;
      }

      case 'end': {
        const text = node.data.text as string | undefined;
        if (text) {
          const msg = interpolate(text, variables);
          await sendTextToConversation(connection, conversation, msg);
          await saveOutboundMessage(conversation.id, msg);
        }
        await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'COMPLETED' } });
        return;
      }

      default:
        nodeId = getNextNodeId(flow, node.id);
    }
  }

  // Si terminamos el loop sin 'end', actualizar el nodo actual
  if (nodeId) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { currentNodeId: nodeId } });
  }
}

// ── Helpers de envío ───────────────────────────────────────────────────────────

async function getContactPhone(contactId: string): Promise<string> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  return contact.phone;
}

async function sendTextToConversation(connection: Connection, conversation: Conversation, text: string) {
  const phone = await getContactPhone(conversation.contactId);
  await sendText(connection, phone, text);
}

async function sendButtonsToConversation(
  connection: Connection,
  conversation: Conversation,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  const phone = await getContactPhone(conversation.contactId);
  await sendButtons(connection, phone, bodyText, buttons);
}

async function saveOutboundMessage(conversationId: string, content: string) {
  return saveMessage(conversationId, 'OUTBOUND', content);
}
