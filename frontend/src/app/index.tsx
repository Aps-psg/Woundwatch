import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ---------- CONFIG ----------
// Set to your FastAPI server's LAN IP (not localhost) when testing on a phone.
const API_URL = "http://192.168.1.10:8000/analyze";
// While the backend/model isn't ready, keep this true to get simulated results.
const USE_MOCK = true;

// ---------- TRIAGE CATEGORIES ----------
const STATUS = {
  green: {
    emoji: "🟢",
    title: "Healing Normally",
    message:
      "Your wound looks like it is healing as expected. Keep the dressing clean and rescan as scheduled.",
    color: "#2E9E5B",
    bg: "#E8F7EE",
  },
  yellow: {
    emoji: "🟡",
    title: "Possible Infection",
    message:
      "Some signs may suggest infection. Recheck soon or contact a clinic for advice.",
    color: "#D99A00",
    bg: "#FFF6DB",
  },
  red: {
    emoji: "🔴",
    title: "Needs Immediate Attention",
    message:
      "This wound shows signs that need urgent medical care. Please seek medical help now.",
    color: "#D6322E",
    bg: "#FDE9E8",
  },
};

// ---------- API CALL ----------
async function analyzeWound(photoUri) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1800)); // fake processing delay
    const options = ["green", "yellow", "red"];
    return {
      status: options[Math.floor(Math.random() * 3)],
      confidence: 0.6 + Math.random() * 0.35,
      woundType: "Surgical incision",
    };
  }

  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    name: "wound.jpg",
    type: "image/jpeg",
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data" },
    body: formData,
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  // Expected: { status: "green" | "yellow" | "red", confidence: 0-1, woundType: "..." }
  return await res.json();
}

// ---------- SCREENS ----------
function HomeScreen({ onScan }) {
  return (
    <SafeAreaView style={styles.homeContainer}>
      <View style={styles.homeContent}>
        <Text style={styles.logo}>🩹</Text>
        <Text style={styles.appName}>WoundWatch</Text>
        <Text style={styles.tagline}>
          Monitor your wound healing, right from home.
        </Text>
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={onScan}>
        <Text style={styles.scanButtonText}>SCAN</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Triage aid only, not a medical diagnosis. Always consult a healthcare
        professional.
      </Text>
    </SafeAreaView>
  );
}

function CameraScreen({ onCapture, onCancel }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permText}>
          Camera access is needed to scan your wound.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={onCancel}>
          <Text style={styles.linkBtnText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      onCapture(photo.uri);
    } catch (e) {
      Alert.alert("Error", "Could not capture photo. Please try again.");
      setCapturing(false);
    }
  };

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.guideBox} />
        <Text style={styles.guideText}>Place the wound inside the frame</Text>
      </CameraView>

      <View style={styles.cameraControls}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shutterOuter} onPress={takePhoto}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

function ResultScreen({ photoUri, result, error, loading, onScanAgain }) {
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <Image source={{ uri: photoUri }} style={styles.thumbSmall} />
        <ActivityIndicator size="large" color="#2E6BE6" />
        <Text style={styles.loadingText}>Analyzing wound...</Text>
        <Text style={styles.loadingSub}>
          Comparing with reference dataset
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onScanAgain}>
          <Text style={styles.primaryBtnText}>Scan Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const info = STATUS[result.status] || STATUS.yellow;

  return (
    <SafeAreaView style={[styles.resultContainer, { backgroundColor: info.bg }]}>
      <Image source={{ uri: photoUri }} style={styles.thumb} />

      <Text style={styles.resultEmoji}>{info.emoji}</Text>
      <Text style={[styles.resultTitle, { color: info.color }]}>
        {info.title}
      </Text>
      <Text style={styles.resultMessage}>{info.message}</Text>

      <View style={styles.metaBox}>
        {result.woundType ? (
          <Text style={styles.metaText}>Wound type: {result.woundType}</Text>
        ) : null}
        {typeof result.confidence === "number" ? (
          <Text style={styles.metaText}>
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: info.color }]}
        onPress={onScanAgain}
      >
        <Text style={styles.primaryBtnText}>Scan Again</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimerSmall}>
        Not a diagnosis. If you are worried, contact a medical professional.
      </Text>
    </SafeAreaView>
  );
}

// ---------- ROOT ----------
export default function App() {
  const [screen, setScreen] = useState("home"); // home | camera | result
  const [photoUri, setPhotoUri] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCapture = async (uri) => {
    setPhotoUri(uri);
    setResult(null);
    setError(null);
    setLoading(true);
    setScreen("result");
    try {
      const res = await analyzeWound(uri);
      setResult(res);
    } catch (e) {
      setError("Could not analyze the wound. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhotoUri(null);
    setResult(null);
    setError(null);
    setScreen("camera"); // straight back to scanning
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {screen === "home" && <HomeScreen onScan={() => setScreen("camera")} />}
      {screen === "camera" && (
        <CameraScreen
          onCapture={handleCapture}
          onCancel={() => setScreen("home")}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          photoUri={photoUri}
          result={result}
          error={error}
          loading={loading}
          onScanAgain={reset}
        />
      )}
    </>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  // Home
  homeContainer: {
    flex: 1,
    backgroundColor: "#F5F8FF",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  homeContent: { alignItems: "center", marginTop: 80 },
  logo: { fontSize: 72 },
  appName: { fontSize: 34, fontWeight: "800", color: "#1B2A4E", marginTop: 8 },
  tagline: {
    fontSize: 16,
    color: "#5A6A8A",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  scanButton: {
    backgroundColor: "#2E6BE6",
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#2E6BE6",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 3,
  },
  disclaimer: {
    fontSize: 12,
    color: "#8A94AA",
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1, alignItems: "center", justifyContent: "center" },
  guideBox: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 20,
    borderStyle: "dashed",
  },
  guideText: { color: "#fff", marginTop: 16, fontSize: 15 },
  cameraControls: {
    height: 130,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  cancelText: { color: "#fff", fontSize: 16, width: 60 },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },

  // Shared
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F8FF",
  },
  permText: { fontSize: 16, textAlign: "center", marginBottom: 20 },
  primaryBtn: {
    backgroundColor: "#2E6BE6",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 20,
  },
  primaryBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  linkBtn: { marginTop: 16 },
  linkBtnText: { color: "#2E6BE6", fontSize: 16 },

  // Result
  resultContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  thumb: {
    width: 160,
    height: 160,
    borderRadius: 16,
    marginBottom: 20,
  },
  thumbSmall: { width: 120, height: 120, borderRadius: 14, marginBottom: 24 },
  resultEmoji: { fontSize: 64 },
  resultTitle: { fontSize: 28, fontWeight: "800", marginTop: 8 },
  resultMessage: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  metaBox: { marginTop: 16, alignItems: "center" },
  metaText: { fontSize: 14, color: "#555", marginTop: 2 },
  loadingText: { fontSize: 18, fontWeight: "600", marginTop: 20 },
  loadingSub: { fontSize: 14, color: "#777", marginTop: 6 },
  errorText: { fontSize: 16, textAlign: "center", color: "#D6322E" },
  disclaimerSmall: {
    fontSize: 12,
    color: "#777",
    textAlign: "center",
    marginTop: 24,
  },
});