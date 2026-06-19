# Instrucciones de Compilación y Ejecución - OCR Matrículas España

## Descripción General

Esta aplicación Expo utiliza **ML Kit nativo** para el reconocimiento de texto (OCR) offline de matrículas españolas. Debido a que ML Kit requiere módulos nativos compilados, **no es posible usar Expo Go** (que solo soporta código JavaScript). En su lugar, debes compilar la aplicación en un entorno de desarrollo nativo.

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalados:

- **Node.js** (versión 16 o superior)
- **npm** o **pnpm** (gestor de paquetes)
- **Android Studio** (para compilar APK de Android)
- **Java Development Kit (JDK)** (versión 11 o superior)
- **Expo CLI** (instalado globalmente: `npm install -g expo-cli`)

### Para iOS (macOS únicamente):

- **Xcode** (versión 14 o superior)
- **CocoaPods** (gestor de dependencias de iOS)

## Pasos de Compilación

### 1. Instalar Dependencias del Proyecto

```bash
cd /home/ubuntu/ocr-matriculas-espana
npm install
# o si usas pnpm:
pnpm install
```

### 2. Compilar para Android (APK)

Para generar la APK de pruebas, ejecuta el siguiente comando:

```bash
npx expo run:android
```

Este comando:
- Compila el código nativo de ML Kit para Android.
- Genera un entorno de desarrollo nativo.
- Instala la aplicación en un dispositivo Android conectado o en un emulador.
- Abre la aplicación automáticamente.

**Nota:** La primera compilación puede tardar 5-10 minutos, ya que descarga e instala todas las dependencias nativas.

### 3. Compilar para iOS (macOS únicamente)

Para generar la aplicación iOS, ejecuta:

```bash
npx expo run:ios
```

Este comando realiza el mismo proceso que Android, pero para iOS.

## Uso de la Aplicación

Una vez que la aplicación esté compilada y ejecutándose en tu dispositivo:

1. **Solicitud de Permisos:** La aplicación solicitará permiso para acceder a la cámara. Debes conceder este permiso para que funcione.

2. **Escaneo de Matrículas:**
   - Apunta la cámara a una matrícula española.
   - Pulsa el botón azul "Escanear" en la parte inferior de la pantalla.
   - La aplicación capturará una foto y procesará el texto con OCR.

3. **Resultados:**
   - Si se detecta una matrícula válida (4 números + 3 consonantes), se mostrará una alerta con la matrícula detectada.
   - La matrícula se guardará en un archivo de texto local (`matriculas_detectadas.txt`) en el directorio de documentos de la aplicación.
   - Las matrículas detectadas aparecerán en el panel inferior de la pantalla.

## Generación de APK para Distribución

Si deseas generar una APK para distribuir o instalar en múltiples dispositivos, puedes usar:

```bash
eas build --platform android --local
```

**Nota:** Esto requiere que tengas una cuenta de Expo y que hayas configurado EAS (Expo Application Services).

Alternativamente, puedes usar el comando estándar de Gradle:

```bash
cd android
./gradlew assembleRelease
```

La APK generada estará en `android/app/build/outputs/apk/release/`.

## Solución de Problemas

### Error: "ML Kit no se encuentra"

Si recibes un error indicando que ML Kit no está disponible, asegúrate de que:
- Has ejecutado `npx expo run:android` (no `expo start`).
- Las dependencias nativas se han compilado correctamente.
- Tu dispositivo Android tiene API 24 o superior.

### Error: "Permisos de cámara denegados"

Si la aplicación no puede acceder a la cámara:
- Verifica que has concedido permisos de cámara a la aplicación en la configuración del dispositivo.
- En Android, ve a Configuración > Aplicaciones > OCR Matrículas España > Permisos > Cámara.

### La aplicación se congela o crashea

Si la aplicación se congela después de pulsar "Escanear":
- Asegúrate de que la imagen capturada es clara y contiene una matrícula visible.
- Verifica que el dispositivo tiene suficiente memoria disponible.
- Intenta reiniciar la aplicación.

## Estructura del Proyecto

```
ocr-matriculas-espana/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Pantalla principal con cámara y OCR
│   │   └── _layout.tsx        # Configuración de pestañas
│   ├── _layout.tsx            # Layout raíz
│   └── oauth/
├── assets/
│   └── images/                # Iconos y splash screen
├── components/
│   ├── screen-container.tsx   # Contenedor de pantalla
│   └── ui/
├── app.config.ts              # Configuración de Expo
├── package.json               # Dependencias del proyecto
├── tsconfig.json              # Configuración de TypeScript
└── design.md                  # Documentación de diseño
```

## Dependencias Clave

- **expo-camera**: Acceso a la cámara del dispositivo.
- **expo-file-system**: Lectura y escritura de archivos locales.
- **@react-native-ml-kit/text-recognition**: Reconocimiento de texto nativo con ML Kit.
- **expo-router**: Enrutamiento y navegación.
- **nativewind**: Tailwind CSS para React Native.

## Notas Importantes

1. **OCR Offline:** El reconocimiento de texto se realiza completamente en el dispositivo. No se envía ningún dato a servidores externos.

2. **Persistencia Local:** Las matrículas detectadas se guardan en un archivo de texto local. Este archivo no se sincroniza con la nube a menos que lo hagas manualmente.

3. **Compatibilidad:** La aplicación es compatible con Android API 24+ e iOS 13+.

4. **Rendimiento:** La primera compilación puede tardar varios minutos. Las compilaciones posteriores serán más rápidas.

## Contacto y Soporte

Si encuentras problemas durante la compilación o ejecución, verifica:
- Que todas las dependencias están instaladas correctamente.
- Que tu dispositivo o emulador está conectado y disponible.
- Que tienes los permisos necesarios en tu dispositivo.
