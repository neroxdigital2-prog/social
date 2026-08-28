import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_PROGRAMADAS = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_PROGRAMADAS_LIST!;
const BRIDGE_MARCAR = process.env.IONOS_BRIDGE_URL_PUBLICACION_MARCAR_RESULTADO!;
const BRIDGE_QA_RECHAZAR = process.env.IONOS_BRIDGE_URL_PUBLICACION_QA_RECHAZAR!;
const CRON_SECRET = process.env.CRON_SECRET!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_PHONE_NUMBER_ID = "1212209208648547"; // numero de negocio de Nerox (remitente)
const WHATSAPP_ALERTA_NUMERO = "34641801175"; // numero personal donde llegan las alertas del sistema
const WHATSAPP_API_VERSION = "v21.0";
const GRAPH_VERSION = "v21.0";

// --- QA de Marca: revisa el texto contra la rubrica de Nerox antes de publicar ---
const RUBRICA_MARCA = `Tono de marca de Nerox Digital: cercano y directo, como hablarle a un amigo dueño de un negocio. NO debe sonar corporativo/frio, NO debe usar jerga tecnica sin explicar, NO debe tener errores ortograficos obvios, NO debe prometer resultados exagerados o falsos ("resultados garantizados 100%", "el mejor del mundo"), NO debe sonar agresivo o de presion excesiva de venta.`;

async function evaluarQA(texto: string): Promise<{ aprueba: boolean; motivo?: string }> {
  if (!GROQ_API_KEY) return { aprueba: true }; // si no hay clave, no bloqueamos la publicacion
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: `Eres el revisor de calidad de marca de Nerox Digital. ${RUBRICA_MARCA} Responde SOLO un JSON: {"aprueba": true|false, "motivo": "razon breve si no aprueba, o cadena vacia si aprueba"}.`,
          },
          { role: "user", content: texto },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        temperature: 0,
        max_tokens: 300,
      }),
    });
    if (!res.ok) return { aprueba: true }; // si el QA falla tecnicamente, no bloqueamos por eso
    const data = await res.json();
    const contenido = data?.choices?.[0]?.message?.content || "{}";
    const veredicto = JSON.parse(contenido.replace(/```json|```/gi, "").trim());
    return { aprueba: veredicto.aprueba !== false, motivo: veredicto.motivo || undefined };
  } catch {
    return { aprueba: true }; // ante cualquier error tecnico del QA, no bloqueamos la publicacion
  }
}

async function enviarAlertaWhatsApp(mensaje: string) {
  if (!WHATSAPP_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: WHATSAPP_ALERTA_NUMERO,
        type: "text",
        text: { body: mensaje },
      }),
    });
  } catch (err) {
    console.error("Error enviando alerta de WhatsApp:", err);
  }
}

interface RedConectadaResumen {
  red: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK" | "GOOGLE" | "TWITTER";
  accessToken: string;
  refreshToken?: string | null;
  cuentaExterna: string;
}

interface PublicacionProgramada {
  id: string;
  texto: string;
  hashtags: string[];
  imagenUrl: string | null;
  altText?: string | null;
  redesConectadas: RedConectadaResumen[];
}

async function publicarEnFacebook(pageId: string, token: string, texto: string, imagenUrl: string | null) {
  const url = imagenUrl
    ? `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`
    : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;

  const body = new URLSearchParams({ access_token: token });
  if (imagenUrl) {
    body.set("url", imagenUrl);
    body.set("caption", texto);
  } else {
    body.set("message", texto);
  }

  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) {
    return { error: data?.error?.message || "Error desconocido publicando en Facebook" };
  }
  return { postIdExterno: data.post_id || data.id };
}

