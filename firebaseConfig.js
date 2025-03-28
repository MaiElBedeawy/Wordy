// Import necessary Firebase modules
// Initializes the Firebase app
import { initializeApp } from 'firebase/app';
// Firebase Auth setup with persistence for React Native
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
// Firestore for database access
import { getFirestore } from 'firebase/firestore';
// Cloud Functions support
import { getFunctions, httpsCallable } from 'firebase/functions';
// AsyncStorage for persisting auth state in React Native
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Firebase project configuration
const firebaseConfig = {
  // API Key for Firebase
  apiKey: "AIzaSyC9DHRpQOC5aRcTktTXXVhNjFgD6biyjIk",
  // Auth domain for web use
  authDomain: "wordy-d48f2.firebaseapp.com",
  // Firebase project ID
  projectId: "wordy-d48f2",
  // Storage bucket for file uploads (not used here but required)
  storageBucket: "wordy-d48f2.appspot.com",
  // Messaging sender ID (for notifications)
  messagingSenderId: "455341770822",
  // App ID for Firebase project
  appId: "1:455341770822:web:cb6eea8e50b67d2445e247",
};

// Initialize Firebase app instance
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and enable persistence using AsyncStorage (React Native compatible)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore database
const db = getFirestore(app);

// Initialize Firebase Cloud Functions
const functions = getFunctions(app);

// Export all initialized modules to be used across the app
export { db, auth, functions, httpsCallable };
