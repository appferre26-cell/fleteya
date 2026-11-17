const ACCIONES: Record<string, string> = {
  CREADO: "registrado",
  APROBADO: "aprobado",
  SUSPENDIDO: "suspendido",
  REACTIVADO: "reactivado",
  EDITADO: "datos editados",
  CONTRASENA_RESTABLECIDA: "contraseña restablecida",
  DOCUMENTO_ACTUALIZADO: "documento actualizado",
  AUTOREGISTRO: "se registró desde la app",
  PAGO_ACCESO: "pago de acceso registrado",
  PAGO_ACCESO_ANULADO: "pago de acceso anulado",
  AVISO_PAGO: "avisó que pagó su acceso",
};

export function textoAccion(a: string) {
  return ACCIONES[a] ?? a.toLowerCase();
}
