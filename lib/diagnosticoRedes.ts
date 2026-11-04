// Traduce los errores técnicos de Meta / Google a: qué pasa, por qué y cómo
// arreglarlo. Es puro (sin dependencias de servidor): lo usan el Dashboard,
// la comprobación en vivo de conexiones y cualquier pantalla que muestre errores.

export type AmbitoError = "conexion" | "contenido" | "temporal" | "desconocido";

export interface AccionDiagnostico {
  etiqueta: string;
  destino: "configuracion" | "publicacion" | "biblioteca" | "externo";
  url?: string; // solo para destino "externo"
}

export interface Diagnostico {
  ambito: AmbitoError;
  titulo: string;
  causa: string;
  pasos: string[];
  acciones: AccionDiagnostico[];
}

const RECONECTAR_META: AccionDiagnostico = { etiqueta: "Ir a Configuración", destino: "configuracion" };
const ABRIR_PUBLICACION: AccionDiagnostico = { etiqueta: "Abrir la publicación", destino: "publicacion" };

const URL_GOOGLE_PUBLICO = "https://console.cloud.google.com/auth/audience?project=nerox-gbp";
const URL_GOOGLE_MARCA = "https://console.cloud.google.com/auth/branding?project=nerox-gbp";
const URL_META_INSTAGRAM = "https://business.facebook.com/latest/settings/instagram_account";

function coincide(texto: string, ...patrones: RegExp[]): boolean {
  return patrones.some((p) => p.test(texto));
}

function diagnosticoGoogle(m: string): Diagnostico | null {
  if (coincide(m, /renovar el token/, /invalid_grant/, /expired or revoked/, /token has been expired/)) {
    return {
      ambito: "conexion",
      titulo: "La conexión con Google ha caducado",
      causa:
        "La app de Google Cloud (nerox-gbp) está en modo «Prueba». En ese modo Google anula el acceso cada 7 días y hay que reconectar. Se soluciona pasando la app a «En producción».",
      pasos: [
        "Google Cloud → Google Auth Platform → Información de la marca: rellena nombre de la app, correo de asistencia, página principal (https://nerox.es), política de privacidad y añade nerox.es en «Dominios autorizados». Guarda.",
        "Google Auth Platform → Público → pulsa «Publicar app» y confirma. El estado debe pasar a «En producción».",
        "En Nerox: Configuración → Google Business → Desconectar → Conectar Google Business y elige la ficha.",
        "Vuelve aquí y pulsa «Comprobar conexiones».",
      ],
      acciones: [
        { etiqueta: "Información de la marca", destino: "externo", url: URL_GOOGLE_MARCA },
        { etiqueta: "Publicar app", destino: "externo", url: URL_GOOGLE_PUBLICO },
        { etiqueta: "Reconectar Google", destino: "configuracion" },
      ],
    };
  }
  if (coincide(m, /falta el refresh_token/)) {
    return {
      ambito: "conexion",
      titulo: "Google no guardó el permiso permanente",
      causa: "La conexión se hizo sin «refresh token», así que no puede renovarse sola.",
      pasos: ["Configuración → Google Business → Desconectar.", "Conectar Google Business de nuevo y acepta todos los permisos."],
      acciones: [{ etiqueta: "Reconectar Google", destino: "configuracion" }],
    };
  }
  if (coincide(m, /permission_denied/, /\b403\b/, /does not have permission/, /caller does not have/)) {
    return {
      ambito: "conexion",
      titulo: "La cuenta de Google no tiene permiso sobre la ficha",
      causa: "La cuenta conectada ya no es propietaria o administradora de la ficha de Google Business.",
      pasos: [
        "En business.google.com comprueba que la cuenta conectada gestiona la ficha.",
        "Reconecta Google Business en Configuración eligiendo la ficha correcta.",
      ],
      acciones: [{ etiqueta: "Reconectar Google", destino: "configuracion" }],
    };
  }
  if (coincide(m, /resource_exhausted/, /\b429\b/, /quota/)) {
    return {
      ambito: "temporal",
      titulo: "Límite de Google alcanzado",
      causa: "Se hicieron demasiadas llamadas a la API de Google en poco tiempo.",
      pasos: ["No hace falta tocar nada: vuelve a programar la publicación dentro de una hora."],
      acciones: [ABRIR_PUBLICACION],
    };
  }
  return null;
}

