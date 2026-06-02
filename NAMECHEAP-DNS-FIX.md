# DNS Records para Namecheap — mail.tokenia.live

IMPORTANTE: Estos registros SOLO afectan el subdominio mail.tokenia.live.
Tu info@tokenia.live en Outlook (Private Email de Namecheap) NO se ve afectado.
Los MX records del dominio raiz tokenia.live quedan intactos.

---

## INSTRUCCIONES

1. Ve a https://www.namecheap.com → Dashboard → Domain List
2. Busca tokenia.live → Click "Manage"
3. Click pestana "Advanced DNS"
4. Agrega los 3 registros con "+ Add Record"

---

## REGISTRO 1 — DKIM (TXT)

| Campo  | Valor |
|--------|-------|
| Type   | TXT Record |
| Host   | resend._domainkey.mail |
| Value  | [VER INSTRUCCION ABAJO] |
| TTL    | Automatic |

Para obtener el Value del DKIM:
1. Ve a https://resend.com/domains
2. Click en mail.tokenia.live
3. Copia el valor del campo "Value" del registro DKIM
   Empieza con: p=MIGfMA0G... o v=DKIM1; k=rsa; p=...

O ejecuta PUSH-AND-FIX-RESEND.bat — lo obtiene automaticamente
y genera RESEND-DNS-RECORDS.json con el valor exacto.

---

## REGISTRO 2 — SPF (TXT) — valor conocido, pegar tal cual

| Campo  | Valor |
|--------|-------|
| Type   | TXT Record |
| Host   | send.mail |
| Value  | v=spf1 include:amazonses.com ~all |
| TTL    | Automatic |

Este valor es el mismo para todos los dominios de Resend.

---

## REGISTRO 3 — MX — valor conocido, pegar tal cual

| Campo    | Valor |
|----------|-------|
| Type     | MX Record |
| Host     | send.mail |
| Value    | feedback-smtp.us-east-1.amazonses.com |
| Priority | 10 |
| TTL      | Automatic |

Este valor es estandar para todos los dominios Resend en us-east-1.

---

## DESPUES DE AGREGAR LOS 3 REGISTROS

1. Click "Save All Changes" en Namecheap
2. Espera 30 minutos a 2 horas (propagacion DNS)
3. Ve a https://resend.com/domains
4. Click en mail.tokenia.live → "Verify DNS Records"
5. Cuando los 3 esten verdes OK, los emails de Tokenia funcionaran

---

## RESUMEN RAPIDO

RECORD 1 (TXT):
  Host:  resend._domainkey.mail
  Value: [desde resend.com/domains → mail.tokenia.live → DKIM Value]

RECORD 2 (TXT):
  Host:  send.mail
  Value: v=spf1 include:amazonses.com ~all

RECORD 3 (MX):
  Host:     send.mail
  Value:    feedback-smtp.us-east-1.amazonses.com
  Priority: 10

---

## Por que mail.tokenia.live y no tokenia.live?

El dominio raiz tokenia.live tiene Private Email de Namecheap
(tu info@tokenia.live en Outlook). Agregar registros Resend al raiz
podria crear conflictos con los MX existentes.

Con el subdominio mail.tokenia.live:
- Resend envia emails automaticos (alertas, newsletter, confirmaciones)
- info@tokenia.live sigue funcionando en Outlook sin cambios
- Cero conflictos entre los dos sistemas

Los emails de Tokenia se envian desde: noreply@mail.tokenia.live
Los usuarios pueden responder a: info@tokenia.live (reply-to)
