# Project TODO

- [x] Inicializar proyecto Expo con TypeScript y configurar dependencias nativas.
- [x] Configurar app.json con permisos y branding.
- [x] Implementar visor de cámara, OCR y persistencia.
- [x] Añadir pestañas de Registro, soporte de GPS y cotejo CSV.
- [ ] Añadir preset de zoom 1x antes de 1.5x (ciclo 1x -> 1.5x -> 2x -> 4x -> 1x).
- [ ] Guardar estado de zoom en AsyncStorage y restaurarlo al volver de background (AppState).
- [ ] Crear nueva opción/TAB o sección en Registros para reglas de notificación por matrícula (activación global/individual, texto personalizado, edición y borrado).
- [ ] Integrar toasts especiales de notificación cuando se detecte una matrícula con regla activa.
- [ ] Guardar checkpoint y entregar la APK/proyecto finalizado.

- [ ] Eliminar la referencia `packageManager` que fuerza a Corepack a descargar pnpm 11.21.0.
- [ ] Validar que `pnpm-lock.yaml` coincide con `package.json` y permite instalación congelada.
- [ ] Resolver el bloqueo de scripts de instalación (`ERR_PNPM_IGNORED_BUILDS`) del constructor remoto.
- [ ] Verificar TypeScript/Expo y guardar un checkpoint apto para construir APK.

## Incidencia de compilación APK — 2026-08-15

- [ ] Corregir `pnpm_install_failed` causado por Corepack al descargar pnpm 11.21.0.
- [ ] Confirmar una instalación reproducible en el entorno de construcción remoto.
- [ ] Volver a habilitar una versión publicable para construir y descargar la APK.

NOTA: estas tareas son historial de la incidencia; no se eliminan al completarse.

- [ ] Revisión de la configuración del gestor de paquetes tras el error de BuildAndroidActivity.
- [ ] Regeneración/validación del lockfile con la versión de pnpm usada por el builder.
- [ ] Validación final de la compilación de dependencias y APK.
