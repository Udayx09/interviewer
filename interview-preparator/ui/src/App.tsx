import { useState } from 'react';
import './App.css';
import { useUserProfile } from './context/UserProfileContext';

// Import components
import FinalRound from './components/FinalRound'; // <-- Import this
import DetailsForm from './components/DetailsForm'; // <-- Import this

function App() {
  // Use state to control the current form stage
  const [currentStage, setCurrentStage] = useState<string>('details'); // Start with 'details' stage

  const handleDetailsSubmitted = () => {
    // After the form is submitted, update the stage to 'final-round'
    setCurrentStage('final-round');
  };

  return (
    <div className="App">
      {/* Conditionally render based on the current stage */}
      {currentStage === 'details' && <DetailsForm onDetailsSubmitted={handleDetailsSubmitted} />}
      {currentStage === 'final-round' && <FinalRound />}
    </div>
  );
}

export default App;
