// React and React Native imports
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import * as Progress from 'react-native-progress';
import 'react-native-gesture-handler';
// Navigation packages
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
// Pages (Screens)
import HomePage from './HomePage'; // Import the Home Page component
import ScrambledLetters from './ScrambledLetters'; // Import the ScrambledLetters page
import WordyLevels from './WordyLevels'; // Import the WordyLevels page
import CrosswordsCraze from './CrosswordsCraze'; // Import the CrosswordsCraze page
import HangmanGame from './HangmanGame'; // Import the HangmanGame page
// Firebase + Expo AuthSession
import * as AuthSession from 'expo-auth-session';
import { auth } from './firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
// Context for global sound state
import { SoundProvider } from './components/SoundContext'; // Import SoundProvider

// Create the stack navigator
const Stack = createStackNavigator();

// The main functional component of the app
export default function App() {
  // Tracks whether the app is currently loading (true) when the loading bar is displayed
  // and false once the loading is complete
  const [isLoading, setIsLoading] = useState(true);
  // Tracks the progress of the loading bar, initially set at 0 (0%)
  const [progress, setProgress] = useState(0);

  // Logs the redirect URI used in Facebook login (only logs once)
  useEffect(() => {
    const uri = AuthSession.makeRedirectUri({ useProxy: true });
    console.log("Expo Proxy Redirect URI:", uri);
  }, []);

  // Handles anonymous sign-in if the user isn't already authenticated
  useEffect(() => {
    onAuthStateChanged(auth, user => {
      if (!user) {
        // Not signed in, sign in anonymously
        signInAnonymously(auth)
          .then(() => console.log('Signed in anonymously'))
          .catch(err => console.error('Anonymous sign-in failed:', err));
      } else {
        // Already logged in, just show UID
        console.log('Already logged in:', user.uid);
      }
    });
  }, []);

  // Fake loading screen (updates every 300ms until progress reaches 1)
  useEffect(() => {
    // Simulate a loading time
    const interval = setInterval(() => {
      // Update the progress value by adding 0.1 until it reaches 1 (100%)
      setProgress((prevProgress) => {
        // If progress reaches or exceeds 1, it clears the interval
        // and set isLoading to false, indicating the loading is complete
        if (prevProgress >= 1) {
          clearInterval(interval);
          setIsLoading(false); // Done loading, show app
          return 1;
        }
        return prevProgress + 0.1;
      });
    }, 300); // Increment every 300ms

    // Clearing the interval to avoid memory leaks
    return () => clearInterval(interval);
  }, []);

  // If isLoading is true, it renders the loading screen
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {/* Displaying the app name */}
        <Text style={styles.appName}>Wordy</Text>
        {/* The Progress.Bar shows the progress visually based on the progress state
           as progress prop represents the current loading progress (between 0-1) */}
        <Progress.Bar progress={progress} width={200} color="black" />
        {/* Displaying the loading text */}
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  // Once the loading is over, it displays the main App UI
  return (
    <SoundProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          {/* Home screen */}
          <Stack.Screen
            name="Home"
            component={HomePage}
            options={{ headerShown: false }}
          />
          {/* Game screens */}
          <Stack.Screen
            name="ScrambledLetters"
            component={ScrambledLetters}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WordyLevels"
            component={WordyLevels}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CrosswordsCraze"
            component={CrosswordsCraze}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="HangmanGame"
            component={HangmanGame}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SoundProvider>
  );
}

// Styles for splash screen
const styles = StyleSheet.create({
  // Style the appearance of the loading screen
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Styling the app name
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#FF3333',
    letterSpacing: 7,
  },
});
