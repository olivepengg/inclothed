import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { deleteItem, getItems, Item } from "../lib/db";
import { imageUri } from "../lib/storage";

export default function Closet() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(
    useCallback(() => {
      setItems(getItems());
    }, []),
  );

  const confirmDelete = (item: Item) =>
    Alert.alert("Delete this item?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteItem(item);
          setItems(getItems());
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Your closet is empty. Tap + to add a piece.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.cell}
            onLongPress={() => confirmDelete(item)}
          >
            <Image
              source={{ uri: imageUri(item.image) }}
              style={styles.image}
              contentFit="contain"
            />
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push("/add-item")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  cell: { width: "33.33%", aspectRatio: 1, padding: 4 },
  image: { flex: 1, backgroundColor: "#f2f2f2", borderRadius: 8 },
  empty: { textAlign: "center", marginTop: 80, color: "#888" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 40,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: "#fff", fontSize: 32, marginTop: -2 },
});
