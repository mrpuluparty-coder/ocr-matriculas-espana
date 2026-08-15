import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';

const IMPORTED_PLATES_STORAGE_KEY = 'imported_plates';
const NOTIFICATION_RULES_STORAGE_KEY = 'notification_rules';
const GLOBAL_NOTIFICATIONS_KEY = 'global_notifications_active';
const PLATES_FILE_NAME = 'matriculas_detectadas.csv';

const getPlatesFile = () => new File(Paths.document, PLATES_FILE_NAME);

interface ImportedPlateData {
  fecha: string;
  hora: string;
}

interface ScannedPlate {
  plate: string;
  date: string;
  time: string;
  isInRegistry: boolean;
}

interface NotificationRule {
  plate: string;
  message: string;
  active: boolean;
}

function normalizeImportedPlates(rawValue: string | null): Record<string, ImportedPlateData> {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.reduce<Record<string, ImportedPlateData>>((store, plate) => {
        if (typeof plate === 'string' && plate.trim()) store[plate.trim().toUpperCase()] = { fecha: '', hora: '' };
        return store;
      }, {});
    }

    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).reduce<Record<string, ImportedPlateData>>((store, plate) => {
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

export default function RegistroScreen() {
  const [importedPlates, setImportedPlates] = useState<Record<string, ImportedPlateData>>({});
  const [scannedPlates, setScannedPlates] = useState<ScannedPlate[]>([]);
  const [notificationRules, setNotificationRules] = useState<Record<string, NotificationRule>>({});
  const [globalNotificationsActive, setGlobalNotificationsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingPlate, setEditingPlate] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isRuleActive, setIsRuleActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void loadImportedPlates();
      void loadScannedPlates();
      void loadNotificationSettings();
    }, []),
  );

  const loadImportedPlates = async () => {
    setImportedPlates(normalizeImportedPlates(await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY)));
  };

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

  const loadScannedPlates = async () => {
    try {
      const platesFile = getPlatesFile();
      const fileInfo = await platesFile.info();
      if (!fileInfo.exists) {
        setScannedPlates([]);
        return;
      }

      const importedStore = normalizeImportedPlates(await AsyncStorage.getItem(IMPORTED_PLATES_STORAGE_KEY));
      const content = await platesFile.text();
      const platesData = content
        .split('\n')
        .filter(Boolean)
        .slice(1)
        .map((line) => {
          const [rawPlate = '', rawDate = '', rawTime = ''] = line.split(',');
          const plate = rawPlate.trim().toUpperCase();
          if (!plate) return null;
          return {
            plate,
            date: rawDate.trim(),
            time: rawTime.trim(),
            isInRegistry: plate in importedStore,
          };
        })
        .filter((item): item is ScannedPlate => item !== null);

      setScannedPlates(platesData.reverse());
    } catch (error) {
      console.error('Error loading scanned plates:', error);
    }
  };

  const handleImportCSV = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const selectedAsset = result.assets[0];
      const tempFile = new File(Paths.cache, 'temp_import.csv');
      if (tempFile.exists) tempFile.delete();

      await FileSystem.copyAsync({ from: selectedAsset.uri, to: tempFile.uri });
      const lines = (await tempFile.text()).replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim() !== '');
      const newImportedPlates: Record<string, ImportedPlateData> = {};

      for (let i = 1; i < lines.length; i += 1) {
        const columns = lines[i].split(',');
        const plate = columns[0]?.replace(/"/g, '').trim().toUpperCase();
        if (!plate) continue;

        newImportedPlates[plate] = {
          fecha: columns[1]?.replace(/"/g, '').trim() ?? '',
          hora: columns[2]?.replace(/"/g, '').trim() ?? '',
        };
      }

      await AsyncStorage.setItem(IMPORTED_PLATES_STORAGE_KEY, JSON.stringify(newImportedPlates));
      setImportedPlates(newImportedPlates);
      if (tempFile.exists) tempFile.delete();
      Alert.alert('Éxito', `Se importaron ${Object.keys(newImportedPlates).length} matrículas correctamente.`);
      await loadScannedPlates();
    } catch (error) {
      console.error('Error importing CSV:', error);
      Alert.alert('Error', 'No se pudo importar el archivo CSV.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCSV = () => {
    Alert.alert('Limpiar Registros CSV', '¿Estás seguro de que deseas eliminar todas las matrículas importadas del registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(IMPORTED_PLATES_STORAGE_KEY);
          setImportedPlates({});
          await loadScannedPlates();
          Alert.alert('Completado', 'Registros CSV eliminados.');
        },
      },
    ]);
  };

  const handleClearOCR = () => {
    Alert.alert('Eliminar Registros OCR', '¿Estás seguro de que deseas eliminar todas las detecciones guardadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const platesFile = getPlatesFile();
          if ((await platesFile.info()).exists) await platesFile.delete();
          setScannedPlates([]);
          Alert.alert('Completado', 'Registros OCR eliminados.');
        },
      },
    ]);
  };

  const handleToggleRuleActive = (plate: string) => {
    const current = notificationRules[plate];
    if (!current) return;
    void saveNotificationSettings({ ...notificationRules, [plate]: { ...current, active: !current.active } }, globalNotificationsActive);
  };

  const handleDeleteRule = (plate: string) => {
    Alert.alert('Eliminar Notificación', `¿Deseas eliminar la regla de notificación para ${plate}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const updated = { ...notificationRules };
          delete updated[plate];
          void saveNotificationSettings(updated, globalNotificationsActive);
        },
      },
    ]);
  };

  const handleOpenEditRule = (plate: string) => {
    setEditingPlate(plate);
    const existing = notificationRules[plate];
    setNotificationMessage(existing?.message ?? `¡Atención! Matrícula ${plate} detectada.`);
    setIsRuleActive(existing?.active ?? true);
    setShowNotificationModal(true);
  };

  const handleSaveRule = () => {
    const plate = editingPlate.trim().toUpperCase();
    if (!plate) {
      Alert.alert('Error', 'La matrícula no puede estar vacía.');
      return;
    }

    void saveNotificationSettings({
      ...notificationRules,
      [plate]: { plate, message: notificationMessage.trim() || `Matrícula ${plate} detectada.`, active: isRuleActive },
    }, globalNotificationsActive);
    setShowNotificationModal(false);
  };

  const renderScannedPlateItem = ({ item }: { item: ScannedPlate }) => (
    <View style={styles.plateItem}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.plateText, item.isInRegistry && styles.plateTextInRegistry]}>{item.plate}</Text>
        <Text style={styles.plateSubText}>{item.date} {item.time}</Text>
      </View>
      <MaterialIcons name={item.isInRegistry ? 'check-circle' : 'history'} size={22} color={item.isInRegistry ? '#FF3B30' : '#687076'} />
    </View>
  );

  return (
    <ScreenContainer className="flex-1 p-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Alertas y Notificaciones</Text>
          <View style={styles.globalToggleRow}>
            <Text style={styles.globalToggleLabel}>Activar Notificaciones Globales</Text>
            <Switch value={globalNotificationsActive} onValueChange={(value) => void saveNotificationSettings(notificationRules, value)} />
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
                  <Switch value={rule.active} onValueChange={() => handleToggleRuleActive(rule.plate)} style={{ marginRight: 8 }} />
                  <TouchableOpacity onPress={() => handleOpenEditRule(rule.plate)} style={styles.iconButton}>
                    <MaterialIcons name="edit" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteRule(rule.plate)} style={styles.iconButton}>
                    <MaterialIcons name="delete" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : <Text style={styles.emptyText}>No hay reglas de notificación configuradas.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registro de Matrículas (CSV)</Text>
          <Text style={styles.helpText}>Se utilizan matrícula, fecha y hora. Las columnas de ubicación del CSV se ignoran.</Text>
          <TouchableOpacity style={styles.button} onPress={handleImportCSV} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Importar Archivo CSV</Text>}
          </TouchableOpacity>
          {Object.keys(importedPlates).length > 0 && (
            <>
              <Text style={styles.statusText}>Registros cargados: {Object.keys(importedPlates).length} matrículas</Text>
              <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleClearCSV}>
                <Text style={styles.buttonText}>Limpiar Registros CSV</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

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
            <FlatList data={scannedPlates} renderItem={renderScannedPlateItem} keyExtractor={(item, index) => `${item.plate}-${index}`} scrollEnabled={false} />
          ) : <Text style={styles.emptyText}>No hay matrículas detectadas aún</Text>}
        </View>
      </ScrollView>

      <Modal visible={showNotificationModal} animationType="slide" transparent onRequestClose={() => setShowNotificationModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitleText}>Configurar Alerta de Matrícula</Text>
            <Text style={styles.inputLabel}>Matrícula:</Text>
            <TextInput style={styles.textInput} placeholder="Ej: 1234ABC" value={editingPlate} onChangeText={setEditingPlate} autoCapitalize="characters" />
            <Text style={styles.inputLabel}>Texto de Notificación (Toast):</Text>
            <TextInput style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} placeholder="Mensaje que aparecerá al detectar" value={notificationMessage} onChangeText={setNotificationMessage} multiline />
            <View style={styles.globalToggleRow}>
              <Text style={styles.globalToggleLabel}>Alerta Activa</Text>
              <Switch value={isRuleActive} onValueChange={setIsRuleActive} />
            </View>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ccc' }]} onPress={() => setShowNotificationModal(false)}><Text style={styles.modalButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#007AFF' }]} onPress={handleSaveRule}><Text style={styles.modalButtonText}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24, backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#11181C', marginBottom: 12 },
  subSectionTitle: { fontSize: 14, fontWeight: '600', color: '#687076', marginBottom: 8 },
  globalToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8 },
  globalToggleLabel: { fontSize: 15, fontWeight: '600', color: '#11181C' },
  button: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonDanger: { backgroundColor: '#FF3B30' },
  buttonSmall: { backgroundColor: '#FF3B30', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  buttonSmallText: { color: 'white', fontSize: 12, fontWeight: '600' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  helpText: { color: '#687076', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  statusText: { fontSize: 14, color: '#22C55E', marginBottom: 12, fontWeight: '500' },
  plateItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5F5F5', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8 },
  plateText: { fontSize: 16, fontWeight: 'bold', color: '#11181C' },
  plateTextInRegistry: { color: '#FF3B30' },
  plateSubText: { fontSize: 12, color: '#687076', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#687076', fontStyle: 'italic', textAlign: 'center', marginVertical: 8 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  rulePlate: { fontSize: 15, fontWeight: 'bold', color: '#11181C' },
  ruleMessage: { fontSize: 13, color: '#687076' },
  iconButton: { padding: 6, marginLeft: 4 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 },
  modalTitleText: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: '#11181C' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 16, backgroundColor: '#F9FAFB' },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 6 },
  modalButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
