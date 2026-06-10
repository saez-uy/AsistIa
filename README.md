# FlowChat

SaaS de bots de WhatsApp con flujos automáticos e IA para negocios pequeños.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 20 + TypeScript + Fastify |
| ORM | Prisma + PostgreSQL |
| Cache / Queue | Redis + BullMQ |
| IA | OpenAI gpt-4o-mini |
| Auth | JWT (15min) + Refresh Token en Redis (7d) |
| Frontend | React 18 + Vite + Tailwind + React Flow |

---

## Requisitos

- Node.js 20+
- Docker y Docker Compose
- Cuenta de OpenAI con API key
- App de Meta for Developers con WhatsApp Business Cloud API habilitada

---

## Instalación y desarrollo

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales
```

Variables obligatorias:
- `DATABASE_URL` — cadena de conexión de PostgreSQL
- `REDIS_URL` — URL de Redis
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — secretos de mínimo 16 chars
- `OPENAI_API_KEY` — API key de OpenAI
- `META_APP_SECRET` — App Secret de tu app de Meta
- `META_WEBHOOK_VERIFY_TOKEN` — token de verificación del webhook (inventalo)
- `ENCRYPTION_KEY` — string de exactamente 32 caracteres para encriptar tokens de Meta

### 2. Levantar PostgreSQL y Redis

```bash
docker-compose up -d
```

### 3. Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run dev
```

El servidor arranca en `http://localhost:3000`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

La app arranca en `http://localhost:5173`.

---

## Configurar la app en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com) → crear app de tipo "Business"
2. Agregar el producto **WhatsApp**
3. En **WhatsApp > Configuración**, copiar el **Phone Number ID** y el **Access Token**
4. En **Webhooks**, configurar:
   - URL: `https://tu-dominio.com/api/webhooks/whatsapp`
   - Verify token: el valor de `META_WEBHOOK_VERIFY_TOKEN` en tu `.env`
   - Suscribirse a: `messages`
5. Copiar el **App Secret** desde Configuración de la app → Basic Settings

---

## Estructura del proyecto

```
flowchat/
├── docker-compose.yml
├── .env.example
├── backend/
│   └── src/
│       ├── server.ts              # Entry point
│       ├── config/env.ts          # Validación de env con Zod
│       ├── modules/
│       │   ├── auth/              # Register, login, refresh, logout
│       │   ├── connections/       # Números de WhatsApp conectados
│       │   ├── flows/             # CRUD de flujos
│       │   ├── contacts/          # Contactos
│       │   ├── conversations/     # Historial de conversaciones
│       │   ├── webhooks/          # Receptor de mensajes de Meta
│       │   └── users/             # Dashboard stats
│       └── services/
│           ├── flow-engine.service.ts  # Motor de ejecución de flujos
│           ├── ai.service.ts           # Integración OpenAI
│           ├── queue.service.ts        # BullMQ workers
│           ├── whatsapp.service.ts     # Meta Cloud API
│           ├── crypto.service.ts       # AES-256-GCM para tokens
│           ├── prisma.service.ts
│           └── redis.service.ts
└── frontend/
    └── src/
        ├── pages/                 # Dashboard, FlowEditor, Connections, etc.
        ├── components/
        │   ├── layout/            # Sidebar, TopBar
        │   ├── flow-editor/       # Nodos de React Flow + paneles
        │   └── ui/                # shadcn/ui components
        ├── stores/                # Zustand (auth, flow)
        └── lib/                   # Axios con interceptors, utils
```

---

## Planes

| Plan | Flujos | Conversaciones/mes | IA |
|------|--------|-------------------|-----|
| FREE | 2 | 100 | No |
| STARTER | 10 | 1.000 | No |
| PRO | ∞ | ∞ | Sí |

---

## Tipos de nodos

| Nodo | Descripción |
|------|-------------|
| `start` | Punto de entrada, se activa con un keyword |
| `message` | Envía un mensaje de texto (soporta `{{variables}}`) |
| `question` | Hace una pregunta y captura la respuesta como variable |
| `buttons` | Envía botones de respuesta rápida (máx. 3) |
| `condition` | Ramifica el flujo según el valor de una variable |
| `ai_response` | Genera una respuesta con GPT-4o-mini (solo plan PRO) |
| `delay` | Pausa N segundos antes de continuar |
| `end` | Termina la conversación |
