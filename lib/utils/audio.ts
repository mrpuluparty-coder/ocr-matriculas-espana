import { Audio } from 'expo-av';

export const playSound = async (soundAsset: any) => {
  try {
    const { sound } = await Audio.Sound.createAsync(soundAsset);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        await sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

