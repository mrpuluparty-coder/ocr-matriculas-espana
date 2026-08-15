# Paquete de diagnóstico: fallo de compilación APK Android

**Proyecto:** OCR Matrículas España  
**Checkpoint revisado:** `manus-webdev://9210eaba`  
**Incidencia reportada:** construcción APK remota falla aproximadamente al 50 %, con el mensaje genérico `eas_build_failed` durante **Bundle JavaScript build phase**.

## 1. Evidencia remota disponible

La interfaz de compilación muestra únicamente el siguiente resumen. El workspace no recibe ni conserva el log detallado del worker remoto, por lo que **no existe una traza EAS completa para adjuntar** desde este entorno.

```text
activity error (type: BuildAndroidActivity, scheduledEventID: 5,
startedEventID: 6, identity: 1@cfworkers-deploy-android-worker-675799485c-8sgpk@):
EAS build ended with status ERRORED: Unknown error.
See logs of the Bundle JavaScript build phase for more information.
(type: eas_build_failed, retryable: false)
```

> El archivo `metro-local-history.log` adjunto contiene **solamente errores históricos del servidor local de Preview**. No debe confundirse con el log del worker EAS; se aporta porque conserva una traza concreta de Metro relacionada con `react-native-maps`.

## 2. Validaciones locales que sí pasaron

| Validación | Comando | Resultado |
|---|---|---|
| Compatibilidad Expo | `CI=1 npx expo install --check` | `Dependencies are up to date` |
| Lockfile | `CI=true pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies=true` | Correcto |
| Peers | `pnpm peers check` | Sin conflictos |
| TypeScript | `pnpm exec tsc --noEmit` | Sin errores |
| Bundle Android producción | `CI=1 NODE_ENV=production npx expo export --platform android --clear` | Correcto: 1.601 módulos, 4.709.606 bytes |

Estas validaciones no reproducen el error del builder remoto. Por eso el primer paso para otro agente debe ser obtener el **primer error con stack trace** del apartado “Bundle JavaScript build phase” de la actividad fallida.

## 3. Logs locales relevantes

El extracto adjunto conserva tres tipos de mensaje:

| Fecha | Mensaje | Interpretación |
|---|---|---|
| 2026-08-14 23:26 | `codegenNativeComponent is not a function` desde `react-native-maps@1.29.0` al generar Web | Error histórico de Preview. Se aplicó después una separación por plataforma y se fijó `react-native-maps@1.20.1`. |
| 2026-08-14 23:32 | `Unable to resolve "expo"` desde `.expo/static-tmp/_error.js` | Artefacto temporal de la pantalla de error de Metro; `.expo/` está ignorado por Git. |
| 2026-08-14/15 | `ENOSPC: System limit for number of file watchers reached` | Límite de inotify del sandbox de Preview. No es una traza EAS ni equivale al fallo del builder remoto. |

## 4. Archivos prioritarios para revisión

| Prioridad | Archivo | Por qué debe revisarse |
|---:|---|---|
| 1 | `package.json` | Versiones declaradas de Expo, React Native, React Navigation y módulos nativos. Confirmar que el builder usa el mismo lockfile. |
| 1 | `pnpm-lock.yaml` | Resoluciones reales que usará `pnpm install --frozen-lockfile` en el worker. |
| 1 | `pnpm-workspace.yaml` | Tiene `allowBuilds` y `confirmModulesPurge: false`, necesarios para el flujo no interactivo. |
| 1 | `app.config.ts` | `newArchEnabled: true`, plugins Expo, Android API 35, permisos, `minSdkVersion` y `buildArchs` influyen en prebuild/bundle. |
| 1 | `babel.config.js` | Configura `react-native-worklets/plugin`; debe comprobarse contra Reanimated/Worklets instalados. |
| 1 | `metro.config.js` | Aplica `withNativeWind(...)`; es el transformador personalizado que interviene directamente en Metro. |
| 2 | `app/(tabs)/index.tsx` | Importa cámara, ML Kit OCR, filesystem y ubicación. El import de `@react-native-ml-kit/text-recognition` es el candidato nativo externo más importante. |
| 2 | `app/(tabs)/registro.tsx` | Selector CSV, filesystem y consumo del componente de mapa por plataforma. |
| 2 | `components/plate-location-map.ts` | Entrada TypeScript para el componente de mapa; validar el orden de resolución de Metro. |
| 2 | `components/plate-location-map.native.tsx` | Único import actual de `react-native-maps`; se usa en Android. |
| 2 | `components/plate-location-map.web.tsx` | Fallback Web que evita importar el módulo nativo. |
| 3 | `.npmrc` | Desactiva prompts de Corepack; revisar solo si el worker volviera a caer antes del bundle. |
| 3 | `.gitignore` | Confirma que `.expo/`, `node_modules/`, logs y carpetas nativas generadas no deben incluirse en el contexto de build. |

