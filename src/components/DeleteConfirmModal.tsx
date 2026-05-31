import React from 'react';
import { CircleHelp } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui';

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  subject?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  title,
  message,
  subject,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay fixed inset-0 z-[140] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-[25rem] rounded-[1.6rem] bg-white px-7 py-6 text-center shadow-[0_32px_80px_-28px_rgba(0,0,0,0.38)]"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-amber-200 text-amber-500">
            <CircleHelp size={30} strokeWidth={2.4} />
          </div>
          <h3 className="mt-4 text-[1.65rem] font-black tracking-tight text-zinc-950">{title}</h3>
          {subject && (
            <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
              {subject}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center text-center">
          <p className="max-w-[18rem] text-[13px] font-bold leading-6 text-zinc-500">{message}</p>

          <div className="mt-7 flex w-full items-center justify-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="min-w-[8.5rem] flex-1 rounded-2xl"
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              className="min-w-[8.5rem] flex-1 rounded-2xl"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
