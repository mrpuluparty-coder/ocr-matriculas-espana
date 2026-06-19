
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ScreenContainer } from "@/components/screen-container";



export default function HomeScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedPlates, setScannedPlates] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      loadScannedPlates();
    })();
  }, []);

const PLATES_FILE_NAME = 'matriculas_detectadas.txt';
const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

  const loadScannedPlates = async () => {
    try {
      const platesFile = getPlatesFile();
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        const content = await platesFile.text();
        setScannedPlates(content.split('\n').filter(Boolean));
      }
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  const savePlate = async (plate: string) => {
    try {
      const platesFile = getPlatesFile();
      const timestamp = new Date().toLocaleString();
      const entry = `${plate} - ${timestamp}\n`;

      let currentContent = "";
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        currentContent = await platesFile.text();
      } else {
        await platesFile.create();
      }
      const newContent = currentContent + entry;
      await platesFile.write(newContent);
      loadScannedPlates(); // Reload to update UI
    } catch (error) {
      console.error('Error saving plate:', error);
      Alert.alert('Error', 'No se pudo guardar la matrícula.');
    }
  };

  const handleScan = async () => {
    if (cameraRef.current && cameraReady) {
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
          // Regex para matrículas españolas (4 números seguidos de 3 consonantes)
          const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
          const match = cleanText.match(plateRegex);

          if (match && match[0]) {
            Alert.alert('Matrícula detectada', match[0]);
            savePlate(match[0]);
          } else {
            Alert.alert('No se detectó matrícula', 'No se encontró una matrícula española válida.');
          }
        }
      } catch (error) {
        console.error('Error during scan:', error);
        Alert.alert('Error', 'Ocurrió un error al escanear la matrícula.');
      }
    }
  };

  if (hasPermission === null) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Solicitando permisos de cámara...</Text></ScreenContainer>;
  }
  if (hasPermission === false) {
    return <ScreenContainer className="flex-1 items-center justify-center"><Text>Acceso a la cámara denegado.</Text></ScreenContainer>;
  }

  return (
    <ScreenContainer className="flex-1 p-0">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        onCameraReady={() => setCameraReady(true)}
        facing="back"
      />
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          disabled={!cameraReady}
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
    maxHeight: 200,
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
});
