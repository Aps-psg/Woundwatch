/**
 * WoundWatch — Home screen
 *
 * Image acquisition:
 *   • "Scan Wound"   → opens the device camera
 *   • "Upload Photo" → opens the system photo library  ← NEW
 *
 * After acquisition the image is POSTed to the FastAPI /analyze endpoint.
 * The full structured response (tissue mix, area, overlay image, healing
 * indicator, warnings) is displayed in a scrollable card-based result screen.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * QUICK CONFIG:
 *   API_BASE  – set to your server's LAN IP when testing on a real device.
 *               Use "http://localhost:7860" for iOS Simulator.
 *               Use "http://10.0.2.2:7860"  for Android Emulator.
 *   USE_MOCK  – set true for offline UI demo (skips the real API call).
 * ──────────────────────────────────────────────────────────────────────────────
 */

import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:7860";
const USE_MOCK = false;

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface TissueMix {
  granulation: number;
  slough: number;
  necrotic: number;
  other: number;
}

interface HealingIndicator {
  not_healed_probability: number;
  note: string;
}

interface AnalyzeResponse {
  area: number;
  unit: "cm2" | "px";
  tissue: TissueMix;
  overlay: string; // base64 JPEG data URL
  healing_indicator: HealingIndicator | null;
  warnings: string[];
  disclaimer: string;
}

// ── STATUS RULES ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  green: {
    emoji: "🟢",
    title: "Healing Normally",
    message:
      "Tissue composition looks healthy. Keep the dressing clean and rescan as scheduled.",
    color: "#16A34A",
    bgColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  yellow: {
    emoji: "🟡",
    title: "Needs Monitoring",
    message:
      "Some slough or mixed tissue detected. Monitor closely and consult a clinician if needed.",
    color: "#CA8A04",
    bgColor: "#FEFCE8",
    borderColor: "#FDE047",
  },
  red: {
    emoji: "🔴",
    title: "Needs Attention",
    message:
      "Significant necrotic or slough tissue detected. Please consult a healthcare professional promptly.",
    color: "#DC2626",
    bgColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
};

function deriveStatus(tissue: TissueMix): keyof typeof STATUS_CONFIG {
  if (tissue.necrotic >= 20) return "red";
  if (tissue.slough >= 35 || tissue.necrotic >= 10) return "yellow";
  if (tissue.granulation >= 50) return "green";
  return "yellow";
}

