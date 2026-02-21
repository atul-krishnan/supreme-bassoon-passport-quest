import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type InlineErrorProps = {
  message: string;
};

export function InlineError({ message }: InlineErrorProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#2B0E14",
    padding: theme.spacing.sm,
  },
  text: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
});
