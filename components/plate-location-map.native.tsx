import MapView, { Marker } from "react-native-maps";
import { StyleSheet } from "react-native";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type PlateLocationMapProps = {
  scannedLocation: Coordinate;
  originalLocation: Coordinate;
};

export function PlateLocationMap({
  scannedLocation,
  originalLocation,
}: PlateLocationMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: scannedLocation.latitude,
        longitude: scannedLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      <Marker
        coordinate={scannedLocation}
        title="Lugar de escaneo"
        pinColor="green"
      />
      <Marker
        coordinate={originalLocation}
        title="Ubicación original CSV"
        pinColor="red"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
