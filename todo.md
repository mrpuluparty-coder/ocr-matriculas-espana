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

## Paquete de diagnóstico para revisión externa — 2026-08-15

- [x] Recopilar los logs y evidencias disponibles del fallo remoto de APK.
- [x] Identificar los archivos de configuración, dependencias e imports más relevantes para una segunda revisión.
- [x] Entregar un informe autocontenido con los hallazgos y las limitaciones de acceso al log remoto.

## Exportación limpia para revisión externa — 2026-08-15

- [x] Crear un ZIP del código fuente sin node_modules, .expo, dist ni carpetas de build.
- [x] Verificar exclusiones y entregar la descarga.

## Simplificación previa a build — 2026-08-15

- [x] Eliminar react-native-maps, los componentes de mapa y toda la interfaz de ubicaciones.
- [x] Eliminar expo-location, permisos GPS, watchPositionAsync y campos de coordenadas.
- [x] Simplificar CSV e historial a matrícula, fecha/hora y estado de coincidencia sin coordenadas.
- [x] Desactivar experiments.reactCompiler sin actualizar versiones no solicitadas.
- [x] Ejecutar instalación congelada, TypeScript y exportación Android de producción sin construir APK.

## ZIP limpio actualizado — 2026-08-15

- [x] Generar un ZIP del estado simplificado sin node_modules, .expo, dist ni carpetas de build.
- [x] Verificar exclusiones y entregar la descarga actualizada.

## Validación sin modificaciones — 2026-08-15

- [x] Ejecutar instalación congelada sin modificar dependencias.
- [x] Ejecutar TypeScript sin modificar código.
- [x] Ejecutar exportación Android de producción sin generar APK (falló al resolver react-native-css-interop/jsx-runtime).

## Resolución de NativeWind en Metro — 2026-08-15

- [x] Inspeccionar versiones, lockfile, instalación física, imports y configuración de NativeWind.
- [x] Aplicar únicamente la corrección mínima para resolver react-native-css-interop/jsx-runtime.
- [x] Validar instalación congelada, TypeScript y export Android sin construir APK.

## Ajustes tras compilación exitosa — 2026-08-16

- [x] Reparar el ciclo de zoom 1x → 1.5x → 2x → 4x.
- [x] Renombrar la pestaña Registros a Ajustes y usar un icono de engranaje.
- [x] Reducir el título del historial y evitar que el botón de eliminación se salga del contenedor.
- [x] Revisar y restaurar la importación CSV robusta.
- [x] Validar TypeScript y bundle Android antes del siguiente checkpoint.

## Sincronización del zoom al recuperar foco — 2026-08-16

- [x] Comparar la gestión actual del zoom con el checkpoint estable anterior.
- [x] Persistir y restaurar el índice de zoom sin desincronizar el botón y CameraView.
- [x] Validar TypeScript y bundle Android antes de entregar la corrección.

## Filtros diferenciados de detecciones — 2026-08-16

- [x] Conservar y mostrar todas las matrículas OCR en la pantalla principal.
- [x] Mostrar en Historial de Ajustes únicamente las detecciones que existan en el CSV importado.
- [x] Validar TypeScript y bundle Android antes de entregar el cambio.

## GPS y modo Vídeo con OCR controlado — 2026-08-17

- [x] Revisar la integración de ubicación, permisos y el estado actual de cámara/OCR/CSV/zoom.
- [x] Restaurar únicamente expo-location y los permisos nativos necesarios, sin introducir mapas.
- [x] Mantener una última posición GPS válida sin guardar un histórico continuo y mostrar su estado en Escáner.
- [x] Registrar solo coincidencias CSV con coordenadas recientes y aplicar deduplicación temporal de 60 segundos.
- [x] Añadir selector Manual/Vídeo y OCR aproximado de un fotograma por segundo sin ejecuciones simultáneas.
- [x] Ejecutar instalación congelada, TypeScript y export Android; no construir APK.
