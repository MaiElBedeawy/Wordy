// Import required dependencies and libraries
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { useSound } from './components/SoundContext';
import NetInfo from "@react-native-community/netinfo";
import localWordList from './assets/wordlist/CrosswordsPuzzles.json';

// Hangman Game Component
const HangmanGame = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isSoundEnabled } = useSound();
  const { level, coins: initialCoins = 10, completeLevel, updateCoins } = route.params || {};

  // State variables
  const [word, setWord] = useState('');
  const [clue, setClue] = useState('');
  const [hiddenWord, setHiddenWord] = useState([]);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [coins, setCoins] = useState(initialCoins);
  // max allowed wrong guesses
  const maxAttempts = 6;

  // Load a word and clue either online or offline
  useEffect(() => {
    const loadWord = async () => {
      const isConnected = (await NetInfo.fetch()).isConnected;
      let words = [];

      if (isConnected) {
        words = await getWordsWithClues();
      } else {
        words = localWordList.words;
      }

      const randomWordObj = words[Math.floor(Math.random() * words.length)];
      const selectedWord = randomWordObj.answer.toUpperCase();
      const selectedClue = randomWordObj.clue;

      setWord(selectedWord);
      setClue(selectedClue);
      setHiddenWord(Array(selectedWord.length).fill('_'));
    };

    loadWord();
  }, []);

  // Fetch words related to "fun" from Datamuse API
  const fetchDatamuseWords = async () => {
    const response = await fetch('https://api.datamuse.com/words?ml=fun&max=50');
    const data = await response.json();

    const shuffledData = data.sort(() => Math.random() - 0.5);

    return shuffledData.slice(0, 10).map(item => item.word);
  };

  // Get definitions from dictionary API
  const fetchDefinition = async (word) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0 || !data[0]?.meanings) return null;
      return data[0].meanings[0]?.definitions[0]?.definition || null;
    } catch (error) {
      return null;
    }
  };

  // Combine word + clue
  const getWordsWithClues = async () => {
    const words = await fetchDatamuseWords();
    const result = [];

    for (const word of words) {
      const clue = await fetchDefinition(word);
      if (clue) result.push({ answer: word.toUpperCase(), clue });
    }

    return result;
  };

  // Handle user guessing a letter
  const handleLetterPress = (letter) => {
    if (guessedLetters.includes(letter)) return;

    setGuessedLetters([...guessedLetters, letter]);

    if (word.includes(letter)) {
      const updatedHiddenWord = hiddenWord.map((char, index) => (word[index] === letter ? letter : char));
      setHiddenWord(updatedHiddenWord);

      // Win condition
      if (!updatedHiddenWord.includes('_')) {
        const updatedCoins = coins + 10;
        Alert.alert('Congratulations!', 'You won 10 Coins!', [
          { text: 'OK', onPress: () => {
                          updateCoins(updatedCoins);
                          completeLevel(level);
                          navigation.goBack();
                        }
          }
        ]);
      }
    } else {
      setWrongGuesses(wrongGuesses + 1);
      if (wrongGuesses + 1 >= maxAttempts) {
        Alert.alert('Game Over', `The word was: ${word}`, [
          { text: 'Try Again', onPress: () =>
                                navigation.goBack()
          }
        ]);
      }
    }
  };

  // Use a hint to reveal one letter
  const useHint = () => {
    if (coins < 5) return Alert.alert('Not enough coins!');

    const hiddenIndices = hiddenWord.map((char, index) => (char === '_' ? index : null)).filter(index => index !== null);
    if (hiddenIndices.length === 0) return;

    const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    const revealedLetter = word[randomIndex];

    const updatedHiddenWord = [...hiddenWord];
    updatedHiddenWord[randomIndex] = revealedLetter;
    setHiddenWord(updatedHiddenWord);

    const updatedCoins = coins - 5;
    setCoins(updatedCoins);
    updateCoins(updatedCoins); // Also update global coins

  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Hangman</Text>

      {/* Hangman Gallows */}
      <View style={styles.gallowsContainer}>
        <View style={styles.topBeam} />
        <View style={styles.verticalSupport1} />
        <View style={styles.verticalSupport2} />
        <View style={styles.bottomNotch} />

        {/* The hangman */}
        {wrongGuesses > 0 && <View style={styles.head} />}
        {wrongGuesses > 1 && <View style={styles.body} />}
        {wrongGuesses > 2 && <View style={styles.leftArm} />}
        {wrongGuesses > 3 && <View style={styles.rightArm} />}
        {wrongGuesses > 4 && <View style={styles.leftLeg} />}
        {wrongGuesses > 5 && <View style={styles.rightLeg} />}
      </View>

      {/* Clue */}
      <Text style={styles.clue}>Clue: {clue}</Text>

      {/* Hidden Word */}
      <Text style={styles.word}>{hiddenWord.join(' ')}</Text>

      {/* Letter Buttons */}
      <View style={styles.lettersContainer}>
        {'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map((letter) => {
          const isGuessed = guessedLetters.includes(letter);
          const isWrong = isGuessed && !word.includes(letter);

          return (
            <TouchableOpacity
              key={letter}
              style={[
                styles.letterButton,
                isGuessed && styles.guessedButton,
                isWrong && styles.wrongLetterButton,
              ]}
              onPress={() => handleLetterPress(letter)}
              disabled={isGuessed} // disable after one guess
            >
              <Text style={[
                styles.letter,
                isWrong && styles.wrongLetterText
              ]}>
                {letter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>


      {/* Hint Button & Coins */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.hintButton} onPress={useHint}>
          <FontAwesome name="lightbulb-o" size={24} color="yellow" />
          <Text style={styles.hintText}>Hint $5</Text>
        </TouchableOpacity>
        <Text style={styles.coinsText}>${coins}</Text>
      </View>
    </View>
  );
};

// Styles for the Hangman UI
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#222',
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    marginBottom: 10,
  },
  clue: {
    fontSize: 18,
    color: '#ffcc00',
    marginBottom: 20,
  },
  word: {
    fontSize: 30,
    letterSpacing: 8,
    color: '#fff',
    marginBottom: 20,
  },
  hangman: {
    fontSize: 40,
    marginBottom: 20,
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  letterButton: {
    margin: 5,
    padding: 10,
    backgroundColor: '#444',
    borderRadius: 5,
  },
  letter: {
    fontSize: 20,
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    alignItems: 'center',
    marginTop: 20,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#555',
    padding: 10,
    borderRadius: 5,
  },
  hintText: {
    color: 'yellow',
    marginLeft: 5,
  },
  coinsText: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#555',
    padding: 10,
    borderRadius: 5,
    fontSize: 20,
    color: 'yellow',
    marginright: 5,
  },
  gallowsContainer: {
    left: 100,
    alignItems: 'center',
    marginVertical: 20,
  },
  topBeam: {
    width: 80,          // Length of the top beam
    height: 4,          // Thickness of the line
    backgroundColor: '#fff',
  },
  verticalSupport2: {
    width: 4,
    height: 120,        // 1.5 times the length of the top beam (80 * 1.5 = 120)
    backgroundColor: '#fff',
    left: 38,
    top: -20,
  },
  bottomNotch: {
    width: 15,
    height: 4,
    backgroundColor: '#fff',
    left: 38,
    top: -20,
  },
  verticalSupport1: {
    width: 4,
    height: 20,
    backgroundColor: '#fff',
    right: 38,
  },
  head: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#fff',
    position: 'absolute',
    top: 20,
    right: 62.5,
  },
  body: {
    width: 4,
    height: 40,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 50,
    right: 75,
  },
  leftArm: {
    width: 30,
    height: 4,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 60,
    right: 74,
    transform: [{ rotate: '-45deg' }],
  },
  rightArm: {
    width: 30,
    height: 4,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 60,
    right: 50,
    transform: [{ rotate: '45deg' }],
  },
  leftLeg: {
    width: 30,
    height: 4,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 95,
    right: 74,
    transform: [{ rotate: '-45deg' }],
  },
  rightLeg: {
    width: 30,
    height: 4,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 95,
    right: 50,
    transform: [{ rotate: '45deg' }],
  },
  guessedButton: {
    backgroundColor: '#888', // for all guessed letters
  },
  wrongLetterButton: {
    backgroundColor: '#aa0000', // red for wrong guesses
  },
  wrongLetterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HangmanGame;
