import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { addClothingItemFromPhoto } from "../lib/clothingItems";
import { addItem } from "../lib/db";
import { removeBackground } from "../lib/removeBg";
import { imageUri, saveBytes, saveFromUri } from "../lib/storage";

export default function AddItem() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const process = async (uri: string) => {
    setBusy(true);
    try {
      const original = saveFromUri(uri, "jpg");
      let image = original;
      try {
        image = saveBytes(await removeBackground(uri), "png");
      } catch (e) {
        console.warn("Background removal failed", e);
        Alert.alert(
          "Background removal failed",
          "Saved the original photo instead.",
        );
      }
      addItem(image, original);
      try {
        await addClothingItemFromPhoto(imageUri(image));
      } catch (e) {
        // The item is already saved locally, so a network problem doesn't lose it.
        console.warn("Cloud sync failed", e);
        Alert.alert("Couldn't sync", "This item is saved on this device only.");
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: "camera" | "library") => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.8,
    };
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted)
        return Alert.alert("Camera access needed", "Enable it in Settings.");
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled) process(result.assets[0].uri);
  };

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Cutting out the background...</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Pressable style={styles.button} onPress={() => pick("camera")}>
        <Text style={styles.buttonText}>Take a photo</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => pick("library")}>
        <Text style={styles.buttonText}>Choose from library</Text>
      </Pressable>
      <Text style={styles.hint}>
        Tip: lay the item flat on a plain floor or bed in good light.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  button: {
    backgroundColor: "#111",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontSize: 16 },
  hint: { color: "#888", textAlign: "center", marginTop: 8 },
});
