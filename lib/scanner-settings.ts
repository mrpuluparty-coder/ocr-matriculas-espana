import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCANNER_SETTINGS_STORAGE_KEY = 'scanner_operational_settings';

export interface ScannerSettings {
  videoIntervalSeconds: number;
  duplicateWindowSeconds: number;
  toastDurationSeconds: number;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  videoIntervalSeconds: 1,
  duplicateWindowSeconds: 60,
  toastDurationSeconds: 2.5,
};

function toValidSeconds(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 && numberValue <= 3_600 ? numberValue : fallback;
}

export function normalizeScannerSettings(value: unknown): ScannerSettings {
  const source = value && typeof value === 'object' ? value as Partial<ScannerSettings> : {};
  return {
    videoIntervalSeconds: toValidSeconds(source.videoIntervalSeconds, DEFAULT_SCANNER_SETTINGS.videoIntervalSeconds),
    duplicateWindowSeconds: toValidSeconds(source.duplicateWindowSeconds, DEFAULT_SCANNER_SETTINGS.duplicateWindowSeconds),
    toastDurationSeconds: toValidSeconds(source.toastDurationSeconds, DEFAULT_SCANNER_SETTINGS.toastDurationSeconds),
  };
}

export async function loadScannerSettings(): Promise<ScannerSettings> {
  try {
    return normalizeScannerSettings(JSON.parse((await AsyncStorage.getItem(SCANNER_SETTINGS_STORAGE_KEY)) ?? '{}'));
  } catch (error) {
    console.error('Error loading scanner settings:', error);
    return DEFAULT_SCANNER_SETTINGS;
  }
}

export async function saveScannerSettings(settings: ScannerSettings) {
  const normalized = normalizeScannerSettings(settings);
  await AsyncStorage.setItem(SCANNER_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
