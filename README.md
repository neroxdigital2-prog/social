# Nerox Social IA — Paquete de despliegue

## ⚠️ Alcance real de este paquete — lee esto primero

Este proyecto se diseñó y programó a lo largo de una conversación extensa, cubriendo un roadmap muy amplio
(Sprint 1-3, Fase 2 completa, Fase 3 completa). Este paquete de archivos contiene **el núcleo funcional
completo y verificado** listo para desplegar:

### ✅ Incluido y funcional en este paquete
- Autenticación (registro/login con NextAuth + bcrypt)
- Gestión de empresas (crear, editar, límites por plan)
- Generador de contenido con IA (OpenAI, 12 tipos de publicación rotando)
- Biblioteca de publicaciones generadas
- Sistema de permisos multi-empresa/agencia (`lib/permisosAgencia.ts`)
- Rate limiting y retry con backoff (`lib/rateLimiter.ts`, `lib/conRetry.ts`)
- Schema completo de base de datos (MySQL/MariaDB) con **todos** los modelos del roadmap completo:
  CRM, WhatsApp, Agenda, Reseñas, Email marketing, Facturación, Agencia, SEO, Ads — el schema
  soporta TODO, aunque no todos los archivos de UI/API de esos módulos están en este paquete.

### 🔲 NO incluido como archivos físicos en este paquete (pero sí especificado completo en la conversación)
Los siguientes módulos fueron completamente diseñados y su código fue entregado en el chat,
pero **no están reconstruidos como archivos en este paquete** por volumen (son +100 archivos):
generación de imágenes/vídeo, calendario y publicación en redes sociales, CRM completo, WhatsApp bot,
Agenda/citas, Reseñas automáticas, Email marketing, SEO/Auditorías, Ads, Facturación, Modo Agencia (UI),
IA Comercial, webhooks de Meta/LinkedIn/TikTok/Google/Stripe.

**Cómo completar el proyecto:** cada uno de esos módulos fue entregado en bloques de código completos
y listos para copiar en los mensajes anteriores de esta conversación, con su ruta de archivo exacta
indicada en cada bloque (ej. `/app/api/empresas/[id]/leads/route.ts`). Debes copiar ese código en la
ubicación indicada dentro de este mismo proyecto para completar cada módulo.

## Requisitos
- Node.js 20+
- Base de datos MySQL/MariaDB (ya tienes una en IONOS)
- Cuenta OpenAI con API key

## Instalación local

```bash
npm install
cp .env.example .env
# edita .env con tus credenciales reales
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Despliegue (ver DEPLOYMENT.md)

Resumen: GitHub → Vercel (plan Hobby/free) → variables de entorno → cron-job.org para las tareas
programadas (Vercel Hobby no soporta cron cada 15 min).

## Estructura de carpetas

```
app/                  → páginas y rutas API (App Router de Next.js)
  api/                → endpoints backend
components/           → componentes React reutilizables
lib/                  → lógica de negocio, integraciones, utilidades
prisma/schema.prisma  → esquema completo de base de datos (MySQL)
auth.ts               → configuración de NextAuth
middleware.ts         → protección de rutas privadas
```

## Base de datos

El `schema.prisma` incluido es la versión **completa** con todos los modelos de todo el roadmap
(30+ tablas). Si corres `prisma migrate deploy`, se crearán TODAS las tablas aunque no todos los
módulos tengan su UI/API en este paquete todavía — esto es intencional, para que puedas ir
añadiendo cada módulo sin tener que migrar la base de datos de nuevo cada vez.
