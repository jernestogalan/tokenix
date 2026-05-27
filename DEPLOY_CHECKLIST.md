# DEPLOY CHECKLIST — Tokenia v3 (Phase 3: Supabase + Auth + Redis)

> Todas las acciones manuales del proyecto en un solo documento.
> Marca cada ítem conforme avances. Orden recomendado: A → B → C → D → E → F.

---

## A. SUPABASE — Proyecto y base de datos

### A1. Crear proyecto Supabase
- [ ] Ir a https://supabase.com → New project
- [ ] Región recomendada: `us-east-1` (o la más cercana a tu Railway region)
- [ ] Guardar la contraseña de la base de datos en un gestor de contraseñas

### A2. Ejecutar migración inicial
- [ ] Ir a Supabase Dashboard → SQL Editor
- [ ] Pegar y ejecutar el contenido completo de `supabase/migrations/001_initial_schema.sql`
- [ ] Verificar que se crearon las tablas: `profiles`, `usage_events`, `projects`, `documents`, `credit_ledger`
- [ ] Verificar que RLS está activado en las 5 tablas (icono de escudo verde en Table Editor)
- [ ] Verificar que el trigger `handle_new_user` existe en Authentication → Triggers (o en SQL: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`)

### A3. Copiar claves de Supabase
- [ ] Ir a Project Settings → API
- [ ] Copiar `Project URL` → será tu `SUPABASE_URL`
- [ ] Copiar `anon / public key` → será tu `SUPABASE_ANON_KEY` (segura para el browser)
- [ ] Copiar `service_role / secret key` → será tu `SUPABASE_SERVICE_ROLE_KEY`
  - ⚠️  Esta clave NUNCA va en el frontend ni en variables públicas. Solo backend.

### A4. Configurar Auth en Supabase
- [ ] Authentication → Providers → Email: activar "Enable Email Signup"
- [ ] Authentication → URL Configuration:
  - Site URL: `https://tokenia.live`
  - Redirect URLs: `https://tokenia.live/` (con barra final)
- [ ] (Opcional) Authentication → Email Templates: personalizar los correos de confirmación

---

## B. RAILWAY — Despliegue

### B1. Crear proyecto Railway
- [ ] Ir a https://railway.app → New Project → Deploy from GitHub repo
- [ ] Conectar el repositorio de GitHub donde está `tokenix/`
- [ ] Railway detectará `package.json` automáticamente

### B2. Configurar Variables de entorno en Railway
> Variables panel → Add variable. Una por una o en bulk con "Raw Editor".

```
# App
NODE_ENV=production
APP_URL=https://tokenia.live
PORT=3000

# Feature flags — valores para beta privada
ENABLE_FILE_UPLOADS=true
ENABLE_PAID_FEATURES=true
ENABLE_AUTH=true
ENABLE_HISTORY=true
ENABLE_PROJECTS=true
ENABLE_REDIS_RATE_LIMIT=false    # cambiar a true cuando agregues Redis

# Seguridad — CRÍTICO
ALLOW_PLAN_QUERY_OVERRIDE=false  # NUNCA true en producción

# Billing — DESACTIVADO hasta Fase 4
ENABLE_BILLING=false
ENABLE_STRIPE=false
ENABLE_CREDITS=false

# Supabase (copiar de A3)
SUPABASE_URL=https://TU_REF.supabase.co
SUPABASE_ANON_KEY=eyJ_TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ_TU_SERVICE_ROLE_KEY

# Rate limit (si no tienes Redis todavía, déjalo sin REDIS_URL)
# REDIS_URL=redis://...
```

### B3. Verificar start command
- [ ] Railway Settings → Deploy: Start Command debe ser `node server.js`
- [ ] Si no aparece, agregar manualmente o verificar que `package.json` tiene `"start": "node server.js"`

### B4. Primer build
- [ ] Hacer push del código a la rama conectada
- [ ] Railway → Deployments: verificar que el build termina sin errores
- [ ] Ver logs del deploy: debe aparecer `[server] Tokenia listening on port 3000`
- [ ] Verificar flags en los logs de arranque:
  ```
  auth: true, billing: false, stripe: false, credits: false, redis: false
  ```

---

## C. DOMINIO — tokenia.live en Railway + Namecheap

### C1. Railway — Custom Domain
- [ ] Railway → tu servicio → Settings → Domains → Add Custom Domain
- [ ] Escribir `tokenia.live`
- [ ] Railway mostrará un registro CNAME y el valor de destino

### C2. Namecheap — DNS
- [ ] Ir a Namecheap → Domain List → Manage → Advanced DNS
- [ ] Agregar registro CNAME:
  - Host: `@` (o el subdominio que Railway indique)
  - Value: el valor CNAME de Railway (ej. `xxxxxxxx.up.railway.app`)
  - TTL: Automatic
- [ ] Para `www` (opcional):
  - Host: `www`
  - Value: mismo destino CNAME
- [ ] Esperar propagación DNS: 5–30 minutos (verificar en https://dnschecker.org)

### C3. Verificar HTTPS
- [ ] Abrir `https://tokenia.live` en el navegador
- [ ] El candado verde debe aparecer (Railway provisiona SSL automáticamente vía Let's Encrypt)

---

## D. SMOKE TESTS — Post-despliegue en producción

Ejecutar estos curl desde tu terminal local (reemplaza `tokenia.live`):

```bash
# D1. Health check
curl https://tokenia.live/api/health

# Esperado:
# {"status":"ok","env":"production","flags":{"auth":true,"billing":false,...}}

# D2. Count (texto libre)
curl -X POST https://tokenia.live/api/count \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world, this is a token count test."}'

# Esperado: array de resultados con precision="exact" para OpenAI, "estimated" para Anthropic/Gemini

# D3. Clean (sin autenticación — modo demo)
curl -X POST https://tokenia.live/api/clean \
  -H "Content-Type: application/json" \
  -d '{"text":"   Hello   world.  \n\n\n  Extra space.  "}'

# Esperado: demo=true, savingsMessage contiene "Full meaning is preserved"

# D4. Retrieve (sin autenticación — modo demo)
curl -X POST https://tokenia.live/api/retrieve \
  -H "Content-Type: application/json" \
  -d '{"text":"Large document about AI and token counting and API costs.","query":"token counting"}'

# Esperado: demo=true, savingsMessage contiene "this is a subset, not the complete text"

# D5. Lead capture
curl -X POST https://tokenia.live/api/lead \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tokenia.live","name":"Smoke Test"}'

# Esperado: {"ok":true,"message":"You're on the list!..."}
```

### D6. Auth flow — manual en el browser
- [ ] Abrir `https://tokenia.live`
- [ ] Hacer clic en "Sign up" → crear cuenta con email real
- [ ] Revisar bandeja de entrada: debe llegar correo de confirmación de Supabase
- [ ] Confirmar correo → volver al sitio → verificar que aparece el nav de usuario (email + barra de uso)
- [ ] Probar Sign out y Sign in nuevamente

---

## E. REDIS — Activación opcional (cuando escales)

Actualmente el servidor cae back a rate limiting en memoria. Para activar Redis real:

- [ ] En Railway: Add Service → Database → Redis
- [ ] Copiar la variable `REDIS_URL` que genera Railway automáticamente
- [ ] En Variables del servicio principal: agregar `REDIS_URL=<valor>` y `ENABLE_REDIS_RATE_LIMIT=true`
- [ ] Redeploy → verificar en logs: `[redis] connected` en lugar de `using in-memory`

---

## F. PENDIENTE PARA FASES FUTURAS (no hacer ahora)

Los siguientes ítems están **intencionalmente excluidos** de este deploy. Están documentados aquí para que no se pierdan.

| # | Ítem | Documento de referencia | Cuando activar |
|---|------|------------------------|----------------|
| F1 | Stripe / cobros reales | `STRIPE_FUTURE_PLAN.md` | Fase 4 — post beta privada |
| F2 | `ENABLE_BILLING=true` | `STRIPE_FUTURE_PLAN.md` §3 | Solo tras aprobar con Bank of America |
| F3 | Embeddings locales (`USE_LOCAL_EMBEDDINGS=true`) | `.env.example` | Fase 5 — requiere integrar sentence-transformers |
| F4 | API de usuario (claves propias) | `ALLOW_USER_API_KEYS=true` | Fase 4 — requiere UI de gestión de claves |
| F5 | `ENABLE_CREDITS=true` | `src/lib/credits.js` | Junto con Stripe (F1) |
| F6 | `ENABLE_AI_OPTIMIZATION=true` | `server.js` flag `AI_OPT_ENABLED` | Requiere integración de modelo AI |
| F7 | Migración SQL 002 (Stripe columns) | `STRIPE_FUTURE_PLAN.md` §SQL | Antes de activar F1 |
| F8 | GitHub Actions CI en producción | `.github/workflows/` | Ya existe — solo activar en el repo |
| F9 | Webhook de Stripe | `STRIPE_FUTURE_PLAN.md` §webhook | Solo tras F1 |
| F10 | Batch processing (múltiples archivos) | UI botón "Próximamente: Batch Pro" | Fase 4 Pro feature |

---

## G. SEGURIDAD — Checklist antes de producción

- [ ] `ALLOW_PLAN_QUERY_OVERRIDE=false` en Railway Variables ← **CRÍTICO**
- [ ] `ENABLE_BILLING=false` en Railway Variables
- [ ] `ENABLE_STRIPE=false` en Railway Variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NO está en ninguna variable pública de Railway
- [ ] `.env` está en `.gitignore` (verificado ✓)
- [ ] No hay claves reales en el repositorio — ejecutar antes del push:
  ```bash
  git grep -i "sk_live\|rk_live\|eyJ.*service_role\|AKIA"
  # Debe devolver vacío
  ```
- [ ] README.md y `.env.example` usan solo placeholders (`sk_test_YOUR_...`)

---

## H. RESUMEN DE COMANDOS GIT — Push a producción

```bash
cd tokenix/

# 1. Revisar qué va a subir
git status
git diff --stat

# 2. Stage y commit
git add -A
git commit -m "feat: Phase 3 complete — Supabase auth, Redis rate limit, savings messages differentiation"

# 3. Push (Railway auto-despliega desde main)
git push origin main

# 4. Verificar en Railway Dashboard → Deployments que el build pasa
# 5. Ejecutar smoke tests D1–D5
```

---

*Generado automáticamente · Tokenia v3 · Mayo 2026*
