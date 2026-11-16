const ACCIONES: Record<string, string> = {
  CREADO: "registrado",
  APROBADO: "aprobado",
  SUSPENDIDO: "suspendido",
  REACTIVADO: "reactivado",
  EDITADO: "datos editados",
  CONTRASENA_RESTABLECIDA: "contraseña restablecida",
  DOCUMENTO_ACTUALIZADO: "documento actualizado",
};

export function textoAccion(a: string) {
  return ACCIONES[a] ?? a.toLowerCase();
}
