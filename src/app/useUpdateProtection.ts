import { useEffect } from "react";
import { protectApplicationUpdate } from "./update-protection";
export function useUpdateProtection(protectedWriting: boolean): void {
  useEffect(() => protectedWriting ? protectApplicationUpdate() : undefined, [protectedWriting]);
}
