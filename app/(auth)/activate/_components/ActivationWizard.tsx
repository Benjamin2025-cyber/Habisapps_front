"use client";

import { useState } from "react";
import { ActivationPhoneStep } from "./ActivationPhoneStep";
import { ActivationVerifyStep } from "./ActivationVerifyStep";
import { ActivationSuccess } from "./ActivationSuccess";

type Step = "phone" | "verify" | "done";

export function ActivationWizard() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");

  if (step === "phone") {
    return (
      <ActivationPhoneStep
        initialPhone={phone}
        onSubmitted={(submittedPhone) => {
          setPhone(submittedPhone);
          setStep("verify");
        }}
      />
    );
  }

  if (step === "verify") {
    return (
      <ActivationVerifyStep
        phone={phone}
        onBack={() => setStep("phone")}
        onSuccess={() => setStep("done")}
      />
    );
  }

  return <ActivationSuccess />;
}
