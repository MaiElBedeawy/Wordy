// React and React Native imports
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Alert, Image, Dimensions, ScrollView } from 'react-native';
// Navigation and other utilities
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Progress from 'react-native-progress';
import { FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import NetInfo from "@react-native-community/netinfo";
// Local assets and utils
import wordListData from './assets/wordlist/words.json';
import TapTouchableOpacity from './components/TapTouchableOpacity';
import { useSound } from './components/SoundContext';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, functions, httpsCallable } from './firebaseConfig';

// Function to save user progress, not currently used but defined
const saveProgress = async (userId, currentLevel, coins, completedLevels) => {
  try {
    await setDoc(doc(db, "userProgress", userId), {
      currentLevel,
      coins,
      completedLevels,
    });
  } catch (error) {
    console.error('Error saving progress:', error);
  }
};

export default function WordyLevels() {
  const { width, height } = Dimensions.get('window');
  const levelCircle = width/5;
  const navigation = useNavigation();
  const route = useRoute();
  // Sound setting from context
  const { isSoundEnabled } = useSound(); // Get the global sound state

  const [currentLevel, setCurrentLevel] = useState(1); // Current level the user is on
  const [completedLevels, setCompletedLevels] = useState([]); // List of completed levels
  const [showBoardSizeModal, setShowBoardSizeModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null); // Store selected level
  const [coins, setCoins] = useState(10);

  const [wordList, setWordList] = useState([]);

  const userId = route.params?.uid;

  // Start the game with selected board size
  const startGame = (size) => {
    setShowBoardSizeModal(false);
    navigation.navigate('ScrambledLetters', {
      boardSize: size,
      level: selectedLevel, // Use the selected level
      wordList,
      completeLevel,
      coins,
      setCoins,
      updateCoins: setCoins,
    });
  };

  // Define game types per level
  const levels = [
    { level: 1, game: 'Scrambled Letters' },
    { level: 2, game: 'Crosswords Craze' },
    { level: 3, game: 'Hangman Game' },
  ];

  // Cycle through game types for any level > 3
  const getGameForLevel = (level) => {
    const index = (level - 1) % levels.length; // Loop through the levels
    return levels[index].game;
  };

  // When a level is selected
  const handleLevelPress = (level) => {
    setSelectedLevel(level); // Store selected level
    const game = getGameForLevel(level);

    if (game === 'Scrambled Letters') {
      // Show board size modal for Scrambled Letters
      setShowBoardSizeModal(true);
    } else if (game === "HangmanGame") {
      navigation.navigate('HangmanGame', { wordList, coins, level, completeLevel, updateCoins: setCoins });
    } else {
      // Directly navigate to the game for other levels
      navigation.navigate(game.replace(/\s/g, ''), { level, game, wordList, completeLevel, coins, setCoins, updateCoins: setCoins, });
    }
  };
  // Mark level as completed and unlock next one
  const completeLevel = async (level) => {
    setCompletedLevels((prev) => {
      if (!prev.includes(level)) {
        const updatedLevels = [...prev, level];
        const nextLevel = level + 1;
        setCurrentLevel(nextLevel);

        setCoins((prevCoins) => {
          const newCoins = prevCoins; // Correctly adds coins for each level

          // Save locally
          // Save to AsyncStorage immediately
          AsyncStorage.setItem('completedLevels', JSON.stringify(updatedLevels));
          AsyncStorage.setItem('currentLevel', nextLevel.toString());
          AsyncStorage.setItem('coins', newCoins.toString());

          console.log("testing coins and levels before saving to firebase " + newCoins + " " + nextLevel);
          // Save progress remotely to Firebase, Save remotely
          handleSaveProgress(updatedLevels, nextLevel, newCoins);

          return newCoins; // Ensures React uses the updated coins value
        });

        return updatedLevels;
      }
      return prev;
    });
  };

  // Save progress to Firebase via Cloud Function
  const handleSaveProgress = async (completedLevels, currentLevel, coins) => {
    const saveProgressToCloud = httpsCallable(functions, 'saveUserProgress');
    const user = auth.currentUser;
    const effectiveUID = user ? user.uid : route.params?.uid; // fallback to guest UID from navigation

    try {
      const result = await saveProgressToCloud({
        currentLevel: currentLevel ?? 1,
        coins: coins ?? 10,
        completedLevels: completedLevels ?? [],
        uid: effectiveUID, // Send the UID explicitly
      });

      if (result.data.success) {
        console.log('Progress saved successfully!');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Load Levels progress from AsyncStorage on render
  useEffect(() => {
    const loadLevels = async () => {
      const storedLevels = await AsyncStorage.getItem('completedLevels');
      const storedCurrentLevel = await AsyncStorage.getItem('currentLevel');

      if (storedLevels !== null) {
        setCompletedLevels(JSON.parse(storedLevels)); // Convert string to array
      }
      if (storedCurrentLevel !== null) {
        setCurrentLevel(parseInt(storedCurrentLevel, 10));
      }
    };

    loadLevels();
  }, []);


  // Load coins from AsyncStorage
  useEffect(() => {
    const loadCoins = async () => {
      const storedCoins = await AsyncStorage.getItem('coins');
      if (storedCoins !== null) {
        setCoins(parseInt(storedCoins, 10)); // Convert to number
      }
    };

    loadCoins();
  }, []);
  // Save coin changes to storage
  useEffect(() => {
    if (coins !== null) {
      AsyncStorage.setItem('coins', coins.toString()); // Save coins whenever they change
    }
  }, [coins]);

  // Update coins if coming from another screen (daily puzzle)
  useEffect(() => {
    if (route.params?.newCoins !== undefined) {
      setCoins(route.params.newCoins); // Update UI
      AsyncStorage.setItem('coins', route.params.newCoins.toString()); // Save in AsyncStorage
    }
  }, [route.params?.newCoins]);

  useEffect(() => {
    if (userId) {
      setDoc(doc(db, "userProgress", userId), {
        currentLevel,
        coins,
        completedLevels,
      }).catch(console.error);
    }
  }, [currentLevel, coins, completedLevels]);
  // Also store progress in Firestore whenever state changes
  useEffect(() => {
    const loadUserProgress = async (userId) => {
      try {
        const docSnap = await getDoc(doc(db, "userProgress", userId));
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Set local state from Firebase data
          setCurrentLevel(data.currentLevel || 1);
          setCoins(data.coins || 10);
          setCompletedLevels(data.completedLevels || []);

          // Update AsyncStorage with Firebase data
          await AsyncStorage.setItem('currentLevel', (data.currentLevel || 1).toString());
          await AsyncStorage.setItem('coins', (data.coins || 10).toString());
          await AsyncStorage.setItem('completedLevels', JSON.stringify(data.completedLevels || []));

          console.log("🔥 Progress loaded successfully from Firebase!");
        } else {
          console.log("⚠️ No progress found in Firebase.");
        }
      } catch (error) {
        console.error("🚨 Error loading progress from Firebase:", error);
      }
    };

    if (auth.currentUser) {
      loadUserProgress(auth.currentUser.uid);
    }
  }, [auth.currentUser]);

  // Load words from local + Datamuse API if online
  useEffect(() => {
    // Load basic words locally on home page load
    setWordList(wordListData.words);
    // Fetch extra words from API if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        fetch('https://api.datamuse.com/words?ml=game')
          .then(response => response.json())
          .then(data => {
            const fetchedWords = data.map(item => item.word);
            setWordList((prevWords) => [...prevWords, ...fetchedWords]);
          })
          .catch(error => console.error('Error fetching words:', error));
      }
    });
  }, []);
  // Listen for navigation change to complete level (after finishing a game)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (route.params?.completedLevel) {
        completeLevel(route.params.completedLevel);
        navigation.setParams({ completedLevel: undefined }); // Reset after using
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.completedLevel]);

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        source={require('./assets/BackgroundImages/Wordy-WordyLevelsPage.mp4')}
        style={[styles.backgroundVideo, {width: width, height: height} ]}
        resizeMode="cover"
        shouldPlay
        isLooping
        isMuted
        rate={1.0}
        volume={1.0}
      />
      <Text style={styles.appName}>Wordy Levels</Text>
      {/* Display Coins */}
      <View style={styles.coinsContainer}>
        <FontAwesome name="money" size={24} color="#FFD700" />
        <Text style={styles.coinsText}>${coins}</Text>
      </View>
      {/* Overlay Content */}
      <View style={[styles.overlay, showBoardSizeModal && styles.dimBackground]}>
        {/*<View style={styles.levelsContainer}>*/}
        <ScrollView contentContainerStyle={[styles.levelsScrollContainer, {width: width/2} ]}>
          {Array.from({ length: 100 }).map((_, index) => {
            const level = index + 1;
            const isUnlocked = level === 1 || completedLevels.includes(level - 1);
            const isCompleted = completedLevels.includes(level);

            return (
              <TapTouchableOpacity
                isSoundEnabled={isSoundEnabled}
                key={level}
                style={[
                  styles.levelCircle,
                  {
                    backgroundColor: isCompleted
                      ? '#32CD32' // Completed
                      : isUnlocked
                      ? '#CCCCFF' // Unlocked
                      : '#555', // Locked
                    opacity: isUnlocked ? 1 : 0.5,
                    width: levelCircle,
                    height: levelCircle,
                    borderRadius: levelCircle/2,
                  },
                ]}
                disabled={!isUnlocked} // Disable button if the level is locked
                onPress={() => handleLevelPress(level)}
              >
                <Text style={[styles.levelText, { color: isUnlocked ? '#000' : '#fff' }]}>
                  Level {level}
                </Text>
              </TapTouchableOpacity>
            );
          })}
        {/*</View>*/}
        </ScrollView>
      </View>
      {/* Board Size Selection Modal */}
      <Modal
        transparent={true}
        visible={showBoardSizeModal}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Select Board Size</Text>
            <TapTouchableOpacity onPress={() => startGame('small')} style={styles.modalButton} isSoundEnabled={isSoundEnabled}>
              <Text style={styles.modalButtonText}>Small</Text>
            </TapTouchableOpacity>
            <TapTouchableOpacity onPress={() => startGame('medium')} style={styles.modalButton} isSoundEnabled={isSoundEnabled}>
              <Text style={styles.modalButtonText}>Medium</Text>
            </TapTouchableOpacity>
            <TapTouchableOpacity onPress={() => startGame('large')} style={styles.modalButton} isSoundEnabled={isSoundEnabled}>
              <Text style={styles.modalButtonText}>Large</Text>
            </TapTouchableOpacity>
            <TapTouchableOpacity onPress={() => startGame('timed')} style={styles.modalButton} isSoundEnabled={isSoundEnabled}>
              <Text style={styles.modalButtonText}>Timed Challenge</Text>
            </TapTouchableOpacity>
            <TapTouchableOpacity onPress={() => setShowBoardSizeModal(false)} style={[styles.modalButton, { backgroundColor: '#ff4d4d' }]} isSoundEnabled={isSoundEnabled}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TapTouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </View>
  );
}
// Styles for WordyLevels page
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    position: 'relative',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dimBackground: {
    opacity: 0.5,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  coinsText: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  levelsScrollContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width:  '30%',
  },
  levelCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
    elevation: 3,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameText: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#0092FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
