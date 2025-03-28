// Import necessary React functions
import React, { createContext, useState, useContext } from 'react';

// Create a context for sound settings
const SoundContext = createContext();


// SoundProvider component wraps the app and provides sound state to all children
export const SoundProvider = ({ children }) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true); // State to control whether sound is on or off (default: true)

  return (
    // Provide the current sound state and setter function to all children
    <SoundContext.Provider value={{ isSoundEnabled, setIsSoundEnabled }}>
      {children}
    </SoundContext.Provider>
  );
};

// Custom hook for accessing sound context more easily
export const useSound = () => useContext(SoundContext);
