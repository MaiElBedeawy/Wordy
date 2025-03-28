// React Native and required libraries
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, ScrollView, PanResponder } from 'react-native';
// import { useFocusEffect } from '@react-navigation/native';
import TapTouchableOpacity from './components/TapTouchableOpacity';
import { useSound } from './components/SoundContext';

// Helper to generate random background color for found words
const getRandomColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  const a = 0.7;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export default function ScrambledLetters({ route, navigation }) {
  // Refs to track selection start/end
  const startOvalRowRef = useRef(null);
  const startOvalColRef = useRef(null);
  const currentOvalRowRef = useRef(null);
  const currentOvalColRef = useRef(null);
  const userWonRef = useRef(false);
  // Props and state
  const { boardSize, wordList, completeLevel, level, coins, setCoins, updateCoins } = route.params;
  const [currentCoins, setCurrentCoins] = useState(coins);
  const [missingWords, setMissingWords] = useState([]);
  const [highlightedWord, setHighlightedWord] = useState(null);
  const [highlightedPosition, setHighlightedPosition] = useState(null);
  const [highlightedLetters, setHighlightedLetters] = useState([]);  // List to store highlighted letters on the board
  const [wordPositions, setWordPositions] = useState([]);
  const [board, setBoard] = useState([]);
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [cellSize, setCellSize] = useState(40);
  const [ovalStyle, setOvalStyle] = useState(null);
  const [foundWords, setFoundWords] = useState([]);
  const boardContainerRef = useRef(null);
  // Stores styles of ovals for found words
  const [foundOvals, setFoundOvals] = useState([]);
  // Timer state
  const [timer, setTimer] = useState(30);
  const timerRef = useRef(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const { isSoundEnabled } = useSound(); // Get the global sound state

  useEffect(() => {
    console.log("Highlighted letters updated:", highlightedLetters);
  }, [highlightedLetters]);

  // Update coin state when correct words are found
  useEffect(() => {
    if (foundWords.length === missingWords.length)
    {
      if(boardSize === "timed") {
        setCoins((prevCoins) => prevCoins + 10);
      } else {
        setCoins((prevCoins) => prevCoins + 5);
      }
    }
  }, [foundWords]);

  // Sync coins with parent
  useEffect(() => {
    updateCoins(currentCoins);
  }, [currentCoins]);

  // Main setup when component mounts
  useEffect(() => {
    // Reset `foundWords`, `ovalStyle` and `foundOvals` when the component mounts
    setFoundWords([]);
    setFoundOvals([]);
    setOvalStyle([]);

    // Calculate board dimensions and validate word list
    const { width = 360, height = 640 } = Dimensions.get('window');

    const rowFactor = Math.floor(height / 140);
    const colFactor = Math.floor(width / 60);
    // Board dimensions based on selected size
    const calculateDimension = (factor, min, max) => Math.max(min, Math.min(max, factor));
    let calculateRows, calculateCols;

    switch (boardSize) {
      case 'small':
        calculateRows = calculateDimension(rowFactor, 6, 8);
        calculateCols = calculateDimension(colFactor, 6, 8);
        break;
      case 'medium':
        calculateRows = calculateDimension(rowFactor, 10, 12);
        calculateCols = calculateDimension(colFactor, 8, 10);
        break;
      case 'large':
        calculateRows = calculateDimension(rowFactor, 12, 14);
        calculateCols = calculateDimension(colFactor, 8, 10);
        break;
      case 'timed':
        calculateRows = calculateDimension(rowFactor, 10, 12);
        calculateCols = calculateDimension(colFactor, 8, 10);
        break;
      default:
        return;
    }

    // Cell size calculation
    const size = Math.min(Math.min(width / calculateCols, height / calculateRows) * 0.9, 40);
    setCellSize(size);
    setRows(calculateRows);
    setCols(calculateCols);

    // Pick words from word list
    const shuffledWords = [...wordList].sort(() => Math.random() - 0.5);
    const validWords = shuffledWords.filter(
      (word) => word.length <= calculateRows && word.length <= calculateCols && !word.includes(' '));
    const selectedWords = validWords.slice(0, Math.floor(calculateRows / 2));

    if (selectedWords.length < Math.floor(calculateRows / 2)) {
      Alert.alert("Error", "Not enough valid words available for the board dimensions.");
      return;
    }

    // Generate board and populate it
    const { board: generatedBoard, wordPositions: generatedWordPositions } = generateBoard(calculateRows, calculateCols, selectedWords);
    setBoard(generatedBoard);
    setWordPositions(generatedWordPositions);
    setMissingWords(selectedWords);

    // Start the timer if in "timed" mode
    // Timer setup for timed boards
    if (boardSize === 'timed') {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          // Check if all words are found
          if (userWonRef.current) {
            clearInterval(timerRef.current);

            Alert.alert("Congratulations!", "You found all the words in time!", [
              {
                text: "OK",
                onPress: () => navigation.goBack(), // Navigate back to home
              },
            ]);
            return prev; // Stop decrementing the timer
          }

          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsGameOver(true);

            Alert.alert("Tik Tok! Tik Tok! Time's Up!", "You ran out of time!", [
              {
                text: "OK",
                onPress: () => navigation.goBack(), // Navigate back to home
              },
            ]);
            return 0;
          } else {
            return prev - 1;
          }
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current); // Cleanup the timer
  }, [boardSize, wordList, rows, cols]);

  // Generating the board
  const generateBoard = (rows, cols, words) => {
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const wordPositions = [];  // Store word position details

    words.forEach((word) => {
      let placed = false, retryCount = 0;

      while (!placed && retryCount < 100) {
        const startRow = Math.floor(Math.random() * rows);
        const startCol = Math.floor(Math.random() * cols);
        const direction = Math.floor(Math.random() * 4);  // 0: Horizontal, 1: Vertical, 2: Diagonal (↘), 3: Diagonal (↙)

        retryCount++;
        placed = placeWord(board, word, startRow, startCol, direction, rows, cols, wordPositions);
      }
    });

    // Fill empty cells with random letters
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!board[row][col]) board[row][col] = randomLetter();
      }
    }

    return { board, wordPositions };  // Return the board and word positions
  };

  // Placing words
  const placeWord = (board, word, startRow, startCol, direction, rows, cols, wordPositions) => {
    const letters = word.toUpperCase().split('');
    let validPlacement = true;

    // Validate if the word fits and does not overlap with other words
    for (let i = 0; i < letters.length; i++) {
      let row = startRow;
      let col = startCol;

      switch (direction) {
        case 0: col += i; break;  // Horizontal
        case 1: row += i; break;  // Vertical
        case 2: row += i; col += i; break;  // Diagonal ↘
        case 3: row += i; col -= i; break;  // Diagonal ↙
        default: return false;
      }

      if (row >= rows || col >= cols || col < 0 || board[row][col]) {
        validPlacement = false;
        break;
      }
    }

    if (!validPlacement) return false;

    // Place the word on the board
    for (let i = 0; i < letters.length; i++) {
      let row = startRow;
      let col = startCol;

      switch (direction) {
        case 0: col += i; break;
        case 1: row += i; break;
        case 2: row += i; col += i; break;
        case 3: row += i; col -= i; break;
      }
      board[row][col] = letters[i];
    }

    // Save word position details
    wordPositions.push({
      word,
      startRow,
      startCol,
      direction,
      length: letters.length,
    });

    return true;
  };

  const randomLetter = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));

  // Hint logic
  const useHint = () => {

    if (currentCoins < 5) {
      Alert.alert("Not Enough Coins", "You don't have enough coins. Play more levels to earn coins!");
      return;
    }

    console.log("Coins before deduction:", currentCoins);
    // Deduct coins and update both local and parent coins state
    setCurrentCoins((prev) => prev - 5);

    // Find a word that hasn't been fully highlighted or already found
    const wordToHighlight = missingWords.find(
      (word) => !highlightedLetters.some((hl) => hl.word === word) && !foundWords.includes(word.toLowerCase())
    );

    if (wordToHighlight) {
      setHighlightedWord(wordToHighlight);

      // Find the word position details
      const wordDetails = wordPositions.find((pos) => pos.word.toLowerCase() === wordToHighlight.toLowerCase());

      if (wordDetails) {
        const { startRow, startCol, direction, length } = wordDetails;

        // Add each letter of the word to highlightedLetters
        const newHighlights = [{ row: startRow, col: startCol, word: wordToHighlight, isFirstLetter: true }];
        for (let i = 0; i < length; i++) {
          let row = startRow;
          let col = startCol;

          switch (direction) {
            case 0: col += i; break;  // Horizontal
            case 1: row += i; break;  // Vertical
            case 2: row += i; col += i; break;  // Diagonal ↘
            case 3: row += i; col -= i; break;  // Diagonal ↙
          }

          newHighlights.push({ row, col, word: wordToHighlight });
        }

        setHighlightedLetters((prev) => {
          const updatedHighlights = [...prev, ...newHighlights];
          return updatedHighlights;
        });
      }
    } else {
      Alert.alert("Hint", "No more words to highlight!");
    }
  };

   // Display the word list with the hint applied
   const renderWords = () => {
     return missingWords.map((word, index) => {
       const isHighlighted = word === highlightedWord;
       const highlightedLetterStyle = isHighlighted ? { color: 'red', fontWeight: 'bold' } : {};

       return (
         <Text key={index} style={[styles.word, { textDecorationLine: foundWords.includes(word.toLowerCase()) ? 'line-through' : 'none' }]}>
           {/* Apply color only to the first letter */}
           <Text style={highlightedLetterStyle}>{word.charAt(0)}</Text>
           {word.slice(1)}
         </Text>
       );
     });
   };
    // Rendering the board
    const renderBoard = () => {
      return board.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((letter, colIndex) => {
            const isHighlighted =
              highlightedLetters.length > 0 &&
              highlightedLetters.some(
                (hl) => hl.row === rowIndex && hl.col === colIndex && hl.isFirstLetter
              );

            if (isHighlighted) {
              // console.log(`FirstHighlighted letter "${letter}" at (${rowIndex}, ${colIndex})`);
            }
            const letterStyle = isHighlighted ? { color: 'red', fontWeight: 'bold' } : {};

            return (
              <View key={colIndex} style={[styles.cell, { width: cellSize, height: cellSize }]}>
                <Text style={[styles.letter, letterStyle]}>{letter || ''}</Text>
              </View>
            );
          })}
        </View>
      ));
    };

  // PanResponder for selection
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderStart: (e) => {
      const { pageX, pageY } = e.nativeEvent;

      // Get the position of the boardContainer
      boardContainerRef.current.measure((x, y, width, height, pageXOffset, pageYOffset) => {
        const adjustedX = pageX - pageXOffset;
        const adjustedY = pageY - pageYOffset;

        // Calculate row and column based on touch location
        startOvalColRef.current = Math.floor(adjustedX / cellSize);
        startOvalRowRef.current = Math.floor(adjustedY / cellSize);

        // Check if the touch is within the board boundaries
        if (startOvalRowRef.current >= 0 && startOvalRowRef.current < rows && startOvalColRef.current >= 0 && startOvalColRef.current < cols) {
          setOvalStyle({
            top: startOvalRowRef.current * cellSize,
            left: startOvalColRef.current * cellSize,
            width: cellSize,
            height: cellSize,
          });
        }
      });
    },
    onPanResponderMove: (e, gestureState) => {
      const { pageX, pageY } = e.nativeEvent;

      // Get the position of the boardContainer
      boardContainerRef.current.measure((x, y, width, height, pageXOffset, pageYOffset) => {
        const adjustedX = pageX - pageXOffset;
        const adjustedY = pageY - pageYOffset;

        // Calculate row and column based on touch location
        const startOvalCol = startOvalColRef.current;
        const startOvalRow = startOvalRowRef.current;

        const currentCol = Math.floor(adjustedX / cellSize); // Current column index
        const currentRow = Math.floor(adjustedY / cellSize); // Current row index

        // Calculate row and column after movement
        currentOvalColRef.current = currentCol;
        currentOvalRowRef.current = currentRow;

        // Ensure the movement is within boundaries
        if (currentRow >= 0 && currentRow < rows && currentCol >= 0 && currentCol < cols) {
          let newWidth = cellSize; // Default width for a single cell
          let newHeight = cellSize ; // Default height for a single cell
          let isDiagonal = false;
          let isValidMovement = false;

          if (Math.abs(currentRow - startOvalRow) === Math.abs(currentCol - startOvalCol)
          && currentRow !== startOvalRow
          && currentCol !== startOvalCol
          ) {
            // Handle diagonal movement
            isValidMovement = true;
            let isDiagonal = true;
            const diagonalLength = Math.sqrt(
              Math.pow(cellSize, 2) +
              Math.pow(cellSize, 2)
            ) * (Math.abs(currentCol - startOvalCol) + 0.75);

            let newTop = Math.min(startOvalRow, currentRow) * cellSize;
            let newLeft = Math.min(startOvalCol, currentCol) * cellSize;
            let rotation = "0deg";
            let translationX = 0;
            let translationY = 0;

            if (currentRow < startOvalRow && currentCol > startOvalCol) {
              // Up-right diagonal
              rotation = "315deg";
              newTop = startOvalRow * cellSize + cellSize/2;
              newLeft = newLeft - cellSize/4;
              translationX = diagonalLength / 2;
              translationY = cellSize / 2;
            } else if (currentRow > startOvalRow && currentCol > startOvalCol) {
              // Down-right diagonal
              rotation = "45deg";
              newTop = newTop - cellSize/4;
              newLeft = newLeft + cellSize/2;
              translationX = diagonalLength / 2;
              translationY = cellSize / 2;
            } else if (currentRow < startOvalRow && currentCol < startOvalCol) {
              // Up-left diagonal
              rotation = "45deg";
              newTop = currentRow * cellSize - cellSize/4;
              newLeft = currentCol * cellSize + cellSize/2;
              translationX = diagonalLength / 2;
              translationY = cellSize / 2;
            } else if (currentRow > startOvalRow && currentCol < startOvalCol) {
              // Down-left diagonal
              rotation = "315deg";
              newTop = currentRow * cellSize + cellSize/2;
              newLeft = currentCol * cellSize - cellSize/4;
              translationX = diagonalLength / 2;
              translationY = cellSize / 2;
            }

            setOvalStyle({
              width: diagonalLength,
              height: cellSize,
              top: newTop,
              left: newLeft,
              transform: [
                { translateX: -translationX },
                { translateY: -translationY },
                { rotate: rotation },
                { translateX: translationX },
                { translateY: translationY },
              ],
            });

            return;
          }
          if(!isDiagonal) {
            isValidMovement = true;
            if (currentRow === startOvalRow) {

            // Horizontal movement
            if (currentCol > startOvalCol) {
              // Moving forward horizontally
              newWidth = (currentCol - startOvalCol + 1) * cellSize;
              setOvalStyle((prevStyle) => ({
                ...prevStyle,
                width: newWidth,
                height: newHeight,
                top: startOvalRow * cellSize,
                left: startOvalCol * cellSize, // Adjust left position
                transform: [], // Reset any rotation
              }));
            } else if (currentCol < startOvalCol) {
              // Moving backward horizontally
              newWidth = (startOvalCol - currentCol + 1) * cellSize;
              setOvalStyle((prevStyle) => ({
                ...prevStyle,
                width: newWidth,
                height: newHeight,
                top: currentRow * cellSize,
                left: currentCol * cellSize, // Adjust left position
                transform: [], // Reset any rotation
              }));
            }
          } else if (currentCol === startOvalCol) {
            // Vertical movement
            if (currentRow > startOvalRow) {
              // Moving vertically downwards
              newHeight = (currentRow - startOvalRow + 1) * cellSize;
              setOvalStyle((prevStyle) => ({
                ...prevStyle,
                width: newWidth,
                height: newHeight,
                top: startOvalRow * cellSize, // Adjust top position
                left: currentCol * cellSize,
                transform: [], // Reset any rotation
              }));
            } else if (currentRow < startOvalRow) {
              // Moving vertically upwards
              newHeight = (startOvalRow - currentRow + 1) * cellSize;
              setOvalStyle((prevStyle) => ({
                ...prevStyle,
                width: newWidth,
                height: newHeight,
                top: currentRow * cellSize, // Adjust top position
                left: currentCol * cellSize,
                transform: [], // Reset any rotation
              }));
            }
          }
        }
        if (!isValidMovement) {
          // Reset the oval style for invalid movements
          setOvalStyle(null);
        }
      }
      });
    },
    onPanResponderEnd: () => {
      const startOvalRow = startOvalRowRef.current;
      const startOvalCol = startOvalColRef.current;
      const endOvalRow = currentOvalRowRef.current;
      const endOvalCol = currentOvalColRef.current;

      if (0 < startOvalRow < rows  && 0 < startOvalCol < cols) {

        // Extract letters based on the oval's position
        let word = "";

        if (startOvalRow === endOvalRow) {
          // Horizontal word
          const start = startOvalCol;
          const end = endOvalCol;
          if (startOvalCol < endOvalCol) {
            console.log("Forward Horizontal word");
            word = board[startOvalRow].slice(start, end + 1).join("");
          } else {
            console.log("Backward Horizontal word");
            word = board[startOvalRow].slice(end, start + 1).reverse().join("");
          }
        } else if (startOvalCol === endOvalCol) {
          // Vertical word
          const start = Math.min(startOvalRow, endOvalRow);
          const end = Math.max(startOvalRow, endOvalRow);
          if (startOvalRow < endOvalRow) {
            console.log("downward Vertical word");
            word = board.slice(start, end + 1).map((row) => row[startOvalCol]).join("");
          } else {
            console.log("Upward Vertical word");
            word = board.slice(start, end + 1).map((row) => row[startOvalCol]).reverse().join("");
          }
        } else {
          // Diagonal word
          console.log("Calculating diagonal word...");
          let rowStep = startOvalRow < endOvalRow ? 1 : -1; // Direction of row traversal
          let colStep = startOvalCol < endOvalCol ? 1 : -1; // Direction of column traversal

          let currentRow = startOvalRow;
          let currentCol = startOvalCol;

          while (
            currentRow !== endOvalRow + rowStep &&
            currentCol !== endOvalCol + colStep &&
            currentRow >= 0 &&
            currentRow < rows &&
            currentCol >= 0 &&
            currentCol < cols
          ) {
            word += board[currentRow][currentCol]; // Add the letter
            currentRow += rowStep;
            currentCol += colStep;
            console.log(`Building word: ${word}`);
          }
        }

        console.log("Formed word:", word);

        // Check if the word is in the missingWords list and not already found
        if (missingWords.includes(word.toLowerCase()) && !foundWords.includes(word.toLowerCase())) {
          console.log("Word found in the list:", word);

          const randomColor = getRandomColor();
          if (startOvalRow !== endOvalRow && startOvalCol !== endOvalCol) {

            let newTop = Math.min(startOvalRow, endOvalRow) * cellSize;
            let newLeft = Math.min(startOvalCol, endOvalCol) * cellSize;
            let rotation = "0deg";
            let translationX = 0;
            let translationY = 0;
            const diagonalLength = (Math.sqrt(Math.pow(cellSize, 2) + Math.pow(cellSize, 2))) * ((Math.abs(endOvalCol - startOvalCol) + 0.75));

            if(startOvalRow < endOvalRow) {
              if(startOvalCol < endOvalCol) {
                // Down-right diagonal
                rotation = "45deg";
                newTop = newTop - cellSize/4;
                newLeft = newLeft + cellSize/2;
                translationX = diagonalLength / 2;
                translationY = cellSize / 2;
                console.log(diagonalLength);
                setFoundOvals((prev) => [
                  ...prev,
                  {
                    top: newTop,
                    left: newLeft,
                    width: diagonalLength,
                    height: cellSize,
                    borderColor: randomColor,
                    backgroundColor: randomColor,
                    borderRadius: cellSize / 2,
                    transform: [
                      { translateX: -translationX},
                      { translateY: -translationY },
                      { rotate: rotation },
                      { translateX: translationX },
                      { translateY: translationY },
                    ],
                  },
                ]);
              } else {
                // Down-left diagonal
                rotation = "315deg";
                newTop = endOvalRow * cellSize + cellSize/2;
                newLeft = endOvalCol * cellSize - cellSize/4;
                translationX = diagonalLength / 2;
                translationY = cellSize / 2;
                console.log(diagonalLength);
                setFoundOvals((prev) => [
                  ...prev,
                  {
                    top: newTop,
                    left: newLeft,
                    width: diagonalLength,
                    height: cellSize,
                    borderColor: randomColor,
                    backgroundColor: randomColor,
                    borderRadius: cellSize / 2,
                    transform: [
                      { translateX: -translationX },
                      { translateY: -translationY },
                      { rotate: rotation },
                      { translateX: translationX },
                      { translateY: translationY },
                    ],
                  },
                ]);
              }
            } else {
              if(startOvalCol < endOvalCol) {
                // Up-right diagonal
                rotation = "315deg";
                newTop = startOvalRow * cellSize + cellSize/2;
                newLeft = newLeft - cellSize/4;
                translationX = diagonalLength / 2;
                translationY = cellSize / 2;
                console.log(diagonalLength);
                setFoundOvals((prev) => [
                  ...prev,
                  {
                    top: newTop,
                    left: newLeft,
                    width: diagonalLength,
                    height: cellSize,
                    borderColor: randomColor,
                    backgroundColor: randomColor,
                    borderRadius: cellSize / 2,
                    transform: [
                      { translateX: -translationX },
                      { translateY: -translationY },
                      { rotate: rotation },
                      { translateX: translationX },
                      { translateY: translationY },
                    ],
                  },
                ]);
              } else {
                // Up-left diagonal
                rotation = "45deg";
                newTop = endOvalRow * cellSize - cellSize/4;
                newLeft = endOvalCol * cellSize + cellSize/2;
                translationX = diagonalLength / 2;
                translationY = cellSize / 2;
                console.log(diagonalLength);
                setFoundOvals((prev) => [
                  ...prev,
                  {
                    top: newTop,
                    left: newLeft,
                    width: diagonalLength,
                    height: cellSize,
                    borderColor: randomColor,
                    backgroundColor: randomColor,
                    borderRadius: cellSize / 2,
                    transform: [
                      { translateX: -translationX },
                      { translateY: -translationY },
                      { rotate: rotation },
                      { translateX: translationX },
                      { translateY: translationY },
                    ],
                  },
                ]);
              }
            }
          } else {
            let newTop = Math.min(startOvalRow, endOvalRow) * cellSize;
            let newLeft = Math.min(startOvalCol, endOvalCol) * cellSize;
            setFoundOvals((prev) => [
              ...prev,
              {
                top: newTop,
                left: newLeft,
                width: ovalStyle.width,
                height: ovalStyle.height,
                backgroundColor: randomColor,
                borderColor: randomColor,
                borderRadius: cellSize / 2,
              },
            ]);
        }
          console.log(foundOvals);
          // Mark the word as found only if it's not already found
          setFoundWords((prev) => {
            if (!prev.includes(word.toLowerCase())) {
              return [...prev, word.toLowerCase()];
            }
            return prev; // If the word is already found, don't update
          });

          if ( foundWords.length + 1 === missingWords.length && !foundWords.includes(word.toLowerCase()) && boardSize === "timed") {
            userWonRef.current = true;
            completeLevel(level);
          }

          // As the setFoundWords state update is asynchronous and might not immediately reflect the newly added word
          else if (foundWords.length + 1 === missingWords.length && !foundWords.includes(word.toLowerCase()) && boardSize !== "timed") {
            Alert.alert("Congratulations!", "You found all the words!", [
              {
                text: "OK",
                onPress: () => {
                  completeLevel(level);
                  navigation.goBack(); // Navigate back to home
                },
              },
            ]);
          }
        } else {
          console.log("Word not found in the list. Resetting oval.");
          setOvalStyle(null);
        }
      }

      // Reset references
      startOvalRowRef.current = null;
      startOvalColRef.current = null;
      setOvalStyle([]);
    },
  });

  // Rendering the Page
  return (
    <View style={styles.container}>
      {/* Displaying the current coins */}
      <View style={styles.coinDisplayContainer}>
        <Text style={styles.coinText}>${currentCoins}</Text>
      </View>

      {/* Hint Button */}
      <View style={styles.hintButtonContainer}>
        <TapTouchableOpacity onPress={useHint} style={styles.hintButton} isSoundEnabled={isSoundEnabled}>
          <Text style={styles.hintButtonText}>Hint $5</Text>
        </TapTouchableOpacity>
      </View>

      {/* Displaying the boardSize */}
      {boardSize === "timed" && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>Time Remaining: {timer}s</Text>
        </View>
      )}

      {/* Displaying the ovals */}
      <View style={styles.boardContainer} ref={boardContainerRef} {...panResponder.panHandlers}>
      {/* Render all saved ovals
        Due to the rendering issues for the found ovals,
        I must add the style inline to force the oval background to be the same shape of the oval after transforming */}
      {foundOvals.map((oval, index) => (
        <View key={index} style={[styles.oval, { ...oval, borderRadius: oval.height / 2, overflow: 'hidden', }]} />
      ))}
      {ovalStyle && <View style={[styles.oval, ovalStyle]} />}
      {renderBoard()}
    </View>
      {/* Displaying the chosen words from the wordlist that needs to be found */}
      <ScrollView style={styles.wordListContainer} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.title}>Find These Words:</Text>
        <View style={styles.wordColumns}>{renderWords()}</View>
      </ScrollView>
      {/* Back button to return to home page */}
      <TapTouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} isSoundEnabled={isSoundEnabled}>
        <Text style={styles.backButtonText}>Go Back Home</Text>
      </TapTouchableOpacity>
    </View>
  );
}

