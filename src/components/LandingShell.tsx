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
  children: ReactNode;
};

const illustrations = [
  { src: efficientManagement, label: 'Efficient management', delay: 0.08, drift: -5 },
  { src: realTimeUpdates, label: 'Real-time updates', delay: 0.16, drift: 5 },
  { src: detailedAuditing, label: 'Detailed auditing', delay: 0.24, drift: -4 },
  { src: teamCollaboration, label: 'Team collaboration', delay: 0.32, drift: 4 },
];

export function LandingShell({ isLoginOpen, logoSrc, loginLabel, onOpenLogin, children }: LandingShellProps) {
  return (
    <div id="login-screen" className="relative min-h-[100dvh] overflow-hidden bg-white font-sans text-slate-950">
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-6 sm:px-10 lg:px-[4.5vw] lg:py-8"
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

      <main className="flex min-h-[100dvh] w-full flex-col lg:flex-row">
        <motion.section
          animate={{ width: isLoginOpen ? '50%' : '100%' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="landing-visual-pane relative flex min-h-[100dvh] shrink-0 items-center justify-center overflow-hidden bg-white px-5 pb-20 pt-28 sm:px-10 lg:px-12 lg:py-24"
        >
          <div className="pointer-events-none absolute -left-32 -top-32 h-[410px] w-[410px] rounded-full bg-[#00ae60]/[0.055]" />
          <div className="pointer-events-none absolute -bottom-44 -right-40 h-[430px] w-[430px] rounded-full bg-[#00ae60]/[0.025]" />

          <div className="relative z-10 flex w-full max-w-[530px] flex-col items-center gap-10">
            <motion.div
              layout
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="grid w-full grid-cols-2 gap-x-7 gap-y-12 sm:gap-x-12 sm:gap-y-16"
            >
              {illustrations.map(({ src, label, delay, drift }) => (
                <motion.figure
                  key={label}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: [0, drift, 0] }}
                  transition={{
                    opacity: { duration: 0.55, delay },
                    y: { duration: 6 + delay, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  className="flex min-w-0 flex-col items-center gap-5 text-center"
                >
                  <div className="aspect-square w-full max-w-[225px] overflow-hidden rounded-[24px] bg-slate-50 shadow-[0_20px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04]">
                    <img src={src} alt={label} className="h-full w-full object-cover" />
                  </div>
                  <figcaption className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 sm:text-[11px]">
                    {label}
                  </figcaption>
                </motion.figure>
              ))}
            </motion.div>

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
        </motion.section>

        <AnimatePresence initial={false}>
          {isLoginOpen && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="landing-login-pane relative flex min-h-[100dvh] min-w-0 flex-1 items-center justify-center overflow-y-auto bg-[#fbfcfd] px-5 py-24 sm:px-10 lg:px-12"
            >
              <motion.div
                initial={{ opacity: 0, x: 36 }}
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
