// React Native and required libraries
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, TextInput, ScrollView, Button, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import localWordList from './assets/wordlist/CrosswordsPuzzles.json';
import TapTouchableOpacity from './components/TapTouchableOpacity';
import { useSound } from './components/SoundContext';

export default function CrosswordsCraze({ route }) {
  // Define the crossword grid size
  const GRID_SIZE = 15;
  const navigation = useNavigation();
  // The crossword grid structure
  const [grid, setGrid] = useState([]);
  // Clues for across and down
  const [clues, setClues] = useState({ across: [], down: [] });
  // Words placed in the grid
  const [usedWords, setUsedWords] = useState([]);
  // Refs to input fields for focus control
  const nextInputRefs = useRef({});
  // Extract props passed from navigation
  const { completeLevel, level, coins = 10, updateCoins = () => {}, setCoins = () => {} } = route.params || {};
  // Local coin state
  const [currentCoins, setCurrentCoins] = useState(coins);
  // Global sound state
  const { isSoundEnabled } = useSound(); // Get the global sound state
  // Toggle for online vs. offline words
  const [useOnlineData, setUseOnlineData] = useState(true);
  // Loading state while fetching words
  const [isLoading, setIsLoading] = useState(false);

  // Update both local and global coin states when currentCoins changes
  useEffect(() => {
    setCoins(currentCoins);      // update HomePage coin state
    updateCoins(currentCoins);   // update asyncStorage
  }, [currentCoins]);

  // Load puzzle data on mount or when online mode changes
  useEffect(() => {
    const loadWords = async () => {
      setIsLoading(true);

      let puzzles = [];

      if (useOnlineData) {
        const isConnected = (await NetInfo.fetch()).isConnected;
        if (isConnected) {
          puzzles = await getWordsWithClues();
        } else {
          Alert.alert("No Internet", "Falling back to offline data.");
          puzzles = localWordList.words;
        }
      } else {
        puzzles = localWordList.words;
      }

      setUsedWords(puzzles);
      generateGrid(puzzles);
      setIsLoading(false);
    };

    loadWords();
  }, [useOnlineData]);


  // Fetching data online from https://api.datamuse.com/words?ml=fun&max=50
  // Fetch 50 random similar words from Datamuse and return 10
  const fetchDatamuseWords = async () => {
    const response = await fetch('https://api.datamuse.com/words?ml=fun&max=50');
    const data = await response.json();

    const shuffledData = data.sort(() => Math.random() - 0.5);

    return shuffledData.slice(0, 10).map(item => item.word);
  };


  // Getting the definition of the word to use it as a clue
  const fetchDefinition = async (word) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0 || !data[0]?.meanings) return null;

      return data[0].meanings[0]?.definitions[0]?.definition || null;
    } catch (error) {
      console.warn("Definition not found for:", word);
      return null;
    }
  };


  // Combine words with definitions into puzzle format
  const getWordsWithClues = async () => {
    const words = await fetchDatamuseWords();
    const result = [];

    for (const word of words) {
      const clue = await fetchDefinition(word);
      if (clue) {
        result.push({ answer: word.toUpperCase(), clue });
      }
    }

    console.log("Generated result from API:", result);

    return result;
  };

  // Initialize an empty crossword grid
  const createEmptyGrid = () => {
    return Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null));
  };

  const [userAnswers, setUserAnswers] = useState(createEmptyGrid());

  // Check if a word can be placed in the grid without conflicts
  const canPlaceWord = (word, grid, row, col, direction) => {
    if (direction === "across") {
      if (col + word.answer.length > GRID_SIZE) return false;

      for (let i = 0; i < word.answer.length; i++) {
        let currentCol = col + i;

        // Check if this cell is occupied by a different letter
        if (grid[row][currentCol] !== null && grid[row][currentCol] !== "") {
          return false;
        }

        // Check adjacent spaces to prevent forming unintended words
        if (
          (row > 0 && grid[row - 1][currentCol] !== null) || // Top cell
          (row < GRID_SIZE - 1 && grid[row + 1][currentCol] !== null) // Bottom cell
        ) {
          return false;
        }

        // Ensure there's a space before and after the word
        if (i === 0 && col > 0 && grid[row][col - 1] !== null) return false;
        if (i === word.answer.length - 1 && currentCol < GRID_SIZE - 1 && grid[row][currentCol + 1] !== null) return false;
      }
    } else { // Vertical Placement
      if (row + word.answer.length > GRID_SIZE) return false;

      for (let i = 0; i < word.answer.length; i++) {
        let currentRow = row + i;

        if (grid[currentRow][col] !== null && grid[currentRow][col] !== "") {
          return false;
        }

        if (
          (col > 0 && grid[currentRow][col - 1] !== null) || // Left cell
          (col < GRID_SIZE - 1 && grid[currentRow][col + 1] !== null) // Right cell
        ) {
          return false;
        }

        if (i === 0 && row > 0 && grid[row - 1][col] !== null) return false;
        if (i === word.answer.length - 1 && currentRow < GRID_SIZE - 1 && grid[currentRow + 1][col] !== null) return false;
      }
    }
    return true;
  };

  // Try to place a word randomly in the grid
  const placeWord = (word, grid, wordIndex) => {
    let placed = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;

    while (!placed && attempts < MAX_ATTEMPTS) {
      attempts++;
      let startRow = Math.floor(Math.random() * GRID_SIZE);
      let startCol = Math.floor(Math.random() * GRID_SIZE);

      if (canPlaceWord(word, grid, startRow, startCol, word.direction)) {
        word.position = [startRow, startCol];
        word.number = wordIndex + 1;

        console.log(`Word: ${word.answer}, Number: ${word.number}, Position: ${word.position}`);

        for (let i = 0; i < word.answer.length; i++) {
          if (word.direction === "across") {
            if (i === 0) grid[startRow][startCol + i] = word.number;
            else grid[startRow][startCol + i] = "";
          } else {
            if (i === 0) grid[startRow + i][startCol] = word.number;
            else grid[startRow + i][startCol] = "";
          }
        }
        placed = true;
      }
    }
    return placed ? word : null;
  };

  // Generate the crossword puzzle grid from a word list
  const generateGrid = (wordList) => {
    if (!Array.isArray(wordList) || wordList.length === 0) return;

    let newGrid = createEmptyGrid();
    let tempUsedWords = [];
    let wordPlacedCount = 0;
    let totalWords = wordList.length;

    while (wordPlacedCount < totalWords && wordPlacedCount < 10) {
      const word = wordList[wordPlacedCount];
      if (!word) {
        console.warn("No word found at index", wordPlacedCount);
        wordPlacedCount++;
        continue;
      }

      const direction = Math.random() < 0.5 ? "across" : "down";
      const wordWithDirection = { ...word, direction };

      const placedWord = placeWord(wordWithDirection, newGrid, wordPlacedCount);

      if (placedWord) {
        tempUsedWords.push({ ...placedWord, number: wordPlacedCount + 1 });
        wordPlacedCount++;
      } else {
        console.warn("Could not place word:", word.answer);
        wordPlacedCount++;
      }
    }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (newGrid[r][c] === null) {
          newGrid[r][c] = "#";
        }
      }
    }

    let newClues = { across: [], down: [] };
    tempUsedWords.forEach((word, index) => {
      newClues[word.direction].push(`${index + 1}. ${word.clue}`);
    });

    // Filter only valid words (with position + direction) before using
    const placedWordsOnly = tempUsedWords.filter(w => w.position && w.direction);

    // Set everything safely
    setGrid(newGrid);
    setUserAnswers(createEmptyGrid());
    setClues(newClues);
    setUsedWords(placedWordsOnly);
  };

  // Handle text input in crossword cell and auto-focus next input
  const handleInputChange = (text, row, col) => {
    if (text.length > 0) {
      let newUserAnswers = [...userAnswers];
      newUserAnswers[row][col] = text.toUpperCase(); // Store uppercase letter
      setUserAnswers(newUserAnswers);

      // Find the current word based on the cell position
      // Move the curser automatically to the next box
      const word = usedWords.find(
        (word) =>
          (word.direction === "across" && word.position[0] === row && word.position[1] <= col) ||
          (word.direction === "down" && word.position[1] === col && word.position[0] <= row)
      );

      if (word) {
        let nextRow = row;
        let nextCol = col;

        // Determine the next cell based on direction
        if (word.direction === "across") {
          nextCol += 1;
        } else {
          nextRow += 1;
        }

        // Focus on the next input if it's valid
        if (
          nextRow < GRID_SIZE &&
          nextCol < GRID_SIZE &&
          grid[nextRow][nextCol] !== "#" &&
          nextInputRefs.current[`${nextRow}-${nextCol}`]
        ) {
          // Focus next input
          nextInputRefs.current[`${nextRow}-${nextCol}`].focus();
        }
      }
    }
  };

  // Validate user answers against the correct ones
  const checkAnswers = () => {
    let isCorrect = true;
    for (let word of usedWords) {
      let { position, direction, answer } = word;
      let [row, col] = position;

      for (let i = 0; i < answer.length; i++) {
        let userChar =
          direction === "across"
            ? userAnswers[row][col + i]
            : userAnswers[row + i][col];

        if (userChar !== answer[i]) {
          isCorrect = false;
          break;
        }
      }
      if (!isCorrect) break;
    }

    if (isCorrect) {

      const newCoins = currentCoins + 10; // use currentCoins here
      setCurrentCoins(newCoins);          // update currentCoins state
      setCoins?.(newCoins);                 // update locally (if needed elsewhere)
      updateCoins(newCoins);              // update global coins

      Alert.alert("Congratulations!", "You won!", [
        {
          text: "OK",
          onPress: () => {
            completeLevel(level);  // Update completed levels
            navigation.goBack(); // Go back to level screen
          }
        },
      ]);
    } else {
      Alert.alert("Try Again!", "Some answers are incorrect.");
    }
  };

  // Handle hint logic and deduct coins
  const handleHint = () => {
    if (currentCoins < 2) {
      Alert.alert("Not enough coins!", "You need at least 2 coins for a hint.");
      return;
    }

    const wordToHint = usedWords[Math.floor(Math.random() * usedWords.length)];
    if (!wordToHint) return;

    const [row, col] = wordToHint.position;
    const hintIndex = Math.floor(Math.random() * wordToHint.answer.length);

    let newUserAnswers = [...userAnswers];

    if (wordToHint.direction === "across") {
      newUserAnswers[row][col + hintIndex] = wordToHint.answer[hintIndex];
    } else {
      newUserAnswers[row + hintIndex][col] = wordToHint.answer[hintIndex];
    }

    setUserAnswers(newUserAnswers);
    const newCoins = currentCoins - 2;
    setCurrentCoins(newCoins);
    updateCoins?.(newCoins);
    setCoins?.(newCoins);
    console.log(currentCoins);
    console.log(newCoins);
  };

  // Handle solving the puzzle with coin deduction
  const handleSolve = () => {
    console.log(currentCoins);
    if (currentCoins < 15) {
      Alert.alert("Not enough coins!", "You need at least 15 coins to solve the puzzle.");
      return;
    }

    let newUserAnswers = [...userAnswers];

    usedWords.forEach((word) => {
      const [row, col] = word.position;
      for (let i = 0; i < word.answer.length; i++) {
        if (word.direction === "across") {
          newUserAnswers[row][col + i] = word.answer[i];
        } else {
          newUserAnswers[row + i][col] = word.answer[i];
        }
      }
    });

    setUserAnswers(newUserAnswers);
    const newCoins = currentCoins - 15;
    setCurrentCoins(newCoins);
    updateCoins?.(newCoins);
    setCoins?.(newCoins);
    console.log(newCoins);

    Alert.alert("Puzzle Solved!", "All answers are filled in. You can submit now.");
  };

  // Render crossword grid
  const renderGrid = () => (
    <View>
      {grid.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => {
            const wordAtThisCell = usedWords.find(
              (word) => word.position && word.position[0] === rowIndex && word.position[1] === colIndex
            );


            return (
              <View key={colIndex} style={styles.cellContainer}>
                {wordAtThisCell && (
                  <Text style={styles.wordNumber}>{wordAtThisCell.number}</Text>
                )}
                <TextInput
                  ref={(ref) => (nextInputRefs.current[`${rowIndex}-${colIndex}`] = ref)}
                  style={[
                    styles.cell,
                    cell === "#" ? styles.blackCell : null,
                  ]}
                  value={cell === "#" ? "" : userAnswers[rowIndex][colIndex] || ""}
                  onChangeText={(text) => handleInputChange(text, rowIndex, colIndex)}
                  editable={cell !== "#" && cell !== null}
                  maxLength={1}
                  returnKeyType="next"
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

    // Show loading spinner while puzzle is being generated
    if (isLoading) {
      return (
        <View style={styles.container}>
          <Text style={{ fontSize: 18, textAlign: 'center', marginTop: 50 }}>
            Loading Puzzle...
          </Text>
        </View>
      );
    }

    // Main render function
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Crosswords Craze</Text>

        {/* Coins Display and Toggle between online data and offline one */}
        <View style={styles.topBar}>
          <Text style={styles.coinText}>${currentCoins}</Text>
          <Button
            title={useOnlineData ? "Use Offline Mode" : "Use Online Mode"}
            onPress={() => setUseOnlineData(prev => !prev)}
            color="#007AFF"
          />
        </View>

        {/* Grid Display */}
        <View style={styles.gridContainer}>{renderGrid()}</View>

        {/* Check Button */}
        <TapTouchableOpacity
          style={styles.checkButton}
          isSoundEnabled={isSoundEnabled}
          onPress={checkAnswers}>
          <Text style={styles.buttonText}>Check</Text>
        </TapTouchableOpacity>


        {/* Hint Button */}
        <TapTouchableOpacity
          style={styles.hintButton}
          isSoundEnabled={isSoundEnabled}
          onPress={handleHint}>
          <Text style={styles.buttonText}>Hint $2</Text>
        </TapTouchableOpacity>

        {/* Solve Button */}
        <TapTouchableOpacity
          style={styles.solveButton}
          isSoundEnabled={isSoundEnabled}
          onPress={handleSolve}>
          <Text style={styles.buttonText}>Solve $15</Text>
        </TapTouchableOpacity>

        {/* Clues Display */}
        <ScrollView style={styles.cluesContainer}>
          <Text style={styles.cluesTitle}>Clues:</Text>
          <Text style={styles.cluesSubTitle}>Across:</Text>
          {clues.across.map((clue, index) => (
            <Text key={`Across-${index}`} style={styles.clueText}>{clue}</Text>
          ))}
          <Text style={styles.cluesSubTitle}>Down:</Text>
          {clues.down.map((clue, index) => (
            <Text key={`Down-${index}`} style={styles.clueText}>{clue}</Text>
          ))}
        </ScrollView>
      </View>
    );
}

// Styles for UI layout and design
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f0f0f0" },
  header: { fontSize: 24, fontWeight: "bold", textAlign: "center", top: 30 },
  gridContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  row: { flexDirection: "row" },
  cell: { width: 24, height: 24, textAlign: "center", borderWidth: 1, backgroundColor: "white", fontSize: 18, },
  blackCell: { backgroundColor: "black" },
  cluesContainer: { marginTop: 20 },
  cluesTitle: { fontSize: 20, fontWeight: "bold" },
  cluesSubTitle: { fontSize: 16, fontWeight: "bold", marginTop: 10 },
  clueText: { fontSize: 14 },
  wordNumber: { position: "absolute", top: 2, left: 2, fontSize: 6, fontWeight: "bold", color: "black", zIndex: 2 },
  cellContainer: { position: "relative" },
  hintButton: { backgroundColor: "#FFD700", padding: 10, borderRadius: 5, marginTop: 10, alignItems: "center" },
  solveButton: { backgroundColor: "#FF6347", padding: 10, borderRadius: 5, marginTop: 10, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "bold" },
  checkButton: { backgroundColor: "#1E90FF", padding: 10, borderRadius: 5, marginTop: 10, alignItems: "center" },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 },
  coinText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
});
