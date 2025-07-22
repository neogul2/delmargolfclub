interface Score {
  hole_number: number;
  score: number;
}

export const calculateTotal = (scores: Score[] = []): number => {
  return scores.reduce((sum, s) => sum + (s.score || 0), 0);
};

export const getCompletedHoles = (scores: Score[] = []): string => {
  // 실제로 점수가 입력된 홀의 수만 카운트
  const completedHoles = scores.filter(s => s.score !== null && s.score !== undefined).length;
  return `${completedHoles}/18`;
}; 