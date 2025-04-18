// src/components/FinalRound.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUserProfile } from '../context/UserProfileContext';
import RecordRTC from 'recordrtc';

type HistoryEntry = { role: 'user' | 'model'; parts: string };
type RoundState =
  | 'IDLE'
  | 'ASKING_QUESTION'
  | 'PLAYING_AUDIO'
  | 'USER_READY'
  | 'RECORDING'
  | 'PROCESSING_AUDIO'
  | 'PROCESSING_AI'
  | 'ROUND_OVER'
  | 'ERROR';

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
};

const FinalRound: React.FC = () => {
  const { profile } = useUserProfile();

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [interviewerQuestion, setInterviewerQuestion] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [roundState, setRoundState] = useState<RoundState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [recorderReady, setRecorderReady] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<RecordRTC | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const componentMountedRef = useRef<boolean>(true);

  const stopMediaStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      console.log('Media stream stopped');
    }
  }, []);

  const playAudioFromBase64 = useCallback((base64String: string | null) => {
    if (!base64String) {
      console.log("Skipping TTS playback: No audio data.");
      return;
    }
    try {
      const audioSrc = `data:audio/mp3;base64,${base64String}`;
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioSrc;
        audioPlayerRef.current.play().catch((err: any) => {
          console.error('Error playing audio:', err);
          setError(`Audio playback error: ${getErrorMessage(err)}`);
        });
      }
    } catch (err: any) {
      console.error('Error processing audio data:', err);
      setError(`Audio processing error: ${getErrorMessage(err)}`);
    }
  }, []);

  const callFinalApi = useCallback(
    async (transcript: string) => {
      setRoundState('PROCESSING_AI');
      const currentHistory = [...history, { role: 'user', parts: transcript }];
      try {
        const response = await fetch('http://localhost:3001/api/finalround/next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: currentHistory, role: profile?.role }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'API error');

        const roleFromApi = data.role;
        if (roleFromApi !== 'user' && roleFromApi !== 'model') {
          throw new Error(`Invalid role received: ${roleFromApi}`);
        }

        setHistory([...currentHistory, { role: roleFromApi, parts: data.nextQuestion }]);
        setInterviewerQuestion(data.nextQuestion);
        if (data.isClosing) {
          setRoundState('ROUND_OVER');
          playAudioFromBase64(data.audioData);
        } else {
          setRoundState('PLAYING_AUDIO');
          playAudioFromBase64(data.audioData);
        }
      } catch (err: any) {
        setError(getErrorMessage(err));
        setRoundState('ERROR');
      }
    },
    [history, profile?.role, playAudioFromBase64]
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setRoundState('PROCESSING_AUDIO');
      console.log("transcribeAudio called with blob size:", audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'user_audio.webm');
      
      try {
        console.log("Sending audio to backend...");
        const response = await fetch('http://localhost:3001/api/finalround/submit', {
          method: 'POST',
          body: formData,
        });
        
        console.log("Backend response status:", response.status);
        
        // Try to log the raw response for debugging
        const responseText = await response.text();
        console.log("Raw response:", responseText);
        
        // Parse the JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse JSON response:", e);
          throw new Error("Invalid response from server");
        }
        
        if (!response.ok) {
          console.error("Transcription error:", data);
          throw new Error(data.error || 'Transcription failed');
        }

        console.log("Transcription successful:", data.transcript);
        setUserTranscript(data.transcript);
        await callFinalApi(data.transcript);
      } catch (err: any) {
        console.error("Transcription request error:", err);
        setError(`Transcription error: ${getErrorMessage(err)}`);
        setRoundState('ERROR');
      }
    },
    [callFinalApi]
  );

  const fetchInitialQuestionAndAudio = useCallback(async () => {
    console.log('fetchInitialQuestionAndAudio called');
    if (!profile?.role) {
      setError('Profile role missing');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/finalround/start?role=${profile?.role}`);
      console.log('API response:', response);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error: ${errText}`);
      }
      const data = await response.json();
      setHistory([{ role: 'model', parts: data.firstQuestionText }]);
      setInterviewerQuestion(data.firstQuestionText);
      setIsLoading(false);
      console.log('setIsLoading(false) - success');
      setRoundState('PLAYING_AUDIO');
      playAudioFromBase64(data.audioData);
    } catch (err: any) {
      console.error('fetchInitialQuestionAndAudio error:', err);
      setError(getErrorMessage(err));
      setIsLoading(false);
      console.log('setIsLoading(false) - error');
      setRoundState('ERROR');
    }
  }, [profile?.role, playAudioFromBase64]);

  const setupRecorder = useCallback(async () => {
    console.log('setupRecorder called');
    try {
      // Stop any existing stream first
      stopMediaStream();

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');

      audioStreamRef.current = stream;
      
      // Keep the stream active with a hidden audio element
      const hiddenAudio = document.createElement('audio');
      hiddenAudio.srcObject = stream;
      hiddenAudio.muted = true;
      hiddenAudio.play().catch(e => console.error("Error playing hidden audio:", e));

      // Create and configure the recorder
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        sampleRate: 44100,
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        disableLogs: false, // Enable logs for debugging
      });

      // Set the recorder ref
      mediaRecorderRef.current = recorder;
      setRecorderReady(true);
      console.log('Recorder setup complete');
      return true;
    } catch (err: any) {
      console.error('setupRecorder error:', err);
      setError(`Microphone error: ${getErrorMessage(err)}`);
      setIsLoading(false);
      setRoundState('ERROR');
      return false;
    }
  }, [stopMediaStream]);

  const handleRecord = useCallback(() => {
    console.log("handleRecord called, recorder status:", 
      mediaRecorderRef.current ? "exists" : "null", 
      "ready:", recorderReady,
      "state:", roundState);
      
    if (!mediaRecorderRef.current || !recorderReady) {
      console.log("Recorder not ready, setting up...");
      setupRecorder().then(success => {
        if (success && roundState === 'USER_READY') {
          setTimeout(() => {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
              try {
                console.log("Starting recording after setup...");
                recorder.startRecording();
                setIsRecording(true);
                setRoundState('RECORDING');
              } catch (err: any) {
                console.error("Error starting recording after setup:", err);
                setError(`Failed to start recording: ${getErrorMessage(err)}`);
              }
            } else {
              console.error("Recorder not available after setup");
              setError("Recorder not available after setup");
            }
          }, 500);
        }
      }).catch((err: unknown) => {
        setError(`Setup recorder failed: ${getErrorMessage(err)}`);
      });
      return;
    }

    if (isRecording) {
      try {
        console.log("Stopping recording...");
        const recorder = mediaRecorderRef.current;
        if (recorder) {
          recorder.stopRecording(() => {
            try {
              const blob = recorder.getBlob();
              console.log("Recording stopped, blob size:", blob.size, "bytes");
              if (blob && blob.size > 0) {
                setRoundState('PROCESSING_AUDIO');
                transcribeAudio(blob);
              } else {
                console.warn("Empty recording blob");
                setRoundState('USER_READY');
              }
            } catch (err: any) {
              console.error("Error in stopRecording callback:", err);
              setError(`Recording error: ${getErrorMessage(err)}`);
              setRoundState('USER_READY');
            }
          });
        } else {
          console.error("Recorder not available when stopping");
          setError("Recorder not available when stopping");
        }
        setIsRecording(false);
      } catch (err: any) {
        console.error("Error stopping recording:", err);
        setError(getErrorMessage(err));
        setRoundState('USER_READY');
        setIsRecording(false);
      }
    } else {
      if (roundState === 'USER_READY') {
        try {
          console.log("Starting recording...");
          const recorder = mediaRecorderRef.current;
          if (recorder) {
            recorder.startRecording();
            setIsRecording(true);
            setRoundState('RECORDING');
          } else {
            console.error("Recorder not available when starting");
            setError("Recorder not available when starting");
          }
        } catch (err: any) {
          console.error("Error starting recording:", err);
          setError(getErrorMessage(err));
        }
      }
    }
  }, [isRecording, roundState, recorderReady, setupRecorder, transcribeAudio]);

  // Handle audio level visualization when recording
  useEffect(() => {
    if (isRecording && audioStreamRef.current) {
      let audioContext: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      let microphone: MediaStreamAudioSourceNode | null = null;
      let animationFrame: number | null = null;
      
      try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(audioStreamRef.current);
        microphone.connect(analyser);
        analyser.fftSize = 256;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkAudioLevel = () => {
          if (!isRecording) return;
          
          analyser?.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average);
          
          if (isRecording) {
            animationFrame = requestAnimationFrame(checkAudioLevel);
          }
        };
        
        checkAudioLevel();
      } catch (err) {
        console.error("Error setting up audio visualization:", err);
      }
      
      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        
        if (microphone) {
          microphone.disconnect();
        }
        
        if (audioContext) {
          audioContext.close().catch(err => {
            console.error("Error closing audio context:", err);
          });
        }
        
        setAudioLevel(0);
      };
    } else {
      setAudioLevel(0);
    }
  }, [isRecording]);

  // Effect for audio player
  useEffect(() => {
    if (!audioPlayerRef.current) return;

    const onEnded = () => {
      if (roundState === 'PLAYING_AUDIO') {
        setRoundState('USER_READY');
      }
    };

    audioPlayerRef.current.addEventListener('ended', onEnded);
    return () => {
      audioPlayerRef.current?.removeEventListener('ended', onEnded);
    };
  }, [roundState]);

  // Main initialization effect - runs only once
  useEffect(() => {
    componentMountedRef.current = true;
    console.log('useEffect - Initial setup effect called');

    const initialize = async () => {
      console.log('initialize called');
      if (roundState === 'IDLE' && componentMountedRef.current) {
        console.log('roundState === IDLE');
        const success = await setupRecorder();
        if (componentMountedRef.current && success) {
          console.log('setupRecorder successful, calling fetchInitialQuestionAndAudio');
          fetchInitialQuestionAndAudio();
        } else {
          console.log('setupRecorder failed, or component unmounted');
        }
      }
    };

    initialize();

    // Cleanup function that runs only on unmount
    return () => {
      componentMountedRef.current = false;
      console.log('useEffect - Component unmounting cleanup');
      
      // Clean up the recorder only on full component unmount
      if (mediaRecorderRef.current) {
        try {
          console.log("Cleaning up recorder on unmount...");
          setRecorderReady(false);
          
          const recorder = mediaRecorderRef.current;
          if (isRecording) {
            console.log("Stopping recording during unmount...");
            try {
              recorder.stopRecording(() => {
                try {
                  recorder.destroy();
                  console.log("Recorder destroyed after stop on unmount");
                } catch (e: any) {
                  console.error("Error destroying recorder after stop on unmount:", getErrorMessage(e));
                }
              });
            } catch (e: any) {
              console.error("Error stopping recording during unmount:", getErrorMessage(e));
              try {
                recorder.destroy();
              } catch (e2: any) {
                console.error("Error destroying recorder after failed stop on unmount:", getErrorMessage(e2));
              }
            }
          } else {
            console.log("Destroying recorder directly during unmount...");
            try {
              recorder.destroy();
              console.log("Recorder destroyed during unmount");
            } catch (e: any) {
              console.error("Error destroying recorder during unmount:", getErrorMessage(e));
            }
          }
          
          mediaRecorderRef.current = null;
        } catch (e: any) {
          console.error("Error cleaning up recorder during unmount:", getErrorMessage(e));
        }
      }

      stopMediaStream();
    };
  }, []); // Empty dependency array - run only on mount and cleanup on unmount

  let statusMessage = '';
  switch (roundState) {
    case 'IDLE': statusMessage = 'Loading...'; break;
    case 'ASKING_QUESTION': statusMessage = 'The interviewer is asking a question...'; break;
    case 'PLAYING_AUDIO': statusMessage = "Playing the interviewer's question..."; break;
    case 'USER_READY': statusMessage = "Ready to record your answer. Click 'Start Speaking'."; break;
    case 'RECORDING': statusMessage = 'Recording your answer...'; break;
    case 'PROCESSING_AUDIO': statusMessage = 'Processing your audio...'; break;
    case 'PROCESSING_AI': statusMessage = 'AI is analyzing your response...'; break;
    case 'ROUND_OVER': statusMessage = 'The round is over. Thank you!'; break;
    case 'ERROR': statusMessage = `Error: ${error}. Please refresh.`; break;
    default: statusMessage = 'Unknown state...'; break;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>Final Round Simulation (RecordRTC + TTS)</h1>
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
      {isLoading && <p>Loading Interview...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!isLoading && !error && (
        <>
          <div>
            <h3>Interviewer Question:</h3>
            <p>{interviewerQuestion}</p>
          </div>
          <div>
            <button
              onClick={handleRecord}
              disabled={roundState !== 'USER_READY' && roundState !== 'RECORDING'}
              style={{
                padding: '10px 20px',
                backgroundColor: isRecording ? '#ff4d4d' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: roundState !== 'USER_READY' && roundState !== 'RECORDING' ? 'not-allowed' : 'pointer',
              }}
            >
              {isRecording ? 'Stop Recording' : 'Start Speaking'}
            </button>
          </div>
          <div>
            <p style={{ fontWeight: 'bold' }}>{statusMessage}</p>
            {recorderReady ? (
              <p style={{ color: 'green' }}>Microphone ready</p>
            ) : (
              <p style={{ color: 'orange' }}>Microphone initializing...</p>
            )}
            {isRecording && (
              <div>
                <div style={{ 
                  width: '100%', 
                  height: '20px', 
                  backgroundColor: '#eee',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginTop: '10px'
                }}>
                  <div style={{ 
                    width: `${Math.min(100, audioLevel * 2)}%`, 
                    height: '100%', 
                    backgroundColor: '#4CAF50',
                    transition: 'width 0.1s'
                  }} />
                </div>
                <p>Audio level: {Math.round(audioLevel)}</p>
              </div>
            )}
            {userTranscript && (
              <div>
                <h4>Your Last Response:</h4>
                <p style={{ fontStyle: 'italic' }}>{userTranscript}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinalRound;