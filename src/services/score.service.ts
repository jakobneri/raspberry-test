import { readFileSync, writeFileSync } from "node:fs";

export interface Score {
  score: number;
  userId: string;
  timestamp: string;
}

const SCORES_FILE = "config/scores.json";
let scores: Score[] = [];

// Load scores on module initialization
try {
  const scoresData = JSON.parse(readFileSync(SCORES_FILE, "utf8"));
  scores = scoresData.topScores || [];
} catch (err) {
  console.log("[Scores] No existing scores file, starting fresh");
  scores = [];
}

export const addScore = (score: number, userId: string): void => {
  scores.push({
    score,
    userId,
    timestamp: new Date().toISOString(),
  });

  // Keep only top 100 scores
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 100);

  // Save top 10 to file
  saveScores();
};

export const getTopScores = (limit: number = 10): Score[] => {
  return scores.slice(0, limit);
};

const saveScores = (): void => {
  writeFileSync(
    SCORES_FILE,
    JSON.stringify({ topScores: scores.slice(0, 10) }, null, 2)
  );
};
