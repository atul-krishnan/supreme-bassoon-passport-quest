import type { ThemeTokens } from "./types";

export const theme: ThemeTokens = {
  colors: {
    background: "#070B1A",
    backgroundElevated: "#0B1024",
    surface: "#121B34",
    surfaceAlt: "#192644",
    border: "#2A3B63",
    textPrimary: "#EFF6FF",
    textSecondary: "#AFC2E6",
    textMuted: "#7890BF",
    accentCyan: "#3AD7FF",
    accentGreen: "#2EF6A8",
    accentPurple: "#8F63FF",
    warning: "#F9C74F",
    danger: "#F87171",
    success: "#4ADE80",
  },
  typography: {
    // Swap to loaded Sora/Manrope fonts later without changing component APIs.
    display: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
      fontFamily: "System",
    },
    title: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "700",
      fontFamily: "System",
    },
    body: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "400",
      fontFamily: "System",
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      fontFamily: "System",
    },
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  elevation: {
    card: {
      shadowColor: "#000000",
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    glowCyan: {
      shadowColor: "#3AD7FF",
      shadowOpacity: 0.48,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    glowGreen: {
      shadowColor: "#2EF6A8",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
  },
  motion: {
    fastMs: 120,
    normalMs: 220,
  },
};
