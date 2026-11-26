import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Matches the web upload: longest edge 1600 px, JPEG. */
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Take or choose a receipt photo and shrink it. Resolves null when the contractor backs out.
 * Throws with words to show when the camera is blocked or the photo can't be read.
 */
export async function pickReceiptPhoto(source: "camera" | "library"): Promise<string | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Camera access is blocked. Allow it in your phone's settings, or choose a photo.");
    }
  }
  // The system photo picker needs no library permission: it only hands back what was chosen.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
  } catch {
    throw new Error(source === "camera" ? "The camera isn't available here." : "Couldn't open your photos.");
  }
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  try {
    const context = ImageManipulator.manipulate(asset.uri);
    // Never upscale. The other side follows to keep the shape.
    if (Math.max(asset.width, asset.height) > MAX_EDGE_PX) {
      context.resize(asset.width >= asset.height ? { width: MAX_EDGE_PX } : { height: MAX_EDGE_PX });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    return saved.uri;
  } catch {
    throw new Error("Couldn't open that photo. Try another one.");
  }
}
