import { describe, expect, it } from 'vitest';
import { groupDeliveryPhotos } from './deliveryPhotoGroups';
import type { PalletPhoto } from '../types';

const photo = (id: number, deliveryStartedAt: string): PalletPhoto => ({
  id,
  pallet_id: 2,
  type: 'delivery_photo',
  delivery_started_at: deliveryStartedAt,
  mime_type: 'image/webp',
  size_bytes: 100,
  expires_at: '2026-09-01T12:00:00.000Z',
  created_at: deliveryStartedAt,
});

describe('groupDeliveryPhotos', () => {
  it('keeps photos in the same 24-hour delivery session together', () => {
    const groups = groupDeliveryPhotos([
      photo(1, '2026-08-13T08:00:00.000Z'),
      photo(2, '2026-08-13T08:00:00.000Z'),
      photo(3, '2026-08-15T08:00:00.000Z'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].photos.map(({ id }) => id)).toEqual([3]);
    expect(groups[1].photos.map(({ id }) => id)).toEqual([1, 2]);
  });

  it('separates older scan photos into 24-hour delivery windows', () => {
    const legacyPhoto = (id: number, createdAt: string): PalletPhoto => ({
      ...photo(id, createdAt),
      type: 'scan',
      created_at: createdAt,
    });

    const groups = groupDeliveryPhotos([
      legacyPhoto(1, '2026-08-03T08:00:00.000Z'),
      legacyPhoto(2, '2026-08-13T08:00:00.000Z'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.photos.map(({ id }) => id))).toEqual([[2], [1]]);
  });
});
