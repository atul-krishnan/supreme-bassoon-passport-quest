import { StyleSheet, View, type DimensionValue } from "react-native";

type Star = {
  top: DimensionValue;
  left: DimensionValue;
  size: number;
  opacity: number;
};

const STARS: Star[] = [
  { top: "8%", left: "12%", size: 2, opacity: 0.42 },
  { top: "14%", left: "78%", size: 2, opacity: 0.36 },
  { top: "18%", left: "36%", size: 1.5, opacity: 0.28 },
  { top: "24%", left: "62%", size: 2, opacity: 0.33 },
  { top: "29%", left: "18%", size: 1.5, opacity: 0.3 },
  { top: "33%", left: "83%", size: 2, opacity: 0.31 },
  { top: "40%", left: "52%", size: 2, opacity: 0.24 },
  { top: "47%", left: "11%", size: 1.5, opacity: 0.34 },
  { top: "55%", left: "71%", size: 2, opacity: 0.3 },
  { top: "61%", left: "32%", size: 2, opacity: 0.28 },
  { top: "66%", left: "86%", size: 1.5, opacity: 0.24 },
  { top: "71%", left: "14%", size: 2, opacity: 0.31 },
  { top: "79%", left: "57%", size: 2, opacity: 0.25 },
  { top: "84%", left: "28%", size: 1.5, opacity: 0.3 },
  { top: "88%", left: "76%", size: 2, opacity: 0.37 },
  { top: "92%", left: "43%", size: 1.5, opacity: 0.23 },
];

export function NightSkyBackdrop() {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <View style={styles.auroraOne} />
      <View style={styles.auroraTwo} />
      {STARS.map((star, index) => (
        <View
          key={`star-${index}`}
          style={[
            styles.star,
            {
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#050914",
  },
  topGlow: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(43, 98, 183, 0.28)",
  },
  bottomGlow: {
    position: "absolute",
    right: -120,
    bottom: -150,
    width: 380,
    height: 380,
    borderRadius: 999,
    backgroundColor: "rgba(37, 134, 126, 0.20)",
  },
  auroraOne: {
    position: "absolute",
    top: "26%",
    left: "-22%",
    width: "65%",
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(18, 64, 120, 0.20)",
    transform: [{ rotate: "-12deg" }],
  },
  auroraTwo: {
    position: "absolute",
    top: "58%",
    right: "-20%",
    width: "62%",
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(26, 118, 105, 0.18)",
    transform: [{ rotate: "12deg" }],
  },
  star: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#E6F1FF",
  },
});
