// =============================================================================
//  CONFIGURACIÓN DE LA LANDING (página de bienvenida que se ve al escanear el QR)
// -----------------------------------------------------------------------------
//  RELLENAR CUANDO TENGAN LOS DATOS.
//  Mientras un campo esté vacío (""), en el pie de página NO aparece su enlace
//  (así no se ven botones rotos). Cuando el usuario pase redes/contacto/dominio,
//  SOLO se edita este archivo: no hay que tocar la página.
// =============================================================================

type LandingConfigDatos = {
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  correo: string;
  dominio: string;
};

export const landingConfig: LandingConfigDatos = {
  // Número de WhatsApp SIN el +503, solo los 8 dígitos. Ej.: "7777-7777" o "77777777".
  whatsapp: "7687-8956", // WhatsApp de soporte de FleteYa

  // URLs completas de las redes sociales (incluyendo https://). Ej.: "https://facebook.com/fleteya".
  facebook: "https://www.facebook.com/share/1FndDUU6A7/", // Página oficial FleteYa
  instagram: "", // RELLENAR CUANDO TENGAN LA CUENTA
  tiktok: "", // RELLENAR CUANDO TENGAN LA CUENTA

  // Correo de contacto. Ej.: "hola@fleteya.com".
  correo: "", // RELLENAR CUANDO TENGAN EL CORREO

  // Dominio público donde vive la app. Hoy es temporal; cambiar por el definitivo
  // cuando compren el dominio (sin "/" al final). Ej.: "https://fleteya.com".
  dominio: "https://33c645075.abacusai.cloud", // CAMBIAR POR EL DOMINIO DEFINITIVO
};

export type LandingConfig = LandingConfigDatos;
