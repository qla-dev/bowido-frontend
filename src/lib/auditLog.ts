import type { AuditLog } from '../types';

/**
 * Some legacy production records were written twice with distinct IDs. Keep
 * genuine repeat actions, but collapse records that are otherwise identical
 * down to their timestamp.
 */
export const deduplicateAuditLogs = (logs: AuditLog[]): AuditLog[] => {
  const seen = new Set<string>();

  return logs.filter((log) => {
    const key = [
      log.pallet_id,
      log.event_type || log.type,
      log.made_by_user_id,
      log.old_status_id,
      log.new_status_id,
      log.old_client_id,
      log.new_client_id,
      log.old_location,
      log.new_location,
      log.old_qr_code,
      log.new_qr_code,
      log.note,
      log.created_at,
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};
