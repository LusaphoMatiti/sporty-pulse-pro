export type SessionDraft = {
  sessionNumber: number;
  currentExerciseIdx: number;
  completedSets: number;
  elapsedSeconds: number;
  logs: {
    plannedExerciseId: string;
    actualSets: number;
    actualReps: number;
    weightKg?: number;
  }[];
};
