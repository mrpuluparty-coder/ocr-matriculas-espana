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
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        Alert.alert('Importación cancelada', 'No se seleccionó ningún archivo CSV.');
        return;
      }

      const csvUri = result.assets[0].uri;
      const csvContent = await FileSystem.readAsStringAsync(csvUri);

      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) {
        Alert.alert('Error de importación', 'El archivo CSV está vacío.');
        return;
      }

      const uniquePlates = new Set<string>();
      // Asumiendo que la matrícula es la primera columna y la primera línea es el encabezado
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',');
        if (columns.length > 0) {
          uniquePlates.add(columns[0].trim().toUpperCase());
        }
      }

      const platesArray = Array.from(uniquePlates);
      await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(platesArray));
      setImportedPlatesCount(platesArray.length);
      Alert.alert('Importación exitosa', `${platesArray.length} matrículas importadas y guardadas.`);

    } catch (error) {
      console.error('Error importing CSV:', error);
      Alert.alert('Error de importación', 'No se pudo importar el archivo CSV. Asegúrate de que sea un archivo CSV válido.');
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center gap-8">
          <Text className="text-3xl font-bold text-foreground">Registro de Matrículas</Text>
          <Text className="text-base text-muted text-center">
            Importa un archivo CSV con matrículas para cotejar.
          </Text>

          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-full active:opacity-80"
            onPress={handleImportCSV}
          >
            <Text className="text-background font-semibold">Importar CSV</Text>
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-lg text-foreground">
              Matrículas importadas: {importedPlatesCount}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Puedes añadir estilos específicos aquí si es necesario
});
