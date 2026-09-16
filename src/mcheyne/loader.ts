import type { McheynePlan } from "./types";

let planPromise: Promise<McheynePlan> | null = null;

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

export function loadMcheynePlan(): Promise<McheynePlan> {
  if (!planPromise) {
    planPromise = fetch(assetUrl("/plans/mcheyne-classic.v1.json"))
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load the M'Cheyne plan (${response.status}).`);
        return response.json() as Promise<McheynePlan>;
      })
      .then((plan) => {
        if (plan.planId !== "mcheyne-classic" || plan.version !== 1 || plan.assignments.length !== 365) {
          throw new Error("The bundled M'Cheyne plan is invalid.");
        }
        return plan;
      });
  }
  return planPromise;
}