// ── API ───────────────────────────────────────────────────────────────────────
async function analyzeWound(photoUri: string): Promise<AnalyzeResponse> {
  // Offline demo mode ─────────────────────────────────────────────────────────
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 2200));
    return {
      area: 847,
      unit: "px",
      tissue: { granulation: 54.2, slough: 26.5, necrotic: 7.1, other: 12.2 },
      overlay: photoUri,
      healing_indicator: { not_healed_probability: 0.28, note: "Experimental." },
      warnings: [],
      disclaimer:
        "Estimates from a prototype, not a diagnosis. Share worsening or stalled wounds with a clinician.",
    };
  }

  // Real backend call ─────────────────────────────────────────────────────────
  const formData = new FormData();

  if (Platform.OS === "web") {
    // On web, { uri, name, type } gets stringified to "[object Object]".
    // Fetch the data URL and convert it to a proper Blob instead.
    const fetchResp = await fetch(photoUri);
    const blob = await fetchResp.blob();
    formData.append("image", blob, "wound.jpg");
  } else {
    // React Native's FormData accepts the { uri, name, type } shorthand.
    formData.append("image", {
      uri: photoUri,
      name: "wound.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }

  // Use the full image frame as the wound bounding box.
  // For production: let the user draw a box, then pass it here.
  formData.append("wound_boxes", JSON.stringify([[0.05, 0.05, 0.95, 0.95]]));
  formData.append("wound_kind", "surgical");

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Server returned ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<AnalyzeResponse>;
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

/** A single tissue type row with label, percentage and filled progress bar. */
function TissueBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.tissueRow}>
      <View style={styles.tissueLabelRow}>
        <View style={[styles.tissueDot, { backgroundColor: color }]} />
        <Text style={styles.tissueLabel}>{label}</Text>
        <Text style={styles.tissueValue}>{value.toFixed(1)}%</Text>
      </View>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min(value, 100)}%` as unknown as number, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// ── SCREENS ───────────────────────────────────────────────────────────────────

function HomeScreen({
  onScan,
  onUpload,
}: {
  onScan: () => void;
  onUpload: () => void;
}) {
  return (
    <SafeAreaView style={styles.homeContainer}>
      {/* Branding */}
      <View style={styles.homeContent}>
        <Text style={styles.logo}>🩹</Text>
        <Text style={styles.appName}>WoundWatch</Text>
        <Text style={styles.tagline}>
          Monitor your wound healing, right from home.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        {/* Scan (camera) */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={onScan}
          activeOpacity={0.85}
        >
          <Text style={styles.btnIcon}>📷</Text>
          <Text style={styles.scanBtnLabel}>Scan Wound</Text>
          <Text style={styles.btnSub}>Open camera</Text>
        </TouchableOpacity>

        {/* Upload (gallery) */}
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={onUpload}
          activeOpacity={0.85}
        >
          <Text style={styles.btnIcon}>🖼️</Text>
          <Text style={styles.uploadBtnLabel}>Upload Photo</Text>
          <Text style={styles.btnSub}>From gallery</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Decision support only — not a medical diagnosis.{"\n"}Always consult a
        healthcare professional.
      </Text>
    </SafeAreaView>
  );
}

function CameraScreen({
  onCapture,
  onCancel,
}: {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<CameraView>(null);
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) onCapture(photo.uri);
    } catch {
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

function LoadingScreen({ photoUri }: { photoUri: string }) {
  return (
    <SafeAreaView style={styles.loadingContainer}>
      <Image source={{ uri: photoUri }} style={styles.thumbSmall} />
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color="#2E6BE6" />
        <Text style={styles.loadingTitle}>Analyzing Wound</Text>
        <Text style={styles.loadingSub}>
          Running AI segmentation and tissue classification…
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ResultScreen({
  photoUri,
  result,
  error,
  onNewAnalysis,
}: {
  photoUri: string;
  result: AnalyzeResponse | null;
  error: string | null;
  onNewAnalysis: () => void;
}) {
  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Analysis Failed</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onNewAnalysis}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!result) return null;

  const statusKey = deriveStatus(result.tissue);
  const status = STATUS_CONFIG[statusKey];

  return (
    <SafeAreaView style={styles.resultOuter}>
      <ScrollView
        style={styles.resultScroll}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <Text style={styles.resultHeading}>Analysis Report</Text>

        {/* ── Image pair ── */}
        <View style={styles.imageRow}>
          <View style={styles.imageCol}>
            <Text style={styles.imageCaption}>Original</Text>
            <Image source={{ uri: photoUri }} style={styles.resultImg} />
          </View>
          <View style={styles.imageCol}>
            <Text style={styles.imageCaption}>Tissue Map</Text>
            <Image source={{ uri: result.overlay }} style={styles.resultImg} />
          </View>
        </View>

        {/* ── Status card ── */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: status.bgColor, borderColor: status.borderColor },
          ]}
        >
          <Text style={styles.statusEmoji}>{status.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: status.color }]}>
              {status.title}
            </Text>
            <Text style={styles.statusMessage}>{status.message}</Text>
          </View>
        </View>

        {/* ── Tissue breakdown ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tissue Breakdown</Text>
          <TissueBar label="Granulation" value={result.tissue.granulation} color="#EF4444" />
          <TissueBar label="Slough"      value={result.tissue.slough}      color="#EAB308" />
          <TissueBar label="Necrotic"    value={result.tissue.necrotic}    color="#374151" />
          <TissueBar label="Other"       value={result.tissue.other}       color="#94A3B8" />
          <View style={styles.legend}>
            <Text style={styles.legendText}>
              🔴 Granulation (healthy) · 🟡 Slough (dead) · ⚫ Necrotic (critical)
            </Text>
          </View>
        </View>

        {/* ── Measurements ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wound Area</Text>
          <Text style={styles.areaValue}>
            {result.area.toLocaleString()}{" "}
            <Text style={styles.areaUnit}>{result.unit}</Text>
          </Text>
          {result.unit === "px" && (
            <Text style={styles.areaNote}>
              Area is in pixels. Provide a reference object (e.g. a coin) for cm²
              measurements.
            </Text>
          )}
        </View>

        {/* ── Healing indicator (surgical only) ── */}
        {result.healing_indicator && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Surgical Healing Indicator</Text>
            <View style={styles.healingRow}>
              <Text style={styles.healingLabel}>Not-healed probability</Text>
              <Text
                style={[
                  styles.healingPct,
                  {
                    color:
                      result.healing_indicator.not_healed_probability > 0.6
                        ? "#DC2626"
                        : "#16A34A",
                  },
                ]}
              >
                {(result.healing_indicator.not_healed_probability * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${result.healing_indicator.not_healed_probability * 100}%` as unknown as number,
                    backgroundColor:
                      result.healing_indicator.not_healed_probability > 0.6
                        ? "#DC2626"
                        : "#16A34A",
                  },
                ]}
              />
            </View>
            <Text style={styles.healingNote}>{result.healing_indicator.note}</Text>
          </View>
        )}

        {/* ── Warnings ── */}
        {result.warnings.length > 0 && (
          <View style={[styles.card, styles.warnCard]}>
            <Text style={styles.warnTitle}>⚠️ Warnings</Text>
            {result.warnings.map((w, i) => (
              <Text key={i} style={styles.warnItem}>
                • {w}
              </Text>
            ))}
          </View>
        )}

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimerSmall}>{result.disclaimer}</Text>

        {/* ── Action ── */}
        <TouchableOpacity style={styles.newAnalysisBtn} onPress={onNewAnalysis}>
          <Text style={styles.newAnalysisBtnText}>New Analysis</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<
    "home" | "camera" | "loading" | "result"
  >("home");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Shared pipeline: show loading → call API → show result. */
  const runAnalysis = async (uri: string) => {
    setPhotoUri(uri);
    setResult(null);
    setError(null);
    setScreen("loading");
    try {
      const res = await analyzeWound(uri);
      setResult(res);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not analyze the wound. Check your connection and retry.";
      setError(msg);
    } finally {
      setScreen("result");
    }
  };

  /** Open the system photo library and run analysis on the selected image. */
  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Gallery access is needed to upload wound photos.",
        [{ text: "OK" }]
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!picked.canceled && picked.assets.length > 0) {
      runAnalysis(picked.assets[0].uri);
    }
  };

  const reset = () => {
    setPhotoUri(null);
    setResult(null);
    setError(null);
    setScreen("home");
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8FF" />

      {screen === "home" && (
        <HomeScreen onScan={() => setScreen("camera")} onUpload={handleUpload} />
      )}
      {screen === "camera" && (
        <CameraScreen
          onCapture={runAnalysis}
          onCancel={() => setScreen("home")}
        />
      )}
      {screen === "loading" && photoUri && (
        <LoadingScreen photoUri={photoUri} />
      )}
      {screen === "result" && photoUri && (
        <ResultScreen
          photoUri={photoUri}
          result={result}
          error={error}
          onNewAnalysis={reset}
        />
      )}
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const BLUE = "#2E6BE6";
const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  // ── Home ──────────────────────────────────────────────────────────────────
  homeContainer: {
    flex: 1,
    backgroundColor: "#F5F8FF",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  homeContent: { alignItems: "center", marginTop: 60 },
  logo: { fontSize: 72 },
  appName: { fontSize: 34, fontWeight: "800", color: "#1B2A4E", marginTop: 8 },
  tagline: {
    fontSize: 16,
    color: "#5A6A8A",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },

  buttonRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 14,
  },

  // Scan button — filled
  scanBtn: {
    flex: 1,
    backgroundColor: BLUE,
    borderRadius: CARD_RADIUS,
    alignItems: "center",
    paddingVertical: 24,
    elevation: 8,
    shadowColor: BLUE,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  scanBtnLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
  },

  // Upload button — outlined
  uploadBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: CARD_RADIUS,
    alignItems: "center",
    paddingVertical: 24,
    borderWidth: 2,
    borderColor: BLUE,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  uploadBtnLabel: {
    color: BLUE,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
  },

  btnIcon: { fontSize: 32 },
  btnSub: { fontSize: 12, marginTop: 3 },

  disclaimer: {
    fontSize: 12,
    color: "#8A94AA",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 18,
  },

  // ── Camera ────────────────────────────────────────────────────────────────
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

  // ── Loading ───────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F5F8FF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: CARD_RADIUS,
    padding: 32,
    alignItems: "center",
    marginTop: 24,
    width: "100%",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B2A4E",
    marginTop: 16,
  },
  loadingSub: {
    fontSize: 14,
    color: "#5A6A8A",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  thumbSmall: { width: 100, height: 100, borderRadius: 14 },

  // ── Result ────────────────────────────────────────────────────────────────
  resultOuter: { flex: 1, backgroundColor: "#F5F8FF" },
  resultScroll: { flex: 1 },
  resultContent: { padding: 16, paddingBottom: 48 },

  resultHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B2A4E",
    marginBottom: 16,
  },

  imageRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  imageCol: { flex: 1 },
  imageCaption: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5A6A8A",
    textAlign: "center",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultImg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },

  // Status card
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  statusEmoji: { fontSize: 36 },
  statusTitle: { fontSize: 18, fontWeight: "800" },
  statusMessage: { fontSize: 13, color: "#374151", marginTop: 4, lineHeight: 18 },

  // Generic card
  card: {
    backgroundColor: "#fff",
    borderRadius: CARD_RADIUS,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B2A4E",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Tissue bars
  tissueRow: { marginBottom: 12 },
  tissueLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  tissueDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  tissueLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "500" },
  tissueValue: { fontSize: 14, fontWeight: "700", color: "#1B2A4E" },
  barBg: { height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  legend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  legendText: { fontSize: 11, color: "#94A3B8", lineHeight: 16 },

  // Area
  areaValue: { fontSize: 36, fontWeight: "800", color: "#1B2A4E" },
  areaUnit: { fontSize: 18, fontWeight: "500", color: "#5A6A8A" },
  areaNote: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
    lineHeight: 16,
    fontStyle: "italic",
  },

  // Healing indicator
  healingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  healingLabel: { fontSize: 14, color: "#5A6A8A" },
  healingPct: { fontSize: 28, fontWeight: "800" },
  healingNote: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 10,
    lineHeight: 15,
    fontStyle: "italic",
  },

  // Warnings
  warnCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warnTitle: { fontSize: 15, fontWeight: "700", color: "#92400E", marginBottom: 8 },
  warnItem: { fontSize: 13, color: "#78350F", lineHeight: 20 },

  // New analysis button
  newAnalysisBtn: {
    backgroundColor: BLUE,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    elevation: 4,
    shadowColor: BLUE,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  newAnalysisBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  // ── Shared ────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F8FF",
  },
  permText: {
    fontSize: 16,
    textAlign: "center",
    color: "#374151",
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 20,
  },
  primaryBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  linkBtn: { marginTop: 16 },
  linkBtnText: { color: BLUE, fontSize: 16 },

  disclaimerSmall: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
    lineHeight: 16,
  },

  // Errors
  errorEmoji: { fontSize: 52, marginBottom: 8 },
  errorTitle: { fontSize: 22, fontWeight: "800", color: "#1B2A4E", marginBottom: 8 },
  errorBody: {
    fontSize: 14,
    textAlign: "center",
    color: "#DC2626",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});