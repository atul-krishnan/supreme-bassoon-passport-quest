import type { CityId } from "@passport-quest/shared";

export const APP_CITY_ID: CityId = "blr";

export const CITY_ANCHORS: Record<
  CityId,
  {
    cityId: CityId;
    lat: number;
    lng: number;
    label: string;
  }
> = {
  blr: {
    cityId: "blr",
    lat: 12.9763,
    lng: 77.5929,
    label: "Bangalore",
  },
  nyc: {
    cityId: "nyc",
    lat: 40.7536,
    lng: -73.9832,
    label: "New York City",
  },
};

export const APP_CITY_ANCHOR = CITY_ANCHORS[APP_CITY_ID];

export function getCityAnchor(cityId: CityId) {
  return CITY_ANCHORS[cityId] ?? CITY_ANCHORS[APP_CITY_ID];
}
