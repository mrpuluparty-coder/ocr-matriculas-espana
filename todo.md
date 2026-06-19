# Project TODO

- [x] Inicializar proyecto Expo con TypeScript.
- [x] Instalar `expo-camera`, `expo-file-system` y `@react-native-ml-kit/text-recognition`.
- [x] Configurar `app.json` con permisos de cámara para iOS y Android.
- [x] Implementar `CameraView` a pantalla completa en `App.tsx` (o `index.tsx`).
- [x] Añadir botón flotante para 'Escanear'.
- [x] Implementar lógica para `takePictureAsync` al pulsar 'Escanear'.
- [x] Integrar `TextRecognition.recognize` con la URI de la foto.
- [x] Procesar el texto con expresión regular para matrículas españolas (`/\d{4}[B-DF-HJ-NP-TV-Z]{3}/`).
- [x] Implementar persistencia en `matriculas_detectadas.txt` usando `expo-file-system`.
- [x] Mostrar las matrículas detectadas en un área de texto en la parte inferior de la pantalla.
- [ ] Asegurar que la recarga del estado de la pantalla muestre las nuevas matrículas.
- [x] Generar instrucciones para compilar la APK de pruebas (`npx expo run:android`).
- [x] Generar un logo único para la aplicación y actualizar `app.config.ts`.
