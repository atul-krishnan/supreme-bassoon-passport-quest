import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type CircularProgressProps = {
  value: number;
  max: number;
  label: string;
  subtitle: string;
};

const RING_SIZE = 196;
const SEGMENT_COUNT = 28;
const SEGMENT_WIDTH = 7;
const SEGMENT_HEIGHT = 18;
const SEGMENT_RADIUS = RING_SIZE / 2 - SEGMENT_HEIGHT / 2 - 7;

export function CircularProgress({
  value,
  max,
  label,
  subtitle,
}: CircularProgressProps) {
  const safeMax = Math.max(1, max);
  const progress = Math.min(1, Math.max(0, value / safeMax));
  const activeSegments =
    progress > 0 ? Math.max(1, Math.round(progress * SEGMENT_COUNT)) : 0;

  return (
    <View style={styles.container}>
      <View
        style={styles.ring}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        {Array.from({ length: SEGMENT_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              index < activeSegments ? styles.segmentActive : styles.segmentIdle,
              {
                transform: [
                  { rotate: `${(360 / SEGMENT_COUNT) * index}deg` },
                  { translateY: -SEGMENT_RADIUS },
                ],
              },
            ]}
          />
        ))}

        <View style={styles.center}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{Math.round(value)}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        {Math.round(value)}/{Math.round(safeMax)} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  segment: {
    position: "absolute",
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: 4,
    top: RING_SIZE / 2 - SEGMENT_HEIGHT / 2,
    left: RING_SIZE / 2 - SEGMENT_WIDTH / 2,
  },
  segmentActive: {
    backgroundColor: theme.colors.accentCyan,
    ...theme.elevation.glowCyan,
  },
  segmentIdle: {
    backgroundColor: "rgba(77, 101, 150, 0.3)",
  },
  center: {
    width: 126,
    height: 126,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(133, 161, 220, 0.46)",
    backgroundColor: "rgba(9, 19, 42, 0.86)",
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  subtitle: {
    color: theme.colors.accentPurple,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
  },
  footer: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.body.fontFamily,
  },
});
