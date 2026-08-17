import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';
import { DEFAULT_SCANNER_SETTINGS, loadScannerSettings, normalizeScannerSettings, saveScannerSettings, type ScannerSettings } from '@/lib/scanner-settings';

const NOTIFICATION_RULES_STORAGE_KEY = 'notification_rules';
const GLOBAL_NOTIFICATIONS_KEY = 'global_notifications_active';
const SPECIAL_ALERT_PLACEHOLDER = '¡Matrícula especial detectada!';

interface NotificationRule {
  plate: string;
  message: string;
  active: boolean;
}

interface TimeInputs {
  videoIntervalSeconds: string;
  duplicateWindowSeconds: string;
  toastDurationSeconds: string;
  gpsUpdateIntervalSeconds: string;
}

function toTimeInputs(settings: ScannerSettings): TimeInputs {
  return {
    videoIntervalSeconds: String(settings.videoIntervalSeconds),
    duplicateWindowSeconds: String(settings.duplicateWindowSeconds),
    toastDurationSeconds: String(settings.toastDurationSeconds),
    gpsUpdateIntervalSeconds: String(settings.gpsUpdateIntervalSeconds),
  };
}

export default function AjustesScreen() {
  const [notificationRules, setNotificationRules] = useState<Record<string, NotificationRule>>({});
  const [globalNotificationsActive, setGlobalNotificationsActive] = useState(true);
  const [timeInputs, setTimeInputs] = useState<TimeInputs>(toTimeInputs(DEFAULT_SCANNER_SETTINGS));
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingPlate, setEditingPlate] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isRuleActive, setIsRuleActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void loadNotificationSettings();
      void loadTimeSettings();
    }, []),
  );

  const loadNotificationSettings = async () => {
    try {
      const storedRules = await AsyncStorage.getItem(NOTIFICATION_RULES_STORAGE_KEY);
      setNotificationRules(storedRules ? JSON.parse(storedRules) : {});
      const storedGlobal = await AsyncStorage.getItem(GLOBAL_NOTIFICATIONS_KEY);
      setGlobalNotificationsActive(storedGlobal === null ? true : JSON.parse(storedGlobal));
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const loadTimeSettings = async () => setTimeInputs(toTimeInputs(await loadScannerSettings()));

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

  const handleSaveTimes = async () => {
    try {
      const settings = normalizeScannerSettings({
        videoIntervalSeconds: Number(timeInputs.videoIntervalSeconds),
        duplicateWindowSeconds: Number(timeInputs.duplicateWindowSeconds),
        toastDurationSeconds: Number(timeInputs.toastDurationSeconds),
        gpsUpdateIntervalSeconds: Number(timeInputs.gpsUpdateIntervalSeconds),
      });
      const saved = await saveScannerSettings(settings);
      setTimeInputs(toTimeInputs(saved));
      Alert.alert('Tiempos guardados', 'Los nuevos tiempos se aplicarán en Cámara al volver a esa pestaña.');
    } catch (error) {
      console.error('Error saving scanner settings:', error);
      Alert.alert('Error', 'No se pudieron guardar los tiempos.');
    }
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
    const existing = notificationRules[plate];
    setEditingPlate(plate);
    setNotificationMessage(existing?.message ?? '');
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
      [plate]: { plate, message: notificationMessage.trim() || SPECIAL_ALERT_PLACEHOLDER, active: isRuleActive },
    }, globalNotificationsActive);
    setShowNotificationModal(false);
  };

  return (
    <ScreenContainer className="flex-1 p-4">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <MaterialIcons name="timer" size={22} color="#007AFF" />
            <Text style={styles.sectionTitle}>Tiempos de Escaneo</Text>
          </View>
          <Text style={styles.helpText}>Personaliza cada intervalo en segundos. Los valores se aplican al volver a Cámara.</Text>
          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Captura entre fotogramas (Vídeo)</Text>
            <TextInput style={styles.timeInput} value={timeInputs.videoIntervalSeconds} onChangeText={(value) => setTimeInputs((current) => ({ ...current, videoIntervalSeconds: value }))} keyboardType="decimal-pad" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Ignorar duplicados</Text>
            <TextInput style={styles.timeInput} value={timeInputs.duplicateWindowSeconds} onChangeText={(value) => setTimeInputs((current) => ({ ...current, duplicateWindowSeconds: value }))} keyboardType="decimal-pad" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Mostrar toast</Text>
            <TextInput style={styles.timeInput} value={timeInputs.toastDurationSeconds} onChangeText={(value) => setTimeInputs((current) => ({ ...current, toastDurationSeconds: value }))} keyboardType="decimal-pad" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Intervalo de actualización GPS</Text>
            <TextInput style={styles.timeInput} value={timeInputs.gpsUpdateIntervalSeconds} onChangeText={(value) => setTimeInputs((current) => ({ ...current, gpsUpdateIntervalSeconds: value }))} keyboardType="decimal-pad" />
          </View>
          <TouchableOpacity style={styles.button} onPress={() => void handleSaveTimes()}>
            <Text style={styles.buttonText}>Guardar tiempos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Alertas y Notificaciones</Text>
          <View style={styles.globalToggleRow}>
            <Text style={styles.globalToggleLabel}>Activar Notificaciones Globales</Text>
            <Switch value={globalNotificationsActive} onValueChange={(value) => void saveNotificationSettings(notificationRules, value)} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonPurple]}
            onPress={() => {
              setEditingPlate('');
              setNotificationMessage('');
              setIsRuleActive(true);
              setShowNotificationModal(true);
            }}
          >
            <Text style={styles.buttonText}>+ Añadir Alerta de Matrícula</Text>
          </TouchableOpacity>

          {Object.keys(notificationRules).length > 0 ? (
            <View style={styles.rulesList}>
              <Text style={styles.subSectionTitle}>Matrículas con Alerta Configurada:</Text>
              {Object.entries(notificationRules).map(([plate, rule]) => (
                <View key={plate} style={styles.ruleItem}>
                  <View style={styles.ruleCopy}>
                    <Text style={styles.rulePlate}>{rule.plate}</Text>
                    <Text style={styles.ruleMessage} numberOfLines={1}>{rule.message}</Text>
                  </View>
                  <Switch value={rule.active} onValueChange={() => handleToggleRuleActive(rule.plate)} style={styles.ruleSwitch} />
                  <TouchableOpacity onPress={() => handleOpenEditRule(rule.plate)} style={styles.iconButton}><MaterialIcons name="edit" size={20} color="#007AFF" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteRule(rule.plate)} style={styles.iconButton}><MaterialIcons name="delete" size={20} color="#FF3B30" /></TouchableOpacity>
                </View>
              ))}
            </View>
          ) : <Text style={styles.emptyText}>No hay reglas de notificación configuradas.</Text>}
        </View>
      </ScrollView>

      <Modal visible={showNotificationModal} animationType="slide" transparent onRequestClose={() => setShowNotificationModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={24}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitleText}>Configurar Alerta de Matrícula</Text>
              <Text style={styles.inputLabel}>Matrícula:</Text>
              <TextInput style={styles.textInput} placeholder="Ej: 1234ABC" value={editingPlate} onChangeText={setEditingPlate} autoCapitalize="characters" />
              <Text style={styles.inputLabel}>Texto de Notificación (Toast):</Text>
              <TextInput style={[styles.textInput, styles.messageInput]} placeholder={SPECIAL_ALERT_PLACEHOLDER} value={notificationMessage} onChangeText={setNotificationMessage} multiline />
              <View style={styles.globalToggleRow}>
                <Text style={styles.globalToggleLabel}>Alerta Activa</Text>
                <Switch value={isRuleActive} onValueChange={setIsRuleActive} />
              </View>
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowNotificationModal(false)}><Text style={styles.modalButtonText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSaveRule}><Text style={styles.modalButtonText}>Guardar</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  section: { marginBottom: 24, backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#11181C' },
  subSectionTitle: { fontSize: 14, fontWeight: '600', color: '#687076', marginBottom: 8 },
  helpText: { color: '#687076', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  timeField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
  timeLabel: { flex: 1, fontSize: 14, color: '#11181C', fontWeight: '600' },
  timeInput: { width: 74, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: '#F9FAFB', textAlign: 'center', fontSize: 15 },
  globalToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8 },
  globalToggleLabel: { fontSize: 15, fontWeight: '600', color: '#11181C', flex: 1, paddingRight: 12 },
  button: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonPurple: { backgroundColor: '#5856D6', marginTop: 0 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  rulesList: { marginTop: 16 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  ruleCopy: { flex: 1 },
  rulePlate: { fontSize: 15, fontWeight: 'bold', color: '#11181C' },
  ruleMessage: { fontSize: 13, color: '#687076' },
  ruleSwitch: { marginRight: 8 },
  iconButton: { padding: 6, marginLeft: 4 },
  emptyText: { fontSize: 14, color: '#687076', fontStyle: 'italic', textAlign: 'center', marginVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, alignSelf: 'center' },
  modalTitleText: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: '#11181C' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 16, backgroundColor: '#F9FAFB' },
  messageInput: { height: 80, textAlignVertical: 'top' },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 6 },
  modalButtonCancel: { backgroundColor: '#8E8E93' },
  modalButtonSave: { backgroundColor: '#007AFF' },
  modalButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
