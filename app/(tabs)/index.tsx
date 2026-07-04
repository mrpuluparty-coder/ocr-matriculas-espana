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
import { ZoomSlider } from "@/components/zoom-slider";
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

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<ScannedPlateItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [frameColor, setFrameColor] = useState<'blue' | 'red'>('blue');
  const [importedPlates, setImportedPlates] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [zoom, setZoom] = useState(0.33); // Inicia en modo 2x nativo de forma exacta
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
        setImportedPlates(JSON.parse(storedPlates));
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
      const place = isMatch ? 'DF' : 'AC';

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
        });

        if (photo.uri) {
          const result = await TextRecognition.recognize(photo.uri);
          const cleanText = result.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
          const match = cleanText.match(plateRegex);

          if (match && match[0]) {
            const detectedPlate = match[0];
            const isMatch = importedPlates.includes(detectedPlate);

            if (isMatch) {
              setFrameColor('red');
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              showToast(`¡${detectedPlate} en registro!`, 'warning');
              setTimeout(() => setFrameColor('blue'), 500);
            } else {
              showToast(`${detectedPlate} detectada`, 'success');
            }
            savePlate(detectedPlate, isMatch);
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

  return (
    <ScreenContainer className="flex-1 p-0">
      {/* 1. Cámara como componente autocierre puro para solventar el parpadeo negro */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        zoom={zoom}
        enableTorch={isTorchOn}
        onCameraReady={() => setCameraReady(true)}
        facing="back"
      />

      {/* 2. Overlays y Marcos hermanos absolutos */}
      <View style={[styles.focusFrame, { borderColor: frameColor === 'blue' ? '#007AFF' : '#FF3B30' }]} />

      {toast && (
        <View style={[styles.toast, { backgroundColor: getToastBackgroundColor(toast.type) }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* 3. Slider absoluto lateral derecho (Alineado con base de Escanear, libre de solapamientos) */}
      <View style={styles.sliderAbsoluteContainer}>
        <ZoomSlider zoom={zoom} setZoom={setZoom} />
      </View>

      {/* 4. Capa contenedora inferior de interfaz */}
      <View style={styles.overlay}>
        
        {/* Botón de la Linterna: Centrado horizontalmente en eje X sobre el botón de escanear */}
        <TouchableOpacity 
          onPress={() => setIsTorchOn(!isTorchOn)}
          style={[styles.torchButtonCentered, { backgroundColor: isTorchOn ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 0, 0, 0.6)' }]}
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

        <View style={styles.platesContainer}>
          <View style={styles.platesHeader}>
            <Text style={styles.platesTitle}>Matrículas Detectadas:</Text>
            {scannedPlates.length > 0 && (
              <TouchableOpacity onPress={() => setScannedPlates([])}>
                <Text style={styles.clearButtonText}>×</Text>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  torchButtonCentered: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  sliderAbsoluteContainer: {
    position: 'absolute',
    right: 15,
    bottom: 165,
    width: 60,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scanButton: {
    backgroundColor: 'blue',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
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
  clearButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    padding: 4,
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
