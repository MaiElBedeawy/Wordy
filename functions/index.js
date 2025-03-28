// Import Firebase Cloud Functions and Admin SDK
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore(); // Reference to Firestore database

// Export a callable Cloud Function named "saveUserProgress"
exports.saveUserProgress = functions.https.onCall(async (data, context) => {
  // Determine the UID of the user
  // Use the passed `uid` from the client,
  // or if the user is authenticated use context.auth.uid
  // Otherwise fallback to using "guest" for anonymous sessions
  const uid = data.uid || (context.auth ? context.auth.uid : "guest");

  // Destructure user progress data from request payload, with default values
  const {
    currentLevel = 1,
    coins = 10,
    completedLevels = [],
    completedPuzzleType = "",
    puzzleDate = "",
  } = data;

  // Reference to the Firestore document for this user
  const userDoc = db.collection("userProgress").doc(uid);

  // Base object to update Firestore with
  const updateData = {
    // Store timestamp of last update
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Handle Daily Puzzle updates explicitly
  // If this is a daily puzzle submission
  if (currentLevel === "Daily Puzzle") {
    // Save the daily puzzle completion metadata
    updateData.dailyPuzzle = {completedPuzzleType, puzzleDate};
    updateData.coins = coins; // Ensure coins always update
  } else {
    // Regular level completion updates
    updateData.currentLevel = currentLevel; // Save the current level user is on
    updateData.completedLevels = completedLevels; // Save all completed levels
    updateData.coins = coins; // Ensure coins always update
  }

  try {
    // Merge updateData into the existing user document in Firestore
    await userDoc.set(updateData, {merge: true});
    // Return success to the client
    return {success: true};
  } catch (error) {
    // If there's any error, return it as a Firebase HttpsError
    throw new functions.https.HttpsError("internal", error.message);
  }
});
