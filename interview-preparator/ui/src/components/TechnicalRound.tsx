// src/components/TechnicalRound.tsx
import React, { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
// Import language extensions
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { cpp } from '@codemirror/lang-cpp';
import { Extension } from '@codemirror/state';
import CircularTimer from './CircularTimer';
import StarRating from './StarRating'; // Import StarRating component
import { useUserProfile } from '../context/UserProfileContext';
// --- Import CSS ---
import './TechnicalRound.css'; // Import the CSS file

// --- Types ---
type ChallengeType = 'live_coding' | 'code_review' | 'debug';
type TechnicalChallenge = {
  id: number;
  type: ChallengeType;
  instructions: string;
  codeSnippet?: string;
  language?: string;
};

type TechnicalFeedback = {
  assessment: string;
  positive_point: string;
  improvement_point: string;
  raw?: string;
};

type TechnicalFeedbackResult = {
  challengeId: number;
  challengeType: ChallengeType;
  challengeLanguage?: string;
  instructions: string;
  submittedCode?: string;
  submittedAnswerText?: string;
  feedback: TechnicalFeedback;
  score?: number; // Optional score for simulated ratings
};
// --- End Types ---

const TIME_PER_CHALLENGE = 300;
const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
  { value: 'php', label: 'PHP' },
];

