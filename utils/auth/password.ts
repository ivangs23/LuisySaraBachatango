/**
 * Longitud mínima de contraseña, compartida por signup y set-password.
 * Vive fuera de los módulos 'use server' (que solo pueden exportar funciones
 * async) para poder reutilizarse en varias acciones.
 */
export const MIN_PASSWORD_LENGTH = 8
