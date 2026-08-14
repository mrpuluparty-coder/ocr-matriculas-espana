import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, AppState, AppStateStatus } from 'react-native';
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
const NOTIFICATION_RULES_STORAGE_KEY = 'notification_rules';
const GLOBAL_NOTIFICATIONS_KEY = 'global_notifications_active';
const ZOOM_STORAGE_KEY = 'camera_zoom_index';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv';

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'custom_notification';
}

interface ScannedPlateItem {
  plate: string;
  isInRegistry: boolean;
}

interface NotificationRule {
  plate: string;
  message: string;
  active: boolean;
}

// Zoom presets: 1x (angular), 1.5x, 2x, 4x
const ZOOM_PRESETS = [0.0, 0.2, 0.33, 0.66];
const ZOOM_LABELS = ['1x', '1.5x', '2x', '4x'];

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<ScannedPlateItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [frameColor, setFrameColor] = useState<'blue' | 'red'>('blue');
  const [importedPlates, setImportedPlates] = useState<Record<string, any>>({});
  const [notificationRules, setNotificationRules] = useState<Record<string, NotificationRule>>({});
  const [globalNotificationsActive, setGlobalNotificationsActive] = useState<boolean>(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    loadScannedPlates();
    loadImportedPlates();
    loadNotificationSettings();
    loadSavedZoom();

    // Listener para guardar el estado del zoom al minimizar / background
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        try {
          await AsyncStorage.setItem(ZOOM_STORAGE_KEY, zoomIndex.toString());
        } catch (e) {
          console.error('Error saving zoom state on background:', e);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [zoomIndex]);

  const loadSavedZoom = async () => {
    try {
      const savedZoom = await AsyncStorage.getItem(ZOOM_STORAGE_KEY);
      if (savedZoom !== null) {
        const parsed = parseInt(savedZoom, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < ZOOM_PRESETS.length) {
          setZoomIndex(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading saved zoom:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const storedRules = await AsyncStorage.getItem(NOTIFICATION_RULES_STORAGE_KEY);
      if (storedRules) {
        setNotificationRules(JSON.parse(storedRules));
      }
      const storedGlobal = await AsyncStorage.getItem(GLOBAL_NOTIFICATIONS_KEY);
      if (storedGlobal !== null) {
        setGlobalNotificationsActive(JSON.parse(storedGlobal));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

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
      loadNotificationSettings();
      loadImportedPlates();
      loadScannedPlates();

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
          return { plate, isInRegistry: plate in importedPlates };
        });
        setScannedPlates(platesData.reverse());
      }
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  const loadImportedPlates = async () => {
    try {
      const storedPlates = await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY);
      if (storedPlates) {
        const parsed = JSON.parse(storedPlates);
        if (Array.isArray(parsed)) {
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

  const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'custom_notification') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    const toastId = Date.now().toString();
    setToast({ id: toastId, message, type });
    const duration = type === 'custom_notification' ? 3000 : 1000;
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const savePlate = async (plate: string) => {
    try {
      const platesFile = getPlatesFile();
      const now = new Date();
      const date = now.toLocaleDateString('es-ES');
      const time = now.toLocaleTimeString('es-ES', { hour12: false });
      const latLong = location ? `${location.coords.latitude},${location.coords.longitude}` : 'N/A,N/A';
      const place = 'REGISTRO_MATCH';

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
            const isMatch = typeof importedPlates === 'object' && !Array.isArray(importedPlates) && detectedPlate in importedPlates;

            if (isMatch) {
              setFrameColor('red');
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }

              // Comprobar si hay regla de notificación personalizada para esta matrícula
              const rule = notificationRules[detectedPlate];
              if (globalNotificationsActive && rule && rule.active && rule.message) {
                showToast(`🔔 ${rule.message}`, 'custom_notification');
              } else {
                showToast(`¡${detectedPlate} en registro!`, 'warning');
              }

              setTimeout(() => setFrameColor('blue'), 500);
              savePlate(detectedPlate);
            } else {
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
      case 'custom_notification': return '#5856D6'; // Morado especial para notificación personalizada
      default: return '#808080';
    }
  };

  const currentZoom = ZOOM_PRESETS[zoomIndex];
  const currentZoomLabel = ZOOM_LABELS[zoomIndex];

  return (
    <ScreenContainer className="flex-1 p-0">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        zoom={currentZoom}
        enableTorch={isTorchOn}
        onCameraReady={() => setCameraReady(true)}
        facing="back"
      />

      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={[styles.focusFrame, { borderColor: frameColor === 'blue' ? '#007AFF' : '#FF3B30' }]} pointerEvents="none" />

        {toast && (
          <View style={[styles.toast, { backgroundColor: getToastBackgroundColor(toast.type) }]} pointerEvents="none">
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.scanRow} pointerEvents="box-none">
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

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScan}
              disabled={!cameraReady || !hasLocationPermission}
            >
              <Text style={styles.scanButtonText}>Escanear</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleZoomPreset}
              style={[styles.zoomButtonRight, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
            >
              <Text style={styles.zoomButtonText}>{currentZoomLabel}</Text>
            </TouchableOpacity>
          </View>

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
  focusFrame: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 120,
    borderWidth: 3,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 100,
  },
  toastText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    backgroundColor: '#007AFF',
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
    maxHeight: 120,
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
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platesScrollView: {
    maxHeight: 80,
  },
  plateText: {
    color: 'white',
    fontSize: 16,
    marginVertical: 2,
  },
  plateTextInRegistry: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
});
