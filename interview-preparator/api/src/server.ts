// api/src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { AssemblyAI } from 'assemblyai';
import multer from 'multer';
import { ElevenLabsClient } from 'elevenlabs';
import { createClient } from '@deepgram/sdk';

const app = express();
const PORT = 3001;

// ========== API KEYS ==========

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("FATAL ERROR: Missing GEMINI_API_KEY");
  process.exit(1);
}

const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;
if (!assemblyaiApiKey) {
  console.error("FATAL ERROR: Missing ASSEMBLYAI_API_KEY");
  process.exit(1);
}

const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

// ========== INITIALIZE CLIENTS ==========

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
});

const assembly = new AssemblyAI({ apiKey: assemblyaiApiKey });
const elevenlabsClient = elevenlabsApiKey ? new ElevenLabsClient({ apiKey: elevenlabsApiKey }) : null;
const deepgramClient = deepgramApiKey ? createClient(deepgramApiKey) : null;

// ========== MIDDLEWARE ==========

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '5MB' }));
app.use(express.urlencoded({ extended: true, limit: '5MB' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ========== HELPERS ==========

const parseQuestionList = (text: string): string[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  return lines.map(line => line.replace(/^[\d]+\.\s*/, '').trim());
};

async function generateAudio(text: string): Promise<string | null> {
  if (!elevenlabsClient || !text) {
    console.error('ElevenLabs client not initialized or text missing');
    return null;
  }
  try {
    const voiceId = '1SM7GgM6IMuvQlz2BwM3'; // Replace with valid voice ID
    const audioStream = await elevenlabsClient.generate({
      voice: voiceId,
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    return buffer.toString('base64');
  } catch (error: any) {
    console.error('ElevenLabs TTS Error:', error?.message || error);
    return null;
  }
}

// ========== ROUTES ==========

// --- SCREENING ROUND ---

app.get('/api/screening/start', async (req: Request, res: Response) => {
  const role = (req.query.role as string) || 'generic software developer';
  const experience = (req.query.experience as string) || 'unspecified experience level';
  const skills = (req.query.skills as string) || 'various technical skills';

  try {
    const prompt = `Generate a numbered list of 5 unique and thought-provoking screening interview questions tailored for a candidate applying for a '${role}' position with '${experience}' experience, highlighting skills like '${skills}'. Avoid generic questions. Each question should start with the number and a period.`;
    const result = await model.generateContent(prompt);
    const rawText = result.response?.text() || '';
    const questions = parseQuestionList(rawText);
    if (questions.length === 0) throw new Error('No questions generated');
    res.json({ questions });
  } catch (error: any) {
    console.error('Error generating screening questions:', error);
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

app.post('/api/screening/submit', async (req: Request, res: Response) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Missing question or answer' });

  try {
    const prompt = `You are an expert interview coach. Provide feedback and a score out of 10 for the following answer. Return ONLY a JSON object with keys: assessment, strength, improvement, scoreOutOf10.

Interview Question: "${question}"
Candidate's Answer: "${answer}"`;

    const result = await model.generateContent(prompt);
    const text = result.response?.text() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse feedback JSON');
    const feedback = JSON.parse(jsonMatch[0]);
    res.json({ feedback });
  } catch (error: any) {
    console.error('Error generating feedback:', error);
    res.status(500).json({ error: error.message || 'Failed to generate feedback' });
  }
});

// --- FINAL ROUND ---

app.get('/api/finalround/start', async (_req: Request, res: Response) => {
  const initialQuestion = "What is your greatest strength?";
  try {
    const audioBase64 = await generateAudio(initialQuestion);
    res.json({ firstQuestionText: initialQuestion, audioData: audioBase64 });
  } catch (error: any) {
    console.error('Error generating initial question audio:', error);
    res.status(500).json({ error: error.message || 'Failed to generate audio' });
  }
});

app.post('/api/finalround/submit', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  try {
    const uploadURL = await assembly.files.upload(req.file.buffer);
    const transcript = await assembly.transcripts.create({ audio_url: uploadURL, language_code: 'en_us' });

    let transcriptData = await assembly.transcripts.get(transcript.id);
    while (transcriptData.status !== 'completed' && transcriptData.status !== 'error') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      transcriptData = await assembly.transcripts.get(transcript.id);
    }

    if (transcriptData.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${transcriptData.error}`);
    }

    res.json({
      transcript: transcriptData.text,
      keywords: transcriptData.topics || [],
    });
  } catch (error: any) {
    console.error('Error processing audio submission:', error);
    res.status(500).json({ error: error.message || 'Failed to process audio' });
  }
});

app.post('/api/finalround/next', async (req: Request, res: Response) => {
  const { history, role } = req.body;
  if (!history || !Array.isArray(history)) return res.status(400).json({ error: 'Invalid history format' });

  try {
    const userResponse = history.length > 0 ? history[history.length - 1].parts : '';
    const isLastQuestion = history.length >= 5;

    let nextQuestion = isLastQuestion
      ? "Thank you for your responses. That concludes our interview today. We'll be in touch soon with next steps."
      : (await model.generateContent(
          `You are an interviewer for a ${role || 'software developer'} position. 
The candidate just answered: "${userResponse}". 
Based on their response, ask a single thoughtful follow-up interview question. 
Make your question natural and conversational. 
Return ONLY the question text without any additional context.`)).response?.text() || 'Could you tell me more about your experience?';

    const audioBase64 = await generateAudio(nextQuestion);
    res.json({
      role: 'model',
      nextQuestion,
      audioData: audioBase64,
      isClosing: isLastQuestion
    });
  } catch (error: any) {
    console.error('Error generating next question:', error);
    res.status(500).json({ error: error.message || 'Failed to generate next question' });
  }
});

// ========== START SERVER ==========

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