// Styles for ScrambledLetters page
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row'
  },
  cell: {
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center'
  },
  letter: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  wordListContainer: {
    marginTop: 50,
    maxHeight: '21%',
    width: '100%'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  wordColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around'
  },
  word: {
    fontSize: 16,
    color: '#555',
    width: '45%',
    textAlign: 'center',
    marginBottom: 10,
    linethrough: 'none',
  },
  oval: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'red',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
  },
  backButton: {
    backgroundColor: '#0092FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 20
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  timerContainer: {
   position: "absolute",
   top: 60,
   alignSelf: "center",
   backgroundColor: "#ffcccc",
   padding: 10,
   borderRadius: 5,
 },
 timerText: {
   fontSize: 18,
   fontWeight: "bold",
   color: "#ff0000",
 },
 hintButtonContainer: {
   left: 140,
   top: 5,
   marginBottom: 10,
 },
 hintButton: {
   backgroundColor: '#FF6347',
   padding: 10,
   borderRadius: 5,
   elevation: 3,
 },
 hintButtonText: {
   color: '#fff',
   fontWeight: 'bold',
   fontSize: 16,
  },
coinDisplayContainer: {
  right: 130,
  top: 55,
  marginBottom: 10,
  backgroundColor: '#FF6347',
  padding: 10,
  borderRadius: 5,
  elevation: 3,
},
coinText: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#333',
},
});
