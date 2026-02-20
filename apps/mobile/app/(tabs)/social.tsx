import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View
} from "react-native";
import { acceptFriend, getSocialFeed, requestFriend } from "../../src/api/endpoints";

export default function SocialScreen() {
  const [receiverUserId, setReceiverUserId] = useState("");
  const [requestId, setRequestId] = useState("");

  const feedQuery = useQuery({
    queryKey: ["social-feed"],
    queryFn: () => getSocialFeed(30)
  });

  const requestMutation = useMutation({
    mutationFn: () => requestFriend(receiverUserId)
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptFriend(requestId)
  });

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Social</Text>

      <View style={{ marginTop: 12, gap: 8 }}>
        <TextInput
          value={receiverUserId}
          onChangeText={setReceiverUserId}
          placeholder="Friend user id"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => requestMutation.mutate()}
          style={{ backgroundColor: "#111", borderRadius: 8, padding: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Send Friend Request</Text>
        </Pressable>
        {requestMutation.data && <Text>Status: {requestMutation.data.status}</Text>}
      </View>

      <View style={{ marginTop: 16, gap: 8 }}>
        <TextInput
          value={requestId}
          onChangeText={setRequestId}
          placeholder="Request id to accept"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          onPress={() => acceptMutation.mutate()}
          style={{ backgroundColor: "#111", borderRadius: 8, padding: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Accept Friend Request</Text>
        </Pressable>
        {acceptMutation.data && <Text>Status: {acceptMutation.data.status}</Text>}
      </View>

      <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "600" }}>Activity Feed</Text>
      {feedQuery.isLoading && <Text>Loading feed...</Text>}
      {feedQuery.error && <Text>Failed to load feed.</Text>}
      <FlatList
        style={{ marginTop: 8 }}
        data={feedQuery.data?.events ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 10,
              marginBottom: 8
            }}
          >
            <Text style={{ fontWeight: "600" }}>{item.eventType}</Text>
            <Text selectable>{JSON.stringify(item.payload)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
