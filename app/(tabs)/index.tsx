import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv';

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error';
}

interface ScannedPlateItem {
  plate: string;
  isInRegistry: boolean;
}

// Zoom presets: 1.5x, 2x, 4x
const ZOOM_PRESETS = [0.2, 0.33, 0.66];
const ZOOM_LABELS = ['1.5x', '2x', '4x'];

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<ScannedPlateItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [frameColor, setFrameColor] = useState<'blue' | 'red'>('blue');
  const [importedPlates, setImportedPlates] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    loadScannedPlates();
    loadImportedPlates();
  }, []);

  const requestLocationPermissionAndStartUpdates = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(status === 'granted');

    if (status === 'granted') {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.LocationAccuracy.Highest,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      requestLocationPermissionAndStartUpdates();

      return () => {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
      };
    }, [requestLocationPermissionAndStartUpdates])
  );

  const loadScannedPlates = async () => {
    try {
      const platesFile = getPlatesFile();
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        const content = await platesFile.text();
        const lines = content.split('\n').filter(Boolean);
        const platesData = lines.slice(1).map(line => {
          const plate = line.split(',')[0];
          return { plate, isInRegistry: importedPlates.includes(plate) };
        });
        setScannedPlates(platesData.reverse());
      }
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  useEffect(() => {
    if (scannedPlates.length > 0) {
      const updatedPlates = scannedPlates.map(item => ({
        ...item,
        isInRegistry: importedPlates.includes(item.plate)
      }));
      setScannedPlates(updatedPlates);
    }
  }, [importedPlates]);

  const loadImportedPlates = async () => {
    try {
      const storedPlates = await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY);
      if (storedPlates) {
        const parsed = JSON.parse(storedPlates);
        // Si es un diccionario (objeto), usarlo directamente; si es array, convertir a diccionario
        if (Array.isArray(parsed)) {
          // Compatibilidad: convertir array antiguo a diccionario
          const dict: Record<string, any> = {};
          parsed.forEach(plate => {
            dict[plate] = { fecha: '', hora: '', latitud: 0, longitud: 0, lugar: '' };
          });
          setImportedPlates(dict);
        } else {
          setImportedPlates(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading imported plates:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'warning' | 'error') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    const toastId = Date.now().toString();
    setToast({ id: toastId, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 1000);
  };

  const savePlate = async (plate: string, isMatch: boolean) => {
    try {
      const platesFile = getPlatesFile();
      const now = new Date();
      const date = now.toLocaleDateString('es-ES');
      const time = now.toLocaleTimeString('es-ES', { hour12: false });
      const latLong = location ? `${location.coords.latitude},${location.coords.longitude}` : 'N/A,N/A';
      const place = 'REGISTRO_MATCH'; // Siempre guardar como REGISTRO_MATCH

      const entry = `${plate},${date},${time},${latLong},${place}\n`;

      let currentContent = '';
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        currentContent = await platesFile.text();
      } else {
        await platesFile.create();
        currentContent = 'MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n';
      }
      const newContent = currentContent + entry;
      await platesFile.write(newContent);
      loadScannedPlates();
    } catch (error) {
      console.error('Error saving plate:', error);
      showToast('Error al guardar matrícula', 'error');
    }
  };

  const handleScan = async () => {
    if (cameraRef.current && cameraReady && hasLocationPermission) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          base64: false,
          exif: false,
          skipProcessing: true,
        });

        if (photo.uri) {
          const result = await TextRecognition.recognize(photo.uri);
          const cleanText = result.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
          const match = cleanText.match(plateRegex);

          if (match && match[0]) {
            const detectedPlate = match[0];
            // Verificar si la matrícula existe en el registro importado (diccionario)
            const isMatch = typeof importedPlates === 'object' && !Array.isArray(importedPlates) && detectedPlate in importedPlates;

            if (isMatch) {
              setFrameColor('red');
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              showToast(`¡${detectedPlate} en registro!`, 'warning');
              setTimeout(() => setFrameColor('blue'), 500);
              // SOLO guardar si está en registro
              savePlate(detectedPlate, true);
            } else {
              // No está en registro - mostrar toast pero NO guardar
              showToast(`${detectedPlate} no en registro`, 'success');
            }
          } else {
            showToast('No se detectó matrícula válida', 'error');
          }
        }
      } catch (error) {
        console.error('Error during scan:', error);
        showToast('Error al escanear', 'error');
      }
    } else if (!hasLocationPermission) {
      showToast('Permiso de ubicación requerido', 'error');
    } else {
      showToast('Cámara no lista', 'error');
    }
  };

  const handleZoomPreset = () => {
    const nextIndex = (zoomIndex + 1) % ZOOM_PRESETS.length;
    setZoomIndex(nextIndex);
  };

  if (hasCameraPermission === null || hasLocationPermission === null) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Solicitando permisos...</Text></ScreenContainer>;
  }
  if (hasCameraPermission === false) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Acceso a la cámara denegado.</Text></ScreenContainer>;
  }
  if (hasLocationPermission === false) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Acceso a la ubicación denegado.</Text></ScreenContainer>;
  }

  const getToastBackgroundColor = (type: string) => {
    switch (type) {
      case 'success': return '#808080';
      case 'warning': return '#FF9500';
      case 'error': return '#FF3B30';
      default: return '#808080';
    }
  };

  const currentZoom = ZOOM_PRESETS[zoomIndex];
  const currentZoomLabel = ZOOM_LABELS[zoomIndex];

  return (
    <ScreenContainer className="flex-1 p-0">
      {/* CameraView autocerrada sin hijos - ciclo nativo puro */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        zoom={currentZoom}
        enableTorch={isTorchOn}
        onCameraReady={() => setCameraReady(true)}
        facing="back"
      />

      {/* Contenedor de overlays como hermano absoluto - pointerEvents="box-none" para no interferir */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* Marco de enfoque centrado */}
        <View style={[styles.focusFrame, { borderColor: frameColor === 'blue' ? '#007AFF' : '#FF3B30' }]} pointerEvents="none" />

        {/* Toast flotante */}
        {toast && (
          <View style={[styles.toast, { backgroundColor: getToastBackgroundColor(toast.type) }]} pointerEvents="none">
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}

        {/* Capa contenedora principal de controles inferiores */}
        <View style={styles.overlay} pointerEvents="box-none">
          
          {/* Fila de control flotante ultra-alineada */}
          <View style={styles.scanRow} pointerEvents="box-none">
            
            {/* Linterna: Posicionada absoluta a la izquierda, centrada en altura por alignItems del padre */}
            <TouchableOpacity 
              onPress={() => setIsTorchOn(!isTorchOn)}
              style={[styles.torchButtonLeft, { backgroundColor: isTorchOn ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 0, 0, 0.6)' }]}
            >
              <MaterialIcons 
                name={isTorchOn ? "flash-on" : "flash-off"} 
                size={24} 
                color={isTorchOn ? "#FFD700" : "#FFFFFF"} 
              />
            </TouchableOpacity>

            {/* Botón Central de Escaneo - flujo orgánico en el centro */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScan}
              disabled={!cameraReady || !hasLocationPermission}
            >
              <Text style={styles.scanButtonText}>Escanear</Text>
            </TouchableOpacity>

            {/* Botón de Presets de Zoom a la derecha - absoluto simétrico */}
            <TouchableOpacity 
              onPress={handleZoomPreset}
              style={[styles.zoomButtonRight, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
            >
              <Text style={styles.zoomButtonText}>{currentZoomLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* Contenedor de registros */}
          <View style={styles.platesContainer} pointerEvents="box-none">
            <View style={styles.platesHeader}>
              <Text style={styles.platesTitle}>Matrículas Detectadas:</Text>
              {scannedPlates.length > 0 && (
                <TouchableOpacity onPress={() => setScannedPlates([])} style={styles.clearCircleButton}>
                  <MaterialIcons name="close" size={16} color="white" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.platesScrollView}>
              {scannedPlates.length > 0 ? (
                scannedPlates.map((item, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.plateText,
                      item.isInRegistry && styles.plateTextInRegistry
                    ]}
                  >
                    {item.plate}
                  </Text>
                ))
              ) : (
                <Text style={styles.plateText}>Ninguna matrícula detectada aún.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    marginBottom: 20,
    height: 60,
  },
  torchButtonLeft: {
    position: 'absolute',
    left: 25,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomButtonRight: {
    position: 'absolute',
    right: 25,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanButton: {
    backgroundColor: 'blue',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  platesContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '90%',
    maxHeight: 100,
    borderRadius: 10,
    padding: 10,
  },
  platesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  platesTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearCircleButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platesScrollView: {
    flexGrow: 0,
  },
  plateText: {
    color: 'white',
    fontSize: 14,
  },
  plateTextInRegistry: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  focusFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 250,
    height: 100,
    marginTop: -50,
    marginLeft: -125,
    borderWidth: 3,
    borderRadius: 5,
    zIndex: 1,
  },
  toast: {
    position: 'absolute',
    top: 50,
    left: '10%',
    right: '10%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 100,
    alignItems: 'center',
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
