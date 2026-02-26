import type { CityId } from "@passport-quest/shared";
import { env } from "./env";

export type CityAnchor = {
  cityId: CityId;
  lat: number;
  lng: number;
  label: string;
  countryCode: "IN" | "US";
  supportsLiveApi: boolean;
};

export const CITY_ANCHORS: Record<CityId, CityAnchor> = {
  blr: {
    cityId: "blr",
    lat: 12.9763,
    lng: 77.5929,
    label: "Bangalore",
    countryCode: "IN",
    supportsLiveApi: true,
  },
  del: {
    cityId: "del",
    lat: 28.6139,
    lng: 77.209,
    label: "Delhi",
    countryCode: "IN",
    supportsLiveApi: false,
  },
  pnq: {
    cityId: "pnq",
    lat: 18.5204,
    lng: 73.8567,
    label: "Pune",
    countryCode: "IN",
    supportsLiveApi: false,
  },
  nyc: {
    cityId: "nyc",
    lat: 40.7536,
    lng: -73.9832,
    label: "New York City",
    countryCode: "US",
    supportsLiveApi: true,
  },
};

function isCityId(value: unknown): value is CityId {
  return typeof value === "string" && value in CITY_ANCHORS;
}

export const APP_CITY_ID: CityId = isCityId(env.appCityId)
  ? env.appCityId
  : "blr";

export const APP_CITY_ANCHOR = CITY_ANCHORS[APP_CITY_ID];

export function getCityAnchor(cityId: CityId) {
  return CITY_ANCHORS[cityId] ?? CITY_ANCHORS[APP_CITY_ID];
}

export function isCityLive(cityId: CityId) {
  return getCityAnchor(cityId).supportsLiveApi;
}
