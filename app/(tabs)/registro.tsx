import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import MapView, { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from "@/components/screen-container";
import { useFocusEffect } from 'expo-router';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv';

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

interface ImportedPlateData {
  fecha: string;
  hora: string;
  latitud: number;
  longitud: number;
  lugar: string;
}

interface ScannedPlate {
  plate: string;
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  place: string;
}

export default function RegistroScreen() {
  const [importedPlates, setImportedPlates] = useState<Record<string, ImportedPlateData>>({});
  const [scannedPlates, setScannedPlates] = useState<ScannedPlate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<ScannedPlate | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadImportedPlates();
      loadScannedPlates();
    }, [])
  );

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

  const loadScannedPlates = async () => {
    try {
      const platesFile = getPlatesFile();
      const fileInfo = await platesFile.info();
      if (fileInfo.exists) {
        const content = await platesFile.text();
        const lines = content.split('\n').filter(Boolean);
        const platesData = lines.slice(1).map(line => {
          const columns = line.split(',');
          if (columns.length >= 5) {
            const plate = columns[0].trim();
            const date = columns[1].trim();
            const time = columns[2].trim();
            const coords = columns[3].trim().replace(/"/g, '').split(',');
            const latitude = parseFloat(coords[0]);
            const longitude = parseFloat(coords[1]);
            const place = columns[4].trim();
            return { plate, date, time, latitude, longitude, place };
          }
          return null;
        }).filter((item): item is ScannedPlate => item !== null);
        setScannedPlates(platesData.reverse());
      }
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  const handleImportCSV = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.ms-excel',
          'text/plain'
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsLoading(false);
        return;
      }

      const selectedAsset = result.assets[0];

      // Usar fetch + FileReader para leer el archivo
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onload = async (e: any) => {
        try {
          const csvContent = e.target.result;
          if (!csvContent || csvContent.trim().length === 0) {
            Alert.alert('Error', 'El archivo seleccionado está vacío.');
            setIsLoading(false);
            return;
          }

          // Normalizar saltos de línea
          const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter((line: string) => line.trim() !== '');

          if (lines.length < 2) {
            Alert.alert('Error', 'El archivo debe contener un encabezado y al menos una fila de datos.');
            setIsLoading(false);
            return;
          }

          const uniquePlates: Record<string, ImportedPlateData> = {};

          // Procesar líneas (saltar encabezado)
          for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            if (columns.length >= 5) {
              const plate = columns[0].replace(/"/g, '').trim().toUpperCase();
              const fecha = columns[1].replace(/"/g, '').trim();
              const hora = columns[2].replace(/"/g, '').trim();
              
              // Parsear coordenadas (vienen como "lat,lon" entre comillas)
              const coordsStr = columns[3].replace(/"/g, '').trim();
              const coords = coordsStr.split(',');
              const latitud = parseFloat(coords[0]);
              const longitud = parseFloat(coords[1]);
              
              const lugar = columns[4].replace(/"/g, '').trim();

              if (plate && !isNaN(latitud) && !isNaN(longitud)) {
                uniquePlates[plate] = { fecha, hora, latitud, longitud, lugar };
              }
            }
          }

          if (Object.keys(uniquePlates).length === 0) {
            Alert.alert('Advertencia', 'No se encontraron matrículas con formato válido en el archivo.');
            setIsLoading(false);
            return;
          }

          // Guardar en AsyncStorage
          await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(uniquePlates));
          setImportedPlates(uniquePlates);
          Alert.alert('✅ Éxito', `${Object.keys(uniquePlates).length} matrículas importadas correctamente.`);
          setIsLoading(false);
        } catch (error) {
          console.error('Error procesando archivo:', error);
          Alert.alert('Error', 'Ocurrió un error al procesar el archivo.');
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        Alert.alert('Error', 'El lector en memoria no pudo procesar el archivo.');
        setIsLoading(false);
      };

      reader.readAsText(blob, 'UTF-8');
    } catch (error) {
      console.error('Error importando CSV:', error);
      Alert.alert('Error', 'No se pudo importar el archivo. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const handleClearImportedPlates = async () => {
    Alert.alert(
      'Limpiar Registros CSV',
      '¿Estás seguro de que deseas eliminar todas las matrículas importadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(IMPORTED_PLATES_STORAGE_KEY);
              setImportedPlates({});
              Alert.alert('✅ Éxito', 'Registros CSV limpiados correctamente.');
            } catch (error) {
              console.error('Error clearing imported plates:', error);
              Alert.alert('Error', 'No se pudo limpiar los registros.');
            }
          }
        }
      ]
    );
  };

  const handleClearScannedPlates = async () => {
    Alert.alert(
      'Eliminar Registros OCR',
      '¿Estás seguro de que deseas eliminar todos los registros de detecciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const platesFile = getPlatesFile();
              await platesFile.write('MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n');
              setScannedPlates([]);
              Alert.alert('✅ Éxito', 'Registros OCR eliminados correctamente.');
            } catch (error) {
              console.error('Error clearing scanned plates:', error);
              Alert.alert('Error', 'No se pudo eliminar los registros.');
            }
          }
        }
      ]
    );
  };

  const openMapModal = (plate: ScannedPlate) => {
    setSelectedPlate(plate);
    setShowMapModal(true);
  };

  const renderScannedPlateItem = ({ item }: { item: ScannedPlate }) => (
    <TouchableOpacity
      style={styles.plateItem}
      onPress={() => openMapModal(item)}
    >
      <View style={styles.plateItemContent}>
        <Text style={styles.plateItemPlate}>{item.plate}</Text>
        <Text style={styles.plateItemMeta}>{item.date} {item.time}</Text>
      </View>
      <MaterialIcons name="location-on" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView style={styles.container}>
        {/* Sección de importación CSV */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Importar Registros CSV</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleImportCSV}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Seleccionar Archivo CSV</Text>
            )}
          </TouchableOpacity>
          {Object.keys(importedPlates).length > 0 && (
            <>
              <Text style={styles.statusText}>
                ✅ {Object.keys(importedPlates).length} matrículas importadas
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleClearImportedPlates}
              >
                <Text style={styles.buttonText}>Limpiar Registros CSV</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Sección de matrículas detectadas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Matrículas Detectadas</Text>
            {scannedPlates.length > 0 && (
              <TouchableOpacity
                style={styles.buttonSmall}
                onPress={handleClearScannedPlates}
              >
                <Text style={styles.buttonSmallText}>Eliminar OCR</Text>
              </TouchableOpacity>
            )}
          </View>

          {scannedPlates.length > 0 ? (
            <FlatList
              data={scannedPlates}
              renderItem={renderScannedPlateItem}
              keyExtractor={(item, index) => `${item.plate}-${index}`}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No hay matrículas detectadas aún</Text>
          )}
        </View>
      </ScrollView>

      {/* Modal con Mapa */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.modalContainer}>
          {selectedPlate && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedPlate.plate}</Text>
                <TouchableOpacity onPress={() => setShowMapModal(false)}>
                  <MaterialIcons name="close" size={28} color="white" />
                </TouchableOpacity>
              </View>

              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: selectedPlate.latitude,
                  longitude: selectedPlate.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                {/* PIN VERDE: Ubicación de escaneo */}
                <Marker
                  coordinate={{
                    latitude: selectedPlate.latitude,
                    longitude: selectedPlate.longitude,
                  }}
                  title="Lugar de Escaneo"
                  pinColor="green"
                />

                {/* PIN ROJO: Ubicación original CSV */}
                {importedPlates[selectedPlate.plate] && (
                  <Marker
                    coordinate={{
                      latitude: importedPlates[selectedPlate.plate].latitud,
                      longitude: importedPlates[selectedPlate.plate].longitud,
                    }}
                    title="Ubicación Original CSV"
                    pinColor="red"
                  />
                )}
              </MapView>
            </>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonSmall: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonSmallText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    color: '#22C55E',
    marginBottom: 12,
    fontWeight: '500',
  },
  plateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  plateItemContent: {
    flex: 1,
  },
  plateItemPlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 4,
  },
  plateItemMeta: {
    fontSize: 12,
    color: '#687076',
  },
  emptyText: {
    fontSize: 14,
    color: '#687076',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e2022',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  map: {
    flex: 1,
  },
});
