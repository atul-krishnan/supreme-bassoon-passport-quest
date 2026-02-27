import type { ReactNode } from "react";
import { SafeAreaView, StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type ScreenContainerProps = {
  children: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
};

export function ScreenContainer({
  children,
  padded = true,
  style,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <View style={[styles.inner, padded ? styles.padded : undefined]}>
        <View pointerEvents="none" style={styles.backdrop}>
          <View style={[styles.orb, styles.orbTop]} />
          <View style={[styles.orb, styles.orbMiddle]} />
          <View style={[styles.orb, styles.orbBottom]} />
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  inner: {
    flex: 1,
    position: "relative",
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  padded: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTop: {
    width: 320,
    height: 320,
    top: -170,
    left: -100,
    backgroundColor: "rgba(81, 120, 255, 0.22)",
  },
  orbMiddle: {
    width: 300,
    height: 300,
    top: 130,
    right: -130,
    backgroundColor: "rgba(132, 78, 255, 0.22)",
  },
  orbBottom: {
    width: 260,
    height: 260,
    bottom: -120,
    left: 20,
    backgroundColor: "rgba(38, 214, 255, 0.16)",
  },
});
