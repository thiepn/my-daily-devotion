import type { ScriptureReference } from "../domain/types";

export type McheyneGroup = "family" | "secret";

export interface McheyneReading {
  group: McheyneGroup;
  displayReference: string;
  references: ScriptureReference[];
}

export interface McheyneAssignment {
  sequence: number;
  calendarKey: string;
  readings: [McheyneReading, McheyneReading, McheyneReading, McheyneReading];
}

export interface McheynePlan {
  planId: "mcheyne-classic";
  version: 1;
  assignments: McheyneAssignment[];
}

export interface AssignmentProgressSummary {
  assignment: McheyneAssignment;
  completedCount: number;
}
