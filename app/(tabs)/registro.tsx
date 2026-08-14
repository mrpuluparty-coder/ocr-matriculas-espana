import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Modal, FlatList, ActivityIndicator, Alert, TextInput, Switch } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from "@/components/screen-container";
import { PlateLocationMap } from "@/components/plate-location-map";
import { useFocusEffect } from 'expo-router';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const NOTIFICATION_RULES_STORAGE_KEY = 'notification_rules';
const GLOBAL_NOTIFICATIONS_KEY = 'global_notifications_active';
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

interface NotificationRule {
  plate: string;
  message: string;
  active: boolean;
}

export default function RegistroScreen() {
  const [importedPlates, setImportedPlates] = useState<Record<string, ImportedPlateData>>({});
  const [scannedPlates, setScannedPlates] = useState<ScannedPlate[]>([]);
  const [notificationRules, setNotificationRules] = useState<Record<string, NotificationRule>>({});
  const [globalNotificationsActive, setGlobalNotificationsActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<ScannedPlate | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Estados para modal de edición/creación de regla de notificación
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingPlate, setEditingPlate] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isRuleActive, setIsRuleActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadImportedPlates();
      loadScannedPlates();
      loadNotificationSettings();
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

  const saveNotificationSettings = async (newRules: Record<string, NotificationRule>, globalActive: boolean) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_RULES_STORAGE_KEY, JSON.stringify(newRules));
      await AsyncStorage.setItem(GLOBAL_NOTIFICATIONS_KEY, JSON.stringify(globalActive));
      setNotificationRules(newRules);
      setGlobalNotificationsActive(globalActive);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración de notificaciones.');
    }
  };

  const handleToggleGlobalNotifications = (value: boolean) => {
    saveNotificationSettings(notificationRules, value);
  };

  const handleToggleRuleActive = (plate: string) => {
    const current = notificationRules[plate];
    if (!current) return;
    const updated = {
      ...notificationRules,
      [plate]: { ...current, active: !current.active }
    };
    saveNotificationSettings(updated, globalNotificationsActive);
  };

  const handleDeleteRule = (plate: string) => {
    Alert.alert(
      'Eliminar Notificación',
      `¿Deseas eliminar la regla de notificación para ${plate}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updated = { ...notificationRules };
            delete updated[plate];
            saveNotificationSettings(updated, globalNotificationsActive);
          }
        }
      ]
    );
  };

  const handleOpenEditRule = (plate: string) => {
    setEditingPlate(plate);
    const existing = notificationRules[plate];
    setNotificationMessage(existing ? existing.message : `¡Atención! Matrícula ${plate} detectada.`);
    setIsRuleActive(existing ? existing.active : true);
    setShowNotificationModal(true);
  };

  const handleSaveRule = () => {
    if (!editingPlate.trim()) {
      Alert.alert('Error', 'La matrícula no puede estar vacía.');
      return;
    }
    const updated = {
      ...notificationRules,
      [editingPlate.toUpperCase()]: {
        plate: editingPlate.toUpperCase(),
        message: notificationMessage.trim() || `Matrícula ${editingPlate.toUpperCase()} detectada.`,
        active: isRuleActive,
      }
    };
    saveNotificationSettings(updated, globalNotificationsActive);
    setShowNotificationModal(false);
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

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        const tempFile = new File(Paths.cache, 'temp_import.csv');
        if (tempFile.exists) {
          tempFile.delete();
        }

        await FileSystem.copyAsync({
          from: selectedAsset.uri,
          to: tempFile.uri
        });

        const csvContent = await tempFile.text();
        const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');

        const newImportedPlates: Record<string, ImportedPlateData> = {};

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const firstComma = line.indexOf(',');
          if (firstComma !== -1) {
            const plate = line.substring(0, firstComma).replace(/"/g, '').trim().toUpperCase();
            const rest = line.substring(firstComma + 1);
            const secondComma = rest.indexOf(',');
            const thirdComma = rest.indexOf(',', secondComma + 1);
            const fourthComma = rest.indexOf(',', thirdComma + 1);

            if (plate) {
              const fecha = secondComma !== -1 ? rest.substring(0, secondComma).replace(/"/g, '').trim() : '';
              const hora = (secondComma !== -1 && thirdComma !== -1) ? rest.substring(secondComma + 1, thirdComma).replace(/"/g, '').trim() : '';
              const latLongStr = (thirdComma !== -1 && fourthComma !== -1) ? rest.substring(thirdComma + 1, fourthComma).replace(/"/g, '').trim() : '';
              const lugar = fourthComma !== -1 ? rest.substring(fourthComma + 1).replace(/"/g, '').trim() : '';

              const [latStr, lonStr] = latLongStr.split(',');
              const latitud = latStr ? parseFloat(latStr) : 0;
              const longitud = lonStr ? parseFloat(lonStr) : 0;

              newImportedPlates[plate] = { fecha, hora, latitud, longitud, lugar };
            }
          }
        }

        await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(newImportedPlates));
        setImportedPlates(newImportedPlates);
        if (tempFile.exists) {
          tempFile.delete();
        }
        Alert.alert('Éxito', `Se importaron ${Object.keys(newImportedPlates).length} matrículas correctamente.`);
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      Alert.alert('Error', 'No se pudo importar el archivo CSV.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCSV = () => {
    Alert.alert(
      'Limpiar Registros CSV',
      '¿Estás seguro de que deseas eliminar todas las matrículas importadas del registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(IMPORTED_PLATES_STORAGE_KEY);
            setImportedPlates({});
            Alert.alert('Completado', 'Registros CSV eliminados.');
          }
        }
      ]
    );
  };

  const handleClearOCR = () => {
    Alert.alert(
      'Eliminar Registros OCR',
      '¿Estás seguro de que deseas eliminar todas las detecciones guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const platesFile = getPlatesFile();
            const fileInfo = await platesFile.info();
            if (fileInfo.exists) {
              await platesFile.delete();
            }
            setScannedPlates([]);
            Alert.alert('Completado', 'Registros OCR eliminados.');
          }
        }
      ]
    );
  };

  const renderScannedPlateItem = ({ item }: { item: ScannedPlate }) => {
    const hasOriginal = !!importedPlates[item.plate];
    return (
      <TouchableOpacity 
        style={styles.plateItem}
        onPress={() => {
          if (hasOriginal) {
            setSelectedPlate(item);
            setShowMapModal(true);
          } else {
            Alert.alert('Sin ubicación CSV', 'Esta matrícula detectada no tiene una ubicación original asociada en el CSV.');
          }
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.plateText}>{item.plate}</Text>
          <Text style={styles.plateSubText}>{item.date} {item.time} {hasOriginal ? '📍 Ver Mapa' : ''}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#687076" />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="flex-1 p-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Sección Configuración de Notificaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Alertas y Notificaciones</Text>
          
          <View style={styles.globalToggleRow}>
            <Text style={styles.globalToggleLabel}>Activar Notificaciones Globales</Text>
            <Switch
              value={globalNotificationsActive}
              onValueChange={handleToggleGlobalNotifications}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#5856D6', marginBottom: 12 }]}
            onPress={() => {
              setEditingPlate('');
              setNotificationMessage('¡Matrícula especial detectada!');
              setIsRuleActive(true);
              setShowNotificationModal(true);
            }}
          >
            <Text style={styles.buttonText}>+ Añadir Alerta de Matrícula</Text>
          </TouchableOpacity>

          {Object.keys(notificationRules).length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.subSectionTitle}>Matrículas con Alerta Configurada:</Text>
              {Object.entries(notificationRules).map(([plate, rule]) => (
                <View key={plate} style={styles.ruleItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rulePlate}>{rule.plate}</Text>
                    <Text style={styles.ruleMessage} numberOfLines={1}>{rule.message}</Text>
                  </View>
                  <Switch
                    value={rule.active}
                    onValueChange={() => handleToggleRuleActive(rule.plate)}
                    style={{ marginRight: 8 }}
                  />
                  <TouchableOpacity onPress={() => handleOpenEditRule(rule.plate)} style={styles.iconButton}>
                    <MaterialIcons name="edit" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteRule(rule.plate)} style={styles.iconButton}>
                    <MaterialIcons name="delete" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No hay reglas de notificación configuradas.</Text>
          )}
        </View>

        {/* Sección Importar CSV */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registro de Matrículas (CSV)</Text>
          <TouchableOpacity style={styles.button} onPress={handleImportCSV} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Importar Archivo CSV</Text>}
          </TouchableOpacity>

          {Object.keys(importedPlates).length > 0 && (
            <>
              <Text style={styles.statusText}>
                Registros cargados: {Object.keys(importedPlates).length} matrículas
              </Text>
              <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleClearCSV}>
                <Text style={styles.buttonText}>Limpiar Registros CSV</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Sección Registros OCR y Limpieza */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Historial de Detecciones OCR</Text>
            {scannedPlates.length > 0 && (
              <TouchableOpacity style={styles.buttonSmall} onPress={handleClearOCR}>
                <Text style={styles.buttonSmallText}>Eliminar Registros OCR</Text>
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

      {/* Modal para Editar/Crear Alerta de Notificación */}
      <Modal
        visible={showNotificationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitleText}>Configurar Alerta de Matrícula</Text>
            
            <Text style={styles.inputLabel}>Matrícula:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: 1234ABC"
              value={editingPlate}
              onChangeText={setEditingPlate}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Texto de Notificación (Toast):</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Mensaje que aparecerá al detectar"
              value={notificationMessage}
              onChangeText={setNotificationMessage}
              multiline
            />

            <View style={styles.globalToggleRow}>
              <Text style={styles.globalToggleLabel}>Alerta Activa</Text>
              <Switch
                value={isRuleActive}
                onValueChange={setIsRuleActive}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ccc' }]} onPress={() => setShowNotificationModal(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#007AFF' }]} onPress={handleSaveRule}>
                <Text style={styles.modalButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                <Text style={styles.modalHeaderText}>{selectedPlate.plate}</Text>
                <TouchableOpacity onPress={() => setShowMapModal(false)}>
                  <MaterialIcons name="close" size={28} color="white" />
                </TouchableOpacity>
              </View>

              {importedPlates[selectedPlate.plate] && (
                <PlateLocationMap
                  scannedLocation={{
                    latitude: selectedPlate.latitude,
                    longitude: selectedPlate.longitude,
                  }}
                  originalLocation={{
                    latitude: importedPlates[selectedPlate.plate].latitud,
                    longitude: importedPlates[selectedPlate.plate].longitud,
                  }}
                />
              )}
            </>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#687076',
    marginBottom: 8,
  },
  globalToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  globalToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#11181C',
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
    paddingVertical: 6,
    paddingHorizontal: 10,
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
  plateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#11181C',
  },
  plateSubText: {
    fontSize: 12,
    color: '#687076',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#687076',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rulePlate: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#11181C',
  },
  ruleMessage: {
    fontSize: 13,
    color: '#687076',
  },
  iconButton: {
    padding: 6,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#11181C',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  modalHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#11181C',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
