// React and React Native imports
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import * as Progress from 'react-native-progress';
import { FontAwesome } from '@expo/vector-icons';
import { Video, Audio } from 'expo-av';
import NetInfo from "@react-native-community/netinfo";
import wordListData from './assets/wordlist/words.json';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import TapTouchableOpacity from './components/TapTouchableOpacity';
import { useSound } from './components/SoundContext'; // Import the hook
import { getAuth, FacebookAuthProvider, signInWithCredential } from 'firebase/auth';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { doc, setDoc } from 'firebase/firestore';
import { functions, httpsCallable, db } from './firebaseConfig';

// Automatically completes Facebook auth sessions
WebBrowser.maybeCompleteAuthSession();
// Facebook App ID and OAuth discovery endpoint
const FB_APP_ID = "1903570507054840";

const discovery = {
  authorizationEndpoint: 'https://www.facebook.com/v16.0/dialog/oauth',
};

// Preloads background videos for performance
const preloadAssets = async () => {
  const videoAsset = Asset.fromModule(require('./assets/BackgroundImages/Wordy_HomePage.mp4')).downloadAsync();
  const videoAsset2 = Asset.fromModule(require('./assets/BackgroundImages/Wordy-WordyLevelsPage.mp4')).downloadAsync();
  return Promise.all([
    videoAsset,
    videoAsset2
  ]);
};

