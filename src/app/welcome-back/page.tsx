import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function WelcomeBackPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] ?? "Athlete";

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white font-dm">
      <Image
        src="/inbound.jpg"
        alt="Welcome back background"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/95 via-black/60 to-black/80" />

      <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 pt-16 pb-10">
        <div className="w-full max-w-sm mx-auto flex flex-col justify-between min-h-[calc(100vh-6.5rem)]">
          <div className="space-y-8">
            <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center">
              <span className="font-barlow font-black text-xl text-sp-accent">
                SP
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-sp-accent uppercase">
                Welcome back
              </p>
              <h1 className="font-barlow font-extrabold text-[42px] leading-none tracking-tight">
                Good to see
                <br />
                you again,
                <br />
                <span className="text-sp-accent">{firstName}.</span>
              </h1>
              <p className="text-white/60 text-sm font-light pt-1">
                Ready to get back to work?
              </p>
            </div>

            <div className="bg-white/8 border border-white/12 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
              <p className="text-[11px] tracking-widest text-white/50 uppercase">
                Signed in as
              </p>
              <p className="text-sm text-white/80">{session.user.email}</p>
              <div className="h-px bg-white/10" />
              <p className="text-[11px] text-white/40">
                Keep your streak going. Your body remembers.
              </p>
            </div>
          </div>

          <div className="pt-8">
            <Link href="/" className="block">
              <button className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-2xl py-4 hover:opacity-85 transition-opacity">
                Continue Training
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
