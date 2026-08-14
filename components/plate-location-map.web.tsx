import { StyleSheet, Text, View } from "react-native";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type PlateLocationMapProps = {
  scannedLocation: Coordinate;
  originalLocation: Coordinate;
};

function formatCoordinate({ latitude, longitude }: Coordinate) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function PlateLocationMap({
  scannedLocation,
  originalLocation,
}: PlateLocationMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ubicaciones de la detección</Text>
      <View style={[styles.locationCard, styles.scannedCard]}>
        <Text style={styles.locationTitle}>● Escaneo actual</Text>
        <Text style={styles.locationValue}>{formatCoordinate(scannedLocation)}</Text>
      </View>
      <View style={[styles.locationCard, styles.originalCard]}>
        <Text style={styles.locationTitle}>● Ubicación original CSV</Text>
        <Text style={styles.locationValue}>{formatCoordinate(originalLocation)}</Text>
      </View>
      <Text style={styles.note}>
        El mapa interactivo está disponible en la aplicación Android compilada.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#11181C",
    marginBottom: 20,
  },
  locationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  scannedCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  originalCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  locationTitle: {
    color: "#11181C",
    fontSize: 15,
    fontWeight: "700",
  },
  locationValue: {
    color: "#475569",
    fontSize: 14,
    marginTop: 6,
  },
  note: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
});
