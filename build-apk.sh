#!/bin/bash

# Script de compilación para OCR Matrículas España
# Este script genera la APK de pruebas para Android

set -e

echo "================================"
echo "OCR Matrículas España - Build APK"
echo "================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json no encontrado. Asegúrate de ejecutar este script desde la raíz del proyecto."
    exit 1
fi

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado. Por favor, instálalo primero."
    exit 1
fi

# Verificar que npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no está instalado. Por favor, instálalo primero."
    exit 1
fi

# Verificar que Android SDK está configurado
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Android/sdk"
        echo "✓ ANDROID_HOME configurado automáticamente: $ANDROID_HOME"
    else
        echo "❌ Error: ANDROID_HOME no está configurado."
        echo "   Por favor, establece la variable de entorno ANDROID_HOME apuntando a tu Android SDK."
        echo "   Ejemplo: export ANDROID_HOME=/path/to/android/sdk"
        exit 1
    fi
fi

echo "✓ Entorno verificado"
echo ""

# Paso 1: Instalar dependencias
echo "📦 Instalando dependencias..."
npm install
echo "✓ Dependencias instaladas"
echo ""

# Paso 2: Limpiar compilaciones anteriores
echo "🧹 Limpiando compilaciones anteriores..."
rm -rf android
echo "✓ Limpieza completada"
echo ""

# Paso 3: Generar el proyecto nativo
echo "🔨 Generando proyecto nativo de Android..."
npx expo prebuild --clean
echo "✓ Proyecto nativo generado"
echo ""

# Paso 4: Compilar la APK de debug
echo "🚀 Compilando APK de debug..."
cd android
./gradlew assembleDebug
cd ..
echo "✓ APK compilada"
echo ""

# Paso 5: Mostrar ubicación de la APK
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo "✅ ¡Compilación completada exitosamente!"
    echo ""
    echo "📱 APK de pruebas generada:"
    echo "   Ubicación: $APK_PATH"
    echo "   Tamaño: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "📥 Para instalar en tu dispositivo:"
    echo "   adb install -r $APK_PATH"
    echo ""
    echo "   O arrastra y suelta el archivo en Android Studio para instalar."
else
    echo "❌ Error: La APK no se generó correctamente."
    exit 1
fi
