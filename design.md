# Diseño de Interfaz de Usuario - OCR Matrículas España

## Orientación y Uso

La aplicación está diseñada para ser utilizada en **orientación vertical (portrait)** y para **uso con una sola mano** en dispositivos móviles iOS y Android.

## Lista de Pantallas

### 1. Pantalla Principal (Home Screen)

*   **Contenido Principal y Funcionalidad:**
    *   **Visor de Cámara:** Ocupa la mayor parte de la pantalla, mostrando la vista previa de la cámara en tiempo real. Es el elemento central para la captura de matrículas.
    *   **Botón 'Escanear':** Un botón flotante, circular y centrado en la parte inferior del visor de la cámara. Al pulsarlo, se toma una foto y se inicia el proceso de OCR.
    *   **Área de Matrículas Detectadas:** Un panel semitransparente en la parte inferior de la pantalla, superpuesto al visor de la cámara. Muestra una lista desplazable de las matrículas detectadas y guardadas localmente, junto con la fecha y hora de detección.

*   **Flujos de Usuario Clave:**
    1.  **Inicio de la aplicación:** La aplicación solicita permisos de cámara. Si se conceden, se muestra el visor de la cámara. Si no, se muestra un mensaje de denegación.
    2.  **Escaneo de Matrícula:**
        *   El usuario apunta la cámara a una matrícula.
        *   Pulsa el botón 'Escanear'.
        *   La aplicación toma una foto.
        *   Se procesa la imagen con OCR local.
        *   Si se detecta una matrícula española válida, se muestra una alerta con la matrícula y se añade a la lista de matrículas detectadas.
        *   Si no se detecta una matrícula válida, se muestra una alerta informativa.
    3.  **Visualización de Matrículas:** El usuario puede desplazarse por la lista de matrículas detectadas en el panel inferior.

## Opciones de Color

Se utilizará una paleta de colores limpia y funcional, priorizando la legibilidad y la usabilidad.

*   **Fondo (Background):** Blanco puro para el modo claro, negro o gris oscuro para el modo oscuro. (Gestionado por `ScreenContainer` y `NativeWind`).
*   **Texto Principal (Foreground):** Negro para el modo claro, blanco para el modo oscuro.
*   **Botón 'Escanear':** Azul vibrante (`primary` en `theme.config.js`) para destacar la acción principal. Texto del botón en blanco.
*   **Panel de Matrículas:** Fondo semitransparente oscuro (`rgba(0,0,0,0.7)`) para asegurar la legibilidad del texto blanco sobre el visor de la cámara.
*   **Bordes/Separadores:** Gris claro.

## Consideraciones Adicionales

*   **Feedback Visual:** El botón 'Escanear' tendrá un feedback visual al ser pulsado (cambio de opacidad).
*   **Alertas:** Se utilizarán alertas nativas para informar al usuario sobre el éxito o fracaso del reconocimiento de matrículas.
