import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from "@/components/screen-container";

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';

export default function RegistroScreen() {
  const [importedPlatesCount, setImportedPlatesCount] = useState<number>(0);

  useEffect(() => {
    loadImportedPlatesCount();
  }, []);

  const loadImportedPlatesCount = async () => {
    try {
      const storedPlates = await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY);
      if (storedPlates) {
        const platesArray = JSON.parse(storedPlates);
        setImportedPlatesCount(platesArray.length);
      }
    } catch (error) {
      console.error('Error loading imported plates count:', error);
    }
  };

  const handleImportCSV = async () => {
    try {
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
        return;
      }

      const selectedAsset = result.assets?.[0];
      if (!selectedAsset) {
        Alert.alert('Error de importación', 'No se pudo acceder al archivo seleccionado.');
        return;
      }

      const csvUri = decodeURIComponent(selectedAsset.uri);
      const localInternalUri = `${FileSystem.cacheDirectory}temp_import.csv`;

      try {
        await FileSystem.deleteAsync(localInternalUri, { idempotent: true });
      } catch (e) {
        console.log('Sin archivo previo que limpiar');
      }

      await FileSystem.copyAsync({
        from: csvUri,
        to: localInternalUri
      });

      const csvContent = await FileSystem.readAsStringAsync(localInternalUri, { 
        encoding: FileSystem.EncodingType.UTF8 
      });

      if (!csvContent || csvContent.trim().length === 0) {
        Alert.alert('Error de importación', 'El archivo CSV está vacío.');
        return;
      }

      const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        Alert.alert('Error de importación', 'El archivo CSV debe contener al menos un encabezado y una fila de datos.');
        return;
      }

      const uniquePlates = new Set<string>();
      
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
        Alert.alert('Advertencia', 'No se encontraron matrículas válidas en el archivo CSV.');
        return;
      }

      const platesArray = Array.from(uniquePlates);
      await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(platesArray));
      setImportedPlatesCount(platesArray.length);
      
      try {
        await FileSystem.deleteAsync(localInternalUri, { idempotent: true });
      } catch (e) {
        console.log('Error al limpiar caché temporal:', e);
      }

      Alert.alert('Importación exitosa', `${platesArray.length} matrículas importadas y guardadas.`);

    } catch (error) {
      console.error('Error nativo leyendo CSV:', error);
      Alert.alert('Error de lectura', 'No se pudo leer el archivo debido a restricciones del sistema. Intenta de nuevo.');
    }
  };

  const handleClearRegistry = async () => {
    Alert.alert(
      'Limpiar registro',
      '¿Estás seguro de que deseas eliminar todas las matrículas importadas?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(IMPORTED_PLATES_STORAGE_KEY);
              setImportedPlatesCount(0);
              Alert.alert('Éxito', 'El registro de matrículas ha sido eliminado.');
            } catch (error) {
              console.error('Error clearing registry:', error);
              Alert.alert('Error', 'No se pudo limpiar el registro.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center gap-8">
          <Text className="text-3xl font-bold text-foreground">Registro de Matrículas</Text>
          <Text className="text-base text-muted text-center">
            Importa un archivo CSV con matrículas para cotejar durante el escaneo.
          </Text>

          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-full active:opacity-80"
            onPress={handleImportCSV}
          >
            <Text className="text-background font-semibold">Importar CSV</Text>
          </TouchableOpacity>

          <View className="items-center gap-4">
            <Text className="text-lg text-foreground font-semibold">
              Matrículas importadas: {importedPlatesCount}
            </Text>
            {importedPlatesCount > 0 && (
              <TouchableOpacity
                className="bg-error px-6 py-2 rounded-full active:opacity-80"
                onPress={handleClearRegistry}
              >
                <Text className="text-background font-semibold text-sm">Limpiar registro</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="mt-8 p-4 bg-surface rounded-lg">
            <Text className="text-sm text-muted text-center">
              El archivo CSV debe tener la siguiente estructura:{'\n'}
              MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Estilos específicos si es necesario
});
