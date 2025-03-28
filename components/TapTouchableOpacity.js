// Import necessary modules from React and React Native
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';

// Custom TouchableOpacity wrapper that plays a tap sound when pressed
const TapTouchableOpacity = ({ onPress, isSoundEnabled, children, ...props }) => {
  // Function to play the tap sound
  const playTapSound = async () => {
    if (!isSoundEnabled) return; // Do not play sound if disabled

    try {
      // Load and play the tap sound
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/tapSound.wav') // Sound file to play
      );
      await sound.playAsync(); // Play the loaded sound
    } catch (error) {
      // Log any errors that occur during sound playback
      console.error("Error playing tap sound:", error);
    }
  };

  // Render the TouchableOpacity with sound and press handling
  return (
    <TouchableOpacity
      {...props}
      onPress={async () => {
        await playTapSound();
        if (onPress) onPress();
      }}
    >
      {children}
    </TouchableOpacity>
  );
};

// Export the component for use in the app
export default TapTouchableOpacity;
