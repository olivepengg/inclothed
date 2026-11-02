import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Closet" }} />
      <Stack.Screen
        name="add-item"
        options={{ title: "Add Item", presentation: "modal" }}
      />
    </Stack>
  );
}
