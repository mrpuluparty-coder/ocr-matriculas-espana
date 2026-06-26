import React, { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv';

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

export default function RegistroScreen() {
  const [importedPlatesCount, setImportedPlatesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadImportedPlatesCount();
  }, []);

  const loadImportedPlatesCount = async () => {
    try {
      const stored = await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY);
      if (stored) {
        const plates = JSON.parse(stored);
        setImportedPlatesCount(plates.length);
      }
    } catch (error) {
      console.error('Error loading imported plates count:', error);
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
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        Alert.alert('Importación cancelada', 'No se seleccionó ningún archivo CSV.');
        setIsLoading(false);
        return;
      }

      const selectedAsset = result.assets?.[0];
      if (!selectedAsset) {
        Alert.alert('Error de importación', 'No se pudo acceder al archivo seleccionado.');
        setIsLoading(false);
        return;
      }

      // Usar fetch + FileReader para leer el archivo desde la URI virtual sin restricciones de Scoped Storage
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onload = async (e: any) => {
        try {
          const csvContent = e.target.result;
          if (!csvContent || csvContent.trim().length === 0) {
            Alert.alert('Error de importación', 'El archivo seleccionado está vacío.');
            setIsLoading(false);
            return;
          }

          // Proceder al parseo seguro de las líneas
          const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter((line: string) => line.trim() !== '');
          if (lines.length < 2) {
            Alert.alert('Error de importación', 'El archivo debe contener un encabezado y al menos una fila de datos.');
            setIsLoading(false);
            return;
          }

          const uniquePlates = new Set<string>();
          // Parsear líneas saltando el encabezado (índice 0). La matrícula está en la primera columna antes de cualquier coma.
          for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            if (columns.length > 0) {
              const plate = columns[0].replace(/"/g, '').trim().toUpperCase();
              if (plate) {
                uniquePlates.add(plate);
              }
            }
          }

          if (uniquePlates.size === 0) {
            Alert.alert('Advertencia', 'No se encontraron matrículas con formato válido en el archivo.');
            setIsLoading(false);
            return;
          }

          const platesArray = Array.from(uniquePlates);
          await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(platesArray));
          setImportedPlatesCount(platesArray.length);
          Alert.alert('Importación exitosa', `${platesArray.length} matrículas importadas y guardadas correctamente.`);
          setIsLoading(false);
        } catch (error) {
          console.error('Error procesando archivo:', error);
          Alert.alert('Error de procesamiento', 'Ocurrió un error al procesar el archivo.');
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        Alert.alert('Error de lectura', 'El lector en memoria no pudo procesar el archivo.');
        setIsLoading(false);
      };

      reader.readAsText(blob, 'UTF-8');
    } catch (error) {
      console.error('Error importando CSV:', error);
      Alert.alert('Error de importación', 'No se pudo importar el archivo. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const handleClearRegistry = async () => {
    Alert.alert(
      'Limpiar registros CSV',
      '¿Estás seguro de que deseas eliminar todas las matrículas importadas?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Limpiar',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(IMPORTED_PLATES_STORAGE_KEY);
              setImportedPlatesCount(0);
              Alert.alert('Registros CSV limpiados', 'Todas las matrículas importadas han sido eliminadas.');
            } catch (error) {
              console.error('Error limpiando registro:', error);
              Alert.alert('Error', 'No se pudo limpiar el registro.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleDeleteOCRRecords = async () => {
    Alert.alert(
      'Eliminar registros OCR',
      '¿Estás seguro de que deseas eliminar todos los registros de detecciones de matrículas?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            try {
              const platesFile = getPlatesFile();
              const fileInfo = await platesFile.info();
              if (fileInfo.exists) {
                // Crear archivo nuevo solo con el encabezado
                await platesFile.write('MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n');
                Alert.alert('Registros eliminados', 'Todos los registros OCR han sido eliminados.');
              }
            } catch (error) {
              console.error('Error eliminando registros OCR:', error);
              Alert.alert('Error', 'No se pudieron eliminar los registros OCR.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-4">
        <View className="gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">Registro de Matrículas</Text>
            <Text className="text-sm text-muted text-center">
              Importa un archivo CSV con matrículas para cotejar durante el escaneo
            </Text>
          </View>

          {/* Status Card */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-sm text-muted">Matrículas importadas</Text>
            <Text className="text-4xl font-bold text-primary">{importedPlatesCount}</Text>
            <Text className="text-xs text-muted">
              {importedPlatesCount === 0
                ? 'No hay matrículas importadas'
                : `${importedPlatesCount} matrículas en el registro`}
            </Text>
          </View>

          {/* Import Button */}
          <TouchableOpacity
            onPress={handleImportCSV}
            disabled={isLoading}
            className="bg-primary rounded-xl py-4 px-6 items-center active:opacity-80"
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-base">Importar CSV</Text>
            )}
          </TouchableOpacity>

          {/* Clear CSV Button */}
          {importedPlatesCount > 0 && (
            <TouchableOpacity
              onPress={handleClearRegistry}
              className="bg-error/10 rounded-xl py-4 px-6 items-center border border-error active:opacity-80"
            >
              <Text className="text-error font-semibold text-base">Limpiar Registros CSV</Text>
            </TouchableOpacity>
          )}

          {/* Delete OCR Records Button */}
          <TouchableOpacity
            onPress={handleDeleteOCRRecords}
            className="bg-warning/10 rounded-xl py-4 px-6 items-center border border-warning active:opacity-80"
          >
            <Text className="text-warning font-semibold text-base">Eliminar Registros OCR</Text>
          </TouchableOpacity>

          {/* Info Section */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-sm font-semibold text-foreground">Formato esperado del CSV</Text>
            <Text className="text-xs text-muted leading-relaxed">
              El archivo debe contener 5 columnas:{'\n'}
              • Matrícula{'\n'}
              • Fecha{'\n'}
              • Hora{'\n'}
              • Coordenadas (Lat/Lon){'\n'}
              • Lugar
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
