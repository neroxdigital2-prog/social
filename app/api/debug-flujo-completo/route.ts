import { NextRequest, NextResponse } from "next/server";
import { generarRespuestaChat } from "@/lib/generadorTexto";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_EMPRESA_POR_NUMERO = process.env.IONOS_BRIDGE_URL_WHATSAPP_EMPRESA_POR_NUMERO;
const BRIDGE_CONVERSACION_OBTENER = process.env.IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_OBTENER;
const BRIDGE_MENSAJE_GUARDAR = process.env.IONOS_BRIDGE_URL_WHATSAPP_MENSAJE_GUARDAR;

async function bridgePost(url: string | undefined, body: unknown) {
  if (!url) return { paso_ok: false, error: "URL de entorno no definida" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const texto = await res.text();
    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      data = null;
    }
    return { paso_ok: res.ok, status_http: res.status, respuesta_cruda: texto.slice(0, 500), data };
  } catch (e) {
    return { paso_ok: false, error: String(e) };
  }
}

export async function GET() {
  const resultado: Record<string, unknown> = {};

  resultado.env_vars = {
    BRIDGE_SECRET: !!BRIDGE_SECRET,
    IONOS_BRIDGE_URL_WHATSAPP_EMPRESA_POR_NUMERO: BRIDGE_EMPRESA_POR_NUMERO || "NO DEFINIDA",
    IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_OBTENER: BRIDGE_CONVERSACION_OBTENER || "NO DEFINIDA",
    IONOS_BRIDGE_URL_WHATSAPP_MENSAJE_GUARDAR: BRIDGE_MENSAJE_GUARDAR || "NO DEFINIDA",
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    CEREBRAS_API_KEY: !!process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
  };

  // Paso 1: buscar empresa por phoneNumberId
  const empresaRes = await bridgePost(BRIDGE_EMPRESA_POR_NUMERO, {
    phoneNumberId: "1212209208648547",
  });
  resultado.paso1_buscar_empresa = empresaRes;

  const empresa = (empresaRes as { data?: { id?: string } }).data;
  if (!empresa?.id) {
    resultado.diagnostico = "PARÓ AQUÍ: no se encontró ninguna empresa con ese phoneNumberId. Revisa que el SQL de UPDATE se haya ejecutado bien.";
    return NextResponse.json(resultado);
  }

  // Paso 2: obtener/crear conversación
  const convRes = await bridgePost(BRIDGE_CONVERSACION_OBTENER, {
    empresaId: empresa.id,
    telefono: "34600000099",
    nombreContacto: "Diagnóstico",
  });
  resultado.paso2_obtener_conversacion = convRes;

  const conv = (convRes as { data?: { id?: string } }).data;
  if (!conv?.id) {
    resultado.diagnostico = "PARÓ AQUÍ: no se pudo crear/obtener la conversación en la base de datos.";
    return NextResponse.json(resultado);
  }

  // Paso 3: generar respuesta con IA
  try {
    const respuestaIA = await generarRespuestaChat(
      "Eres un asistente de prueba. Responde brevemente.",
      "Di 'funciona correctamente' y nada más."
    );
    resultado.paso3_generar_ia = { paso_ok: true, respuesta: respuestaIA };
  } catch (e) {
    resultado.paso3_generar_ia = { paso_ok: false, error: String(e) };
    resultado.diagnostico = "PARÓ AQUÍ: la generación de IA falló (revisa las claves GEMINI/GROQ/CEREBRAS/OPENROUTER arriba).";
    return NextResponse.json(resultado);
  }

  // Paso 4: guardar mensaje de prueba
  const guardarRes = await bridgePost(BRIDGE_MENSAJE_GUARDAR, {
    conversacionId: conv.id,
    empresaId: empresa.id,
    telefono: "34600000099",
    nombreContacto: "Diagnóstico",
    mensajesNuevos: [{ rol: "BOT", contenido: "Mensaje de prueba de diagnóstico" }],
  });
  resultado.paso4_guardar_mensaje = guardarRes;

  resultado.diagnostico = "Todos los pasos se completaron. Si /whatsapp y /crm siguen vacíos, revisa el paso4 arriba.";
  return NextResponse.json(resultado);
}
