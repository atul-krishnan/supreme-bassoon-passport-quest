import type { CityId } from "@passport-quest/shared";

export const APP_CITY_ID: CityId = "blr";

export const APP_CITY_ANCHOR = {
  cityId: APP_CITY_ID,
  lat: 12.9763,
  lng: 77.5929,
  label: "Bangalore",
} as const;