## 5. Estado de dependencias actual

```text
expo                         ~54.0.36
react                        19.1.0
react-native                 0.81.5
@react-navigation/native     ^7.1.8   (resuelto: 7.3.8)
@react-navigation/bottom-tabs ^7.4.0  (resuelto: 7.4.0)
react-native-maps            1.20.1
@react-native-ml-kit/text-recognition ^2.0.0
expo-camera                  ~17.0.10
expo-location                ~19.0.8
expo-document-picker         ~14.0.8
expo-file-system             ~19.0.23
react-native-reanimated      ~4.1.6
react-native-worklets        0.5.1
```

## 6. Hipótesis que deben comprobarse, sin asumirlas como causa

1. **Diferencia entre el proceso local `expo export` y el comando exacto del worker EAS.** Ejecutar la línea exacta del log remoto, no una aproximación. Si no se muestra, inspeccionar la fase antes de cambiar código.
2. **Transformación de Metro/Babel.** Deshabilitar temporalmente NativeWind o el plugin de Worklets en una rama de diagnóstico para comprobar si el fallo desaparece, no en la versión principal sin evidencia.
3. **Módulo OCR externo.** Aislar `@react-native-ml-kit/text-recognition` con un import condicional o una pantalla mínima para comprobar si el bundle remoto falla cuando ese módulo está presente.
4. **Resolución del mapa por plataforma.** Confirmar en el log de Metro del worker que Android resuelve `components/plate-location-map.native.tsx`, no la entrada `.ts` ni el fallback Web.
5. **Arquitectura nueva.** Comparar una build de diagnóstico con `newArchEnabled: false`; algunos módulos nativos pueden reaccionar de modo distinto bajo la nueva arquitectura. Solo cambiarlo tras obtener el stack trace remoto.

## 7. Instrucciones de triaje para el siguiente agente

1. Obtener en la interfaz de Manus el contenido completo de **Bundle JavaScript build phase** y conservar, como mínimo, el primer `Error`, su stack y 30 líneas anteriores/posteriores.
2. Identificar el comando exacto que ejecuta el worker. Reproducirlo con el lockfile congelado y `NODE_ENV=production`.
3. Si el stack apunta a un módulo nativo, reducir la app temporalmente al `app/_layout.tsx` y añadir los imports críticos uno a uno: Router → NativeWind/Worklets → OCR ML Kit → Camera/Location → Maps.
4. No modificar simultáneamente `metro.config.js`, `babel.config.js`, `app.config.ts` y dependencias; cada experimento debe aislar una sola variable.
5. Conservar `pnpm-lock.yaml` y `pnpm-workspace.yaml` en cada prueba para no reintroducir el fallo no interactivo de pnpm ya resuelto.

## 8. Limitación explícita

El proyecto tiene acceso a logs de **Preview local** (`.manus-logs/devserver.log`), pero no al log interno del worker `cfworkers-deploy-android-worker`. El texto visible en la captura es el único dato remoto disponible. El otro agente necesitará abrir el detalle de la fase desde la interfaz de compilación o recibir ese texto copiado por el usuario para llegar a una causa raíz demostrable.
