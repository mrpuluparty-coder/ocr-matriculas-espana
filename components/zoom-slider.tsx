import React, { useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';

interface ZoomSliderProps {
  zoom: number;
  setZoom: (value: number) => void;
}

export function ZoomSlider({ zoom, setZoom }: ZoomSliderProps) {
  const [sliderHeight] = useState(150);
  const zoomMultiplier = 1 + zoom * 3; // 0 = 1x, 1 = 4x

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newZoom = Math.max(0, Math.min(1, zoom - gestureState.dy / sliderHeight));
        setZoom(newZoom);
      },
    })
  ).current;

  const thumbPosition = zoom * sliderHeight;

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{zoomMultiplier.toFixed(1)}x</Text>
      </View>
      <View
        style={[styles.sliderTrack, { height: sliderHeight }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.filledTrack, { height: thumbPosition }]} />
        <View style={[styles.thumb, { top: thumbPosition - 8 }]} />
      </View>
      <View style={styles.rangeLabels}>
        <Text style={styles.rangeLabel}>1x</Text>
        <Text style={styles.rangeLabel}>4x</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    top: 100,
    width: 60,
    zIndex: 10,
    alignItems: 'center',
    gap: 8,
  },
  labelContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  label: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sliderTrack: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    position: 'relative',
  },
  filledTrack: {
    width: '100%',
    backgroundColor: '#0a7ea4',
    borderRadius: 3,
  },
  thumb: {
    width: 20,
    height: 20,
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    marginLeft: -7,
  },
  rangeLabels: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 8,
  },
  rangeLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginVertical: 4,
  },
});
