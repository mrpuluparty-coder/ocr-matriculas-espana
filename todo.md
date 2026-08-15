# Project TODO

- [x] Inicializar proyecto Expo con TypeScript y configurar dependencias nativas.
- [x] Configurar app.json con permisos y branding.
- [x] Implementar visor de cámara, OCR y persistencia.
- [x] Añadir pestañas de Registro, soporte de GPS y cotejo CSV.
- [x] Añadir preset de zoom 1x antes de 1.5x (ciclo 1x -> 1.5x -> 2x -> 4x -> 1x).
- [x] Guardar estado de zoom en AsyncStorage y restaurarlo al volver de background (AppState).
- [x] Crear nueva opción/TAB o sección en Registros para reglas de notificación por matrícula (activación global/individual, texto personalizado, edición y borrado).
- [x] Integrar toasts especiales de notificación cuando se detecte una matrícula con regla activa.
- [ ] Guardar checkpoint y entregar la APK/proyecto finalizado.

- [x] Eliminar la referencia `packageManager` que fuerza a Corepack a descargar pnpm 11.21.0.
- [x] Validar que `pnpm-lock.yaml` coincide con `package.json` y permite instalación congelada.
- [x] Resolver el bloqueo de scripts de instalación (`ERR_PNPM_IGNORED_BUILDS`) del constructor remoto.
- [x] Verificar TypeScript/Expo y guardar un checkpoint apto para construir APK.

## Incidencia de compilación APK — 2026-08-15

- [x] Corregir `pnpm_install_failed` causado por Corepack al descargar pnpm 11.21.0.
- [x] Confirmar una instalación reproducible en el entorno de construcción remoto.
- [ ] Volver a habilitar una versión publicable para construir y descargar la APK.

NOTA: estas tareas son historial de la incidencia; no se eliminan al completarse.

- [x] Revisión de la configuración del gestor de paquetes tras el error de BuildAndroidActivity.
- [x] Regeneración/validación del lockfile con la versión de pnpm usada por el builder.
- [ ] Validación final de la compilación de dependencias y APK.

## Incidencia de build no interactivo — 2026-08-15

- [x] Evitar la confirmación de borrado de node_modules de pnpm en el builder remoto sin TTY.
- [x] Ejecutar validación de TypeScript y bundle JavaScript de Expo antes del nuevo checkpoint.

## Investigación de Bundle JavaScript EAS — 2026-08-15

- [x] Localizar la causa raíz exacta anterior al paso Bundle JavaScript build phase del último build Android.
- [x] Auditar incompatibilidades de dependencias, imports y configuración Expo.
- [x] Aplicar únicamente la corrección respaldada por el diagnóstico.
- [x] Validar Preview, TypeScript y bundle Android antes de preparar una nueva construcción.

## Corrección de compatibilidad de mapas — 2026-08-15

- [x] Mantener react-native-maps en Android y sustituir su importación directa en Web por una vista de respaldo segura.

## Estabilidad de Preview — 2026-08-15

- [ ] Reducir los watchers de Metro para evitar ENOSPC en la vista previa del proyecto con pnpm.

## Nuevo fallo de compilación APK — 2026-08-15

- [ ] Localizar los logs completos del último intento remoto que falla en Bundle JavaScript build phase.
- [x] Comparar las versiones actuales de Expo y React Navigation con la matriz compatible del SDK 54.
- [x] Corregir las incompatibilidades detectadas y volver a validar el bundle Android local.