function diagnosticoMeta(red: string, m: string): Diagnostico | null {
  const nombre = red === "INSTAGRAM" ? "Instagram" : "Facebook";

  if (coincide(m, /requiere una imagen/, /no ten[ií]a ninguna/)) {
    return {
      ambito: "contenido",
      titulo: "La publicación no tenía imagen ni vídeo",
      causa: "Instagram no permite publicaciones solo de texto. Esta publicación se programó sin imagen y sin Reel.",
      pasos: [
        "Abre la publicación en la Biblioteca.",
        "Elige «Imagen» y genera o sube una imagen, o elige «Vídeo Reel» y pulsa «Generar Reel con IA».",
        "Vuelve a programarla en el Calendario.",
      ],
      acciones: [ABRIR_PUBLICACION],
    };
  }
  if (coincide(m, /\(#10\)/, /instagram_content_publish/, /does not have permission/, /permissions? error/)) {
    return {
      ambito: "conexion",
      titulo: `${nombre}: falta el permiso para publicar`,
      causa:
        "Tu usuario de Facebook no tiene acceso total a la cuenta de Instagram, o al conectar no se marcó la cuenta de Instagram.",
      pasos: [
        "Meta Business Suite → Cuentas de Instagram → nerox_digital → «Asignar personas» → tu usuario con Control total.",
        "En Nerox: Configuración → desconecta Facebook e Instagram → Conectar Facebook → «Editar acceso» → marca la página y la cuenta de Instagram.",
        "Vuelve aquí y pulsa «Comprobar conexiones».",
      ],
      acciones: [
        { etiqueta: "Abrir Business Suite", destino: "externo", url: URL_META_INSTAGRAM },
        RECONECTAR_META,
      ],
    };
  }
  if (
    coincide(
      m,
      /\(#190\)/,
      /session has (been invalidated|expired)/,
      /error validating access token/,
      /access token (has expired|is invalid)/,
      /user has not authorized application/,
      /oauthexception/
    )
  ) {
    return {
      ambito: "conexion",
      titulo: `${nombre}: la sesión ha caducado`,
      causa: "Meta invalidó el token (cambio de contraseña, cierre de sesión o permisos retirados).",
      pasos: [
        "Configuración → Desconectar Facebook (e Instagram).",
        "Conectar Facebook de nuevo y elige la página.",
        "Vuelve aquí y pulsa «Comprobar conexiones».",
      ],
      acciones: [RECONECTAR_META],
    };
  }
  if (coincide(m, /aspect ratio/, /relaci[oó]n de aspecto/, /\(#36003\)/)) {
    return {
      ambito: "contenido",
      titulo: "Proporción de imagen no válida",
      causa: "Instagram solo acepta imágenes del feed entre 4:5 (vertical) y 1.91:1 (horizontal).",
      pasos: ["Abre la publicación y cambia la imagen (Nerox la ajusta a 4:5 automáticamente al publicar)."],
      acciones: [ABRIR_PUBLICACION],
    };
  }
  if (coincide(m, /\(#9004\)/, /2207052/, /could not be fetched/, /media download/, /no se pudo descargar/, /media.*(not|no).*(found|accessible)/)) {
    return {
      ambito: "contenido",
      titulo: `${nombre} no pudo descargar la imagen o el vídeo`,
      causa: "La URL del archivo no es pública o ya no existe.",
      pasos: ["Abre la publicación, quita la imagen/vídeo y vuelve a generarlo o subirlo.", "Programa de nuevo la publicación."],
      acciones: [ABRIR_PUBLICACION],
    };
  }
  if (coincide(m, /tard[oó] demasiado/, /timeout/, /status error/, /no pudo procesar/, /\(#4\)/, /\(#17\)/, /\(#32\)/, /rate limit/, /request limit/)) {
    return {
      ambito: "temporal",
      titulo: `${nombre} no procesó la publicación a tiempo`,
      causa: "Fallo temporal de Meta (procesamiento lento o límite de llamadas).",
      pasos: ["No hace falta reconectar: vuelve a programar la publicación para dentro de 15 minutos."],
      acciones: [ABRIR_PUBLICACION],
    };
  }
  return null;
}

export function diagnosticarError(red: string, mensaje: string): Diagnostico {
  const m = (mensaje || "").toLowerCase();
  const especifico = red === "GOOGLE" ? diagnosticoGoogle(m) : diagnosticoMeta(red, m);
  if (especifico) return especifico;
  return {
    ambito: "desconocido",
    titulo: "Error no identificado",
    causa: "La red devolvió un error que Nerox todavía no reconoce. Abajo tienes el mensaje original.",
    pasos: [
      "Abre la publicación afectada y revisa la imagen, el texto y las redes marcadas.",
      "Pulsa «Comprobar conexiones» para descartar un problema de conexión.",
      "Si se repite, envía el mensaje original a soporte.",
    ],
    acciones: [ABRIR_PUBLICACION, RECONECTAR_META],
  };
}
