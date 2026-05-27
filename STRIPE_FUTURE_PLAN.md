# Tokenia — Plan de Integración Stripe (Sandbox / Test)

> **Estado:** DOCUMENTADO — NO IMPLEMENTADO  
> **Prerequisito:** Beta privada con Supabase + Redis funcionando en producción.  
> **Stripe está conectado a Bank of America pero en modo live DESACTIVADO.**  
> **No activar live mode hasta aprobación manual explícita.**

---

## Variables de entorno requeridas (solo para fase Stripe)

```
# Modo test — nunca poner claves live hasta aprobación manual
ENABLE_BILLING=true          # solo cuando se active esta fase
ENABLE_STRIPE=true           # solo cuando se active esta fase
STRIPE_SECRET_KEY=sk_test_... # clave TEST (nunca sk_live_)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...
```

---

## Paso 1 — Crear productos y precios en Stripe Dashboard (modo test)

1. Ve a **dashboard.stripe.com** → asegúrate de estar en modo **Test** (toggle arriba a la derecha).
2. **Products → + Add product:**

   | Producto | Nombre      | Precio mensual | Price ID a guardar             |
   |----------|-------------|----------------|-------------------------------|
   | Pro      | Tokenia Pro  | $12.00 USD/mes | → `STRIPE_PRO_MONTHLY_PRICE_ID` |
   | Pro      | Tokenia Pro  | $99.00 USD/año | → `STRIPE_PRO_ANNUAL_PRICE_ID`  |
   | Team     | Tokenia Team | $39.00 USD/mes | → `STRIPE_TEAM_MONTHLY_PRICE_ID`|

3. Copia los `price_xxx` IDs y guárdalos en Railway como variables de entorno.

---

## Paso 2 — Cambios en la base de datos (nueva migración SQL)

Crear archivo: `supabase/migrations/002_stripe_billing.sql`

```sql
-- Agregar columnas de Stripe al perfil
alter table public.profiles
  add column if not exists stripe_customer_id    text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status   text default 'none'
    check (subscription_status in ('none','active','past_due','canceled','trialing'));

-- Índice para lookups por customer_id (webhook events)
create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
```

---

## Paso 3 — Checkout: `/api/billing/checkout` (ya existe el scaffolding)

El endpoint existe en `server.js` y devuelve `BILLING_DISABLED` mientras `ENABLE_BILLING=false`.
Cuando se active, el flujo será:

```
POST /api/billing/checkout
Body: { priceId, successUrl, cancelUrl }

1. Verificar que el usuario esté autenticado (req.user)
2. Buscar o crear stripe_customer_id en Supabase:
   - Si ya tiene customer_id → usar ese
   - Si no tiene → stripe.customers.create({ email: user.email, metadata: { supabase_id: user.id } })
   - Guardar customer_id en profiles
3. Crear Stripe Checkout Session:
   stripe.checkout.sessions.create({
     mode: 'subscription',
     customer: customer_id,
     line_items: [{ price: priceId, quantity: 1 }],
     success_url: '/?checkout=success',
     cancel_url:  '/pricing.html?checkout=cancel',
     subscription_data: {
       metadata: { supabase_user_id: user.id }
     }
   })
4. Devolver { url: session.url }
```

---

## Paso 4 — Webhook: `POST /api/billing/webhook`

El endpoint existe en `server.js` pero está desactivado con `BILLING_DISABLED`.
Eventos a manejar:

```javascript
switch (event.type) {

  case 'checkout.session.completed':
    // Pago inicial exitoso — activar plan
    const session = event.data.object;
    const userId  = session.subscription_data?.metadata?.supabase_user_id;
    const subId   = session.subscription;
    const priceId = session.line_items?.data[0]?.price?.id;

    const newPlan = priceId === process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ? 'team' : 'pro';

    await supabaseAdmin.from('profiles').update({
      plan: newPlan,
      stripe_subscription_id: subId,
      subscription_status: 'active',
      monthly_token_limit: newPlan === 'team' ? 5000000 : 1000000,
    }).eq('id', userId);
    break;

  case 'invoice.payment_succeeded':
    // Renovación mensual — confirmar que el plan sigue activo
    // (por si acaso estaba en past_due)
    await supabaseAdmin.from('profiles')
      .update({ subscription_status: 'active' })
      .eq('stripe_subscription_id', event.data.object.subscription);
    break;

  case 'invoice.payment_failed':
    // Pago fallido — marcar como past_due (no degradar inmediatamente)
    await supabaseAdmin.from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('stripe_subscription_id', event.data.object.subscription);
    break;

  case 'customer.subscription.deleted':
    // Cancelación — degradar a free
    const sub = event.data.object;
    await supabaseAdmin.from('profiles').update({
      plan: 'free',
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      monthly_token_limit: 50000,
    }).eq('stripe_subscription_id', sub.id);
    break;
}
```

---

## Paso 5 — Configurar webhook en Stripe Dashboard (modo test)

1. **Stripe → Developers → Webhooks → + Add endpoint**
2. URL: `https://tokenia.live/api/billing/webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copia el **Signing secret** (`whsec_...`) → guardarlo como `STRIPE_WEBHOOK_SECRET` en Railway.

---

## Paso 6 — Portal de cliente (cancelar / cambiar plan)

```javascript
// POST /api/billing/portal
app.post('/api/billing/portal', requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id);
  if (!profile?.stripe_customer_id)
    return res.status(400).json({ error: 'No active subscription.' });

  const session = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: 'https://tokenia.live',
  });
  res.json({ url: session.url });
});
```

---

## Paso 7 — Tarjetas de prueba (test mode)

| Escenario                    | Número de tarjeta        |
|------------------------------|--------------------------|
| Pago exitoso                 | `4242 4242 4242 4242`    |
| Requiere autenticación (3DS) | `4000 0025 0000 3155`    |
| Pago rechazado               | `4000 0000 0000 9995`    |
| Suscripción que falla luego  | `4000 0000 0000 0341`    |

- Fecha: cualquier fecha futura  
- CVC: cualquier 3 dígitos  
- ZIP: cualquier 5 dígitos

---

## Paso 8 — Checklist antes de activar live mode

- [ ] Todo el flujo test funciona end-to-end (checkout → webhook → plan actualizado en Supabase)
- [ ] Portal de cliente funciona (cancelar, cambiar plan)
- [ ] Plan degrada a `free` correctamente cuando se cancela
- [ ] `past_due` no degrada inmediatamente (tiene gracia de 7 días)
- [ ] `STRIPE_SECRET_KEY` es `sk_test_...` en Railway (nunca `sk_live_` hasta aprobación)
- [ ] Revisión legal/fiscal completada (impuestos, términos de servicio)
- [ ] Aprobación manual explícita del equipo antes de cambiar a live
- [ ] Cambiar `sk_test_` → `sk_live_` SOLO después de aprobación

---

## Variables que NUNCA deben estar activas hasta aprobación

```
# ESTAS LÍNEAS DEBEN PERMANECER COMENTADAS EN RAILWAY HASTA APROBACIÓN:
# ENABLE_BILLING=true
# ENABLE_STRIPE=true
# STRIPE_SECRET_KEY=sk_live_...
```

**Fecha de creación de este documento:** Mayo 2026  
**Implementar en:** Fase 4 del producto — post beta privada
