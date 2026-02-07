import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Match, Innings } from "../types";

export interface CommentaryResult {
  text: string;
  audioBase64?: string;
}

const LOCAL_TEMPLATES: Record<string, string[]> = {
  dot: [
    "Good length ball, defended back to the bowler.",
    "Driven straight to the fielder. No run.",
    "Beaten! That was a peach of a delivery.",
    "Played with a straight bat. Dot ball.",
    "Short and wide, but find the fielder. Missed opportunity."
  ],
  one: [
    "Pushed into the gap for a single.",
    "Working the ball away to the leg side for a run.",
    "Good running, they scamper through for one.",
    "Tapped into the off side and they take a quick single.",
    "Just a nudge into the deep for a comfortable single."
  ],
  two: [
    "Great placement! They'll come back for the second easily.",
    "Pushed into the deep, excellent hustle for two runs.",
    "Tucked off the pads, they push hard and get the couple.",
    "Driven wide of the sweeper, easy two there."
  ],
  three: [
    "Timed beautifully! The outfield is slow, so they'll run three.",
    "Massive gap! They are sprinting for the third... and they make it!",
    "Great running between the wickets, that's a hard-earned three."
  ]
};

/**
 * Generates live commentary using Gemini models.
 * Uses gemini-3-flash-preview for text and gemini-2.5-flash-preview-tts for audio.
 */
export async function generateLiveCommentary(match: Match, ball: any): Promise<CommentaryResult> {
  // Always initialize a new GoogleGenAI instance right before making an API call to ensure it uses the latest configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Local templates for speed (0-3 runs, non-wicket)
  if (!ball.isWicket && ball.runs >= 0 && ball.runs <= 3 && !ball.isExtra) {
    const key = ball.runs === 0 ? 'dot' : ball.runs === 1 ? 'one' : ball.runs === 2 ? 'two' : 'three';
    const pool = LOCAL_TEMPLATES[key];
    if (pool) {
      const text = pool[Math.floor(Math.random() * pool.length)];
      return { text: `${ball.striker}: ${text}` };
    }
  }

  const currentInnings = match.innings[match.currentInnings - 1] as Innings;
  const situation = `${currentInnings.battingTeam} are ${currentInnings.runs}/${currentInnings.wickets} in ${Math.floor(currentInnings.balls / 6)}.${currentInnings.balls % 6} overs.`;
  const eventDescription = ball.isWicket 
    ? `WICKET! ${ball.striker} is OUT (${ball.wicketType}).` 
    : ball.isExtra 
      ? `${ball.runs} runs from a ${ball.extraType}.`
      : `BOOM! A massive ${ball.runs} runs! Absolute boundary!`;

  // 2. Parallel AI Requests for big moments (4s, 6s, Wickets, Extras)
  // Fix: Simplify content input and ensure model and config follow latest guidelines.
  const textTask = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Professional cricket commentary for: ${ball.striker} vs ${ball.bowler}. Event: ${eventDescription}. Match context: ${situation}. Short, punchy, 1-sentence.`,
    config: {
      systemInstruction: "You are a world-class, energetic cricket commentator. Provide a single, vivid sentence for the current ball.",
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const audioTask = ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Perform this moment as a commentator: ${eventDescription} ${ball.striker} vs ${ball.bowler}.` }] }],
    config: {
      systemInstruction: "You are an excited, professional radio commentator. Speak with energy and high naturalness. Mention the player and the result clearly.",
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    }
  });

  try {
    const [textRes, audioRes] = await Promise.allSettled([textTask, audioTask]);
    
    let text = "What an unbelievable turn of events!";
    let audioBase64: string | undefined;

    if (textRes.status === 'fulfilled') {
      // Fix: Access response text using the .text property as required.
      text = textRes.value.text || text;
    }

    if (audioRes.status === 'fulfilled') {
      // Fix: Extract audio bytes from candidates parts using the recommended pattern.
      const res = audioRes.value;
      audioBase64 = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    }

    return { text, audioBase64 };
  } catch (error) {
    console.error("Commentary Parallel Error:", error);
    return { text: ball.isWicket ? "OUT! A major breakthrough!" : "That's a vital boundary!" };
  }
}
