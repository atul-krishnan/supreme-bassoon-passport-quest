import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { trackUiEvent } from "../../src/analytics/events";
import {
  acceptFriend,
  getIncomingFriendRequests,
  getProfileCompare,
  getSocialFeed,
  requestFriendByUsername,
} from "../../src/api/endpoints";
import { theme } from "../../src/theme";
import {
  EmptyState,
  FeedEventCard,
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  ScreenContainer,
  TopBar,
} from "../../src/ui";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return "Moments ago";
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`;
  }
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

function eventMessage(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  if (eventType === "badge_unlocked") {
    return `unlocked \"${String(payload.badgeName ?? payload.badgeKey ?? "New Badge")}\" badge!`;
  }
  if (eventType === "quest_completed") {
    return `completed a quest for ${String(payload.xpAwarded ?? 0)} XP.`;
  }
  if (eventType === "friend_connected") {
    return "added a new friend.";
  }
  if (eventType === "streak_updated") {
    return "extended their streak.";
  }
  return "shared a new moment.";
}

export default function SocialScreen() {
  const queryClient = useQueryClient();
  const [friendUsername, setFriendUsername] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const trackedFeedVisibleRef = useRef(false);

  const feedQuery = useQuery({
    queryKey: ["social-feed"],
    queryFn: () => getSocialFeed(30),
  });

  const incomingPendingQuery = useQuery({
    queryKey: ["incoming-friend-requests", "pending"],
    queryFn: () => getIncomingFriendRequests("pending"),
  });

  const acceptedIncomingQuery = useQuery({
    queryKey: ["incoming-friend-requests", "accepted"],
    queryFn: () => getIncomingFriendRequests("accepted"),
  });

  const requestMutation = useMutation({
    mutationFn: async () => requestFriendByUsername(friendUsername.trim()),
    onSuccess: async (result) => {
      trackUiEvent("social_send_friend_request", {
        status: result.status,
      });
      setStatusMessage(
        result.status === "sent" ? "Request sent" : `Status: ${result.status}`,
      );
      setFriendUsername("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["incoming-friend-requests", "pending"],
        }),
        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
      ]);
    },
    onError: () => {
      setStatusMessage("Couldn't send request. Try again.");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => acceptFriend(requestId),
    onSuccess: async (result) => {
      trackUiEvent("social_accept_friend_request", { status: result.status });
      setStatusMessage(
        result.status === "accepted"
          ? "Request accepted"
          : `Status: ${result.status}`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
        queryClient.invalidateQueries({
          queryKey: ["incoming-friend-requests", "pending"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["incoming-friend-requests", "accepted"],
        }),
      ]);
    },
    onError: () => {
      setStatusMessage("Couldn't accept request. Try again.");
    },
  });

  const compareMutation = useMutation({
    mutationFn: async (friendUserId: string) => getProfileCompare(friendUserId),
    onSuccess: (_, friendUserId) => {
      trackUiEvent("social_compare_profile_success", { friendUserId });
    },
  });

  const feedEvents = useMemo(
    () =>
      (feedQuery.data?.events ?? []).map((event, index) => ({
        id: event.id,
        actorName: `Explorer ${event.userId.slice(0, 4)}`,
        message: eventMessage(event.eventType, event.payload),
        relativeTime: formatRelativeTime(event.createdAt),
        accent: (index % 3 === 0
          ? "green"
          : index % 3 === 1
            ? "cyan"
            : "purple") as "cyan" | "green" | "purple",
      })),
    [feedQuery.data?.events],
  );

  useEffect(() => {
    if (!feedQuery.isSuccess) {
      return;
    }

    if (feedEvents.length === 0) {
      trackedFeedVisibleRef.current = false;
      return;
    }

    if (!trackedFeedVisibleRef.current) {
      trackUiEvent("social_feed_visible", {
        eventCount: feedEvents.length,
      });
      trackedFeedVisibleRef.current = true;
    }
  }, [feedEvents.length, feedQuery.isSuccess]);

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Social Feed" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.segmentCard}>
          <Text style={styles.segmentActive}>Activity</Text>
        </GlassCard>

        <GlassCard>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowTools((value) => !value)}
            style={styles.toolsToggle}
          >
            <Text style={styles.toolsToggleLabel}>Friend actions (MVP testing)</Text>
            <Text style={styles.toolsToggleHint}>{showTools ? "Hide" : "Show"}</Text>
          </Pressable>

          {showTools ? (
            <View style={styles.toolsBody}>
              <TextInput
                value={friendUsername}
                onChangeText={setFriendUsername}
                placeholder="Friend username"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
              <NeonButton
                label="Add Friend"
                onPress={() => requestMutation.mutate()}
                loading={requestMutation.isPending}
                disabled={friendUsername.trim().length < 3}
              />

              <Text style={styles.toolsSectionTitle}>Incoming Requests</Text>
              {incomingPendingQuery.isLoading ? (
                <LoadingShimmer label="Loading incoming requests..." />
              ) : null}
              {incomingPendingQuery.error ? (
                <InlineError message="Could not load incoming requests." />
              ) : null}
              {(incomingPendingQuery.data?.requests ?? []).length === 0 &&
              incomingPendingQuery.isSuccess ? (
                <Text style={styles.helperMuted}>No pending requests.</Text>
              ) : null}
              {(incomingPendingQuery.data?.requests ?? []).map((request) => (
                <View key={request.requestId} style={styles.requestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestUser}>@{request.senderUsername}</Text>
                    <Text style={styles.requestMeta}>
                      Sent {formatRelativeTime(request.createdAt)}
                    </Text>
                  </View>
                  <NeonButton
                    label="Accept"
                    variant="secondary"
                    loading={
                      acceptMutation.isPending &&
                      acceptMutation.variables === request.requestId
                    }
                    onPress={() => acceptMutation.mutate(request.requestId)}
                  />
                </View>
              ))}

              <Text style={styles.toolsSectionTitle}>Compare Profiles</Text>
              {(acceptedIncomingQuery.data?.requests ?? []).length === 0 &&
              acceptedIncomingQuery.isSuccess ? (
                <Text style={styles.helperMuted}>
                  Accept a request first to unlock compare.
                </Text>
              ) : null}
              {(acceptedIncomingQuery.data?.requests ?? []).map((request) => (
                <View key={request.requestId} style={styles.requestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestUser}>@{request.senderUsername}</Text>
                    <Text style={styles.requestMeta}>Connection ready</Text>
                  </View>
                  <NeonButton
                    label="Compare"
                    variant="secondary"
                    loading={
                      compareMutation.isPending &&
                      compareMutation.variables === request.senderUserId
                    }
                    onPress={() => {
                      trackUiEvent("profile_compare_requested", {
                        friendUserId: request.senderUserId,
                      });
                      compareMutation.mutate(request.senderUserId);
                    }}
                  />
                </View>
              ))}

              {compareMutation.error ? (
                <InlineError
                  message={String((compareMutation.error as Error).message)}
                />
              ) : null}

              {compareMutation.data ? (
                <GlassCard>
                  <Text style={styles.compareTitle}>Profile Compare</Text>
                  <Text style={styles.compareLine}>
                    Your XP: {compareMutation.data.me.xp} | Friend XP: {compareMutation.data.friend.xp}
                  </Text>
                  <Text style={styles.compareLine}>
                    Your Level: {compareMutation.data.me.level} | Friend Level: {compareMutation.data.friend.level}
                  </Text>
                  <Text style={styles.compareLine}>
                    Delta XP: {compareMutation.data.deltas.xp}
                  </Text>
                  <Text style={styles.compareLine}>
                    Delta Badges: {compareMutation.data.deltas.badgeCount}
                  </Text>
                </GlassCard>
              ) : null}

              {statusMessage ? (
                <Text style={styles.statusMessage}>{statusMessage}</Text>
              ) : null}
            </View>
          ) : null}
        </GlassCard>

        {feedQuery.isLoading ? (
          <LoadingShimmer label="Loading activity feed..." />
        ) : null}
        {feedQuery.error ? (
          <InlineError message="Could not load feed. Pull to refresh and try again." />
        ) : null}
        {feedQuery.isSuccess && feedEvents.length === 0 ? (
          <EmptyState
            title="Your feed is quiet"
            description="Add friends to see their quest moments."
          />
        ) : null}
        {feedEvents.map((event) => (
          <FeedEventCard key={event.id} event={event} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.sm,
  },
  segmentCard: {
    paddingVertical: theme.spacing.xs,
  },
  segmentActive: {
    color: theme.colors.accentGreen,
    fontWeight: "700",
    fontSize: 15,
  },
  toolsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolsToggleLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
  },
  toolsToggleHint: {
    color: theme.colors.accentCyan,
    fontWeight: "600",
  },
  toolsBody: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.backgroundElevated,
  },
  toolsSectionTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
  },
  helperMuted: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
  },
  requestRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    padding: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  requestUser: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 15,
  },
  requestMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    marginTop: 2,
  },
  compareTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: theme.spacing.xs,
  },
  compareLine: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
  statusMessage: {
    color: theme.colors.textSecondary,
  },
});
