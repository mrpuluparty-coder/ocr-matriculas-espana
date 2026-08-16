import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ScreenContainer } from '@/components/screen-container';

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

type ImportedPlateStore = Record<string, { fecha?: string; hora?: string }>;

const ZOOM_PRESETS = [0.0, 0.2, 0.33, 0.66];
const ZOOM_LABELS = ['1x', '1.5x', '2x', '4x'];

function parseImportedPlateStore(rawValue: string | null): ImportedPlateStore {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.reduce<ImportedPlateStore>((store, plate) => {
        if (typeof plate === 'string' && plate.trim()) {
          store[plate.trim().toUpperCase()] = {};
        }
        return store;
      }, {});
    }

    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).reduce<ImportedPlateStore>((store, plate) => {
        const value = parsed[plate] ?? {};
        store[plate.toUpperCase()] = {
          fecha: typeof value.fecha === 'string' ? value.fecha : '',
          hora: typeof value.hora === 'string' ? value.hora : '',
        };
        return store;
      }, {});
    }
  } catch (error) {
    console.error('Error parsing imported plates:', error);
  }

  return {};
}

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<ScannedPlateItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [frameColor, setFrameColor] = useState<'blue' | 'red'>('blue');
  const [importedPlates, setImportedPlates] = useState<ImportedPlateStore>({});
  const [notificationRules, setNotificationRules] = useState<Record<string, NotificationRule>>({});
  const [globalNotificationsActive, setGlobalNotificationsActive] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomIndexRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const persistZoomIndex = async (index: number) => {
    try {
      await AsyncStorage.setItem(ZOOM_STORAGE_KEY, index.toString());
    } catch (error) {
      console.error('Error saving zoom preset:', error);
    }
  };

  const restoreSavedZoom = async (restartCamera = false) => {
    try {
      const savedZoom = await AsyncStorage.getItem(ZOOM_STORAGE_KEY);
      const parsed = savedZoom === null ? zoomIndexRef.current : Number.parseInt(savedZoom, 10);
      const restoredIndex = !Number.isNaN(parsed) && parsed >= 0 && parsed < ZOOM_PRESETS.length
        ? parsed
        : 0;

      zoomIndexRef.current = restoredIndex;
      setZoomIndex(restoredIndex);

      if (restartCamera) {
        setCameraReady(false);
        setCameraSessionKey((current) => current + 1);
      }
    } catch (error) {
      console.error('Error loading saved zoom:', error);
    }
  };

  useEffect(() => {
    void (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    void restoreSavedZoom();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const isReturningToActive = nextAppState === 'active' && appState.current !== 'active';

      if (wasActive && /inactive|background/.test(nextAppState)) {
        void persistZoomIndex(zoomIndexRef.current);
      }

      if (isReturningToActive) {
        void restoreSavedZoom(true);
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    zoomIndexRef.current = zoomIndex;
  }, [zoomIndex]);

  useFocusEffect(
    useCallback(() => {
      void loadNotificationSettings();
      void loadImportedPlates();
      void loadScannedPlates();
    }, []),
  );

  const loadNotificationSettings = async () => {
    try {
      const storedRules = await AsyncStorage.getItem(NOTIFICATION_RULES_STORAGE_KEY);
      if (storedRules) setNotificationRules(JSON.parse(storedRules));

      const storedGlobal = await AsyncStorage.getItem(GLOBAL_NOTIFICATIONS_KEY);
      if (storedGlobal !== null) setGlobalNotificationsActive(JSON.parse(storedGlobal));
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const loadImportedPlates = async () => {
    const importedStore = parseImportedPlateStore(await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY));
    setImportedPlates(importedStore);
  };

  const loadScannedPlates = async () => {
    try {
      const platesFile = getPlatesFile();
      const fileInfo = await platesFile.info();
      if (!fileInfo.exists) {
        setScannedPlates([]);
        return;
      }

      const importedStore = parseImportedPlateStore(await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY));
      const content = await platesFile.text();
      const platesData = content
        .split('\n')
        .filter(Boolean)
        .slice(1)
        .map((line) => line.split(',')[0]?.trim().toUpperCase())
        .filter((plate): plate is string => Boolean(plate))
        .map((plate) => ({ plate, isInRegistry: plate in importedStore }));

      setScannedPlates(platesData.reverse());
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  const showToast = (message: string, type: Toast['type']) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    const toastId = Date.now().toString();
    setToast({ id: toastId, message, type });
    const duration = type === 'custom_notification' ? 3000 : 1000;
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  };

  const savePlate = async (plate: string, isInRegistry: boolean) => {
    try {
      const platesFile = getPlatesFile();
      const now = new Date();
      const date = now.toLocaleDateString('es-ES');
      const time = now.toLocaleTimeString('es-ES', { hour12: false });
      const entry = `${plate},${date},${time},${isInRegistry ? 'EN_REGISTRO' : 'FUERA_REGISTRO'}\n`;

      let currentContent = '';
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        currentContent = await platesFile.text();
      } else {
        await platesFile.create();
        currentContent = 'MATRÍCULA,FECHA,HORA,ESTADO\n';
      }

      await platesFile.write(currentContent + entry);
      await loadScannedPlates();
    } catch (error) {
      console.error('Error saving plate:', error);
      showToast('Error al guardar matrícula', 'error');
    }
  };

  const handleScan = async () => {
    if (!cameraRef.current || !cameraReady) {
      showToast('Cámara no lista', 'error');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        exif: false,
        skipProcessing: true,
      });

      if (!photo.uri) {
        showToast('Error al capturar la imagen', 'error');
        return;
      }

      const result = await TextRecognition.recognize(photo.uri);
      const cleanText = result.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
      const match = cleanText.match(plateRegex);

      if (!match?.[0]) {
        showToast('No se detectó matrícula válida', 'error');
        return;
      }

      const detectedPlate = match[0];
      const isMatch = detectedPlate in importedPlates;

      if (!isMatch) {
        showToast(`${detectedPlate} no en registro`, 'success');
        await savePlate(detectedPlate, false);
        return;
      }

      setFrameColor('red');
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const rule = notificationRules[detectedPlate];
      if (globalNotificationsActive && rule?.active && rule.message) {
        showToast(`🔔 ${rule.message}`, 'custom_notification');
      } else {
        showToast(`¡${detectedPlate} en registro!`, 'warning');
      }

      setTimeout(() => setFrameColor('blue'), 500);
      await savePlate(detectedPlate, true);
    } catch (error) {
      console.error('Error during scan:', error);
      showToast('Error al escanear', 'error');
    }
  };

  const handleZoomPreset = () => {
    const nextIndex = (zoomIndexRef.current + 1) % ZOOM_PRESETS.length;
    zoomIndexRef.current = nextIndex;
    setZoomIndex(nextIndex);
    void persistZoomIndex(nextIndex);
  };

  if (hasCameraPermission === null) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Solicitando permiso de cámara...</Text></ScreenContainer>;
  }

  if (hasCameraPermission === false) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Acceso a la cámara denegado.</Text></ScreenContainer>;
  }

  const getToastBackgroundColor = (type: Toast['type']) => {
    switch (type) {
      case 'warning': return '#FF9500';
      case 'error': return '#FF3B30';
      case 'custom_notification': return '#5856D6';
      default: return '#808080';
    }
  };

  return (
    <ScreenContainer className="flex-1 p-0">
      <CameraView
        key={cameraSessionKey}
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        zoom={ZOOM_PRESETS[zoomIndex]}
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
              onPress={() => setIsTorchOn((current) => !current)}
              style={[styles.torchButtonLeft, { backgroundColor: isTorchOn ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 0, 0, 0.6)' }]}
            >
              <MaterialIcons name={isTorchOn ? 'flash-on' : 'flash-off'} size={24} color={isTorchOn ? '#FFD700' : '#FFFFFF'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanButton} onPress={handleScan} disabled={!cameraReady}>
              <Text style={styles.scanButtonText}>Escanear</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleZoomPreset} style={styles.zoomButtonRight}>
              <Text style={styles.zoomButtonText}>{ZOOM_LABELS[zoomIndex]}</Text>
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
              {scannedPlates.length > 0 ? scannedPlates.map((item, index) => (
                <Text key={`${item.plate}-${index}`} style={[styles.plateText, item.isInRegistry && styles.plateTextInRegistry]}>
                  {item.plate}
                </Text>
              )) : <Text style={styles.plateText}>Ninguna matrícula detectada aún.</Text>}
            </ScrollView>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  overlayContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  focusFrame: { position: 'absolute', top: '25%', left: '10%', right: '10%', height: 120, borderWidth: 3, borderRadius: 12, backgroundColor: 'transparent' },
  toast: { position: 'absolute', top: 60, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, zIndex: 100 },
  toastText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  scanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', marginBottom: 20, height: 60 },
  torchButtonLeft: { position: 'absolute', left: 25, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  zoomButtonRight: { position: 'absolute', right: 25, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  zoomButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  scanButton: { backgroundColor: '#007AFF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  scanButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  platesContainer: { backgroundColor: 'rgba(0,0,0,0.7)', width: '90%', maxHeight: 120, borderRadius: 10, padding: 10 },
  platesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  platesTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  clearCircleButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  platesScrollView: { maxHeight: 80 },
  plateText: { color: 'white', fontSize: 16, marginVertical: 2 },
  plateTextInRegistry: { color: '#FF3B30', fontWeight: 'bold' },
});
