import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCANNER_SETTINGS_STORAGE_KEY = 'scanner_operational_settings';

export interface ScannerSettings {
  videoIntervalSeconds: number;
  duplicateWindowSeconds: number;
  standardToastDurationSeconds: number;
  customToastDurationSeconds: number;
  gpsUpdateIntervalSeconds: number;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  videoIntervalSeconds: 1,
  duplicateWindowSeconds: 60,
  standardToastDurationSeconds: 1.5,
  customToastDurationSeconds: 2.5,
  gpsUpdateIntervalSeconds: 5,
};

function toValidSeconds(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 && numberValue <= 3_600 ? numberValue : fallback;
}

export function normalizeScannerSettings(value: unknown): ScannerSettings {
  const source = value && typeof value === 'object'
    ? value as Partial<ScannerSettings> & { toastDurationSeconds?: unknown }
    : {};
  return {
    videoIntervalSeconds: toValidSeconds(source.videoIntervalSeconds, DEFAULT_SCANNER_SETTINGS.videoIntervalSeconds),
    duplicateWindowSeconds: toValidSeconds(source.duplicateWindowSeconds, DEFAULT_SCANNER_SETTINGS.duplicateWindowSeconds),
    standardToastDurationSeconds: toValidSeconds(source.standardToastDurationSeconds, DEFAULT_SCANNER_SETTINGS.standardToastDurationSeconds),
    customToastDurationSeconds: toValidSeconds(source.customToastDurationSeconds ?? source.toastDurationSeconds, DEFAULT_SCANNER_SETTINGS.customToastDurationSeconds),
    gpsUpdateIntervalSeconds: toValidSeconds(source.gpsUpdateIntervalSeconds, DEFAULT_SCANNER_SETTINGS.gpsUpdateIntervalSeconds),
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
