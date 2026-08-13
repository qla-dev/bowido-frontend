import type { PalletPhoto } from '../types';

export type DeliveryPhotoGroup = {
  id: string;
  palletId: number;
  deliveryStartedAt: string;
  photos: PalletPhoto[];
  cover: PalletPhoto;
};

export const groupDeliveryPhotos = (photos: PalletPhoto[]): DeliveryPhotoGroup[] => {
  const groups = new Map<string, DeliveryPhotoGroup>();
  const legacyPhotosByPallet = new Map<number, PalletPhoto[]>();

  photos.forEach((photo) => {
    if (photo.type !== 'delivery_photo') {
      const legacyPhotos = legacyPhotosByPallet.get(photo.pallet_id) || [];
      legacyPhotos.push(photo);
      legacyPhotosByPallet.set(photo.pallet_id, legacyPhotos);
      return;
    }

    const deliveryStartedAt = photo.delivery_started_at || photo.created_at;
    const id = `${photo.pallet_id}:${deliveryStartedAt}`;
    const group = groups.get(id);

    if (group) {
      group.photos.push(photo);
      return;
    }

    groups.set(id, {
      id,
      palletId: photo.pallet_id,
      deliveryStartedAt,
      photos: [photo],
      cover: photo,
    });
  });

  legacyPhotosByPallet.forEach((palletPhotos, palletId) => {
    const orderedPhotos = [...palletPhotos].sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );
    let activeGroup: DeliveryPhotoGroup | undefined;

    orderedPhotos.forEach((photo) => {
      const photoTime = new Date(photo.created_at).getTime();
      const groupStartTime = activeGroup
        ? new Date(activeGroup.deliveryStartedAt).getTime()
        : Number.NaN;

      if (!activeGroup || photoTime - groupStartTime >= 24 * 60 * 60 * 1000) {
        activeGroup = {
          id: `legacy:${palletId}:${photo.created_at}`,
          palletId,
          deliveryStartedAt: photo.created_at,
          photos: [],
          cover: photo,
        };
        groups.set(activeGroup.id, activeGroup);
      }

      activeGroup.photos.push(photo);
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      photos: [...group.photos].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    }))
    .map((group) => ({ ...group, cover: group.photos[0] }))
    .sort(
      (left, right) => new Date(right.deliveryStartedAt).getTime() - new Date(left.deliveryStartedAt).getTime(),
    );
};
