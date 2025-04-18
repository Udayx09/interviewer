// src/components/SkillsAssessmentRound.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Chart.js Imports ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
ChartJS.register( CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend );
// --- End Chart.js Imports ---

// ========================================================================
//                           TYPES & INTERFACES
// ========================================================================
type MCQOption = string;
type Difficulty = 'Easy' | 'Moderate' | 'Hard';
type MCQ = { id: string; questionText: string; options: MCQOption[]; correctAnswerIndex: number; difficulty: Difficulty; };
type AssessmentResult = { questionId: string; selectedIndex: number | null; correctIndex: number; isCorrect: boolean; difficulty: Difficulty; };
// ========================================================================
//                              CONSTANTS
// ========================================================================
// --- Time Constants (in seconds) ---
const TIMING: Record<Difficulty, number> = { Easy: 60, Moderate: 120, Hard: 300 };
// --- End Time Constants ---

// ========================================================================
//                            COMPONENT DEFINITION
// ========================================================================
const SkillsAssessmentRound = () => {

  // ========================================================================
  //                              STATE VARIABLES
  // ========================================================================
  const [allMCQs, setAllMCQs] = useState<MCQ[]>([]); const [currentMCQIndex, setCurrentMCQIndex] = useState<number>(0); const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null); const [timeLeft, setTimeLeft] = useState<number>(TIMING['Easy']); const [isTimerActive, setIsTimerActive] = useState<boolean>(false); const [results, setResults] = useState<AssessmentResult[]>([]); const [isComplete, setIsComplete] = useState<boolean>(false); const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const [userContext, setUserContext] = useState({ role: 'Software Developer', experience: 'Entry-Level', skills: 'General' }); // Placeholder - NEED TO GET THIS FROM APP/SCREENING
  const [error, setError] = useState<string | null>(null);
  const [warningVisible, setWarningVisible] = useState(true);
  // ========================================================================
  //                             END STATE VARIABLES
  // ========================================================================

  // ========================================================================
  //                                   REFS
  // ========================================================================
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  // ========================================================================
  //                                 END REFS
  // ========================================================================

  // ========================================================================
  //                                  EFFECTS
  // ========================================================================
  // UPDATED Initial setup effect - Fetch REAL MCQs from Backend
  useEffect(() => {
    setIsLoading(true); setError(null); setResults([]); setIsComplete(false); setAllMCQs([]); setCurrentMCQIndex(0); setSelectedOptionIndex(null);
    console.log("Fetching personalized MCQs from API using context:", userContext);

    const requestBody = { role: userContext.role, experience: userContext.experience, skills: userContext.skills };

    fetch('http://localhost:3001/api/assessment/start', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(requestBody), })
    .then(response => {
        if (!response.ok) { return response.json().then(errData => { throw new Error(`HTTP error! status: ${response.status} - ${errData.error || 'Failed to fetch MCQs'}`); }).catch(() => { throw new Error(`HTTP error! status: ${response.status} - Failed to fetch MCQs`); }); }
        return response.json();
    })
    .then(data => {
        if (data && Array.isArray(data.mcqs) && data.mcqs.length > 0) {
          console.log("API MCQ List Response received:", data.mcqs);
          setAllMCQs(data.mcqs); // Use data from API
          setCurrentMCQIndex(0);
          setSelectedOptionIndex(null);
          // Ensure difficulty is valid before accessing TIMING
          const firstDifficulty: Difficulty = data.mcqs[0].difficulty;
          setTimeLeft(TIMING[firstDifficulty] || TIMING['Moderate']); // Fallback to Moderate time
          setIsTimerActive(true);
          setIsLoading(false);
        } else { throw new Error("Invalid or empty MCQ list received from API."); }
    })
    .catch(err => { console.error("Error fetching MCQs:", err); setError(`Error loading assessment: ${err.message}. Please try refreshing.`); setIsLoading(false); setIsTimerActive(false); });

    // Preload Audio
    try { tickAudioRef.current = new Audio('/audio/tick.mp3'); tickAudioRef.current.load(); console.log("Audio object created and loading initiated."); } catch (error) { console.error("Failed to create or load audio:", error); }

  }, [userContext]); // Re-fetch if userContext changes

  // Timer effect with Audio Cue
  useEffect(() => {
    let intervalId: number | null = null; if (isTimerActive && timeLeft > 0) { intervalId = setInterval(() => { setTimeLeft((prevTime) => { const newTime = prevTime - 1; if (newTime === 10) { console.log("Attempting to play ticking sound..."); if (tickAudioRef.current) { tickAudioRef.current.currentTime = 0; tickAudioRef.current.play().catch(e => console.error("Audio play failed:", e)); } else { console.warn("Audio object not available."); } } return newTime; }); }, 1000); } else if (timeLeft === 0 && isTimerActive) { console.log(`Time is up for Q${currentMCQIndex + 1}!`); setIsTimerActive(false); } return () => { if (intervalId) clearInterval(intervalId); };
  }, [isTimerActive, timeLeft, currentMCQIndex]);

  // Effect for Warning Sign Blink
  useEffect(() => { const blinkInterval = setInterval(() => setWarningVisible(prev => !prev), 1500); return () => clearInterval(blinkInterval); }, []);
  // ========================================================================
  //                                END EFFECTS
  // ========================================================================

  // ========================================================================
  //                             HELPER FUNCTIONS
  // ========================================================================
  const formatTime = (seconds: number): string => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; };
  const getTimerColor = (seconds: number): string => { if (seconds <= 10) { return 'red'; } else if (seconds <= 30) { return '#e67e22'; } else { return '#2ecc71'; } };
  // ========================================================================
  //                           END HELPER FUNCTIONS
  // ========================================================================

  // ========================================================================
  //                              EVENT HANDLERS
  // ========================================================================
  const handleOptionSelect = (index: number) => { if (!isTimerActive || timeLeft <= 0) return; setSelectedOptionIndex(index); console.log(`Option selected: ${index}`); };
  const handleSubmit = () => {
     if (selectedOptionIndex === null && timeLeft > 0) return; setIsTimerActive(false); const currentMCQ = allMCQs[currentMCQIndex]; const isCorrect = selectedOptionIndex !== null && selectedOptionIndex === currentMCQ.correctAnswerIndex; console.log(`Submitting answer for Q${currentMCQIndex + 1} (id: ${currentMCQ.id}). Selected: ${selectedOptionIndex}, Correct Index: ${currentMCQ.correctAnswerIndex}, Result: ${isCorrect ? 'Correct' : 'Incorrect'}`); const result: AssessmentResult = { questionId: currentMCQ.id, selectedIndex: selectedOptionIndex, correctIndex: currentMCQ.correctAnswerIndex, isCorrect: isCorrect, difficulty: currentMCQ.difficulty, }; setResults(prevResults => [...prevResults, result]); if (currentMCQIndex < allMCQs.length - 1) { const nextIndex = currentMCQIndex + 1; const nextMCQ = allMCQs[nextIndex]; setCurrentMCQIndex(nextIndex); setSelectedOptionIndex(null); setTimeLeft(TIMING[nextMCQ.difficulty]); setIsTimerActive(true); } else { console.log("Skills Assessment round complete!"); setIsComplete(true); setSelectedOptionIndex(null); }
  };
  // ========================================================================
  //                            END EVENT HANDLERS
  // ========================================================================

  // ========================================================================
  //                         COMPLETION DATA PROCESSING
  // ========================================================================
   const calculatedScores = useMemo(() => { if (!isComplete) return null; const totalQuestions = allMCQs.length; const correctAnswers = results.filter(r => r.isCorrect).length; const overallScorePercent = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0; const calculateScoreByDifficulty = (difficulty: Difficulty) => { const relevantResults = results.filter(r => r.difficulty === difficulty); const correctCount = relevantResults.filter(r => r.isCorrect).length; const totalCount = relevantResults.length; return { correct: correctCount, total: totalCount }; }; return { totalQuestions, correctAnswers, overallScorePercent, easyScore: calculateScoreByDifficulty('Easy'), moderateScore: calculateScoreByDifficulty('Moderate'), hardScore: calculateScoreByDifficulty('Hard'), }; }, [isComplete, results, allMCQs]);
    const chartData = useMemo(() => { if (!isComplete || !calculatedScores) return null; const chartLabels = results.map((_, index) => `Q${index + 1}`); const chartScores = results.map(result => result.isCorrect ? 10 : 2); return { labels: chartLabels, datasets: [ { label: 'Correctness', data: chartScores, backgroundColor: results.map(r => r.isCorrect ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'), borderColor: results.map(r => r.isCorrect ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)'), borderWidth: 1, }, ], }; }, [isComplete, results, calculatedScores]);
    const chartOptions = useMemo(() => ({ responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Correctness Overview' }, }, scales: { y: { beginAtZero: true, max: 10, display: false }, x: { title: { display: true, text: 'Question' } } }, }), []);
  // ========================================================================
  //                       END COMPLETION DATA PROCESSING
  // ========================================================================

  // ========================================================================
  //                          CONDITIONAL RENDERING
  // ========================================================================
  // 1. Loading State
  if (isLoading) { return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading Skills Assessment...</div>; }
  // 2. Error State
  if (error) { return <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'sans-serif' }}>{error}</div>; }
  // 3. Completion Screen
  if (isComplete && calculatedScores && chartData) {
    console.log("Rendering Completion Screen. Final Results:", results);
    return ( <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}> <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#111' }}>Skills Assessment Complete!</h2> {/* Overall Summary */} <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', padding: '20px', borderRadius: '8px', marginBottom: '30px', textAlign: 'center' }}> <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#343a40' }}>Overall Performance</h3> <p style={{ fontSize: '1.8em', fontWeight: 'bold', color: calculatedScores.overallScorePercent >= 70 ? '#28a745' : (calculatedScores.overallScorePercent >= 50 ? '#ffc107' : '#dc3545'), margin: '5px 0' }}>{calculatedScores.overallScorePercent}%</p> <p style={{ fontSize: '1.1em', color: '#6c757d', margin: 0 }}>({calculatedScores.correctAnswers} out of {calculatedScores.totalQuestions} correct)</p> </div> {/* Chart */} <div style={{ width: '90%', maxWidth: '500px', margin: '0 auto 30px auto' }}> {results.length > 0 && <Bar options={chartOptions} data={chartData} />} </div> {/* Score by Difficulty */} <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #eee', borderRadius: '8px', background: '#fff' }}> <h4 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center', color: '#343a40' }}>Score by Difficulty</h4> <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', color: '#333' }}> <div><p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Easy</p><p style={{ margin: 0, fontSize: '1.1em' }}>{calculatedScores.easyScore.correct}/{calculatedScores.easyScore.total}</p></div> <div><p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Moderate</p><p style={{ margin: 0, fontSize: '1.1em' }}>{calculatedScores.moderateScore.correct}/{calculatedScores.moderateScore.total}</p></div> <div><p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Hard</p><p style={{ margin: 0, fontSize: '1.1em' }}>{calculatedScores.hardScore.correct}/{calculatedScores.hardScore.total}</p></div> </div> </div> {/* Question Review */} <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}> <h3 style={{ textAlign: 'center', marginBottom: '25px', color: '#343a40' }}>Question Review:</h3> {results.length > 0 ? ( <div style={{ textAlign: 'left' }}> {results.map((result, index) => { const questionDetails = allMCQs.find(q => q.id === result.questionId); if (!questionDetails) return null; return ( <div key={result.questionId} style={{ border: '1px solid #ddd', padding: '15px 20px', marginBottom: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}> <p style={{ marginTop: 0, marginBottom: '15px', color: '#333', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '10px' }}> Q{index + 1} ({result.difficulty}): <span style={{ fontWeight: 'normal' }}>{questionDetails.questionText}</span> </p> <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0' }}> {questionDetails.options.map((option, optIndex) => { const isUserChoice = result.selectedIndex === optIndex; const isCorrectChoice = result.correctIndex === optIndex; let indicator = ''; let itemStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #e9ecef', borderRadius: '4px', marginBottom: '8px', listStyle: 'none', background: '#f8f9fa', color: '#212529', display: 'flex', alignItems: 'center', justifyContent: 'space-between', }; if (isCorrectChoice) { indicator = '✔️'; itemStyle.borderColor = '#28a745'; itemStyle.background = isUserChoice ? '#d4edda' : '#f0fff4'; itemStyle.color = isUserChoice ? '#155724' : '#333'; itemStyle.fontWeight = 'bold'; } if (isUserChoice && !isCorrectChoice) { indicator = '❌'; itemStyle.borderColor = '#dc3545'; itemStyle.background = '#f8d7da'; itemStyle.color = '#721c24'; itemStyle.textDecoration = 'line-through'; itemStyle.fontWeight = 'normal'; } return ( <li key={optIndex} style={itemStyle}> <span>{option}</span> <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>{indicator}</span> </li> ); })} </ul> {result.selectedIndex === null && <p style={{color: '#dc3545', fontStyle: 'italic', margin:'10px 0 0 0'}}>You did not select an answer (or timed out).</p>} </div> ); })} </div> ) : ( <p style={{ textAlign: 'center', color: '#777' }}>No results to review.</p> )} </div> {/* Start New Button */} <div style={{ textAlign: 'center', marginTop: '30px' }}> <button onClick={() => window.location.reload()} style={{ padding: '12px 25px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1em', fontWeight: 'bold' }}> Start New Practice </button> </div> </div> );
  } // End if(isComplete)

  // --- 4. No questions loaded after trying ---
  if (!allMCQs || allMCQs.length === 0) { return <div style={{ padding: '20px', textAlign: 'center', color: 'orange', fontFamily: 'sans-serif' }}>No questions loaded. Check API response or refresh.</div>; }
  // ========================================================================
  //                        END CONDITIONAL RENDERING
  // ========================================================================

  // ========================================================================
  //                        MAIN RENDER (Active Question)
  // ========================================================================
  if (currentMCQIndex >= allMCQs.length) { return <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'sans-serif' }}>Error loading question index.</div>; } // Safety check
  const currentMCQ = allMCQs[currentMCQIndex];
  return ( <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '700px', margin: 'auto' }}> {/* Header */} <h1 style={{textAlign: 'center', fontSize: '1.6em', marginBottom: '5px'}}>Skills Assessment</h1> <p style={{textAlign: 'center', fontSize: '1.1em', color: '#555', marginTop: 0}}>Question {currentMCQIndex + 1}/{allMCQs.length} ({currentMCQ.difficulty})</p> {/* Progress Bar */} <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '5px', overflow: 'hidden', margin: '15px 0', height: '12px' }}> <div style={{ width: `${((currentMCQIndex + 1) / allMCQs.length) * 100}%`, backgroundColor: '#007bff', height: '100%', transition: 'width 0.3s ease-in-out' }}></div> </div> {/* Warning Sign */} <div style={{ textAlign: 'center', margin: '15px 0', padding: '5px', fontSize: '0.9em', color: '#e67e22', fontWeight: 'bold', border: '1px dashed #e67e22', borderRadius: '4px', opacity: warningVisible ? 1 : 0.6, transition: 'opacity 0.7s ease-in-out' }}> <span>⚠️ Don't switch tabs or copy content. Activity is monitored.</span> </div> <hr style={{margin: '20px 0'}}/> {/* Question */} <div style={{ margin: '25px 0', fontSize: '1.2em', fontWeight: 'bold', lineHeight: '1.5' }}> <p>{currentMCQ.questionText}</p> </div> {/* Options */} <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '12px' }} role="radiogroup"> {currentMCQ.options.map((option, index) => { const isSelected = selectedOptionIndex === index; return ( <div key={index} onClick={() => handleOptionSelect(index)} style={{ padding: '12px 15px', textAlign: 'left', cursor: 'pointer', border: `2px solid ${isSelected ? '#007bff' : '#ccc'}`, borderRadius: '5px', background: isSelected ? '#e7f3ff' : '#ffffff', display: 'flex', alignItems: 'center', width: '100%', fontSize: '1em', transition: 'background-color 0.2s ease, border-color 0.2s ease', }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#aaa'; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#ccc'; }} aria-checked={isSelected} role="radio" tabIndex={0} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleOptionSelect(index); }} > <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isSelected ? '#007bff' : '#ccc'}`, marginRight: '12px', position: 'relative', backgroundColor: isSelected ? '#007bff' : '#fff', flexShrink: 0 }}> {isSelected && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff', }}></span>} </span> <span style={{ color: '#333333' }}>{option}</span> <input type="radio" name={`mcq_${currentMCQ.id}`} value={index.toString()} checked={isSelected} readOnly style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} /> </div> ); })} </div> {/* Timer and Submit */} <div style={{ margin: '35px 0 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: getTimerColor(timeLeft), transition: 'color 0.5s ease' }}> <span>Time Left: </span> <strong>{formatTime(timeLeft)}</strong> </div> <button onClick={handleSubmit} disabled={selectedOptionIndex === null || timeLeft <= 0} style={{ padding: '12px 25px', fontSize: '1.1em', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', opacity: (selectedOptionIndex === null || timeLeft <= 0) ? 0.6 : 1 }}> {currentMCQIndex === allMCQs.length - 1 ? 'Finish Assessment' : 'Submit Answer'} </button> </div> </div> );
  // ========================================================================
  //                      END MAIN RENDER (Active Question)
  // ========================================================================

}; // End of SkillsAssessmentRound Component

export default SkillsAssessmentRound; // Export component