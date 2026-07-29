import type { ClientDetail, Pallet } from "../types";

export const formatPalletLocationAddress = (
  street?: string,
  houseNumber?: string,
  postalCode?: string,
  city?: string,
) => {
  const streetLine = [street, houseNumber].filter(Boolean).join(" ").trim();
  const localityLine = [postalCode, city].filter(Boolean).join(" ").trim();

  return [streetLine, localityLine].filter(Boolean).join(", ");
};

export const getClientWarehouseAddress = (
  client: ClientDetail | undefined,
  warehouse: 1 | 2,
) => {
  const structuredAddress =
    warehouse === 1
      ? formatPalletLocationAddress(
          client?.warehouse1_street,
          client?.warehouse1_house_number,
          client?.warehouse1_postal_code,
          client?.warehouse1_city,
        )
      : formatPalletLocationAddress(
          client?.warehouse2_street,
          client?.warehouse2_house_number,
          client?.warehouse2_postal_code,
          client?.warehouse2_city,
        );

  return structuredAddress || client?.warehouse_addresses?.[warehouse - 1] || "";
};

export const getDeliveryLocationAddress = (pallet?: Pallet | null) => {
  const location = pallet?.delivery_location;

  if (!location) {
    return "";
  }

  return (
    formatPalletLocationAddress(
      location.street,
      location.house_number,
      location.postal_code,
      location.city,
    ) ||
    location.formatted_address ||
    ""
  );
};
