import { Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../src/theme";
import { GlassCard, NeonButton, ScreenContainer } from "../src/ui";

const FEATURES = [
    { emoji: "🧭", title: "Smart Plans", desc: "AI-powered itineraries tailored to your vibe" },
    { emoji: "🗺️", title: "Explore Nearby", desc: "Discover hidden gems around you" },
    { emoji: "🏆", title: "Earn Badges", desc: "Complete quests and unlock achievements" },
    { emoji: "👯", title: "Social Feed", desc: "See what your friends are discovering" },
];

export default function LandingScreen() {
    return (
        <ScreenContainer>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero area — image placeholder */}
                <View style={styles.heroImageWrap}>
                    {/* IMAGE_PLACEHOLDER: Replace with a travel/adventure hero image */}
                    <View style={styles.heroImageFallback}>
                        <Text style={styles.heroEmoji}>🌍</Text>
                    </View>
                </View>

                {/* Title */}
                <View style={styles.titleWrap}>
                    <Text style={styles.logo}>Passport Quest</Text>
                    <Text style={styles.tagline}>
                        Your city.{"\n"}Your adventure.{"\n"}Your story.
                    </Text>
                </View>

                {/* Feature highlights */}
                <View style={styles.featureGrid}>
                    {FEATURES.map((f) => (
                        <GlassCard key={f.title} style={styles.featureCard}>
                            <Text style={styles.featureEmoji}>{f.emoji}</Text>
                            <Text style={styles.featureTitle}>{f.title}</Text>
                            <Text style={styles.featureDesc}>{f.desc}</Text>
                        </GlassCard>
                    ))}
                </View>

                {/* CTA buttons */}
                <View style={styles.ctaWrap}>
                    <NeonButton
                        label="✨ Get Started"
                        onPress={() => router.push("/onboarding")}
                    />

                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/(tabs)")}
                        style={styles.guestButton}
                    >
                        <Ionicons name="person-outline" size={18} color={theme.colors.textSecondary} />
                        <Text style={styles.guestLabel}>Continue as Guest</Text>
                    </Pressable>
                </View>

                {/* Trust strip */}
                <View style={styles.trustStrip}>
                    <View style={styles.trustItem}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accentGreen} />
                        <Text style={styles.trustText}>No login required</Text>
                    </View>
                    <View style={styles.trustItem}>
                        <Ionicons name="lock-closed-outline" size={16} color={theme.colors.accentCyan} />
                        <Text style={styles.trustText}>Privacy first</Text>
                    </View>
                    <View style={styles.trustItem}>
                        <Ionicons name="flash-outline" size={16} color={theme.colors.warning} />
                        <Text style={styles.trustText}>Free forever</Text>
                    </View>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: 60,
        gap: theme.spacing.lg,
    },
    heroImageWrap: {
        height: 220,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(108, 140, 197, 0.26)",
        marginTop: theme.spacing.sm,
    },
    heroImageFallback: {
        flex: 1,
        backgroundColor: "rgba(12, 22, 45, 0.9)",
        alignItems: "center",
        justifyContent: "center",
    },
    heroEmoji: {
        fontSize: 72,
    },
    titleWrap: {
        alignItems: "center",
        gap: theme.spacing.sm,
    },
    logo: {
        color: theme.colors.accentCyan,
        fontSize: 36,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    tagline: {
        color: theme.colors.textPrimary,
        fontSize: 28,
        lineHeight: 34,
        fontWeight: "700",
        textAlign: "center",
    },
    featureGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
    },
    featureCard: {
        width: "47%",
        minHeight: 110,
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.md,
    },
    featureEmoji: {
        fontSize: 28,
    },
    featureTitle: {
        color: theme.colors.textPrimary,
        fontSize: 15,
        fontWeight: "700",
        textAlign: "center",
    },
    featureDesc: {
        color: theme.colors.textMuted,
        fontSize: 12,
        lineHeight: 16,
        textAlign: "center",
        paddingHorizontal: theme.spacing.xs,
    },
    ctaWrap: {
        gap: theme.spacing.sm,
    },
    guestButton: {
        minHeight: 48,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: "rgba(108, 140, 197, 0.4)",
        backgroundColor: "rgba(20, 30, 58, 0.6)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    guestLabel: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: "600",
    },
    trustStrip: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: theme.spacing.sm,
    },
    trustItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    trustText: {
        color: theme.colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
    },
});
