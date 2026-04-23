import Image from "next/image";

const HOW_IT_WORK_STEPS = [
  {
    title: "Get a code",
    description: "Create a unique referral code to share.",
    iconSrc: "/icons/how-it-work-step-code.png",
    iconAlt: "Referral code step icon",
  },
  {
    title: "Send them an invite",
    description:
      "Send your link through all of social media platforms to your friends.",
    iconSrc: "/icons/how-it-work-step-invite.png",
    iconAlt: "Send invite step icon",
  },
  {
    title: "Start earning!",
    description: "Earn points for every successful referral.",
    iconSrc: "/icons/how-it-work-step-earn.png",
    iconAlt: "Start earning step icon",
  },
] as const;

const HowItWork = () => {
  return (
    <section className="column w-full gap-3">
      <h3 className="text-text-heading text-[22px] font-semibold tracking-[-0.02em]">
        How It Works
      </h3>

      <div className="border-border-main bg-surface-card overflow-hidden rounded-[14px] border p-4 shadow-[0_16px_32px_rgba(0,0,0,0.16)]">
        {HOW_IT_WORK_STEPS.map((step, index) => (
          <div key={step.title}>
            <div className="flex items-start gap-4">
              <Image
                src={step.iconSrc}
                alt={step.iconAlt}
                width={64}
                height={64}
                className="shrink-0 rounded-full"
              />

              <div className="min-w-0 space-y-1">
                <h3 className="text-text-heading text-[22px] font-semibold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-text-sub text-sm tracking-[-0.01em]">
                  {step.description}
                </p>
              </div>
            </div>

            {index < HOW_IT_WORK_STEPS.length - 1 && (
              <div className="bg-border-main my-3 h-px w-full" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWork;
