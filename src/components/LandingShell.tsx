import type { ReactNode } from 'react';
import { LogIn } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import efficientManagement from '../assets/landing/efficient-management.jpg';
import realTimeUpdates from '../assets/landing/real-time-updates.jpg';
import detailedAuditing from '../assets/landing/detailed-auditing.jpg';
import teamCollaboration from '../assets/landing/team-collaboration.jpg';

type LandingShellProps = {
  isLoginOpen: boolean;
  logoSrc: string;
  loginLabel: string;
  onOpenLogin: () => void;
  marketingCopy: {
    eyebrow: string;
    title: string;
    description: string;
    illustrationLabels: string[];
  };
  children: ReactNode;
};

const illustrations = [
  { src: efficientManagement, delay: 0.08 },
  { src: realTimeUpdates, delay: 0.16 },
  { src: detailedAuditing, delay: 0.24 },
  { src: teamCollaboration, delay: 0.32 },
];

export function LandingShell({ isLoginOpen, logoSrc, loginLabel, onOpenLogin, marketingCopy, children }: LandingShellProps) {
  return (
    <div id="login-screen" className="relative min-h-[100dvh] overflow-hidden bg-white font-sans text-slate-950">
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="pointer-events-none absolute inset-x-0 top-0 z-[205] flex items-center justify-between px-5 py-6 sm:px-10 lg:px-[4.5vw] lg:py-8"
      >
        <motion.div
          layout
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex w-full items-center justify-between"
          style={{ maxWidth: isLoginOpen ? '46%' : '100%' }}
        >
          <img src={logoSrc} alt="TrackPal" className="h-9 w-auto max-w-[190px] object-contain sm:h-11 sm:max-w-[240px]" />

          <AnimatePresence>
            {!isLoginOpen && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onOpenLogin}
                className="hidden items-center gap-2 rounded-full bg-[#00ae60] px-7 py-3 text-[12px] font-black uppercase tracking-[0.06em] text-white shadow-[0_12px_24px_rgba(0,174,96,0.22)] sm:flex"
              >
                <LogIn size={17} />
                {loginLabel}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.header>

      <main className="flex min-h-[100dvh] w-full flex-col lg:flex-row-reverse">
        <motion.section
          animate={{ width: isLoginOpen ? '50%' : '100%' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="landing-visual-pane relative flex min-h-[100dvh] shrink-0 items-center justify-center overflow-hidden bg-white px-5 pb-20 pt-28 sm:px-10 lg:px-12 lg:py-24"
        >
          <div className="pointer-events-none absolute -left-32 -top-32 h-[410px] w-[410px] rounded-full bg-[#00ae60]/[0.055]" />
          <div className="pointer-events-none absolute -bottom-44 -right-40 h-[430px] w-[430px] rounded-full bg-[#00ae60]/[0.025]" />

          <motion.div
            className="relative z-10 flex w-full max-w-[1120px] flex-col items-center justify-center gap-14 xl:flex-row-reverse xl:gap-24"
          >
            <AnimatePresence mode="popLayout">
              {!isLoginOpen && (
                <motion.aside
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ delay: 0.2, duration: 0.55 }}
                  className="hidden w-[330px] shrink-0 xl:block"
                >
                  <div className="mb-6 flex items-center gap-3">
                    <span className="h-px w-10 bg-[#00ae60]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#00ae60]">
                      {marketingCopy.eyebrow}
                    </p>
                  </div>
                  <h2 className="max-w-[320px] text-[40px] font-black leading-[1.03] tracking-[-0.035em] text-slate-900">
                    {marketingCopy.title}
                  </h2>
                  <p className="mt-6 max-w-[315px] text-[14px] font-medium leading-7 text-slate-500">
                    {marketingCopy.description}
                  </p>
                </motion.aside>
              )}
            </AnimatePresence>

            <div className="flex w-full max-w-[530px] shrink-0 flex-col items-center gap-10">
              <div className="landing-illustrations-float grid w-full grid-cols-2 items-start gap-x-7 gap-y-12 sm:gap-x-12 sm:gap-y-16">
                {illustrations.map(({ src, delay }, index) => {
                  const label = marketingCopy.illustrationLabels[index];

                  return (
                  <motion.figure
                    key={label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.55, delay }}
                    className="flex min-w-0 flex-col items-center gap-5 text-center"
                  >
                    <div className="aspect-square w-full max-w-[225px] overflow-hidden rounded-[24px] bg-slate-50 shadow-[0_20px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04]">
                      <img src={src} alt={label} className="h-full w-full object-cover" />
                    </div>
                    <figcaption className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 sm:text-[11px]">
                      {label}
                    </figcaption>
                  </motion.figure>
                  );
                })}
              </div>

              <AnimatePresence>
                {!isLoginOpen && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onOpenLogin}
                    className="flex min-h-16 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-[#00ae60] px-8 py-5 text-[14px] font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_30px_rgba(0,174,96,0.26)] sm:hidden"
                  >
                    <LogIn size={22} />
                    {loginLabel}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.section>

        <AnimatePresence initial={false}>
          {isLoginOpen && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="landing-login-pane relative flex min-h-[100dvh] min-w-0 shrink-0 items-center justify-center overflow-y-auto bg-[#fbfcfd] px-5 pb-6 pt-24 sm:px-10 lg:px-12"
            >
              <motion.div
                initial={{ opacity: 0, x: -36 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.24, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[515px]"
              >
                {children}
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <p className="pointer-events-none absolute bottom-5 left-5 z-20 text-[9px] font-black uppercase tracking-[0.08em] text-slate-300 sm:left-10 lg:left-[4.5vw]">
        © 2026 TrackPal Logistics Solution
      </p>
    </div>
  );
}
