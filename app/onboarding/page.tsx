import { Suspense } from "react";
import Onboarding from "@/views/Onboarding";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
