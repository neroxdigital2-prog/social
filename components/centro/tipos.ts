import type { EstadoAgente } from "@/lib/agentes";

export interface AgenteVista {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  frecuencia: string;
  estado: EstadoAgente;
  mensaje: string;
  detalle: string[];
  ultimaRevision: string | null;
  segundosRevision: number | null;
  ultimaActividad: string | null;
  desdeEstado: string | null;
  abiertas: number;
  silenciadas: number;
}

export interface DisponibilidadDia {
  agente: string;
  dia: string;
  muestras: number;
  pct: number | null;
  avisos: number;
  errores: number;
}

export interface DatosCentro {
  instalado: boolean;
  telegram: boolean;
  ahora?: string;
  latido?: { ultimaEjecucion: string | null; segundosDesde: number | null };
  otrasIncidencias?: number;
  config?: { modoNoche: string | null; nocheAhora: boolean; escaladoMin: number; email: boolean };
  agentes: AgenteVista[];
  disponibilidad: DisponibilidadDia[];
}

export interface EventoIncidencia {
  id: string | number;
  clave: string | null;
  agente?: string | null;
  tipo: "ABIERTA" | "REABIERTA" | "CAMBIO" | "AVISO" | "REINTENTO" | "AUTOCORRECCION" | "SILENCIADA" | "RESUELTA";
  canal: string | null;
  destino: string | null;
  entregado: number | string | null;
  actor: string | null;
  detalle: string | null;
  momento: string;
}

export interface IncidenciaVista {
  clave: string;
  agente: string | null;
  estado: "ABIERTA" | "SILENCIADA" | "RESUELTA";
  nivel: "CRITICO" | "AVISO";
  titulo: string;
  detalle: string | null;
  avisos: number | string;
  primeraVez: string;
  ultimaVez: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
  resueltaVia: string | null;
  motivoResolucion: string | null;
  duracionSeg: number;
  eventos: EventoIncidencia[];
}
