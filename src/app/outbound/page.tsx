"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const levels = [
  {
    label: "Beginner",
    desc: "New to training or getting back into it",
    accent: true,
  },
  {
    label: "Intermediate",
    desc: "Training consistently for 6+ months",
    accent: false,
  },
  {
    label: "Advanced",
    desc: "Experienced with structured programming",
    accent: false,
  },
];

function Outbound() {
  const router = useRouter();

  function handleSelect(level: string) {
    localStorage.setItem("training_level", level);
    router.push("/");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-dm">
      {/* Background */}
      <Image
        src="/onboarding.jpg"
        alt="Choose your level"
        fill
        priority
        className="object-cover object-[center_right]"
      />

      {/* Gradient: dark bottom sheet effect */}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/85 to-black/30" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-end pb-10 px-5">
        {/* Heading */}
        <div className="mb-8 space-y-2">
          <p className="text-[11px] tracking-widest text-sp-accent uppercase">
            Step 1 of 1
          </p>
          <h1 className="font-barlow font-extrabold text-[42px] leading-none text-white tracking-tight">
            Choose your
            <br />
            <span className="text-sp-accent">training level.</span>
          </h1>
          <p className="text-white/50 text-sm font-light">
            We&apos;ll tailor your programs to match your experience.
          </p>
        </div>

        {/* Level cards */}
        <div className="space-y-3">
          {levels.map(({ label, desc, accent }) => (
            <button
              key={label}
              onClick={() => handleSelect(label)}
              className={`w-full flex items-center justify-between rounded-2xl px-5 py-4 border transition-all text-left
                ${
                  accent
                    ? "bg-sp-accent border-sp-accent"
                    : "bg-white/8 border-white/12 hover:bg-white/12"
                }`}
            >
              <div>
                <p
                  className={`font-barlow font-bold text-xl tracking-wide ${accent ? "text-sp-bg" : "text-white"}`}
                >
                  {label}
                </p>
                <p
                  className={`text-sm font-light mt-0.5 ${accent ? "text-sp-bg/70" : "text-white/50"}`}
                >
                  {desc}
                </p>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={accent ? "text-sp-bg" : "text-white/40"}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Outbound;