const TechnicalRound = () => {
  const { profile } = useUserProfile(); // Get profile from context
  const [challenges, setChallenges] = useState<TechnicalChallenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState<number>(-1); // Start at -1 (not loaded)
  const [currentChallenge, setCurrentChallenge] = useState<TechnicalChallenge | null>(null);
  const [code, setCode] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [isRoundComplete, setIsRoundComplete] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(TIME_PER_CHALLENGE);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    profile.practiceLanguages.length > 0 ? profile.practiceLanguages[0] : SUPPORTED_LANGUAGES[0].value
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [technicalFeedbackResults, setTechnicalFeedbackResults] = useState<TechnicalFeedbackResult[]>([]);
  // --- NEW: State for expanded feedback cards ---
  const [expandedStates, setExpandedStates] = useState<Record<number, boolean>>({});
  // --- End NEW State ---

  // --- Fetch Challenges on Mount (Using Context) ---
  useEffect(() => {
    if (!profile.role || !profile.experience || !profile.skills || profile.practiceLanguages.length === 0) {
      console.log("Profile details not fully set yet, waiting.");
      return; // Don't fetch yet
    }

    setIsLoading(true);
    setError(null);
    setChallenges([]);
    setCurrentChallenge(null);
    setCurrentChallengeIndex(-1);
    setIsRoundComplete(false);
    setIsTimerActive(false);

    console.log("Fetching technical challenges for profile:", profile);
    const queryParams = new URLSearchParams({
      role: profile.role,
      experience: profile.experience,
      skills: profile.skills,
      langs: profile.practiceLanguages.join(','),
      otherSkills: profile.otherSkills || ''
    }).toString();

    fetch(`http://localhost:3001/api/technical/start?${queryParams}`)
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(`HTTP error! status: ${response.status} - ${errData.error || response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data && Array.isArray(data.challenges) && data.challenges.length > 0) {
          console.log("API Technical Challenges received:", data.challenges);
          setChallenges(data.challenges);
          setCurrentChallengeIndex(0);
        } else {
          throw new Error("Invalid or empty challenge list received from API.");
        }
      })
      .catch(err => {
        console.error("Error fetching technical challenges:", err);
        setError(`Failed to load challenges: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [profile.role, profile.experience, profile.skills, profile.practiceLanguages, profile.otherSkills]);

  // --- Set Current Challenge & Timer based on Index/Challenges ---
  useEffect(() => {
    if (!isLoading && !error && challenges.length > 0 && currentChallengeIndex >= 0 && currentChallengeIndex < challenges.length) {
      const challenge = challenges[currentChallengeIndex];
      setCurrentChallenge(challenge);
      setCode(challenge.codeSnippet || '');
      setTextAnswer('');

      if (challenge.type === 'live_coding') {
        const defaultLang = SUPPORTED_LANGUAGES.find(l => l.value === challenge.language && profile.practiceLanguages.includes(l.value)) ? challenge.language : profile.practiceLanguages[0];
        setSelectedLanguage(defaultLang || SUPPORTED_LANGUAGES[0].value);
      } else {
        setSelectedLanguage(challenge.language || '');
      }

      setTimeLeft(TIME_PER_CHALLENGE);
      setIsTimerActive(true);
      console.log(`Challenge ${currentChallengeIndex + 1} loaded and timer started.`);
    } else if (!isLoading && !error && challenges.length > 0 && currentChallengeIndex >= challenges.length) {
      setIsRoundComplete(true);
      setIsTimerActive(false);
      console.log("Index out of bounds - Round Complete.");
    } else {
      setCurrentChallenge(null);
      setIsTimerActive(false);
    }
  }, [challenges, currentChallengeIndex, isLoading, error, profile.practiceLanguages]);

  // --- Timer Countdown useEffect ---
  useEffect(() => {
    let intervalId: number | null = null;
    if (isTimerActive && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTimerActive, timeLeft]);

  // --- Event Handlers ---
  const onCodeChange = useCallback((value: string) => { setCode(value); }, []);
  const handleTextAnswerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setTextAnswer(event.target.value); };
  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (currentChallenge?.type === 'live_coding') {
      setSelectedLanguage(event.target.value);
    }
  };

  // --- UPDATED handleSubmit to use REAL score from backend ---
  const handleSubmit = () => {
    if (!currentChallenge) return;
    setIsTimerActive(false);

    const attemptData = {
      challengeId: currentChallenge.id,
      challengeType: currentChallenge.type,
      challengeLanguage: currentChallenge.language,
      instructions: currentChallenge.instructions,
      submittedCode: code,
      submittedAnswerText: textAnswer,
      selectedCodingLanguage: selectedLanguage
    };

    console.log(`Submitting Attempt Data...`, attemptData);

    fetch('http://localhost:3001/api/technical/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attemptData),
    })
      .then(response => {
        if (!response.ok) {
          console.error("Backend submission failed with status:", response.status);
        }
        return response.json();
      })
      .then(data => {
        console.log("Backend response (Feedback Received):", data);
        let feedbackToAdd: TechnicalFeedback;
        let scoreFromApi: number | undefined = undefined; // Variable to hold score

        if (data && data.feedback) {
          feedbackToAdd = {
            assessment: data.feedback.assessment || "Assessment missing.",
            positive_point: data.feedback.positive_point || "N/A",
            improvement_point: data.feedback.improvement_point || "N/A",
            raw: data.feedback.raw // Include raw if backend sends it on fallback
          };
          // --- Get Score from API Response ---
          if (typeof data.feedback.score === 'number' && data.feedback.score >= 0 && data.feedback.score <= 10) {
            scoreFromApi = data.feedback.score;
            console.log("Using score from API:", scoreFromApi);
          } else {
            console.warn("Invalid or missing score from API response, using default 0.");
            scoreFromApi = 0; // Default score if missing or invalid
          }
          // --- End Get Score ---
        } else {
          // Fallback if feedback object itself is missing
          feedbackToAdd = { assessment: "Feedback not available.", positive_point: "N/A", improvement_point: "N/A" };
          scoreFromApi = 0; // Default score
        }

        // Store result using the score from API (or default)
        const result: TechnicalFeedbackResult = {
          challengeId: attemptData.challengeId,
          challengeType: attemptData.challengeType,
          challengeLanguage: attemptData.challengeLanguage,
          instructions: attemptData.instructions,
          submittedCode: attemptData.submittedCode,
          submittedAnswerText: attemptData.submittedAnswerText,
          feedback: feedbackToAdd,
          score: scoreFromApi // <-- Use the score received from backend
        };
        setTechnicalFeedbackResults(prevResults => [...prevResults, result]);
      })
      .catch(err => {
        console.error("Error submitting technical attempt:", err);
        const errorFeedback: TechnicalFeedback = { assessment: `Error receiving feedback: ${err.message}`, positive_point: "N/A", improvement_point: "N/A" };
        const result: TechnicalFeedbackResult = {
          challengeId: attemptData.challengeId,
          challengeType: attemptData.challengeType,
          instructions: attemptData.instructions,
          feedback: errorFeedback,
          score: 0 // Default score for errors
        };
        setTechnicalFeedbackResults(prevResults => [...prevResults, result]);
      })
      .finally(() => {
        if (currentChallengeIndex < challenges.length - 1) {
          setCurrentChallengeIndex(prev => prev + 1);
        } else {
          setIsRoundComplete(true);
        }
      });
  };

  // --- NEW: Handler to toggle feedback card expansion ---
  const toggleExpand = (index: number) => {
    setExpandedStates(prev => ({
      ...prev, // Keep existing states
      [index]: !prev[index] // Toggle the state for the clicked index
    }));
  };
  // --- End NEW Handler ---
  // --- End Event Handlers ---

  // --- Conditional Rendering ---
  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading technical challenges...</div>;
  }
  if (error) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>Error: {error}</div>;
  }
  if (isRoundComplete) {
    const validScores = technicalFeedbackResults.map(r => r.score ?? 0).filter(s => s > 0);
    const averageScore = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: 'auto' }}>
        {/* --- Overall Summary --- */}
        <div style={{ textAlign: 'center', margin: '30px 0', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>Overall Performance (Simulated)</h3>
          <StarRating score={averageScore} maxScore={10} size={30} />
          <p style={{ margin: '5px 0 0', fontWeight: 'bold', fontSize: '1.2em' }}>
            Average Score: {averageScore.toFixed(1)} / 10
          </p>
        </div>

        <h3 style={{ textAlign: 'center', marginTop: '40px', marginBottom: '25px', color: '#555', borderTop: '1px solid #eee', paddingTop: '30px' }}>Detailed Feedback per Challenge:</h3>
        {technicalFeedbackResults.length > 0 ? (
          <div style={{ textAlign: 'left' }}>
            {technicalFeedbackResults.map((result, index) => {
              const isExpanded = !!expandedStates[index];

              return (
                <div
                  key={result.challengeId || index}
                  className="feedback-card"
                  style={{ '--card-delay': `${index * 0.1}s` } as React.CSSProperties}
                >
                  {/* Card Header */}
                  <div
                    className="feedback-card-header"
                    onClick={() => toggleExpand(index)}
                  >
                    <h4>
                      Challenge {index + 1}: {result.challengeType.replace('_', ' ')} ({result.challengeLanguage || 'N/A'})
                    </h4>
                    {result.score !== undefined && (
                      <StarRating score={result.score} maxScore={10} size={20} />
                    )}
                    <span className={`feedback-toggle-icon ${isExpanded ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  </div>

                  {/* Collapsible Content */}
                  <div className={`feedback-details ${isExpanded ? 'expanded' : ''}`}>
                    <div className="feedback-analysis-content">
                      <h5>Feedback Analysis:</h5>
                      <div className="feedback-block assessment-block">
                        <strong><span>🧐</span> Assessment:</strong>
                        <p>{result.feedback.assessment}</p>
                      </div>
                      <div className="feedback-block positive-block">
                        <strong><span>👍</span> Positive Point:</strong>
                        <p>{result.feedback.positive_point}</p>
                      </div>
                      <div className="feedback-block improvement-block">
                        <strong><span>💡</span> Improvement Point:</strong>
                        <p>{result.feedback.improvement_point}</p>
                      </div>
                      {result.feedback.raw && result.feedback.assessment === "Could not automatically parse feedback." && (
                        <p className="raw-feedback">(Raw AI response: {result.feedback.raw})</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#777' }}>No feedback was recorded for this session.</p>
        )}
      </div>
    );
  }
  if (!currentChallenge && !isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'orange' }}>Could not load current challenge data.</div>;
  }
  if (!currentChallenge) return null;

  // --- Editor Language Extension Logic ---
  let languageExtension: Extension[] = [];
  switch (selectedLanguage.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      languageExtension = [javascript({ jsx: true, typescript: true })];
      break;
    case 'python':
      languageExtension = [python()];
      break;
    case 'java':
      languageExtension = [java()];
      break;
    case 'sql':
      languageExtension = [sql()];
      break;
    case 'php':
      languageExtension = [php()];
      break;
    case 'cpp':
    case 'c':
      languageExtension = [cpp()];
      break;
    default:
      languageExtension = [];
      break;
  }

  // --- Main JSX ---
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', gap: '20px' }}>
        <div style={{ flexGrow: 1 }}>
          <h1 style={{ fontSize: '1.5em', marginBottom: '15px' }}>
            Technical Round ({currentChallengeIndex + 1}/{challenges.length}) - <span style={{ textTransform: 'capitalize' }}>{currentChallenge.type.replace('_', ' ')}</span> {` (${currentChallenge.language || 'N/A'})`}
          </h1>
          <div style={{ marginBottom: '20px', padding: '15px 20px', border: '1px solid #ddd', background: '#fdfdfd', borderRadius: '5px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#111', fontSize: '1.2em' }}>Task:</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.6', color: 'black', fontSize: '1.0em' }}>{currentChallenge.instructions}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', paddingTop: '10px' }}>
          <CircularTimer timeLeft={timeLeft} totalTime={TIME_PER_CHALLENGE} />
          {timeLeft === 0 && <span style={{ color: 'red', display: 'block', fontSize: '0.9em', marginTop: '2px' }}>Time's Up!</span>}
          {currentChallenge.type === 'live_coding' && (
            <div style={{ marginTop: '15px' }}>
              <label htmlFor="languageSelect" style={{ marginRight: '8px', fontSize: '0.9em' }}>Language:</label>
              <select id="languageSelect" value={selectedLanguage} onChange={handleLanguageChange} style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                {profile.practiceLanguages.map(langValue => {
                  const langLabel = SUPPORTED_LANGUAGES.find(l => l.value === langValue)?.label || langValue;
                  return <option key={langValue} value={langValue}>{langLabel}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginBottom: '15px', border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
        <CodeMirror value={code} height="500px" extensions={languageExtension} onChange={setCode} theme="dark" />
      </div>

      {/* Add the text area here */}
      {(currentChallenge.type === 'code_review' || currentChallenge.type === 'debug') && (
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="textAnswer" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            {currentChallenge.type === 'code_review' ? 'Your Review / Comments:' : 'Your Explanation / Bug Analysis:'}
          </label>
          <textarea
            id="textAnswer"
            value={textAnswer}
            onChange={handleTextAnswerChange}
            rows={6}
            style={{
              width: '100%',
              padding: '10px',
              boxSizing: 'border-box',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '1em',
            }}
            placeholder="Enter your analysis here..."
          />
        </div>
      )}
      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <button onClick={handleSubmit} style={{ padding: '10px 20px', cursor: 'pointer' }} disabled={timeLeft === 0}>
          {currentChallengeIndex === challenges.length - 1 ? 'Finish Technical Round' : 'Submit & Next Challenge'}
        </button>
      </div>
    </div>
  );
};

export default TechnicalRound;