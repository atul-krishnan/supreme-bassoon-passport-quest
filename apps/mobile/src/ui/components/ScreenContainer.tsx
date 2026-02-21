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
    backgroundColor: theme.colors.background,
  },
  padded: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
});
