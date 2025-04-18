// src/components/ScreeningRound.tsx
import React, { useState, useEffect } from 'react';

// --- Chart.js Imports ---
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
// --- End Chart.js Imports ---

// --- Types ---
type Feedback = { assessment: string; strength: string; improvement: string; raw?: string; score?: number; }; // Added score
type FeedbackResult = { question: string; answer: string; feedback: Feedback; score?: number };
// --- End Types ---

// --- Register Chart.js components ---
ChartJS.register( CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend );
// --- End Registration ---

const TIME_PER_QUESTION = 180; // 3 minutes

const ScreeningRound = () => {
  // --- State Variables ---
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(TIME_PER_QUESTION);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userExperience, setUserExperience] = useState<string>("");
  const [userSkills, setUserSkills] = useState<string>("");
  const [isDetailsSubmitted, setIsDetailsSubmitted] = useState<boolean>(false);
  const [feedbackResults, setFeedbackResults] = useState<FeedbackResult[]>([]);
  // --- End State Variables ---


  // --- Function to Fetch Questions ---
  const fetchQuestions = () => {
    setIsLoading(true); setError(null); setFeedbackResults([]); setAllQuestions([]); setCurrentQuestionIndex(0); setIsComplete(false);
    console.log("Fetching personalized question list from API...");
    const queryParams = new URLSearchParams({ role: userRole, experience: userExperience, skills: userSkills }).toString();
    fetch(`http://localhost:3001/api/screening/start?${queryParams}`)
      .then(response => { if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); return response.json(); })
      .then(data => {
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          console.log("API List Response received:", data.questions);
          setAllQuestions(data.questions); setCurrentQuestionIndex(0); setTimeLeft(TIME_PER_QUESTION); setIsTimerActive(true); setIsLoading(false);
        } else { throw new Error("Invalid data format: 'questions' array not found or empty."); }
      })
      .catch(err => { console.error("Error fetching initial question list:", err); setError(`Error loading questions: ${err.message}. Please try refreshing.`); setIsLoading(false); setIsTimerActive(false); });
   };
  // --- End Fetch Function ---


  // --- Effects ---
  // Timer useEffect
  useEffect(() => {
    let intervalId: number | null = null; if (isTimerActive && timeLeft > 0) { intervalId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000); } else if (timeLeft === 0) { console.log("Time is up!"); setIsTimerActive(false); } return () => { if (intervalId) clearInterval(intervalId); };
  }, [isTimerActive, timeLeft]);
  // --- End Effects ---


  // --- Helper Function ---
  // Format seconds into MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  // --- End Helper Function ---


  // --- Event Handlers ---
  const handleAnswerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setUserAnswer(event.target.value); };

  // Handle submission of user details form
  const handleDetailsSubmit = (event: React.FormEvent) => {
    event.preventDefault(); if (userRole.trim() && userExperience.trim() && userSkills.trim()) { console.log("Details Submitted:", { role: userRole, experience: userExperience, skills: userSkills }); setIsDetailsSubmitted(true); fetchQuestions(); } else { alert("Please fill in all details."); }
  };

  // UPDATED handleSubmit for REAL SCORES and empty answer check
  const handleSubmit = () => {
    setIsTimerActive(false);
    const currentQuestionText = allQuestions[currentQuestionIndex];
    const submittedAnswer = userAnswer.trim(); // Trim whitespace

    console.log(`Submitting answer for Q${currentQuestionIndex + 1} (${currentQuestionText}): "${submittedAnswer}"`);

    // --- Check for Empty Submission ---
    if (submittedAnswer === "") {
      console.log("Empty answer submitted. Assigning score 0.");
      const emptyFeedback: Feedback = { assessment: "No answer was submitted.", strength: "N/A", improvement: "Please provide an answer.", score: 0 };
      const result: FeedbackResult = { question: currentQuestionText, answer: "(Empty Submission)", feedback: emptyFeedback, score: 0 };
      setFeedbackResults(prevResults => [...prevResults, result]);

      // Move to next question OR complete
      if (currentQuestionIndex < allQuestions.length - 1) { setCurrentQuestionIndex(prevIndex => prevIndex + 1); setUserAnswer(""); setTimeLeft(TIME_PER_QUESTION); setIsTimerActive(true); }
      else { console.log("Screening round complete!"); setIsComplete(true); setUserAnswer(""); }
      return; // Stop processing
    }
    // --- End Check for Empty Submission ---

    // If answer is NOT empty, proceed with API call
    fetch('http://localhost:3001/api/screening/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: currentQuestionText, answer: submittedAnswer }), })
    .then(response => { if (!response.ok) { return response.json().then(errData => { throw new Error(`API Error (${response.status}): ${errData.error || response.statusText}`); }); } return response.json(); })
    .then(data => {
        console.log("Submit Answer Response (Feedback Received):", data);
        let feedbackToAdd: Feedback;
        let scoreToAdd: number | undefined = undefined;

        if (data && data.feedback) {
          feedbackToAdd = data.feedback;
          scoreToAdd = typeof data.feedback.score === 'number' ? data.feedback.score : undefined; // Extract score
          if (scoreToAdd === undefined) { console.warn("Score was missing or not a number in feedback object."); }
        } else {
          console.warn("Feedback object missing in successful response from /submit");
          feedbackToAdd = { assessment: "Feedback processing failed.", strength: "N/A", improvement: "N/A" };
        }

        const result: FeedbackResult = { question: currentQuestionText, answer: submittedAnswer, feedback: feedbackToAdd, score: scoreToAdd };
        setFeedbackResults(prevResults => [...prevResults, result]);

        // Move to next question or complete
        if (currentQuestionIndex < allQuestions.length - 1) { setCurrentQuestionIndex(prevIndex => prevIndex + 1); setUserAnswer(""); setTimeLeft(TIME_PER_QUESTION); setIsTimerActive(true); }
        else { console.log("Screening round complete!"); setIsComplete(true); setUserAnswer(""); }
    })
    .catch(err => {
        console.error("Error submitting answer / getting feedback:", err); setError(`Error submitting answer: ${err.message}. Please try again or refresh.`);
        const result: FeedbackResult = { question: currentQuestionText, answer: submittedAnswer, feedback: { assessment: `Error: ${err.message}`, strength: "N/A", improvement: "N/A"}, score: undefined };
        setFeedbackResults(prevResults => [...prevResults, result]); setIsComplete(true); setUserAnswer("");
    });
  };
  // --- End Event Handlers ---


  // --- Conditional Rendering ---
  // 1. Details form
  if (!isDetailsSubmitted) {
    return ( <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'sans-serif' }}> <h2>Tell us about the role you're preparing for:</h2> <form onSubmit={handleDetailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}> <div><label htmlFor="role" style={{ display: 'block', marginBottom: '5px' }}>Target Role:</label><input type="text" id="role" value={userRole} onChange={(e) => setUserRole(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} placeholder="e.g., Frontend Developer, Data Scientist"/></div> <div><label htmlFor="experience" style={{ display: 'block', marginBottom: '5px' }}>Experience Level:</label><input type="text" id="experience" value={userExperience} onChange={(e) => setUserExperience(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} placeholder="e.g., Internship, Entry-Level, 5+ Years"/></div> <div><label htmlFor="skills" style={{ display: 'block', marginBottom: '5px' }}>Key Skills/Technologies:</label><input type="text" id="skills" value={userSkills} onChange={(e) => setUserSkills(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} placeholder="e.g., Python, SQL, AWS, Communication"/></div> <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer', alignSelf: 'flex-start', marginTop: '10px' }}>Start Practice</button> </form> </div> );
  }

  // 2. Loading state
  if (isLoading) {
     return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading personalized questions...</div>;
  }

  // 3. Error state
  if (error) {
     return <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'sans-serif' }}>{error}</div>;
  }

  // 4. Completion screen
  if (isComplete) {
    console.log("Rendering Completion Screen. Feedback Results:", feedbackResults);

    // Prepare Chart Data (using REAL scores from state)
    const chartLabels = feedbackResults.map((_, index) => `Q${index + 1}`);
    const chartScores = feedbackResults.map(result => result.score ?? 0); // Use real score, default 0
    const chartData = { labels: chartLabels, datasets: [ { label: 'Score', data: chartScores, backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, }, ], };
    const chartOptions = { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Performance Score' }, tooltip: { callbacks: { label: function(context: any) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += `${context.parsed.y} / 10`; } return label; } } } }, scales: { y: { beginAtZero: true, max: 10, title: { display: true, text: 'Score' } }, x: { title: { display: true, text: 'Question' } } }, };

    // JSX for Completion Screen
    return ( <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}> <h2 style={{ textAlign: 'center' }}>Screening Round Complete!</h2> <h3 style={{ textAlign: 'center', marginBottom: '10px', color: '#555' }}>Performance Summary:</h3> {/* Chart */} <div style={{ width: '90%', maxWidth: '600px', margin: '20px auto', padding: '10px', border: '1px solid #eee', borderRadius: '8px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}> {chartScores.length > 0 ? <Bar options={chartOptions} data={chartData} /> : <p>No score data available.</p>} </div> <h3 style={{ textAlign: 'center', marginTop: '40px', marginBottom: '25px', color: '#555', borderTop: '1px solid #eee', paddingTop: '30px' }}>Detailed Feedback:</h3> {feedbackResults.length > 0 ? ( <div style={{ textAlign: 'left' }}> {feedbackResults.map((result, index) => ( <div key={index} style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}> <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '8px' }}> Question {index + 1}: <span style={{ fontWeight: 'normal' }}>{result.question}</span> {/* Display Score */} <span style={{ float: 'right', fontWeight: 'bold', color: result.score !== undefined && result.score < 5 ? 'red' : (result.score !== undefined && result.score >= 8 ? 'green' : '#333') }}> Score: {result.score !== undefined ? `${result.score}/10` : 'N/A'} </span> </h4> <div style={{ marginBottom: '15px' }}> <strong style={{ display: 'block', marginBottom: '5px', color: '#444' }}>Your Answer:</strong> <p style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: '10px 15px', borderRadius: '4px', border: '1px solid #eee', margin: 0, lineHeight: '1.6', color: '#333' }}> {result.answer || '(No answer recorded)'} </p> </div> {/* Feedback Analysis Section */} <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '15px' }}> <h5 style={{marginTop: 0, marginBottom: '15px', color: '#333'}}>Feedback Analysis:</h5> <div style={{ marginBottom: '15px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}><strong style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}><span style={{ marginRight: '8px', fontSize: '1.1em' }}>🧐</span> Assessment:</strong><p style={{ margin: 0, lineHeight: '1.6', color: '#333' }}>{result.feedback.assessment}</p></div> <div style={{ marginBottom: '15px', padding: '10px', background: '#e6ffed', borderRadius: '4px', borderLeft: '4px solid #28a745' }}><strong style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', color: '#155724' }}><span style={{ marginRight: '8px', fontSize: '1.1em' }}>👍</span> Strength:</strong><p style={{ margin: 0, lineHeight: '1.6', color: '#155724' }}>{result.feedback.strength}</p></div> <div style={{ marginBottom: '15px', padding: '10px', background: '#e7f3ff', borderRadius: '4px', borderLeft: '4px solid #007bff' }}><strong style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', color: '#004085' }}><span style={{ marginRight: '8px', fontSize: '1.1em' }}>💡</span> Improvement Suggestion:</strong><p style={{ margin: 0, lineHeight: '1.6', color: '#004085' }}>{result.feedback.improvement}</p></div> {result.feedback.raw && result.feedback.assessment === "Could not automatically parse feedback." && <p style={{ fontSize: '0.85em', color: '#888', marginTop:'15px', fontStyle: 'italic', borderTop: '1px dashed #ccc', paddingTop: '10px' }}> (Raw AI response: {result.feedback.raw}) </p> } </div> </div> ))} </div> ) : ( <p style={{ textAlign: 'center', color: '#777' }}>No feedback was recorded for this session.</p> )} <div style={{ textAlign: 'center', marginTop: '30px' }}> <button onClick={() => window.location.reload()} style={{ padding: '12px 25px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1em', fontWeight: 'bold' }}> Start New Practice </button> </div> </div> );
  }

  // 5. No questions loaded check
   if (allQuestions.length === 0 && !isLoading && isDetailsSubmitted) {
       return <div style={{ padding: '20px', textAlign: 'center', color: 'orange', fontFamily: 'sans-serif' }}>No questions loaded. Check API or refresh.</div>;
  }
  // --- End Conditional Rendering ---


  // --- Main JSX Structure (Render the active question) ---
  if (!isDetailsSubmitted || isLoading || allQuestions.length === 0) { return null; } // Should be handled above, but safe fallback
  const currentQuestionText = allQuestions[currentQuestionIndex];
  return ( <div style={{ padding: '20px', fontFamily: 'sans-serif' }}> <h1 style={{fontSize: '1.5em', marginBottom: '10px'}}>Screening: {userRole} ({currentQuestionIndex + 1}/{allQuestions.length})</h1> {/* Question */} <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc', minHeight: '50px', background: '#f9f9f9' }}><p style={{ color: 'black', whiteSpace: 'pre-wrap', margin: 0 }}>{currentQuestionText}</p></div> {/* Answer */} <div style={{ margin: '20px 0' }}><textarea placeholder="Type your answer here..." rows={8} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} value={userAnswer} onChange={handleAnswerChange} disabled={timeLeft === 0}/></div> {/* Controls */} <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> <div><span>Time Left: </span><strong>{formatTime(timeLeft)}</strong>{timeLeft === 0 && <span style={{ color: 'red', marginLeft: '10px' }}>Time's Up!</span>}</div> <button style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={handleSubmit} disabled={timeLeft === 0}>{currentQuestionIndex === allQuestions.length - 1 ? 'Finish Round' : 'Submit and Next'}</button> </div> {/* Observer */} <div style={{marginTop: '15px', fontSize: '0.9em', color: '#777'}}><span>👀 Interview simulation active</span></div> </div> );
};

export default ScreeningRound; // Export component