export default function HomePage() {

  const [wordList, setWordList] = useState([]);
  const [showBoardSizeModal, setShowBoardSizeModal] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();

  // UI state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // Music settings
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);  // Default music is ON
  // Sound from global context
  const { isSoundEnabled, setIsSoundEnabled } = useSound(); // Get sound state
  // User and game state
  const [uid, setUid] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const auth = getAuth();

  const [dailyPuzzle, setDailyPuzzle] = useState(null); // Stores today's puzzle
  const [puzzleCompleted, setPuzzleCompleted] = useState(false); // Tracks if user has solved the puzzle
  const [coins, setCoins] = useState(10);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

 // Facebook login request
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: FB_APP_ID,
      scopes: ['public_profile', 'email'],
      redirectUri: 'https://auth.expo.io/@maielbedeawy/Wordy',
    },
    {
      authorizationEndpoint: 'https://www.facebook.com/v16.0/dialog/oauth',
    },
  );

  // Navigate to Scrambled Letters with selected board size
  const startGame = (size) => {
    setShowBoardSizeModal(false);
    navigation.navigate('ScrambledLetters', { boardSize: size, wordList });
  };

  // Load background music
  const playBackgroundMusic = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/sounds/background2.wav'),
        { isLooping: true, volume: 0.5 }
      );
      setBackgroundMusic(sound);
      await sound.playAsync();
    } catch (error) {
      console.error("Error loading background music:", error);
    }
  };

  // Shuffle puzzle options and return one
  const getRandomPuzzle = () => {
    const puzzles = ['ScrambledLetters', 'CrosswordsCraze', 'HangmanGame'];

    // Shuffle for randomness
    for (let i = puzzles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
    }

    return puzzles[0]; //Picking the first puzzle after shuffle
  };


  // Load or create today's daily puzzle
  const checkDailyPuzzle = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storedPuzzleData = await AsyncStorage.getItem('dailyPuzzle');

      if (storedPuzzleData) {
        const { date, puzzle, completed } = JSON.parse(storedPuzzleData);

        if (date === today) {
          setDailyPuzzle(puzzle);
          setPuzzleCompleted(completed);
          return;
        }
      }

      // Pick a new puzzle for today
      const newPuzzle = getRandomPuzzle();
      await AsyncStorage.setItem('dailyPuzzle', JSON.stringify({ date: today, puzzle: newPuzzle, completed: false }));
      setDailyPuzzle(newPuzzle);
      setPuzzleCompleted(false);
    } catch (error) {
      console.error("Error setting daily puzzle:", error);
    }
  };

  // Called when user finishes daily puzzle
  const completeDailyPuzzle = async () => {
    try {
      const storedPuzzleData = await AsyncStorage.getItem('dailyPuzzle');
      if (storedPuzzleData) {
        const { date, puzzle } = JSON.parse(storedPuzzleData);
        await AsyncStorage.setItem('dailyPuzzle', JSON.stringify({ date, puzzle, completed: true }));

        // Fetch and update coin balance
        const storedCoins = await AsyncStorage.getItem('coins');
        const newCoinBalance = (storedCoins ? parseInt(storedCoins, 10) : 10) + 10; // Add 10 coins for winning
        await AsyncStorage.setItem('coins', newCoinBalance.toString()); // Save new balance

        setCoins(newCoinBalance); // Update local state

        // Now save progress remotely to Firebase as well
        // handleSaveProgressToFirebase(newCoinBalance, puzzle, date);
        const currentLevel = await AsyncStorage.getItem('currentLevel');
        const completedLevels = await AsyncStorage.getItem('completedLevels');
        console.log("Amount of coins: " + newCoinBalance);
        handleSaveProgressToFirebase(completedLevels, currentLevel, newCoinBalance);

        await AsyncStorage.setItem('dailyPuzzle', JSON.stringify({ date, puzzle, completed: true }));

        Alert.alert(
          "Congratulations!",
          "You solved today's puzzle! 🎉 You won an extra 10 Coins!",
          [
            {
              text: "OK",
              onPress: () => {
                if (navigation.canGoBack()) {
                  navigation.navigate("WordyLevels", { newCoins: newCoinBalance }); // Pass updated coins
                }
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error completing puzzle:", error);
    }
  };


  // Handle daily puzzle start
  const calendarPressHandler = async () => {
    if (!dailyPuzzle) {
      console.error("Daily puzzle not set yet.");
      Alert.alert("Please wait!", "Today's puzzle is still loading.");
      return;
    }

    if (puzzleCompleted) {
      Alert.alert("Come again tomorrow!", "A new puzzle will be available tomorrow.");
      return;
    }

    console.log("Navigating to daily puzzle:", dailyPuzzle);

    try {
      const storedCoins = await AsyncStorage.getItem('coins');
      const latestCoins = storedCoins ? parseInt(storedCoins, 10) : 10;

      navigation.navigate(dailyPuzzle, {
        boardSize: "large",
        wordList,
        completeLevel: completeDailyPuzzle,
        coins: latestCoins, // freshest value
        updateCoins: (newVal) => {
          AsyncStorage.setItem('coins', newVal.toString());
          setCoins(newVal);
        },
        setCoins: setCoins,
      });
    } catch (error) {
      console.error("Error reading coins before puzzle:", error);
    }

  };

  // Save daily progress to Firestore via cloud function
  const handleSaveProgressToFirebase = async (completedLevels, currentLevel, coins) => {
    const saveProgressToCloud = httpsCallable(functions, 'saveUserProgress');
    const user = auth.currentUser;
    const effectiveUID = userInfo ? user?.uid : uid;

    console.log("Saving progress for UID:", effectiveUID);

    try {
      let currentLevelStr = await AsyncStorage.getItem('currentLevel');
      let parsedLevel = parseInt(currentLevelStr, 10);
      if (isNaN(parsedLevel)) parsedLevel = 1; // fallback

      const completedLevelsStr = await AsyncStorage.getItem('completedLevels');
      let parsedCompletedLevels = [];
      try {
        parsedCompletedLevels = completedLevelsStr ? JSON.parse(completedLevelsStr) : [];
      } catch (err) {
        console.warn("Failed to parse completedLevels:", err);
      }

      const result = await saveProgressToCloud({
        currentLevel: parsedLevel,
        coins: coins ?? 10,
        completedLevels: parsedCompletedLevels,
        uid: effectiveUID, // Send the UID explicitly
      });

      console.log(result);

      if (result.data.success) {
        console.log('Progress saved successfully!');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Preload assets
  useEffect(() => {
    const loadAssets = async () => {
      await preloadAssets();
      setAssetsLoaded(true);
    };
    loadAssets();
  }, []);

  // Generate guest UID if no login
  useEffect(() => {
    const initGuestId = async () => {
      let id = await AsyncStorage.getItem('guestUID');
      if (!id) {
        id = 'guest_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('guestUID', id);
        console.log("Generated new guest UID:", id);
      } else {
        console.log("Loaded guest UID from storage:", id);
      }
      setUid(id); // Save to app state
    };
    initGuestId();
  }, []);


  // Facebook login success handler
  useEffect(() => {
    if (response?.type === 'success') {
      console.log("Login success");
      const { access_token } = response.params;
      const credential = FacebookAuthProvider.credential(access_token);
      signInWithCredential(auth, credential)
        .then(result => {
          const uid = result.user.uid;
          fetch(`https://graph.facebook.com/me?fields=id,name,picture.width(300)&access_token=${access_token}`)
            .then(response => response.json())
            .then(data => {
              setUserInfo({
                name: data.name,
                picture: data.picture.data.url,
              });
            })
            .catch(error => {
              console.error('Error fetching Facebook profile:', error);
            });
        })
        .catch(err => Alert.alert('Firebase Auth Error', err.message));
    }
    else {
      console.log("Login to FB failed");
    }
  }, [response]);

  // REMOVE AFTER TESTING ------------------- Resetting the daily puzzle to make it not daily during testing the app
  // TEMP: Reset daily puzzle during testing. I am Leaving it for testing purposes
  // COMMENT THIS IF YOU WANT TO MAKE THE DAILY PUZZLES SOLVES ONLY ONCE PER DAY
  useEffect(() => {
    const clearDailyPuzzle = async () => {
      await AsyncStorage.removeItem('dailyPuzzle'); // Clears stored puzzle
      console.log("Daily puzzle storage cleared!");
    };

    clearDailyPuzzle();
  }, []);
  // ---------------------------------------------------

  // Load level and coin data from local storage
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

  useEffect(() => {
    if (route.params?.newLevels !== undefined) {
      setCompletedLevels(route.params.newLevels);
      AsyncStorage.setItem('completedLevels', JSON.stringify(route.params.newLevels));
    }

    if (route.params?.newCurrentLevel !== undefined) {
      setCurrentLevel(route.params.newCurrentLevel);
      AsyncStorage.setItem('currentLevel', route.params.newCurrentLevel + '');
    }
  }, [route.params?.newLevels, route.params?.newCurrentLevel]);

  // Reload coins if passed from another screen
  useEffect(() => {
    const loadCoins = async () => {
      const storedCoins = await AsyncStorage.getItem('coins');
      if (storedCoins !== null) {
        setCoins(parseInt(storedCoins, 10)); // Load saved coins
      }
    };

    loadCoins();
  }, [route.params?.newCoins]);

  // REMOVE BEFORE PUBLISING ----------------------------------- Resetting user progress when running the app again to test
  // TEMP: Reset user progress during testing
  // COMMENT THIS IF U WANT THE USER PROGRESS AND COINS NOT TO BE RESTARTED EVERYTIME YOU RUN THE PROJECT
  useEffect(() => {
    const resetCoinsForTesting = async () => {
      await AsyncStorage.setItem('coins', '10'); // Reset coins to 10 on every Expo restart
      setCoins(10);
      console.log("🚀 Coins reset to 10 (Testing Mode)");
    };

    resetCoinsForTesting(); // Call the function on app start
  }, []);

  useEffect(() => {
    const resetUserProgress = async () => {
      await AsyncStorage.removeItem('completedLevels'); // Remove completed levels
      await AsyncStorage.removeItem('currentLevel'); // Remove current level
      await AsyncStorage.setItem('coins', '10'); // Reset coins to 10
      console.log("🚀 User progress reset on app restart!");
    };

    resetUserProgress(); // Run reset function when the app starts
  }, []);

  // ----------------------------------

  // Debug Expo redirect URI
  useEffect(() => {
    const redirectUri = makeRedirectUri({ useProxy: true });
    console.log('Exact Expo redirect URI:', redirectUri);
  }, []);

  // Play music when app starts
  useEffect(() => {
    playBackgroundMusic();  // Start music on app launch

    return () => {
      if (backgroundMusic) {
        backgroundMusic.stopAsync();  // Stop music when unmounting
      }
    };
  }, []);

  // Load daily puzzle on mount
  useEffect(() => {
    checkDailyPuzzle(); // Ensure this runs before interacting with the calendar icon
  }, []);

  // Load and augment word list
  useEffect(() => {
    setWordList(
      wordListData.words
        .filter(word =>
          /^[a-zA-Z]+$/.test(word) && // only alphabetic
          (word === word.toLowerCase()) // only fully lowercase
        )
        .map(word => word.toLowerCase()) // convert to lowercase
    );


    // Fetch extra words from API if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        fetch('https://api.datamuse.com/words?ml=game')
          .then(response => response.json())
          .then(data => {
            const fetchedWords = data
              .map(item => item.word)
              .filter(word => /^[a-zA-Z]+$/.test(word))  // Filter valid words
              .map(word => word.toLowerCase());          // Convert to lowercase

            setWordList((prevWords) => [...prevWords, ...fetchedWords]);
          })
          .catch(error => console.error('Error fetching words:', error));
      }
    });
  }, []);

  // RENDER COMPONENT
  return (
    <View style={styles.container}>

      {/* Video Background */}
      {assetsLoaded && (
        <Video
          source={require('./assets/BackgroundImages/Wordy_HomePage.mp4')}
          style={styles.backgroundVideo}
          resizeMode="cover"
          shouldPlay
          isLooping
          isMuted
          rate={1.0}
          volume={1.0}
        />
      )}

      {/* Showing user info if logged in */}
      {userInfo && (
        <View style={styles.profilePicContainer}>
          <Image source={{ uri: userInfo.picture }} style={styles.profilePic} />
        </View>
      )}

      {/* Overlay Content */}
      <View style={[styles.overlay, showBoardSizeModal && styles.dimBackground]}>
        {/* App Name */}
        <Text style={styles.appName}> </Text>
        {/* Instruction Text */}
        <Text style={styles.instructionText}> </Text>

        {/* Game Options */}
        <View style={styles.gameOptionsContainer}>
          <TapTouchableOpacity style={styles.gameCircle}
            isSoundEnabled={isSoundEnabled}
            onPress={() => navigation.navigate('WordyLevels', { coins, setCoins, uid })}
          >
            <Text style={styles.gameText}>Begin</Text>
          </TapTouchableOpacity>
        </View>

        {/* Footer Bar */}
        <View style={styles.footerBar}>
          <TapTouchableOpacity style={styles.footerIconContainer} isSoundEnabled={isSoundEnabled} onPress={() => setShowSettingsModal(true)}>
            <Image source={require('./assets/FootbarIcons/settings.png')} style={styles.footerIcon} />
          </TapTouchableOpacity>
          <TapTouchableOpacity style={styles.footerIconContainer} isSoundEnabled={isSoundEnabled} onPress={() => {
                                                                                                                  promptAsync()
                                                                                                                  }}>
            <Image source={require('./assets/FootbarIcons/fb.png')} style={styles.footerIcon} />
          </TapTouchableOpacity>
          <TapTouchableOpacity style={styles.footerIconContainer} isSoundEnabled={isSoundEnabled} onPress={() => {calendarPressHandler()}}>
            <Image source={require('./assets/FootbarIcons/calendar.png')} style={styles.footerIcon} />
          </TapTouchableOpacity>
          <TapTouchableOpacity style={styles.footerIconContainer} isSoundEnabled={isSoundEnabled}>
            <Image source={require('./assets/FootbarIcons/notification.png')} style={styles.footerIcon} />
          </TapTouchableOpacity>
        </View>
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


      {/* Settings Modal */}
      <Modal transparent={true} visible={showSettingsModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Settings</Text>

            {/* Toggle Music */}
            <TapTouchableOpacity
              onPress={async () => {
                if (isMusicPlaying) {
                  await backgroundMusic.pauseAsync();  // Pause if playing
                } else {
                  await backgroundMusic.playAsync();  // Resume if paused
                }
                setIsMusicPlaying(!isMusicPlaying);
              }}
              style={[styles.modalButton, isMusicPlaying ? styles.enabled : styles.disabled]}
              isSoundEnabled={isSoundEnabled}
            >
              <Text style={styles.modalButtonText}>
                {isMusicPlaying ? "Music: On 🎵" : "Music: Off 🔇"}
              </Text>
            </TapTouchableOpacity>

            {/* Toggle Sound */}
            <TapTouchableOpacity
              style={[styles.modalButton, isSoundEnabled ? styles.enabled : styles.disabled]}
              onPress={() => setIsSoundEnabled(!isSoundEnabled)}
            >
              <Text style={styles.modalButtonText}>
                {isSoundEnabled ? "Sound: On 🔊" : "Sound: Off 🔕"}
              </Text>
            </TapTouchableOpacity>


            {/* Toggle Notifications */}
            <TapTouchableOpacity
              onPress={() => setNotificationsEnabled(!notificationsEnabled)}
              style={[styles.modalButton, notificationsEnabled ? styles.enabled : styles.disabled]}
              isSoundEnabled={isSoundEnabled}
            >
              <Text style={styles.modalButtonText}>{notificationsEnabled ? "Notifications: On 🔔" : "Notifications: Off 🚫"}</Text>
            </TapTouchableOpacity>

            {/* Close Button */}
            <TapTouchableOpacity
              onPress={() => setShowSettingsModal(false)}
              style={[styles.modalButton, { backgroundColor: '#ff4d4d' }]}
              isSoundEnabled={isSoundEnabled}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TapTouchableOpacity>
          </View>
        </View>
      </Modal>


      <StatusBar style="auto" />
    </View>
  );
}

// Styles for HomePage
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dimBackground: {
    opacity: 0.5,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  instructionText: {
    fontSize: 20,
    marginVertical: 20,
    color: '#32CD32',
    fontFamily: 'Lazydog',
  },
  gameOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  gameCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#CCCCFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  gameText: {
    textAlign: 'center',
    fontSize: 14,
  },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#CCCCFF',
    paddingVertical: 10,
  },
  footerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerIcon: {
    width: 35,
    height: 35,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 100, 0.5)',
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
  enabled: {
    backgroundColor: '#32CD32', // Green for enabled
  },
  disabled: {
    backgroundColor: '#555', // Gray for disabled
  },
  profilePicContainer: {
    position: 'absolute',
    top: 40,
    right: 15,
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
});
