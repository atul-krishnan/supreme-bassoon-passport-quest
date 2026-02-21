export type ColorTokens = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentCyan: string;
  accentGreen: string;
  accentPurple: string;
  warning: string;
  danger: string;
  success: string;
};

export type TypographyTokens = {
  display: {
    fontSize: number;
    lineHeight: number;
    fontWeight: "700" | "800";
    fontFamily?: string;
  };
  title: {
    fontSize: number;
    lineHeight: number;
    fontWeight: "600" | "700";
    fontFamily?: string;
  };
  body: {
    fontSize: number;
    lineHeight: number;
    fontWeight: "400" | "500";
    fontFamily?: string;
  };
  caption: {
    fontSize: number;
    lineHeight: number;
    fontWeight: "500" | "600";
    fontFamily?: string;
  };
};

export type SpacingTokens = {
  xxs: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type ElevationTokens = {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  glowCyan: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  glowGreen: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

export type RadiusTokens = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type MotionTokens = {
  fastMs: number;
  normalMs: number;
};

export type ThemeTokens = {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
};
