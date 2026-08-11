/**
 * The service-detail description area has room for six 24px text lines at its
 * 14px bold display size (about 30 typical characters per line).
 */
export const DAMAGE_DESCRIPTION_MAX_LENGTH = 180;

export const limitDamageDescription = (value: string) =>
  Array.from(value).slice(0, DAMAGE_DESCRIPTION_MAX_LENGTH).join('');

export const getDamageDescriptionCharacterCount = (value: string) => Array.from(value).length;