async function publicarEnInstagram(igId: string, token: string, texto: string, imagenUrl: string | null, altText?: string | null) {
  if (!imagenUrl) {
    return { error: "Instagram requiere una imagen; esta publicación no tenía ninguna generada." };
  }

  const paramsCrear = new URLSearchParams({ image_url: imagenUrl, caption: texto, access_token: token });
  // alt_text es un parametro oficial soportado por Meta desde marzo 2025 para
  // posts de imagen (no Reels/Stories). Mejora accesibilidad y SEO/indexacion.
  if (altText) paramsCrear.set("alt_text", altText.slice(0, 100));

  const crearRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
    method: "POST",
    body: paramsCrear,
  });
  const crearData = await crearRes.json();
  if (!crearRes.ok || crearData.error || !crearData.id) {
    return { error: crearData?.error?.message || "Error creando el contenedor de Instagram" };
  }

  // Instagram descarga y procesa la imagen de forma asíncrona; hay que esperar
  // a que el contenedor esté FINISHED antes de publicarlo (si no, falla con
  // "Media ID is not available"). Se comprueba cada 2s, hasta 30s en total.
  let listo = false;
  for (let intento = 0; intento < 15; intento++) {
    const estadoRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${crearData.id}?fields=status_code&access_token=${token}`
    );
    const estadoData = await estadoRes.json();
    if (estadoData.status_code === "FINISHED") {
      listo = true;
      break;
    }
    if (estadoData.status_code === "ERROR") {
      return { error: "Instagram no pudo procesar la imagen (status ERROR al preparar el contenedor)." };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!listo) {
    return { error: "La imagen tardó demasiado en procesarse en Instagram (timeout de 30s)." };
  }

  const publicarRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: crearData.id, access_token: token }),
  });
  const publicarData = await publicarRes.json();
  if (!publicarRes.ok || publicarData.error) {
    return { error: publicarData?.error?.message || "Error publicando el contenedor en Instagram" };
  }
  return { postIdExterno: publicarData.id };
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_GBP_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_GBP_CLIENT_SECRET!;

/**
 * El accessToken de Google caduca en 1 hora. Como este cron corre cada 15
 * minutos pero una publicacion puede quedar programada para dentro de
 * varias horas, siempre renovamos el token con el refreshToken justo antes
 * de publicar, en vez de asumir que el guardado sigue siendo valido.
 */
async function renovarTokenGoogle(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function publicarEnGoogleBusiness(recursoCompleto: string, refreshToken: string | null | undefined, texto: string, imagenUrl: string | null) {
  if (!refreshToken) {
    return { error: "Falta el refresh_token de Google. Reconecta la cuenta desde Configuración." };
  }

  const accessToken = await renovarTokenGoogle(refreshToken);
  if (!accessToken) {
    return { error: "No se pudo renovar el token de acceso de Google." };
  }

  const body: any = {
    languageCode: "es",
    summary: texto.slice(0, 1500), // limite de Google para el resumen del post
    topicType: "STANDARD",
  };
  if (imagenUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: imagenUrl }];
  }

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${recursoCompleto}/localPosts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    return { error: data?.error?.message || "Error publicando en Google Business" };
  }
  return { postIdExterno: data.name };
}

// --- Firma OAuth 1.0a para la API de X (Twitter) ---
function firmarOAuth1(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  apiSecret: string,
  accessTokenSecret: string
): string {
  const encode = (s: string) =>
    encodeURIComponent(s).replace(/[!*()']/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encode(k)}=${encode(oauthParams[k])}`)
    .join("&");

  const baseString = [method.toUpperCase(), encode(url), encode(paramString)].join("&");
  const signingKey = `${encode(apiSecret)}&${encode(accessTokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function encabezadoOAuth1(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const encode = (s: string) =>
    encodeURIComponent(s).replace(/[!*()']/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const firma = firmarOAuth1(method, url, oauthParams, apiSecret, accessTokenSecret);

  // Tipado explícito para evitar que TypeScript pierda el índice de string al combinar objetos.
  const conFirma: Record<string, string> = { ...oauthParams, oauth_signature: firma };

  return (
    "OAuth " +
    Object.keys(conFirma)
      .sort()
      .map((k) => `${encode(k)}="${encode(conFirma[k])}"`)
      .join(", ")
  );
}

async function publicarEnX(accessTokenPack: string, texto: string) {
  let creds: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string };
  try {
    creds = JSON.parse(accessTokenPack);
  } catch {
    return { error: "Credenciales de X mal formadas" };
  }

  const url = "https://api.twitter.com/2/tweets";
  const authHeader = encabezadoOAuth1("POST", url, creds.apiKey, creds.apiSecret, creds.accessToken, creds.accessTokenSecret);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ text: texto.slice(0, 280) }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.errors) {
    const mensaje = data?.detail || data?.errors?.[0]?.message || data?.title || "Error desconocido publicando en X";
    return { error: mensaje };
  }
  return { postIdExterno: data?.data?.id };
}

async function procesarPublicaciones() {
  const res = await fetch(BRIDGE_PROGRAMADAS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const publicaciones: PublicacionProgramada[] = await res.json().catch(() => []);

  const resumen = [];

  for (const pub of Array.isArray(publicaciones) ? publicaciones : []) {
    const textoCompleto = `${pub.texto}\n\n${(pub.hashtags || []).join(" ")}`.trim();

    // --- QA de Marca: revisa antes de publicar en cualquier red ---
    const qa = await evaluarQA(pub.texto);
    if (!qa.aprueba) {
      await fetch(BRIDGE_QA_RECHAZAR, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({ id: pub.id }),
      }).catch(() => {});

      await enviarAlertaWhatsApp(
        `⚠️ Nerox QA: una publicación NO se publicó automáticamente.\n\nMotivo: ${qa.motivo || "No cumple la rúbrica de marca"}\n\nQuedó en Borrador para que la revises: "${pub.texto.slice(0, 100)}..."`
      );

      resumen.push({ publicacionId: pub.id, qaRechazado: true, motivo: qa.motivo });
      continue;
    }

    const resultadosPorRed = [];

    for (const red of pub.redesConectadas || []) {
      let resultado: { postIdExterno?: string; error?: string };
      if (red.red === "FACEBOOK") {
        resultado = await publicarEnFacebook(red.cuentaExterna, red.accessToken, textoCompleto, pub.imagenUrl);
      } else if (red.red === "INSTAGRAM") {
        resultado = await publicarEnInstagram(red.cuentaExterna, red.accessToken, textoCompleto, pub.imagenUrl, pub.altText);
      } else if (red.red === "TWITTER") {
        resultado = await publicarEnX(red.accessToken, textoCompleto);
      } else if (red.red === "GOOGLE") {
        resultado = await publicarEnGoogleBusiness(red.cuentaExterna, red.refreshToken, textoCompleto, pub.imagenUrl);
      } else {
        continue; // LinkedIn/TikTok: no implementado todavía
      }
      resultadosPorRed.push({ red: red.red, ...resultado });
    }

    if (resultadosPorRed.length > 0) {
      await fetch(BRIDGE_MARCAR, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({ publicacionId: pub.id, resultadosPorRed }),
      });
    }

    resumen.push({ publicacionId: pub.id, resultadosPorRed });
  }

  return resumen;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // IMPORTANTE: cron-job.org (y otros disparadores externos) suelen cortar
  // la conexión a los 30s. Publicar en Instagram por si solo puede tardar
  // hasta 30s (esperando a que el contenedor de imagen quede FINISHED), y si
  // hay varias publicaciones/redes en el lote, el total facilmente supera
  // ese limite - el disparador se rendia esperando y el proceso se cortaba a
  // medias (publicaciones que se quedaban en "Programada" para siempre).
  //
  // Por eso se responde OK de inmediato (en milisegundos) y el trabajo real
  // sigue corriendo en segundo plano con waitUntil, dentro del limite de
  // Vercel (maxDuration=60s), sin depender de que el cliente siga esperando.
  waitUntil(
    procesarPublicaciones().catch((err) => {
      console.error("Error procesando publicaciones en segundo plano:", err);
    })
  );

  return NextResponse.json({ ok: true, procesando: true });
}
