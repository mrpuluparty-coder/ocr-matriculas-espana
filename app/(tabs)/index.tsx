import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from "@/components/screen-container";
import { playSound } from '@/lib/utils/audio';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv'; // Cambiado a CSV para el nuevo formato

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

const ALERT_SOUND = require('@/assets/sounds/alert.mp3'); // Asume que tienes un sonido de alerta

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [frameColor, setFrameColor] = useState<'blue' | 'red'>('blue');
  const [importedPlates, setImportedPlates] = useState<string[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  // Load scanned plates and imported plates on mount
  useEffect(() => {
    loadScannedPlates();
    loadImportedPlates();
  }, []);

  // Location permissions and updates
  const requestLocationPermissionAndStartUpdates = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(status === 'granted');

    if (status === 'granted') {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.LocationAccuracy.Highest,
          timeInterval: 1000, // Update every 1 second
          distanceInterval: 1, // Update every 1 meter
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    } else {
      Alert.alert(
        'Permiso de ubicación denegado',
        'Necesitamos acceso a tu ubicación para registrar las matrículas con coordenadas.'
      );
    }
  }, []);

  // Manage location updates based on screen focus
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
        // Asumiendo que el archivo ahora es CSV y queremos mostrar solo la matrícula
        const lines = content.split('\n').filter(Boolean);
        const platesOnly = lines.slice(1).map(line => line.split(',')[0]); // Ignorar encabezado y tomar solo la matrícula
        setScannedPlates(platesOnly);
      }
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

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

  const savePlate = async (plate: string, isMatch: boolean) => {
    try {
      const platesFile = getPlatesFile();
      const now = new Date();
      const date = now.toLocaleDateString('es-ES'); // Formato DD/MM/YYYY
      const time = now.toLocaleTimeString('es-ES', { hour12: false }); // Formato HH:MM:SS
      const latLong = location ? `${location.coords.latitude},${location.coords.longitude}` : 'N/A,N/A';
      const place = isMatch ? 'DF' : 'AC'; // Ejemplo: 'DF' si coincide, 'AC' si no

      const entry = `${plate},${date},${time},${latLong},${place}\n`;

      let currentContent = '';
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        currentContent = await platesFile.text();
      } else {
        // Si el archivo no existe, añadir el encabezado CSV
        await platesFile.create();
        currentContent = 'MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n';
      }
      const newContent = currentContent + entry;
      await platesFile.write(newContent);
      loadScannedPlates(); // Recargar para actualizar UI
    } catch (error) {
      console.error('Error saving plate:', error);
      Alert.alert('Error', 'No se pudo guardar la matrícula.');
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
          console.log('OCR Result:', result.text);

          const cleanText = result.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
          const match = cleanText.match(plateRegex);

          if (match && match[0]) {
            const detectedPlate = match[0];
            const isMatch = importedPlates.includes(detectedPlate);

            if (isMatch) {
              setFrameColor('red');
              playSound(ALERT_SOUND);
              setTimeout(() => setFrameColor('blue'), 500); // Vuelve a azul después de 0.5s
              Alert.alert('¡Matrícula Encontrada!', `La matrícula ${detectedPlate} está en el registro.`);
            } else {
              Alert.alert('Matrícula detectada', detectedPlate);
            }
            savePlate(detectedPlate, isMatch);
          } else {
            Alert.alert('No se detectó matrícula', 'No se encontró una matrícula española válida.');
          }
        }
      } catch (error) {
        console.error('Error during scan:', error);
        Alert.alert('Error', 'Ocurrió un error al escanear la matrícula.');
      }
    } else if (!hasLocationPermission) {
      Alert.alert('Permiso de ubicación requerido', 'Por favor, concede permisos de ubicación para escanear matrículas.');
    } else {
      Alert.alert('Cámara no lista', 'La cámara no está lista o no tiene permisos.');
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

  return (
    <ScreenContainer className="flex-1 p-0">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        onCameraReady={() => setCameraReady(true)}
        facing="back"
      />
      {/* Marco de enfoque centrado */}
      <View style={[styles.focusFrame, { borderColor: frameColor }]} />

      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          disabled={!cameraReady || !hasLocationPermission}
        >
          <Text style={styles.scanButtonText}>Escanear</Text>
        </TouchableOpacity>

        <View style={styles.platesContainer}>
          <Text style={styles.platesTitle}>Matrículas Detectadas:</Text>
          <ScrollView style={styles.platesScrollView}>
            {scannedPlates.length > 0 ? (
              scannedPlates.map((plate, index) => (
                <Text key={index} style={styles.plateText}>
                  {plate}
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
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
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
    maxHeight: 100, // Ajustado para mostrar aproximadamente 4 líneas de texto
    borderRadius: 10,
    padding: 10,
  },
  platesTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  platesScrollView: {
    flexGrow: 0,
  },
  plateText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 2,
  },
  focusFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 250,
    height: 100,
    marginTop: -50, // Centrar verticalmente
    marginLeft: -125, // Centrar horizontalmente
    borderWidth: 3,
    borderRadius: 5,
    zIndex: 1, // Asegurarse de que esté por encima de la cámara
  },
});
