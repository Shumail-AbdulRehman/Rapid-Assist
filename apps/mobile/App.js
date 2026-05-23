import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import api, { setToken } from "./src/api";
import { MapPreview } from "./src/MapPreview";
import { uploadImageFromUri } from "./src/upload";

const initialRegister = {
  role: "user",
  name: "",
  phone: "",
  password: "",
  profilePicture: "",
  workshopPicture: "",
  cnic: "",
  certificates: "",
  previousWorkHistory: "",
  reviewsSummary: "",
  latitude: "24.8607",
  longitude: "67.0011",
};

const initialRequest = {
  serviceId: "",
  description: "",
  vehicleNumber: "",
  latitude: "24.8607",
  longitude: "67.0011",
};

export default function App() {
  const [mode, setMode] = useState("register");
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [services, setServices] = useState([]);
  const [session, setSession] = useState({ token: "", user: null });
  const [requestForm, setRequestForm] = useState(initialRequest);
  const [activeRequest, setActiveRequest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [providerRequests, setProviderRequests] = useState([]);
  const [providerLocation, setProviderLocation] = useState({ latitude: "24.8615", longitude: "67.0099" });
  const [offerDrafts, setOfferDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [providerLiveLocation, setProviderLiveLocation] = useState(null);
  const [uploadingField, setUploadingField] = useState("");
  const [authLoading, setAuthLoading] = useState("");

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function updateRegisterField(field, value) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateLoginField(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateRegisterForm() {
    const errors = {};

    if (!registerForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!registerForm.phone.trim()) {
      errors.phone = "Phone is required";
    }

    if (!registerForm.password.trim()) {
      errors.password = "Password is required";
    } else if (registerForm.password.trim().length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (registerForm.role === "provider") {
      if (!registerForm.cnic.trim()) {
        errors.cnic = "CNIC is required for providers";
      }
    }

    return errors;
  }

  function validateLoginForm() {
    const errors = {};

    if (!loginForm.phone.trim()) {
      errors.phone = "Phone is required";
    }

    if (!loginForm.password.trim()) {
      errors.password = "Password is required";
    }

    return errors;
  }

  useEffect(() => {
    setToken(session.token);
  }, [session.token]);

  useEffect(() => {
    api.get("/services").then((response) => setServices(response.data)).catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (!session.token || session.user?.role !== "provider") {
      return;
    }

    refreshProviderRequests();
  }, [session.token, session.user?.role]);

  useEffect(() => {
    if (!activeRequest?.id || session.user?.role !== "user") {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/requests/${activeRequest.id}`);
        setActiveRequest(response.data.request);
        setOffers(response.data.offers);
        setProviderLiveLocation(response.data.acceptedProviderLocation);
      } catch (_error) {
        return undefined;
      }
    }, 7000);

    return () => clearInterval(timer);
  }, [activeRequest?.id, session.user?.role]);

  async function register() {
    const errors = validateRegisterForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showMessage("Please fix the highlighted fields before continuing.", "error");
      return;
    }

    setFieldErrors({});
    setAuthLoading("register");
    showMessage("Creating your account...", "info");

    try {
      await api.post("/auth/register", registerForm);
      setMode("login");
      showMessage("Registration complete. Please log in.", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Registration failed", "error");
    } finally {
      setAuthLoading("");
    }
  }

  async function login() {
    const errors = validateLoginForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showMessage("Enter your phone and password to continue.", "error");
      return;
    }

    setFieldErrors({});
    setAuthLoading("login");
    showMessage("Signing you in...", "info");

    try {
      const response = await api.post("/auth/login", loginForm);
      setSession(response.data);
      setMessage("");
    } catch (error) {
      showMessage(error.response?.data?.message || "Login failed", "error");
    } finally {
      setAuthLoading("");
    }
  }

  async function createRequest() {
    try {
      const response = await api.post("/requests", requestForm);
      setActiveRequest(response.data.request);
      setOffers([]);
      setProviderLiveLocation(null);
      showMessage("Request submitted", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Request failed", "error");
    }
  }

  async function refreshProviderRequests() {
    try {
      await api.patch("/requests/provider/location", providerLocation);
      const response = await api.get("/requests/nearby", {
        params: {
          latitude: providerLocation.latitude,
          longitude: providerLocation.longitude,
          radiusKm: 4,
        },
      });
      setProviderRequests(response.data);
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to load nearby requests", "error");
    }
  }

  async function pickAndUploadImage(field) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showMessage("Media library permission is required", "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setUploadingField(field);
      const fileUrl = await uploadImageFromUri(result.assets[0].uri);
      setRegisterForm((current) => ({ ...current, [field]: fileUrl }));
      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];
        return next;
      });
      showMessage("Image uploaded", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || error.message || "Image upload failed", "error");
    } finally {
      setUploadingField("");
    }
  }

  async function sendOffer(requestId) {
    const draft = offerDrafts[requestId] || {};

    try {
      await api.post("/requests/offers", {
        requestId,
        price: Number(draft.price || 0),
        estimatedMinutes: Number(draft.estimatedMinutes || 15),
        message: draft.message || "",
      });
      showMessage("Offer sent", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Offer failed", "error");
    }
  }

  async function acceptOffer(offerId) {
    try {
      await api.post(`/requests/offers/${offerId}/accept`);
      const response = await api.get(`/requests/${activeRequest.id}`);
      setActiveRequest(response.data.request);
      setOffers(response.data.offers);
      showMessage("Offer accepted", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Accept failed", "error");
    }
  }

  if (!session.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>Roadside Assistance</Text>
          <Text style={styles.title}>User and provider access in one Expo app.</Text>

          <View style={styles.row}>
            <Pill active={mode === "register"} label="Register" onPress={() => setMode("register")} />
            <Pill active={mode === "login"} label="Login" onPress={() => setMode("login")} />
          </View>

          <View style={styles.row}>
            <Pill
              active={registerForm.role === "user"}
              label="User Side"
              onPress={() => setRegisterForm({ ...registerForm, role: "user" })}
            />
            <Pill
              active={registerForm.role === "provider"}
              label="Provider Side"
              onPress={() => setRegisterForm({ ...registerForm, role: "provider" })}
            />
          </View>

          {mode === "register" ? (
            <View style={styles.card}>
              <Input
                label="Name"
                value={registerForm.name}
                error={fieldErrors.name}
                onChangeText={(name) => updateRegisterField("name", name)}
              />
              <Input
                label="Phone"
                value={registerForm.phone}
                error={fieldErrors.phone}
                onChangeText={(phone) => updateRegisterField("phone", phone)}
              />
              <Input
                label="Password"
                value={registerForm.password}
                error={fieldErrors.password}
                secureTextEntry
                onChangeText={(password) => updateRegisterField("password", password)}
              />
              <PrimaryButton
                label={uploadingField === "profilePicture" ? "Uploading profile image..." : "Upload profile picture (optional)"}
                onPress={() => pickAndUploadImage("profilePicture")}
                disabled={uploadingField !== ""}
              />
              {registerForm.profilePicture ? <Image source={{ uri: registerForm.profilePicture }} style={styles.previewImage} /> : null}
              {registerForm.role === "provider" ? (
                <>
                  <PrimaryButton
                    label={uploadingField === "workshopPicture" ? "Uploading workshop image..." : "Upload workshop picture (optional)"}
                    onPress={() => pickAndUploadImage("workshopPicture")}
                    disabled={uploadingField !== ""}
                  />
                  {registerForm.workshopPicture ? <Image source={{ uri: registerForm.workshopPicture }} style={styles.previewImage} /> : null}
                  <Input
                    label="CNIC"
                    value={registerForm.cnic}
                    error={fieldErrors.cnic}
                    onChangeText={(cnic) => updateRegisterField("cnic", cnic)}
                  />
                  <Input
                    label="Certificates"
                    value={registerForm.certificates}
                    onChangeText={(certificates) => updateRegisterField("certificates", certificates)}
                    multiline
                  />
                  <Input
                    label="Previous work history"
                    value={registerForm.previousWorkHistory}
                    onChangeText={(previousWorkHistory) => updateRegisterField("previousWorkHistory", previousWorkHistory)}
                    multiline
                  />
                  <Input
                    label="Reviews summary"
                    value={registerForm.reviewsSummary}
                    onChangeText={(reviewsSummary) => updateRegisterField("reviewsSummary", reviewsSummary)}
                    multiline
                  />
                </>
              ) : null}
              <PrimaryButton
                label={authLoading === "register" ? "Creating account..." : "Create account"}
                onPress={register}
                loading={authLoading === "register"}
                disabled={authLoading !== "" || uploadingField !== ""}
              />
              {authLoading === "register" ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color="#ffb84d" />
                  <Text style={styles.progressText}>Submitting your registration details...</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <Input
                label="Phone"
                value={loginForm.phone}
                error={fieldErrors.phone}
                onChangeText={(phone) => updateLoginField("phone", phone)}
              />
              <Input
                label="Password"
                value={loginForm.password}
                error={fieldErrors.password}
                secureTextEntry
                onChangeText={(password) => updateLoginField("password", password)}
              />
              <PrimaryButton
                label={authLoading === "login" ? "Signing in..." : "Continue"}
                onPress={login}
                loading={authLoading === "login"}
                disabled={authLoading !== ""}
              />
              {authLoading === "login" ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color="#ffb84d" />
                  <Text style={styles.progressText}>Checking your credentials...</Text>
                </View>
              ) : null}
            </View>
          )}

          {!!message ? <FeedbackMessage message={message} type={messageType} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (session.user.role === "user") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>User Side</Text>
          <Text style={styles.title}>Request roadside help and review live offers.</Text>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create request</Text>
            <Input label="Service ID" value={requestForm.serviceId} onChangeText={(serviceId) => setRequestForm({ ...requestForm, serviceId })} />
            <Text style={styles.helper}>
              {services.map((service) => `${service.id}: ${service.name}`).join(" | ")}
            </Text>
            <Input label="Vehicle number" value={requestForm.vehicleNumber} onChangeText={(vehicleNumber) => setRequestForm({ ...requestForm, vehicleNumber })} />
            <Input label="Description" value={requestForm.description} onChangeText={(description) => setRequestForm({ ...requestForm, description })} multiline />
            <Input label="Latitude" value={requestForm.latitude} onChangeText={(latitude) => setRequestForm({ ...requestForm, latitude })} />
            <Input label="Longitude" value={requestForm.longitude} onChangeText={(longitude) => setRequestForm({ ...requestForm, longitude })} />
            <PrimaryButton label="Request assistance" onPress={createRequest} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Offers</Text>
            <MapPreview
              requestLocation={
                activeRequest
                  ? { latitude: Number(activeRequest.latitude), longitude: Number(activeRequest.longitude) }
                  : null
              }
              providerLocation={providerLiveLocation}
            />
            {offers.length === 0 ? <Text style={styles.helper}>Waiting for providers...</Text> : null}
            {offers.map((offer) => (
              <View style={styles.offerCard} key={offer.id}>
                <Text style={styles.offerTitle}>{offer.providerName}</Text>
                <Text style={styles.helper}>
                  PKR {offer.price + offer.extraDistanceCharge} | {offer.estimatedMinutes} mins | {offer.distanceKm} km
                </Text>
                <Text style={styles.helper}>{offer.message || "Ready to help"}</Text>
                {offer.status === "pending" ? (
                  <PrimaryButton label="Accept offer" onPress={() => acceptOffer(offer.id)} />
                ) : (
                  <Text style={styles.badge}>{offer.status}</Text>
                )}
              </View>
            ))}
          </View>

          {!!message ? <FeedbackMessage message={message} type={messageType} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>Provider Side</Text>
        <Text style={styles.title}>View requests within the service radius and send bids.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current location</Text>
          <Input label="Latitude" value={providerLocation.latitude} onChangeText={(latitude) => setProviderLocation({ ...providerLocation, latitude })} />
          <Input label="Longitude" value={providerLocation.longitude} onChangeText={(longitude) => setProviderLocation({ ...providerLocation, longitude })} />
          <PrimaryButton label="Refresh nearby requests" onPress={refreshProviderRequests} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nearby map</Text>
          <MapPreview
            requestLocation={{ latitude: Number(providerLocation.latitude), longitude: Number(providerLocation.longitude) }}
            nearbyRequests={providerRequests}
          />
        </View>

        {providerRequests.map((request) => (
          <View style={styles.card} key={request.id}>
            <Text style={styles.offerTitle}>{request.serviceName}</Text>
            <Text style={styles.helper}>{request.description}</Text>
            <Text style={styles.helper}>Vehicle: {request.vehicleNumber}</Text>
            <Text style={styles.helper}>
              {request.distanceKm} km away | extra charge PKR {request.extraDistanceCharge}
            </Text>
            <Input
              label="Offer price"
              value={offerDrafts[request.id]?.price || ""}
              onChangeText={(price) =>
                setOfferDrafts({ ...offerDrafts, [request.id]: { ...offerDrafts[request.id], price } })
              }
            />
            <Input
              label="ETA minutes"
              value={offerDrafts[request.id]?.estimatedMinutes || ""}
              onChangeText={(estimatedMinutes) =>
                setOfferDrafts({
                  ...offerDrafts,
                  [request.id]: { ...offerDrafts[request.id], estimatedMinutes },
                })
              }
            />
            <Input
              label="Message"
              value={offerDrafts[request.id]?.message || ""}
              onChangeText={(messageText) =>
                setOfferDrafts({
                  ...offerDrafts,
                  [request.id]: { ...offerDrafts[request.id], message: messageText },
                })
              }
              multiline
            />
            <PrimaryButton label="Send offer" onPress={() => sendOffer(request.id)} />
          </View>
        ))}

        {!!message ? <FeedbackMessage message={message} type={messageType} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ label, multiline = false, error, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#7f98a1"
        style={[styles.input, multiline && styles.textarea, error && styles.inputError]}
        multiline={multiline}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, onPress, loading = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        (pressed || loading) && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color="#111" /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Pill({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FeedbackMessage({ message, type }) {
  return <Text style={[styles.message, type === "error" && styles.messageError, type === "success" && styles.messageSuccess]}>{message}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#08151d",
  },
  container: {
    padding: 18,
    gap: 16,
  },
  eyebrow: {
    color: "#ffb84d",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    marginTop: 16,
  },
  title: {
    color: "#f1f7f4",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#0f2027",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputWrap: {
    marginBottom: 12,
  },
  label: {
    color: "#9ab3bc",
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#122b34",
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#ffb84d",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#111",
    fontWeight: "700",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillActive: {
    backgroundColor: "#46d0a4",
  },
  pillText: {
    color: "#fff",
  },
  pillTextActive: {
    color: "#0b151a",
    fontWeight: "700",
  },
  message: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,184,77,0.14)",
    color: "#ffcf75",
    borderWidth: 1,
    borderColor: "rgba(255,184,77,0.24)",
  },
  messageError: {
    color: "#ff9d9d",
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.28)",
  },
  messageSuccess: {
    color: "#7ff0c7",
    backgroundColor: "rgba(70,208,164,0.12)",
    borderColor: "rgba(70,208,164,0.28)",
  },
  helper: {
    color: "#9ab3bc",
    marginBottom: 8,
  },
  offerCard: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
    marginTop: 12,
  },
  offerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
    marginBottom: 4,
  },
  badge: {
    color: "#46d0a4",
    textTransform: "capitalize",
  },
  inputError: {
    borderColor: "#ff6b6b",
  },
  errorText: {
    color: "#ff9d9d",
    marginTop: 6,
    fontSize: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  progressText: {
    color: "#9ab3bc",
  },
});
