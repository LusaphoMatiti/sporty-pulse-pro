"use client";
import BackButton from "@/components/global/BackButton";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm px-5 pt-6 pb-20 space-y-8 max-w-105 mx-auto">
      <BackButton />
      <div className="space-y-1">
        <p className="text-[11px] tracking-widest text-sp-muted uppercase">
          The app
        </p>
        <h1 className="font-barlow font-extrabold text-[38px] leading-none tracking-tight">
          About Us
        </h1>
      </div>
      <div className="space-y-6 text-sm text-sp-muted leading-relaxed">
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-3">
          <h2 className="font-barlow font-bold text-lg text-sp-text">
            What is Sporty Pulse Pro?
          </h2>
          <p>
            Sporty Pulse Pro is a personal training platform built for people
            who take their fitness seriously but can&#39;t always make it to the
            gym. It brings structured, equipment-based workout programs directly
            to your phone, wherever you are.
          </p>
          <p>
            Every program is built around the equipment you own. Whether you
            train with kettlebells, resistance bands, a pull-up bar, or a full
            rack — Sporty Pulse Pro meets you where you are.
          </p>
        </div>

        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-3">
          <h2 className="font-barlow font-bold text-lg text-sp-text">
            Why it exists
          </h2>
          <p>
            Most fitness apps are built for the gym or for bodyweight training.
            Very few are designed around the equipment you already own at home.
            Sporty Pulse Pro was built to fill that gap, giving you guided,
            progressive programs that make full use of your equipment, track
            your progress, and adapt to your level.
          </p>
        </div>

        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-3">
          <h2 className="font-barlow font-bold text-lg text-sp-text">
            What you get
          </h2>
          <ul className="space-y-2">
            {[
              "Structured workout programs for your equipment",
              "Beginner, intermediate and advanced levels",
              "Session tracking and progress history",
              "Streak monitoring to keep you consistent",
              "AI coaching on the Pro tier",
              "Programs that grow with you",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-sp-accent mt-0.5">✔</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-3">
          <h2 className="font-barlow font-bold text-lg text-sp-text">
            Built by LMDEVPRO
          </h2>
          <p>
            Sporty Pulse Pro is an independent project — designed, built, and
            maintained by LMDEVPRO, they believe that great training tools
            shouldn&#39;t require a gym membership or a personal trainer.
          </p>
          <p>This is version one. It will keep getting better.</p>
        </div>
      </div>
    </div>
  );
}
