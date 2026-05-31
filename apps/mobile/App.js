import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFonts } from "expo-font";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import api, { setToken } from "./src/api";
import { getCurrentDeviceLocation, searchAddress } from "./src/location";
import { MapPreview } from "./src/MapPreview";
import { uploadImageFromUri } from "./src/upload";

const LAHORE_COORDS = {
  latitude: "31.5204",
  longitude: "74.3587",
};

const PROVIDER_QUEUE_RADIUS_KM = 300;

const PROVIDER_SERVICE_OPTIONS = [
  { code: "fuel_delivery", label: "Fuel Delivery", short: "FD" },
  { code: "car_towing", label: "Car Towing", short: "CT" },
  { code: "mechanic", label: "Mechanic", short: "MC" },
];

const CUSTOMER_TAB_ITEMS = [
  { key: "home", label: "Request" },
  { key: "history", label: "History" },
  { key: "profile", label: "Profile" },
];

const CUSTOMER_BOOKING_STEPS = [
  { key: "service", label: "Service" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
];

const PROVIDER_TAB_ITEMS = [
  { key: "home", label: "Queue" },
  { key: "history", label: "History" },
  { key: "profile", label: "Profile" },
];

const TOWING_PROBLEM_OPTIONS = [
  { code: "accident", label: "Accident" },
  { code: "flat_tyre", label: "Flat Tyre" },
  { code: "battery_dead", label: "Battery Dead" },
  { code: "engine_not_starting", label: "Engine Not Starting" },
  { code: "other", label: "Other" },
];

const DEFAULT_SERVICES = [
  {
    id: "fuel_delivery",
    code: "fuel_delivery",
    name: "Fuel Delivery",
    description: "Emergency fuel delivery for cars and bikes across Lahore.",
    pricing: {
      currency: "PKR",
      flatDeliveryFee: 250,
      fuelPrices: {
        petrol: 272,
        diesel: 280,
      },
    },
    config: {
      fuelTypes: ["petrol", "diesel"],
      vehicleTypes: ["bike", "car"],
      quantities: [1, 2, 5, 10],
    },
  },
  {
    id: "car_towing",
    code: "car_towing",
    name: "Car Towing",
    description: "Tow vehicle from pickup point to workshop or destination.",
    pricing: {
      currency: "PKR",
      visitFee: 600,
      towingBaseFee: 2200,
      perKmRate: 180,
    },
    config: {
      problemTypes: ["accident", "flat_tyre", "battery_dead", "engine_not_starting", "other"],
    },
  },
  {
    id: "mechanic",
    code: "mechanic",
    name: "Mechanic Service",
    description: "On-demand roadside mechanic with visit fee and extra work approval.",
    pricing: {
      currency: "PKR",
      defaultVisitFee: 800,
    },
    config: {
      categories: [
        { code: "general_repair", name: "General Repair", visitFee: 800 },
        { code: "battery_jump_start", name: "Battery Jump Start", visitFee: 700 },
        { code: "ac_repair", name: "AC Repair", visitFee: 1000 },
        { code: "lockout", name: "Lockout", visitFee: 650 },
        { code: "brake_check", name: "Brake Check", visitFee: 850 },
      ],
    },
  },
];

function createInitialRegister() {
  return {
    role: "user",
    name: "",
    phone: "",
    password: "",
    workshopPicture: "",
    mechanicCertificateImage: "",
    cnicFrontImage: "",
    cnicBackImage: "",
    selfieImage: "",
    cnic: "",
    city: "Lahore",
    serviceCodes: ["fuel_delivery"],
    latitude: LAHORE_COORDS.latitude,
    longitude: LAHORE_COORDS.longitude,
  };
}

function createInitialOrderForm() {
  return {
    serviceCode: "fuel_delivery",
    pickupLatitude: LAHORE_COORDS.latitude,
    pickupLongitude: LAHORE_COORDS.longitude,
    pickupAddress: "",
    destinationLatitude: LAHORE_COORDS.latitude,
    destinationLongitude: LAHORE_COORDS.longitude,
    destinationAddress: "",
    destinationQuery: "",
    vehicleMake: "",
    vehicleModel: "",
    licensePlate: "",
    vehicleType: "car",
    fuelType: "petrol",
    fuelQuantityLiters: "2",
    towingProblemType: "battery_dead",
    mechanicCategory: "general_repair",
    notes: "",
  };
}

function createEmptyExtraWorkItem() {
  return {
    title: "",
    description: "",
    partsCost: "",
    laborCost: "",
    quantity: "1",
  };
}

function profileFormFromUser(user) {
  return {
    name: user?.name || "",
    profilePicture: user?.profilePicture || "",
    city: user?.providerProfile?.city || "Lahore",
    workshopPicture: user?.providerProfile?.workshopPicture || "",
    mechanicCertificateImage: user?.providerProfile?.mechanicCertificateImage || "",
    cnicFrontImage: user?.providerProfile?.cnicFrontImage || "",
    cnicBackImage: user?.providerProfile?.cnicBackImage || "",
    selfieImage: user?.providerProfile?.selfieImage || "",
    cnic: user?.providerProfile?.cnic || "",
    serviceCodes: user?.providerProfile?.serviceCodes || ["fuel_delivery"],
  };
}

function formatMoney(amount) {
  return `PKR ${Number(amount || 0).toFixed(0)}`;
}

function normalizeCnic(value) {
  return String(value || "").replace(/\D/g, "");
}

function titleFromCode(code) {
  return String(code || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function haversineDistance(fromLat, fromLng, toLat, toLng) {
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return 0;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

function hasFiniteCoordinates(location) {
  return Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
}

function formatLocationState(location) {
  return {
    latitude: String(location.latitude),
    longitude: String(location.longitude),
  };
}

function buildEstimate(service, form, activeOrder) {
  if (!service) {
    return null;
  }

  if (activeOrder) {
    return activeOrder.pricing;
  }

  if (service.code === "fuel_delivery") {
    const fuelPricePerLiter = Number(service.pricing?.fuelPrices?.[form.fuelType] || 0);
    const quantity = Number(form.fuelQuantityLiters || 0);
    const quantitySubtotal = fuelPricePerLiter * quantity;
    const deliveryFee = Number(service.pricing?.flatDeliveryFee || 0);

    return {
      total: quantitySubtotal + deliveryFee,
      quantitySubtotal,
      deliveryFee,
      fuelPricePerLiter,
      visitFee: 0,
      towingBaseFee: 0,
      routeDistanceKm: 0,
      distanceCharge: 0,
      extraWorkTotal: 0,
    };
  }

  if (service.code === "car_towing") {
    const routeDistanceKm = haversineDistance(
      Number(form.pickupLatitude || 0),
      Number(form.pickupLongitude || 0),
      Number(form.destinationLatitude || 0),
      Number(form.destinationLongitude || 0)
    );
    const visitFee = Number(service.pricing?.visitFee || 0);
    const towingBaseFee = Number(service.pricing?.towingBaseFee || 0);
    const distanceCharge = routeDistanceKm * Number(service.pricing?.perKmRate || 0);

    return {
      total: visitFee + towingBaseFee + distanceCharge,
      quantitySubtotal: 0,
      deliveryFee: 0,
      fuelPricePerLiter: 0,
      visitFee,
      towingBaseFee,
      routeDistanceKm,
      distanceCharge,
      extraWorkTotal: 0,
    };
  }

  const category = (service.config?.categories || []).find(
    (entry) => entry.code === form.mechanicCategory
  );
  const visitFee = Number(category?.visitFee || service.pricing?.defaultVisitFee || 0);

  return {
    total: visitFee,
    quantitySubtotal: 0,
    deliveryFee: 0,
    fuelPricePerLiter: 0,
    visitFee,
    towingBaseFee: 0,
    routeDistanceKm: 0,
    distanceCharge: 0,
    extraWorkTotal: 0,
  };
}

function normalizeOrderFormForService(form, service) {
  if (!service) {
    return form;
  }

  const next = { ...form, serviceCode: service.code };

  if (service.code === "fuel_delivery") {
    const vehicleTypes = service.config?.vehicleTypes || ["bike", "car"];
    const fuelTypes = service.config?.fuelTypes || ["petrol", "diesel"];
    const quantities = service.config?.quantities || [1, 2, 5, 10];

    next.vehicleType = vehicleTypes.includes(next.vehicleType) ? next.vehicleType : vehicleTypes[0];
    next.fuelType = fuelTypes.includes(next.fuelType) ? next.fuelType : fuelTypes[0];
    next.fuelQuantityLiters = quantities.map(String).includes(String(next.fuelQuantityLiters))
      ? String(next.fuelQuantityLiters)
      : String(quantities[0]);
  }

  if (service.code === "car_towing") {
    const problemTypes = service.config?.problemTypes || TOWING_PROBLEM_OPTIONS.map((item) => item.code);
    next.towingProblemType = problemTypes.includes(next.towingProblemType)
      ? next.towingProblemType
      : problemTypes[0];
  }

  if (service.code === "mechanic") {
    const categories = service.config?.categories || [];
    const categoryCodes = categories.map((category) => category.code);
    next.mechanicCategory = categoryCodes.includes(next.mechanicCategory)
      ? next.mechanicCategory
      : categoryCodes[0] || "";
  }

  return next;
}

function getServiceVisual(serviceCode) {
  if (serviceCode === "fuel_delivery") {
    return {
      title: "Fuel delivery with one clear confirmation loop.",
      subtitle: "Pick quantity, track the provider live, confirm delivered fuel, then close COD cleanly.",
      accent: "#6D28D9",
      bg: "#F7F2FF",
      border: "#E6D6FF",
    };
  }

  if (serviceCode === "car_towing") {
    return {
      title: "Towing with route clarity from pickup to workshop.",
      subtitle: "Pickup, destination, transit, SOS, and COD stay readable in one single order view.",
      accent: "#7C3AED",
      bg: "#F6F1FF",
      border: "#E9DDFF",
    };
  }

  return {
    title: "Mechanic service built around the approval loop.",
    subtitle: "Visit fee first, extra work item by item, then COD confirmation after completion.",
    accent: "#8B5CF6",
    bg: "#F8F4FF",
    border: "#EBDDFF",
  };
}

function getStatusTone(status) {
  if (["completed"].includes(status)) {
    return { bg: "#EAF8EF", text: "#217A4B", border: "#B8E6C8" };
  }

  if (["awaiting_fuel_confirmation", "awaiting_extra_work_approval"].includes(status)) {
    return { bg: "#FFF6E6", text: "#9A5B00", border: "#F4D9A4" };
  }

  if (["cancelled"].includes(status)) {
    return { bg: "#FDECEC", text: "#B64141", border: "#F7CACA" };
  }

  return { bg: "#F2EEFF", text: "#5B3DB4", border: "#DCCFFF" };
}

function getCashConfirmationCopy(order, providerMode = false) {
  const customerConfirmed = Boolean(order?.payment?.customerConfirmed);
  const providerConfirmed = Boolean(order?.payment?.providerConfirmed);

  if (customerConfirmed && providerConfirmed) {
    return {
      title: "Cash confirmation complete.",
      body: "Both sides have confirmed the COD handoff.",
    };
  }

  if (providerMode) {
    if (providerConfirmed && !customerConfirmed) {
      return {
        title: "Waiting for customer confirmation.",
        body: "You marked cash as received. The order will close once the customer confirms payment.",
      };
    }

    if (!providerConfirmed && customerConfirmed) {
      return {
        title: "Customer has already confirmed cash.",
        body: "Confirm receipt to close the COD loop and remove the order from active state.",
      };
    }

    return {
      title: "Cash is still pending.",
      body: "Complete the service first, then confirm once cash is in hand.",
    };
  }

  if (customerConfirmed && !providerConfirmed) {
    return {
      title: "Waiting for provider confirmation.",
      body: "You marked cash as paid. The order will close once the provider confirms receipt.",
    };
  }

  if (!customerConfirmed && providerConfirmed) {
    return {
      title: "Provider has already confirmed receipt.",
      body: "Confirm payment to close the COD loop from your side.",
    };
  }

  return {
    title: "Cash is still pending.",
    body: "Confirm only after cash has changed hands.",
  };
}

function buildTimeline(order) {
  if (!order) {
    return [];
  }

  if (order.serviceCode === "fuel_delivery") {
    return [
      { key: "open", label: "Request placed" },
      { key: "assigned", label: "Provider assigned" },
      { key: "in_progress", label: "Fuel on the way" },
      { key: "awaiting_fuel_confirmation", label: "Awaiting quantity check" },
      { key: "completed", label: "Service completed" },
      { key: "payment", label: "Cash confirmed" },
    ];
  }

  if (order.serviceCode === "car_towing") {
    return [
      { key: "open", label: "Tow request placed" },
      { key: "assigned", label: "Tow provider assigned" },
      { key: "arrived", label: "Tow truck arrived" },
      { key: "tow_in_transit", label: "Transit to workshop" },
      { key: "completed", label: "Drop-off completed" },
      { key: "payment", label: "Cash confirmed" },
    ];
  }

  return [
    { key: "open", label: "Mechanic request placed" },
    { key: "assigned", label: "Mechanic assigned" },
    { key: "inspection_pending", label: "Inspection phase" },
    { key: "awaiting_extra_work_approval", label: "Approval loop" },
    { key: "in_progress", label: "Work in progress" },
    { key: "completed", label: "Service completed" },
    { key: "payment", label: "Cash confirmed" },
  ];
}

function isTimelineStepComplete(order, key) {
  if (!order) {
    return false;
  }

  if (key === "payment") {
    return order.payment?.status === "confirmed";
  }

  if (key === "completed") {
    return order.status === "completed" || order.payment?.status === "confirmed";
  }

  if (key === "awaiting_fuel_confirmation") {
    return [
      "awaiting_fuel_confirmation",
      "completed",
    ].includes(order.status);
  }

  if (key === "awaiting_extra_work_approval") {
    return [
      "awaiting_extra_work_approval",
      "in_progress",
      "completed",
    ].includes(order.status);
  }

  const orderMap = [
    "open",
    "assigned",
    "arrived",
    "inspection_pending",
    "in_progress",
    "tow_in_transit",
    "completed",
  ];

  return orderMap.indexOf(order.status) >= orderMap.indexOf(key);
}

function Reveal({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          delay: 0,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          delay: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [mode, setMode] = useState("register");
  const [registerForm, setRegisterForm] = useState(createInitialRegister);
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [profileForm, setProfileForm] = useState(profileFormFromUser(null));
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesUsingFallback, setServicesUsingFallback] = useState(true);
  const [session, setSession] = useState({ token: "", user: null });
  const [screenTab, setScreenTab] = useState("home");
  const [bookingStep, setBookingStep] = useState("service");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [orderForm, setOrderForm] = useState(createInitialOrderForm);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [providerOrders, setProviderOrders] = useState([]);
  const [providerAvailable, setProviderAvailable] = useState(true);
  const [providerLocation, setProviderLocation] = useState(LAHORE_COORDS);
  const [deviceLocation, setDeviceLocation] = useState({
    latitude: Number(LAHORE_COORDS.latitude),
    longitude: Number(LAHORE_COORDS.longitude),
    address: "Locating your device...",
  });
  const [locationLoading, setLocationLoading] = useState(false);
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState("");
  const [authLoading, setAuthLoading] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [userExtraWorkDecisions, setUserExtraWorkDecisions] = useState({});
  const [providerExtraWorkDraft, setProviderExtraWorkDraft] = useState({
    providerNote: "",
    items: [createEmptyExtraWorkItem()],
  });

  const selectedService =
    services.find((service) => service.code === orderForm.serviceCode) || services[0] || null;
  const pricingEstimate = buildEstimate(selectedService, orderForm, activeOrder);
  const tabs = session.user?.role === "provider" ? PROVIDER_TAB_ITEMS : CUSTOMER_TAB_ITEMS;
  const serviceVisual = getServiceVisual(orderForm.serviceCode);
  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") {
      return orderHistory;
    }

    if (historyFilter === "active") {
      return orderHistory.filter((order) => order.status !== "completed" && order.status !== "cancelled");
    }

    return orderHistory.filter((order) => order.status === "completed");
  }, [historyFilter, orderHistory]);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function getErrorMessage(error, fallback) {
    const responseMessage = error?.response?.data?.message;
    const verification = error?.response?.data?.verification;

    if (responseMessage) {
      if (verification?.faceSimilarity != null) {
        return `${responseMessage} (face match: ${Number(verification.faceSimilarity).toFixed(2)})`;
      }

      if (verification?.extractedCnic) {
        return `${responseMessage} (read CNIC: ${verification.extractedCnic})`;
      }

      return responseMessage;
    }

    if (error?.code === "ECONNABORTED") {
      return "Registration verification took too long. Please try again with clearer CNIC and selfie images.";
    }

    if (error?.message) {
      return error.message;
    }

    return fallback;
  }

  function updateSessionUser(nextUser) {
    setSession((current) => ({ ...current, user: nextUser }));
    setProfileForm(profileFormFromUser(nextUser));
    if (nextUser?.role === "provider") {
      setProviderAvailable(nextUser.providerProfile?.isAvailable ?? true);
    }
  }

  function resetProviderExtraWorkDraft() {
    setProviderExtraWorkDraft({
      providerNote: "",
      items: [createEmptyExtraWorkItem()],
    });
  }

  function resetSession() {
    setSession({ token: "", user: null });
    setScreenTab("home");
    setBookingStep("service");
    setHistoryFilter("all");
    setActiveOrder(null);
    setOrderHistory([]);
    setProviderOrders([]);
    setUserExtraWorkDecisions({});
    resetProviderExtraWorkDraft();
    setMessage("");
  }

  function updateOrderField(field, value) {
    setOrderForm((current) => ({ ...current, [field]: value }));
  }

  function selectOrderService(service) {
    setOrderForm((current) => normalizeOrderFormForService(current, service));
    setBookingStep("service");
  }

  function toggleProviderServiceInRegister(serviceCode) {
    setRegisterForm((current) => {
      const exists = current.serviceCodes.includes(serviceCode);

      return {
        ...current,
        serviceCodes: exists
          ? current.serviceCodes.filter((code) => code !== serviceCode)
          : [...current.serviceCodes, serviceCode],
      };
    });
  }

  function toggleProfileProviderService(serviceCode) {
    setProfileForm((current) => {
      const exists = current.serviceCodes.includes(serviceCode);

      return {
        ...current,
        serviceCodes: exists
          ? current.serviceCodes.filter((code) => code !== serviceCode)
          : [...current.serviceCodes, serviceCode],
      };
    });
  }

  async function syncCurrentLocation({ silent = false, includeProviderRefresh = false } = {}) {
    setLocationLoading(true);

    try {
      const location = await getCurrentDeviceLocation();
      setDeviceLocation(location);
      setRegisterForm((current) => ({
        ...current,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      }));
      setOrderForm((current) => ({
        ...current,
        pickupLatitude: String(location.latitude),
        pickupLongitude: String(location.longitude),
        pickupAddress: location.address || current.pickupAddress,
      }));
      setProviderLocation(formatLocationState(location));

      if (includeProviderRefresh && session.user?.role === "provider") {
        await refreshProviderOrders(true, {
          latitude: location.latitude,
          longitude: location.longitude,
          isAvailable: providerAvailable,
        });
      }

      if (!silent) {
        showMessage("Current location updated", "success");
      }
    } catch (error) {
      if (!silent) {
        showMessage(error.message || "Unable to fetch current location", "error");
      }
    } finally {
      setLocationLoading(false);
    }
  }

  async function loadServices() {
    setServicesLoading(true);

    try {
      const response = await api.get("/services");
      const nextServices = Array.isArray(response.data) && response.data.length > 0 ? response.data : DEFAULT_SERVICES;
      setServices(nextServices);
      setServicesUsingFallback(nextServices === DEFAULT_SERVICES);
      setOrderForm((current) => {
        const service = nextServices.find((entry) => entry.code === current.serviceCode) || nextServices[0];
        return normalizeOrderFormForService(current, service);
      });
    } catch (_error) {
      setServices(DEFAULT_SERVICES);
      setServicesUsingFallback(true);
    } finally {
      setServicesLoading(false);
    }
  }

  async function refreshProfile(silent = false) {
    if (!session.token) {
      return;
    }

    try {
      const response = await api.get("/auth/me");
      updateSessionUser(response.data.user);
    } catch (error) {
      if (!silent) {
        showMessage(error.response?.data?.message || "Unable to refresh profile", "error");
      }
    }
  }

  async function loadActiveOrder(silent = false) {
    if (!session.token) {
      return;
    }

    try {
      const response = await api.get("/orders/mine/active");
      setActiveOrder(response.data.order);
    } catch (error) {
      if (!silent) {
        showMessage(error.response?.data?.message || "Unable to load active order", "error");
      }
    }
  }

  async function loadOrderHistory(silent = false) {
    if (!session.token) {
      return;
    }

    try {
      const response = await api.get("/orders/history");
      setOrderHistory(response.data);
    } catch (error) {
      if (!silent) {
        showMessage(error.response?.data?.message || "Unable to load order history", "error");
      }
    }
  }

  async function refreshProviderOrders(silent = false, options = {}) {
    if (session.user?.role !== "provider") {
      return;
    }

    const latitude = Number(
      options.latitude ??
        (hasFiniteCoordinates(deviceLocation) ? deviceLocation.latitude : providerLocation.latitude)
    );
    const longitude = Number(
      options.longitude ??
        (hasFiniteCoordinates(deviceLocation) ? deviceLocation.longitude : providerLocation.longitude)
    );
    const isAvailable = options.isAvailable ?? providerAvailable;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (!silent) {
        showMessage("Current provider location is not ready yet", "error");
      }
      return;
    }

    try {
      setProviderLocation(formatLocationState({ latitude, longitude }));
      await api.patch("/orders/provider/location", {
        latitude,
        longitude,
        isAvailable,
      });

      const response = await api.get("/orders/open", {
        params: {
          latitude,
          longitude,
          radiusKm: PROVIDER_QUEUE_RADIUS_KM,
        },
      });
      setProviderOrders(response.data);
    } catch (error) {
      if (!silent) {
        showMessage(error.response?.data?.message || "Unable to load nearby jobs", "error");
      }
    }
  }

  useEffect(() => {
    setToken(session.token);
  }, [session.token]);

  useEffect(() => {
    loadServices();
    syncCurrentLocation({ silent: true });
  }, []);

  useEffect(() => {
    if (!session.user) {
      return;
    }

    setProfileForm(profileFormFromUser(session.user));
    loadActiveOrder(true);
    loadOrderHistory(true);

    if (session.user.role === "provider") {
      const initialProviderLocation = hasFiniteCoordinates(deviceLocation)
        ? deviceLocation
        : {
            latitude:
              session.user.providerProfile?.currentLatitude ?? Number(LAHORE_COORDS.latitude),
            longitude:
              session.user.providerProfile?.currentLongitude ?? Number(LAHORE_COORDS.longitude),
          };
      const initialAvailability = session.user.providerProfile?.isAvailable ?? true;

      setProviderLocation(formatLocationState(initialProviderLocation));
      setProviderAvailable(initialAvailability);
      refreshProviderOrders(true, {
        latitude: initialProviderLocation.latitude,
        longitude: initialProviderLocation.longitude,
        isAvailable: initialAvailability,
      });
    }
  }, [session.user, session.token]);

  useEffect(() => {
    if (!session.user) {
      return undefined;
    }

    const timer = setInterval(() => {
      loadActiveOrder(true);

      if (session.user.role === "provider" && !activeOrder) {
        refreshProviderOrders(true);
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [session.user, session.token, activeOrder, providerLocation.latitude, providerLocation.longitude, providerAvailable]);

  useEffect(() => {
    const request = activeOrder?.activeExtraWorkRequest;

    if (!request) {
      setUserExtraWorkDecisions({});
      return;
    }

    setUserExtraWorkDecisions((current) => {
      if (current.__requestId === request.id) {
        return current;
      }

      return { __requestId: request.id };
    });
  }, [activeOrder?.activeExtraWorkRequest?.id]);

  async function pickImage(field, setter) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showMessage("Media library permission is required", "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setter((current) => ({ ...current, [field]: result.assets[0].uri }));
      showMessage("Image selected", "success");
    } catch (error) {
      showMessage(error.message || "Unable to select image", "error");
    }
  }

  async function pickAndUploadImage(field, setter) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showMessage("Media library permission is required", "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setUploadingField(field);
      const fileUrl = await uploadImageFromUri(result.assets[0].uri);
      setter((current) => ({ ...current, [field]: fileUrl }));
      showMessage("Image uploaded", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || error.message || "Image upload failed", "error");
    } finally {
      setUploadingField("");
    }
  }

  async function captureSelfie(field, setter) {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showMessage("Camera permission is required", "error");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setter((current) => ({ ...current, [field]: result.assets[0].uri }));
      showMessage("Live selfie captured", "success");
    } catch (error) {
      showMessage(error.message || "Unable to capture selfie", "error");
    }
  }

  async function register() {
    if (registerForm.role === "provider") {
      if (!registerForm.cnic.trim()) {
        showMessage("CNIC number is required for providers", "error");
        return;
      }

      if (!/^\d{13}$/.test(normalizeCnic(registerForm.cnic))) {
        showMessage("CNIC number must contain exactly 13 digits", "error");
        return;
      }

      if (!registerForm.workshopPicture) {
        showMessage("Upload a workshop picture before registering", "error");
        return;
      }

      if (!registerForm.cnicFrontImage) {
        showMessage("Upload the CNIC front image before registering", "error");
        return;
      }

      if (!registerForm.cnicBackImage) {
        showMessage("Upload the CNIC back image before registering", "error");
        return;
      }

      if (!registerForm.selfieImage) {
        showMessage("Capture a live selfie before registering", "error");
        return;
      }

      if (
        registerForm.serviceCodes.includes("mechanic") &&
        !registerForm.mechanicCertificateImage
      ) {
        showMessage("Select the mechanic certificate before registering", "error");
        return;
      }
    }

    setAuthLoading("register");

    try {
      const payload = { ...registerForm };

      if (registerForm.role === "provider") {
        payload.workshopPicture = await uploadImageFromUri(registerForm.workshopPicture);
        if (registerForm.serviceCodes.includes("mechanic")) {
          payload.mechanicCertificateImage = await uploadImageFromUri(
            registerForm.mechanicCertificateImage
          );
        }
        payload.cnicFrontImage = await uploadImageFromUri(registerForm.cnicFrontImage);
        payload.cnicBackImage = await uploadImageFromUri(registerForm.cnicBackImage);
        payload.selfieImage = await uploadImageFromUri(registerForm.selfieImage);
      }

      await api.post("/auth/register", payload, { timeout: 60000 });
      setMode("login");
      setRegisterForm(createInitialRegister());
      showMessage("Registration complete. Please log in.", "success");
    } catch (error) {
      showMessage(getErrorMessage(error, "Registration failed"), "error");
    } finally {
      setAuthLoading("");
    }
  }

  async function login() {
    setAuthLoading("login");

    try {
      const response = await api.post("/auth/login", loginForm);
      setSession(response.data);
      setScreenTab("home");
      setLoginForm({ phone: "", password: "" });
      setMessage("");
    } catch (error) {
      showMessage(error.response?.data?.message || "Login failed", "error");
    } finally {
      setAuthLoading("");
    }
  }

  async function createOrder() {
    if (!selectedService) {
      showMessage("Services are still loading", "error");
      return;
    }

    if (!orderForm.pickupLatitude || !orderForm.pickupLongitude) {
      showMessage("Current location is required to create an order", "error");
      return;
    }

    if (orderForm.serviceCode === "car_towing" && !orderForm.destinationAddress.trim()) {
      showMessage("Towing requires a destination workshop before review and request creation", "error");
      return;
    }

    setBusyAction("create-order");

    try {
      const payload = {
        serviceCode: orderForm.serviceCode,
        pickupLatitude: orderForm.pickupLatitude,
        pickupLongitude: orderForm.pickupLongitude,
        pickupAddress: orderForm.pickupAddress,
        vehicleMake: orderForm.vehicleMake,
        vehicleModel: orderForm.vehicleModel,
        licensePlate: orderForm.licensePlate,
        notes: orderForm.notes,
      };

      if (orderForm.serviceCode === "fuel_delivery") {
        payload.vehicleType = orderForm.vehicleType;
        payload.fuelType = orderForm.fuelType;
        payload.fuelQuantityLiters = Number(orderForm.fuelQuantityLiters);
      }

      if (orderForm.serviceCode === "car_towing") {
        payload.destinationLatitude = orderForm.destinationLatitude;
        payload.destinationLongitude = orderForm.destinationLongitude;
        payload.destinationAddress = orderForm.destinationAddress;
        payload.towingProblemType = orderForm.towingProblemType;
      }

      if (orderForm.serviceCode === "mechanic") {
        payload.mechanicCategory = orderForm.mechanicCategory;
      }

      const response = await api.post("/orders", payload);
      setActiveOrder(response.data.order);
      setBookingStep("service");
      await loadOrderHistory(true);
      showMessage(
        `Request created. ${response.data.nearbyProvidersCount} provider(s) are currently in range.`,
        "success"
      );
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to create order", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function searchDestination() {
    if (!orderForm.destinationQuery.trim()) {
      showMessage("Enter a destination address first", "error");
      return;
    }

    setDestinationLoading(true);

    try {
      const results = await searchAddress(orderForm.destinationQuery, deviceLocation);
      setDestinationResults(results);

      if (results.length === 0) {
        showMessage("No destination found. Try a more specific workshop or address.", "error");
      }
    } catch (error) {
      showMessage(error.message || "Unable to search destination", "error");
    } finally {
      setDestinationLoading(false);
    }
  }

  function chooseDestination(result) {
    setOrderForm((current) => ({
      ...current,
      destinationLatitude: String(result.latitude),
      destinationLongitude: String(result.longitude),
      destinationAddress: result.label,
      destinationQuery: result.label,
    }));
    setDestinationResults([]);
    showMessage("Destination selected", "success");
  }

  async function saveProfile() {
    if (session.user?.role === "provider") {
      if (!profileForm.cnic.trim()) {
        showMessage("CNIC number is required for providers", "error");
        return;
      }

      if (!profileForm.workshopPicture || !profileForm.cnicFrontImage || !profileForm.cnicBackImage) {
        showMessage("Provider profile must include workshop, CNIC front, and CNIC back images", "error");
        return;
      }
    }

    setBusyAction("save-profile");

    try {
      const payload = {
        name: profileForm.name,
        profilePicture: profileForm.profilePicture,
      };

      if (session.user?.role === "provider") {
        payload.city = profileForm.city;
        payload.workshopPicture = profileForm.workshopPicture;
        payload.cnicFrontImage = profileForm.cnicFrontImage;
        payload.cnicBackImage = profileForm.cnicBackImage;
        payload.cnic = profileForm.cnic;
        payload.serviceCodes = profileForm.serviceCodes;
      }

      const response = await api.patch("/auth/me", payload);
      setSession(response.data);
      showMessage("Profile updated", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to update profile", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function acceptOrder(orderId) {
    setBusyAction(`accept-${orderId}`);

    try {
      const response = await api.post(`/orders/${orderId}/accept`);
      setActiveOrder(response.data.order);
      setProviderOrders([]);
      await loadOrderHistory(true);
      showMessage("Job accepted", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to accept job", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function markArrived() {
    setBusyAction("mark-arrived");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/arrive`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Arrival marked", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to mark arrival", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function startOrder() {
    setBusyAction("start-order");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/start`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Order progress updated", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to update order progress", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function markFuelDelivered() {
    setBusyAction("fuel-delivered");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/fuel-delivered`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Waiting for customer quantity confirmation", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to mark fuel delivered", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function confirmFuelDelivered() {
    setBusyAction("fuel-confirm");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/fuel-confirm`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Fuel delivery confirmed. COD confirmation is now open.", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to confirm fuel delivery", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function completeOrder() {
    setBusyAction("complete-order");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/complete`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Service completed. Awaiting cash confirmation.", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to complete order", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function confirmCustomerPayment() {
    setBusyAction("customer-payment");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/payment/customer-confirm`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Customer cash confirmation saved", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to confirm payment", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function confirmProviderPayment() {
    setBusyAction("provider-payment");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/payment/provider-confirm`);
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Provider cash confirmation saved", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to confirm payment", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function raiseSos() {
    setBusyAction("sos");

    try {
      const response = await api.post(`/orders/${activeOrder.id}/sos`, {
        message: "Customer raised SOS during towing transit",
      });
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("SOS alert recorded on the order", "error");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to raise SOS alert", "error");
    } finally {
      setBusyAction("");
    }
  }

  function updateExtraWorkItem(index, field, value) {
    setProviderExtraWorkDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addExtraWorkItem() {
    setProviderExtraWorkDraft((current) => ({
      ...current,
      items: [...current.items, createEmptyExtraWorkItem()],
    }));
  }

  async function submitExtraWorkRequest() {
    setBusyAction("extra-work");

    try {
      await api.post(`/orders/${activeOrder.id}/extra-work`, {
        providerNote: providerExtraWorkDraft.providerNote,
        items: providerExtraWorkDraft.items.map((item) => ({
          title: item.title,
          description: item.description,
          partsCost: Number(item.partsCost || 0),
          laborCost: Number(item.laborCost || 0),
          quantity: Number(item.quantity || 1),
        })),
      });
      await loadActiveOrder(true);
      await loadOrderHistory(true);
      resetProviderExtraWorkDraft();
      showMessage("Extra work request sent to customer", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to submit extra work request", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function submitExtraWorkDecisions() {
    const request = activeOrder?.activeExtraWorkRequest;

    if (!request) {
      return;
    }

    const items = request.items.map((item) => ({
      itemId: item.id,
      decision: userExtraWorkDecisions[item.id],
    }));

    if (items.some((item) => item.decision !== "approved" && item.decision !== "rejected")) {
      showMessage("Approve or reject every extra work item before submitting.", "error");
      return;
    }

    setBusyAction("extra-work-decision");

    try {
      const response = await api.post(
        `/orders/${activeOrder.id}/extra-work/${request.id}/respond`,
        { items }
      );
      setActiveOrder(response.data.order);
      await loadOrderHistory(true);
      showMessage("Extra work decision submitted", "success");
    } catch (error) {
      showMessage(error.response?.data?.message || "Unable to submit extra work decision", "error");
    } finally {
      setBusyAction("");
    }
  }

  function renderAuthScreen() {
    return (
      <AppCanvas>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Reveal delay={0}>
            <Text style={styles.appMark}>ROADRESCUE</Text>
            <Text style={styles.authTitle}>Emergency help, cleaned up into one calm mobile flow.</Text>
            <Text style={styles.authSubtitle}>
              Automatic location, cash on delivery, and role-aware screens for customers and providers.
            </Text>
          </Reveal>

          <Reveal delay={80} style={styles.switchWrap}>
            <SegmentedControl
              items={[
                { key: "register", label: "Register" },
                { key: "login", label: "Login" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <SegmentedControl
              items={[
                { key: "user", label: "Customer" },
                { key: "provider", label: "Provider" },
              ]}
              value={registerForm.role}
              onChange={(value) => setRegisterForm((current) => ({ ...current, role: value }))}
            />
          </Reveal>

          {mode === "register" ? (
            <Reveal delay={160} style={styles.formPanel}>
              <SectionEyebrow label="Identity" />
              <Field label="Full name" value={registerForm.name} onChangeText={(value) => setRegisterForm((current) => ({ ...current, name: value }))} />
              <Field label="Phone" value={registerForm.phone} onChangeText={(value) => setRegisterForm((current) => ({ ...current, phone: value }))} />
              <Field
                label="Password"
                secureTextEntry
                value={registerForm.password}
                onChangeText={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
              />

              <LocationCard
                title="Detected location"
                subtitle={deviceLocation.address || "Location still resolving"}
                loading={locationLoading}
                onPress={() => syncCurrentLocation({ silent: false })}
              />

              {registerForm.role === "provider" ? (
                <>
                  <SectionEyebrow label="Provider setup" />
                  <Field
                    label="CNIC number"
                    value={registerForm.cnic}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, cnic: value }))}
                  />
                  <PrimaryButton
                    label="Select workshop image"
                    onPress={() => pickImage("workshopPicture", setRegisterForm)}
                    tone="secondary"
                    disabled={authLoading !== ""}
                  />
                  {registerForm.workshopPicture ? (
                    <Image source={{ uri: registerForm.workshopPicture }} style={styles.previewImage} />
                  ) : null}
                  {registerForm.serviceCodes.includes("mechanic") ? (
                    <>
                      <PrimaryButton
                        label="Select mechanic certificate"
                        onPress={() => pickImage("mechanicCertificateImage", setRegisterForm)}
                        tone="secondary"
                        disabled={authLoading !== ""}
                      />
                      {registerForm.mechanicCertificateImage ? (
                        <Image
                          source={{ uri: registerForm.mechanicCertificateImage }}
                          style={styles.previewImage}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <PrimaryButton
                    label="Select CNIC front"
                    onPress={() => pickImage("cnicFrontImage", setRegisterForm)}
                    tone="secondary"
                    disabled={authLoading !== ""}
                  />
                  {registerForm.cnicFrontImage ? (
                    <Image source={{ uri: registerForm.cnicFrontImage }} style={styles.previewImage} />
                  ) : null}
                  <PrimaryButton
                    label="Select CNIC back"
                    onPress={() => pickImage("cnicBackImage", setRegisterForm)}
                    tone="secondary"
                    disabled={authLoading !== ""}
                  />
                  {registerForm.cnicBackImage ? (
                    <Image source={{ uri: registerForm.cnicBackImage }} style={styles.previewImage} />
                  ) : null}
                  <PrimaryButton
                    label="Capture live selfie"
                    onPress={() => captureSelfie("selfieImage", setRegisterForm)}
                    tone="secondary"
                    disabled={authLoading !== ""}
                  />
                  {registerForm.selfieImage ? (
                    <Image source={{ uri: registerForm.selfieImage }} style={styles.previewImage} />
                  ) : null}
                  <Text style={styles.inlineHint}>
                    Selfie must be captured from the camera. Provider registration is blocked until local CNIC OCR and selfie face match both pass.
                  </Text>
                  <ChoiceGrid
                    title="Services you handle"
                    items={PROVIDER_SERVICE_OPTIONS.map((item) => ({
                      key: item.code,
                      label: item.label,
                      active: registerForm.serviceCodes.includes(item.code),
                      onPress: () => toggleProviderServiceInRegister(item.code),
                      short: item.short,
                    }))}
                  />
                </>
              ) : null}

              <PrimaryButton
                label={authLoading === "register" ? "Uploading and verifying identity..." : "Create account"}
                onPress={register}
                loading={authLoading === "register"}
                disabled={authLoading !== ""}
              />
            </Reveal>
          ) : (
            <Reveal delay={160} style={styles.formPanel}>
              <SectionEyebrow label="Sign in" />
              <Field label="Phone" value={loginForm.phone} onChangeText={(value) => setLoginForm((current) => ({ ...current, phone: value }))} />
              <Field label="Password" secureTextEntry value={loginForm.password} onChangeText={(value) => setLoginForm((current) => ({ ...current, password: value }))} />
              <PrimaryButton
                label={authLoading === "login" ? "Signing in..." : "Continue"}
                onPress={login}
                loading={authLoading === "login"}
                disabled={authLoading !== ""}
              />
            </Reveal>
          )}

          {!!message ? <FeedbackMessage message={message} type={messageType} /> : null}
        </ScrollView>
      </AppCanvas>
    );
  }

  function renderCustomerHome() {
    const activeExtraWorkRequest = activeOrder?.activeExtraWorkRequest;

    if (!activeOrder) {
      return (
        <>
          <Reveal delay={0}>
            <HeroPanel
              title={serviceVisual.title}
              subtitle={serviceVisual.subtitle}
              accent={serviceVisual.accent}
              bg={serviceVisual.bg}
              border={serviceVisual.border}
            />
          </Reveal>

          <Reveal delay={80} style={styles.panel}>
            <SegmentedControl
              items={CUSTOMER_BOOKING_STEPS}
              value={bookingStep}
              onChange={setBookingStep}
            />
          </Reveal>

          {bookingStep === "service" ? (
            <Reveal delay={120} style={styles.panel}>
              <SectionEyebrow label="Service" />
              <Text style={styles.sectionTitle}>Choose what you need right now.</Text>
              <Text style={styles.sectionHint}>Three services only. Fewer choices, faster dispatch.</Text>
              {servicesUsingFallback ? (
                <View style={styles.serviceSyncCard}>
                  <Text style={styles.inlineHint}>
                    Showing the built-in service catalog while the app reconnects to the backend.
                  </Text>
                  <PrimaryButton
                    label={servicesLoading ? "Checking..." : "Retry services"}
                    onPress={loadServices}
                    loading={servicesLoading}
                    tone="secondary"
                    compact
                    disabled={servicesLoading}
                  />
                </View>
              ) : null}
              <View style={styles.serviceGrid}>
                {services.map((service) => {
                  const visual = getServiceVisual(service.code);
                  const option = PROVIDER_SERVICE_OPTIONS.find((item) => item.code === service.code);

                  return (
                    <ServiceCard
                      key={service.code}
                      title={service.name}
                      short={option?.short || "SR"}
                      subtitle={service.description}
                      active={orderForm.serviceCode === service.code}
                      accent={visual.accent}
                      onPress={() => selectOrderService(service)}
                    />
                  );
                })}
              </View>
              <SectionEyebrow label="Pickup" />
              <Text style={styles.sectionTitle}>We use your live device location.</Text>
              <LocationCard
                title="Current pickup point"
                subtitle={deviceLocation.address || "Location still resolving"}
                loading={locationLoading}
                onPress={() => syncCurrentLocation({ silent: false })}
              />
              <Field
                label="Pickup address or landmark"
                value={orderForm.pickupAddress}
                onChangeText={(value) => updateOrderField("pickupAddress", value)}
              />
              <PrimaryButton
                label="Continue to details"
                onPress={() => setBookingStep("details")}
                tone="secondary"
              />
            </Reveal>
          ) : null}

          {bookingStep === "details" ? (
            <Reveal delay={120} style={styles.panel}>
              <SectionEyebrow label="Vehicle" />
              <Text style={styles.sectionTitle}>Basic details only.</Text>
              <Field label="Vehicle make" value={orderForm.vehicleMake} onChangeText={(value) => updateOrderField("vehicleMake", value)} />
              <Field label="Vehicle model" value={orderForm.vehicleModel} onChangeText={(value) => updateOrderField("vehicleModel", value)} />
              <Field label="License plate" value={orderForm.licensePlate} onChangeText={(value) => updateOrderField("licensePlate", value)} />

              {orderForm.serviceCode === "fuel_delivery" ? (
                <>
                  <SectionEyebrow label="Fuel request" />
                  <ChoiceGrid
                    title="Vehicle type"
                    items={(selectedService?.config?.vehicleTypes || ["bike", "car"]).map((item) => ({
                      key: item,
                      label: titleFromCode(item),
                      active: orderForm.vehicleType === item,
                      onPress: () => updateOrderField("vehicleType", item),
                      short: item === "bike" ? "BK" : "CR",
                    }))}
                  />
                  <ChoiceGrid
                    title="Fuel type"
                    items={(selectedService?.config?.fuelTypes || ["petrol", "diesel"]).map((item) => ({
                      key: item,
                      label: titleFromCode(item),
                      active: orderForm.fuelType === item,
                      onPress: () => updateOrderField("fuelType", item),
                      short: item === "petrol" ? "PT" : "DS",
                    }))}
                  />
                  <ChoiceGrid
                    title="Quantity"
                    items={(selectedService?.config?.quantities || [1, 2, 5, 10]).map((item) => ({
                      key: String(item),
                      label: `${item} Ltr`,
                      active: Number(orderForm.fuelQuantityLiters) === Number(item),
                      onPress: () => updateOrderField("fuelQuantityLiters", String(item)),
                      short: `${item}L`,
                    }))}
                  />
                </>
              ) : null}

              {orderForm.serviceCode === "car_towing" ? (
                <>
                  <SectionEyebrow label="Tow request" />
                  <ChoiceGrid
                    title="Problem type"
                    items={(selectedService?.config?.problemTypes || TOWING_PROBLEM_OPTIONS.map((item) => item.code)).map((item) => ({
                      key: item,
                      label: titleFromCode(item),
                      active: orderForm.towingProblemType === item,
                      onPress: () => updateOrderField("towingProblemType", item),
                      short: titleFromCode(item).slice(0, 2).toUpperCase(),
                    }))}
                  />
                  <Field
                    label="Workshop or destination search"
                    value={orderForm.destinationQuery}
                    onChangeText={(value) => updateOrderField("destinationQuery", value)}
                  />
                  <PrimaryButton
                    label={destinationLoading ? "Searching..." : "Find destination"}
                    onPress={searchDestination}
                    loading={destinationLoading}
                    tone="secondary"
                    disabled={busyAction !== ""}
                  />
                  {orderForm.destinationAddress ? (
                    <Text style={styles.inlineHint}>Selected destination: {orderForm.destinationAddress}</Text>
                  ) : null}
                  {destinationResults.map((result) => (
                    <Pressable
                      key={`${result.latitude}-${result.longitude}-${result.label}`}
                      style={({ pressed }) => [styles.searchCard, pressed && styles.searchCardPressed]}
                      onPress={() => chooseDestination(result)}
                    >
                      <Text style={styles.searchCardText}>{result.label}</Text>
                    </Pressable>
                  ))}
                  <Field
                    label="Destination address"
                    value={orderForm.destinationAddress}
                    onChangeText={(value) => updateOrderField("destinationAddress", value)}
                  />
                  <View style={styles.row}>
                    <View style={styles.rowField}>
                      <Field
                        label="Destination latitude"
                        value={orderForm.destinationLatitude}
                        onChangeText={(value) => updateOrderField("destinationLatitude", value)}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <Field
                        label="Destination longitude"
                        value={orderForm.destinationLongitude}
                        onChangeText={(value) => updateOrderField("destinationLongitude", value)}
                      />
                    </View>
                  </View>
                </>
              ) : null}

              {orderForm.serviceCode === "mechanic" ? (
                <>
                  <SectionEyebrow label="Mechanic request" />
                  <ChoiceGrid
                    title="Category"
                    items={(selectedService?.config?.categories || []).map((item) => ({
                      key: item.code,
                      label: `${item.name} • ${formatMoney(item.visitFee)}`,
                      active: orderForm.mechanicCategory === item.code,
                      onPress: () => updateOrderField("mechanicCategory", item.code),
                      short: item.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")
                        .toUpperCase(),
                    }))}
                  />
                  <Field
                    label="Mechanic service address"
                    value={orderForm.pickupAddress}
                    onChangeText={(value) => updateOrderField("pickupAddress", value)}
                  />
                  <Text style={styles.inlineHint}>
                    The mechanic uses this address with your current map pin. Refresh location if the pin is not correct.
                  </Text>
                </>
              ) : null}
              <View style={styles.row}>
                <PrimaryButton
                  label="Back"
                  onPress={() => setBookingStep("service")}
                  tone="secondary"
                />
                <PrimaryButton
                  label="Continue to review"
                  onPress={() => {
                    if (
                      orderForm.serviceCode === "car_towing" &&
                      !orderForm.destinationAddress.trim()
                    ) {
                      showMessage("Select a towing destination before continuing to review", "error");
                      return;
                    }

                    setBookingStep("review");
                  }}
                />
              </View>
            </Reveal>
          ) : null}

          {bookingStep === "review" ? (
            <Reveal delay={120} style={styles.panel}>
            <SectionEyebrow label="Estimate" />
            <Text style={styles.sectionTitle}>Straight pricing before dispatch.</Text>
            {pricingEstimate ? (
              <>
                {selectedService?.code === "fuel_delivery" ? (
                  <>
                    <MetricRow label="Fuel price / liter" value={formatMoney(pricingEstimate.fuelPricePerLiter)} />
                    <MetricRow label="Fuel subtotal" value={formatMoney(pricingEstimate.quantitySubtotal)} />
                    <MetricRow label="Delivery fee" value={formatMoney(pricingEstimate.deliveryFee)} />
                  </>
                ) : null}
                {selectedService?.code === "car_towing" ? (
                  <>
                    <MetricRow label="Visit fee" value={formatMoney(pricingEstimate.visitFee)} />
                    <MetricRow label="Towing base fee" value={formatMoney(pricingEstimate.towingBaseFee)} />
                    <MetricRow label={`Distance (${pricingEstimate.routeDistanceKm} km)`} value={formatMoney(pricingEstimate.distanceCharge)} />
                  </>
                ) : null}
                {selectedService?.code === "mechanic" ? (
                  <MetricRow label="Visit fee" value={formatMoney(pricingEstimate.visitFee)} />
                ) : null}
                <MetricRow label="Estimated total" value={formatMoney(pricingEstimate.total)} emphasized />
              </>
            ) : null}
            <Field label="Issue note" value={orderForm.notes} multiline onChangeText={(value) => updateOrderField("notes", value)} />
            <View style={styles.row}>
              <PrimaryButton
                label="Back"
                onPress={() => setBookingStep("details")}
                tone="secondary"
              />
              <PrimaryButton
                label={busyAction === "create-order" ? "Submitting..." : "Create request"}
                onPress={createOrder}
                loading={busyAction === "create-order"}
                disabled={busyAction !== ""}
              />
            </View>
            </Reveal>
          ) : null}
        </>
      );
    }

    return (
      <>
        <Reveal delay={0}>
          <ActiveOrderHero order={activeOrder} />
        </Reveal>
        <Reveal delay={80} style={styles.panel}>
          <SectionEyebrow label="Progress" />
          <OrderTimeline order={activeOrder} />
        </Reveal>
        <Reveal delay={140} style={styles.panel}>
          <SectionEyebrow label="Tracking" />
          <MapPreview
            requestLocation={activeOrder.pickupLocation}
            destinationLocation={activeOrder.destinationLocation}
            providerLocation={
              activeOrder.tracking.providerLatitude != null &&
              activeOrder.tracking.providerLongitude != null
                ? {
                    latitude: Number(activeOrder.tracking.providerLatitude),
                    longitude: Number(activeOrder.tracking.providerLongitude),
                  }
                : null
            }
            nearbyRequests={(activeOrder.nearbyProviders || []).map((provider) => ({
              latitude: provider.latitude,
              longitude: provider.longitude,
              distanceKm: provider.distanceKm,
              markerLabel: provider.name || "Nearby provider",
            }))}
          />
          <InfoRow label="Pickup" value={activeOrder.pickupLocation.address || "Pinned location"} />
          {activeOrder.destinationLocation ? (
            <InfoRow label="Destination" value={activeOrder.destinationLocation.address || "Pinned location"} />
          ) : null}
          <InfoRow label="Current total" value={formatMoney(activeOrder.pricing.total)} strong />
          {activeOrder.provider ? (
            <ProviderStrip provider={activeOrder.provider} />
          ) : (
            <Text style={styles.inlineHint}>
              Dispatch is still looking for the closest provider. {(activeOrder.nearbyProviders || []).length} nearby provider(s) are currently visible on the map.
            </Text>
          )}
        </Reveal>

        {activeExtraWorkRequest ? (
          <Reveal delay={200} style={styles.panel}>
            <SectionEyebrow label="Approval loop" />
            <Text style={styles.sectionTitle}>Approve only the extra work you actually want.</Text>
            {activeExtraWorkRequest.items.map((item) => (
              <View style={styles.workItemCard} key={item.id}>
                <Text style={styles.workItemTitle}>{item.title}</Text>
                {item.description ? <Text style={styles.inlineHint}>{item.description}</Text> : null}
                <Text style={styles.inlineHint}>
                  Parts {formatMoney(item.partsCost)} • Labor {formatMoney(item.laborCost)} • Qty {item.quantity}
                </Text>
                <Text style={styles.workItemValue}>{formatMoney(item.lineTotal)}</Text>
                <View style={styles.row}>
                  <ChoicePill
                    label="Approve"
                    active={userExtraWorkDecisions[item.id] === "approved"}
                    onPress={() =>
                      setUserExtraWorkDecisions((current) => ({ ...current, [item.id]: "approved" }))
                    }
                  />
                  <ChoicePill
                    label="Reject"
                    active={userExtraWorkDecisions[item.id] === "rejected"}
                    onPress={() =>
                      setUserExtraWorkDecisions((current) => ({ ...current, [item.id]: "rejected" }))
                    }
                    tone="danger"
                  />
                </View>
              </View>
            ))}
            <PrimaryButton
              label={busyAction === "extra-work-decision" ? "Submitting..." : "Submit decision"}
              onPress={submitExtraWorkDecisions}
              loading={busyAction === "extra-work-decision"}
              disabled={busyAction !== ""}
            />
          </Reveal>
        ) : null}

        {activeOrder.serviceCode === "fuel_delivery" &&
        activeOrder.status === "awaiting_fuel_confirmation" ? (
          <Reveal delay={260} style={styles.signalPanel}>
            <Text style={styles.signalTitle}>Check the fuel physically before you unlock COD.</Text>
            <Text style={styles.signalBody}>
              This confirmation step exists to reduce disputes on quantity delivery.
            </Text>
            <PrimaryButton
              label={busyAction === "fuel-confirm" ? "Confirming..." : "Confirm quantity delivered"}
              onPress={confirmFuelDelivered}
              loading={busyAction === "fuel-confirm"}
              disabled={busyAction !== ""}
            />
          </Reveal>
        ) : null}

        {activeOrder.serviceCode === "car_towing" &&
        ["assigned", "arrived", "tow_in_transit"].includes(activeOrder.status) ? (
          <Reveal delay={260} style={styles.sosPanel}>
            <Text style={styles.sosTitle}>Emergency support stays one tap away during towing.</Text>
            <PrimaryButton
              label={busyAction === "sos" ? "Sending SOS..." : "Raise SOS"}
              onPress={raiseSos}
              loading={busyAction === "sos"}
              disabled={busyAction !== ""}
              tone="danger"
            />
          </Reveal>
        ) : null}

        {activeOrder.status === "completed" && !activeOrder.payment.customerConfirmed ? (
          <Reveal delay={260} style={styles.panel}>
            <SectionEyebrow label="Cash confirmation" />
            <Text style={styles.sectionTitle}>Confirm when cash has changed hands.</Text>
            <Text style={styles.inlineHint}>{getCashConfirmationCopy(activeOrder).body}</Text>
            <PrimaryButton
              label={busyAction === "customer-payment" ? "Confirming..." : "I paid in cash"}
              onPress={confirmCustomerPayment}
              loading={busyAction === "customer-payment"}
              disabled={busyAction !== ""}
            />
          </Reveal>
        ) : null}

        {activeOrder.payment?.status === "partially_confirmed" ? (
          <Reveal delay={320} style={styles.waitingPanel}>
            <Text style={styles.waitingTitle}>{getCashConfirmationCopy(activeOrder).title}</Text>
            <Text style={styles.waitingBody}>{getCashConfirmationCopy(activeOrder).body}</Text>
          </Reveal>
        ) : null}
      </>
    );
  }

  function renderProviderHome() {
    if (!activeOrder) {
      return (
        <>
          <Reveal delay={0}>
            <HeroPanel
              title="Provider queue, rebuilt for fast scanning and fast acceptance."
              subtitle="Live location, nearby jobs, and one active order at a time in a cleaner dispatch surface."
              accent="#6D28D9"
              bg="#F5F0FF"
              border="#E3D5FF"
            />
          </Reveal>
          <Reveal delay={80} style={styles.panel}>
            <SectionEyebrow label="Availability" />
            <Text style={styles.sectionTitle}>Stay visible only when you’re ready to take work.</Text>
            <LocationCard
              title="Detected provider location"
              subtitle={deviceLocation.address || "Location still resolving"}
              loading={locationLoading}
              onPress={() => syncCurrentLocation({ silent: false, includeProviderRefresh: true })}
            />
            <View style={styles.row}>
              <ChoicePill label="Available" active={providerAvailable} onPress={() => setProviderAvailable(true)} />
              <ChoicePill label="Offline" active={!providerAvailable} onPress={() => setProviderAvailable(false)} />
            </View>
            <PrimaryButton
              label="Refresh nearby jobs"
              onPress={() => refreshProviderOrders(false)}
              tone="secondary"
              disabled={busyAction !== ""}
            />
          </Reveal>
          <Reveal delay={160} style={styles.panel}>
            <SectionEyebrow label="Nearby jobs" />
            <Text style={styles.sectionTitle}>Dispatch queue</Text>
            <MapPreview
              requestLocation={{
                latitude: Number(providerLocation.latitude),
                longitude: Number(providerLocation.longitude),
              }}
              nearbyRequests={providerOrders.map((order) => ({
                latitude: order.pickupLocation.latitude,
                longitude: order.pickupLocation.longitude,
                serviceName: order.serviceName,
                distanceKm: order.providerDistanceKm,
              }))}
            />
            {providerOrders.length === 0 ? (
              <Text style={styles.inlineHint}>No open jobs are inside your radius right now.</Text>
            ) : (
              providerOrders.map((order) => (
                <ProviderQueueCard
                  key={order.id}
                  order={order}
                  busy={busyAction === `accept-${order.id}`}
                  onAccept={() => acceptOrder(order.id)}
                />
              ))
            )}
          </Reveal>
        </>
      );
    }

    return (
      <>
        <Reveal delay={0}>
          <ActiveOrderHero order={activeOrder} providerMode />
        </Reveal>
        <Reveal delay={80} style={styles.panel}>
          <SectionEyebrow label="Progress" />
          <OrderTimeline order={activeOrder} />
        </Reveal>
        <Reveal delay={140} style={styles.panel}>
          <SectionEyebrow label="Route" />
          <MapPreview
            requestLocation={activeOrder.pickupLocation}
            destinationLocation={activeOrder.destinationLocation}
            providerLocation={{
              latitude: Number(providerLocation.latitude),
              longitude: Number(providerLocation.longitude),
            }}
          />
          <InfoRow label="Customer" value={activeOrder.customer?.name || "Customer"} />
          <InfoRow label="Pickup" value={activeOrder.pickupLocation.address || "Pinned location"} />
          {activeOrder.destinationLocation ? (
            <InfoRow label="Destination" value={activeOrder.destinationLocation.address || "Pinned location"} />
          ) : null}
          <InfoRow label="Current total" value={formatMoney(activeOrder.pricing.total)} strong />
          {activeOrder.tracking.sosRaisedAt ? (
            <Text style={styles.alertText}>
              SOS raised: {activeOrder.tracking.sosMessage || "Customer requested emergency help"}
            </Text>
          ) : null}
        </Reveal>

        {activeOrder.status === "assigned" ? (
          <Reveal delay={200} style={styles.panel}>
            <SectionEyebrow label="Arrival" />
            <PrimaryButton
              label={busyAction === "mark-arrived" ? "Saving..." : "Mark arrived"}
              onPress={markArrived}
              loading={busyAction === "mark-arrived"}
              disabled={busyAction !== ""}
            />
          </Reveal>
        ) : null}

        {activeOrder.serviceCode === "fuel_delivery" ? (
          <Reveal delay={260} style={styles.panel}>
            <SectionEyebrow label="Fuel workflow" />
            {["arrived"].includes(activeOrder.status) ? (
              <PrimaryButton
                label={busyAction === "start-order" ? "Starting..." : "Start delivery"}
                onPress={startOrder}
                loading={busyAction === "start-order"}
                disabled={busyAction !== ""}
              />
            ) : null}
            {["in_progress"].includes(activeOrder.status) ? (
              <PrimaryButton
                label={busyAction === "fuel-delivered" ? "Saving..." : "Mark fuel delivered"}
                onPress={markFuelDelivered}
                loading={busyAction === "fuel-delivered"}
                disabled={busyAction !== ""}
              />
            ) : null}
            {activeOrder.status === "awaiting_fuel_confirmation" ? (
              <Text style={styles.inlineHint}>Waiting for customer quantity confirmation.</Text>
            ) : null}
          </Reveal>
        ) : null}

        {activeOrder.serviceCode === "car_towing" ? (
          <Reveal delay={260} style={styles.panel}>
            <SectionEyebrow label="Towing workflow" />
            {["arrived"].includes(activeOrder.status) ? (
              <PrimaryButton
                label={busyAction === "start-order" ? "Starting..." : "Start towing transit"}
                onPress={startOrder}
                loading={busyAction === "start-order"}
                disabled={busyAction !== ""}
              />
            ) : null}
            {["tow_in_transit"].includes(activeOrder.status) ? (
              <PrimaryButton
                label={busyAction === "complete-order" ? "Completing..." : "Complete towing job"}
                onPress={completeOrder}
                loading={busyAction === "complete-order"}
                disabled={busyAction !== ""}
              />
            ) : null}
          </Reveal>
        ) : null}

        {activeOrder.serviceCode === "mechanic" ? (
          <>
            {["inspection_pending", "arrived"].includes(activeOrder.status) ? (
              <Reveal delay={260} style={styles.panel}>
                <SectionEyebrow label="Approval loop" />
                <Text style={styles.sectionTitle}>Send only the extra work that needs customer consent.</Text>
                <Field
                  label="Provider note"
                  value={providerExtraWorkDraft.providerNote}
                  multiline
                  onChangeText={(value) =>
                    setProviderExtraWorkDraft((current) => ({ ...current, providerNote: value }))
                  }
                />
                {providerExtraWorkDraft.items.map((item, index) => (
                  <View key={index} style={styles.workDraftCard}>
                    <Field
                      label={`Item ${index + 1} title`}
                      value={item.title}
                      onChangeText={(value) => updateExtraWorkItem(index, "title", value)}
                    />
                    <Field
                      label="Description"
                      value={item.description}
                      multiline
                      onChangeText={(value) => updateExtraWorkItem(index, "description", value)}
                    />
                    <View style={styles.row}>
                      <View style={styles.rowField}>
                        <Field
                          label="Parts"
                          value={item.partsCost}
                          onChangeText={(value) => updateExtraWorkItem(index, "partsCost", value)}
                        />
                      </View>
                      <View style={styles.rowField}>
                        <Field
                          label="Labor"
                          value={item.laborCost}
                          onChangeText={(value) => updateExtraWorkItem(index, "laborCost", value)}
                        />
                      </View>
                      <View style={styles.rowField}>
                        <Field
                          label="Qty"
                          value={item.quantity}
                          onChangeText={(value) => updateExtraWorkItem(index, "quantity", value)}
                        />
                      </View>
                    </View>
                  </View>
                ))}
                <PrimaryButton label="Add another item" onPress={addExtraWorkItem} tone="secondary" disabled={busyAction !== ""} />
                <PrimaryButton
                  label={busyAction === "extra-work" ? "Sending..." : "Send extra work request"}
                  onPress={submitExtraWorkRequest}
                  loading={busyAction === "extra-work"}
                  disabled={busyAction !== ""}
                />
                <PrimaryButton
                  label={busyAction === "start-order" ? "Starting..." : "Start work without extras"}
                  onPress={startOrder}
                  tone="secondary"
                  loading={busyAction === "start-order"}
                  disabled={busyAction !== ""}
                />
              </Reveal>
            ) : null}

            {activeOrder.status === "awaiting_extra_work_approval" ? (
              <Reveal delay={260} style={styles.signalPanel}>
                <Text style={styles.signalTitle}>Customer approval pending.</Text>
                <Text style={styles.signalBody}>The job is paused until the customer approves or rejects the extra work items.</Text>
              </Reveal>
            ) : null}

            {activeOrder.status === "in_progress" ? (
              <Reveal delay={260} style={styles.panel}>
                <SectionEyebrow label="Completion" />
                <PrimaryButton
                  label={busyAction === "complete-order" ? "Completing..." : "Complete mechanic job"}
                  onPress={completeOrder}
                  loading={busyAction === "complete-order"}
                  disabled={busyAction !== ""}
                />
              </Reveal>
            ) : null}
          </>
        ) : null}

        {activeOrder.status === "completed" && !activeOrder.payment.providerConfirmed ? (
          <Reveal delay={320} style={styles.panel}>
            <SectionEyebrow label="Cash confirmation" />
            <Text style={styles.inlineHint}>{getCashConfirmationCopy(activeOrder, true).body}</Text>
            <PrimaryButton
              label={busyAction === "provider-payment" ? "Confirming..." : "I received cash"}
              onPress={confirmProviderPayment}
              loading={busyAction === "provider-payment"}
              disabled={busyAction !== ""}
            />
          </Reveal>
        ) : null}

        {activeOrder.payment?.status === "partially_confirmed" ? (
          <Reveal delay={380} style={styles.waitingPanel}>
            <Text style={styles.waitingTitle}>{getCashConfirmationCopy(activeOrder, true).title}</Text>
            <Text style={styles.waitingBody}>{getCashConfirmationCopy(activeOrder, true).body}</Text>
          </Reveal>
        ) : null}
      </>
    );
  }

  function renderHistory() {
    return (
      <>
        <Reveal delay={0}>
          <HeroPanel
            title="Every request and every job stays readable after the rush."
            subtitle="History is grouped, quieter, and easier to scan than the active-dispatch view."
            accent="#7C3AED"
            bg="#F7F2FF"
            border="#E7DCFF"
          />
        </Reveal>
        <Reveal delay={80} style={styles.panel}>
          <View style={styles.panelHead}>
            <View>
              <SectionEyebrow label="Filters" />
              <Text style={styles.sectionTitle}>Order history</Text>
            </View>
            <PrimaryButton label="Refresh" onPress={() => loadOrderHistory(false)} tone="secondary" disabled={busyAction !== ""} />
          </View>
          <View style={styles.row}>
            <ChoicePill label="All" active={historyFilter === "all"} onPress={() => setHistoryFilter("all")} />
            <ChoicePill label="Active" active={historyFilter === "active"} onPress={() => setHistoryFilter("active")} />
            <ChoicePill label="Completed" active={historyFilter === "completed"} onPress={() => setHistoryFilter("completed")} />
          </View>
          {filteredHistory.length === 0 ? (
            <Text style={styles.inlineHint}>No orders found for this filter.</Text>
          ) : (
            filteredHistory.map((order) => <HistoryCard key={order.id} order={order} />)
          )}
        </Reveal>
      </>
    );
  }

  function renderProfile() {
    const isProvider = session.user?.role === "provider";

    return (
      <>
        <Reveal delay={0}>
          <HeroPanel
            title={isProvider ? "Provider profile stays operational, not ornamental." : "Your profile stays simple, local, and editable."}
            subtitle={
              isProvider
                ? "Service toggles, workshop identity, and dispatch details belong in one coherent place."
                : "Identity and profile image stay editable without burying account basics."
            }
            accent={isProvider ? "#6D28D9" : "#8B5CF6"}
            bg={isProvider ? "#F5F0FF" : "#F8F4FF"}
            border={isProvider ? "#E3D5FF" : "#EBDDFF"}
          />
        </Reveal>
        <Reveal delay={80} style={styles.panel}>
          <SectionEyebrow label="Profile" />
          <Field
            label="Name"
            value={profileForm.name}
            onChangeText={(value) => setProfileForm((current) => ({ ...current, name: value }))}
          />
          <PrimaryButton
            label={uploadingField === "profilePicture" ? "Uploading profile image..." : "Upload profile image"}
            onPress={() => pickAndUploadImage("profilePicture", setProfileForm)}
            tone="secondary"
            disabled={uploadingField !== ""}
          />
          {profileForm.profilePicture ? (
            <Image source={{ uri: profileForm.profilePicture }} style={styles.previewImage} />
          ) : null}

          {isProvider ? (
            <>
              <Field
                label="City"
                value={profileForm.city}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, city: value }))}
              />
              <LocationCard
                title="Live dispatch location"
                subtitle={deviceLocation.address || "Location still resolving"}
                loading={locationLoading}
                onPress={() => syncCurrentLocation({ silent: false, includeProviderRefresh: true })}
              />
              <PrimaryButton
                label={uploadingField === "workshopPicture" ? "Uploading workshop image..." : "Upload workshop image"}
                onPress={() => pickAndUploadImage("workshopPicture", setProfileForm)}
                tone="secondary"
                disabled={uploadingField !== ""}
              />
              {profileForm.workshopPicture ? (
                <Image source={{ uri: profileForm.workshopPicture }} style={styles.previewImage} />
              ) : null}
              <Field
                label="CNIC number"
                value={profileForm.cnic}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, cnic: value }))}
              />
              <PrimaryButton
                label={uploadingField === "cnicFrontImage" ? "Uploading CNIC front..." : "Upload CNIC front"}
                onPress={() => pickAndUploadImage("cnicFrontImage", setProfileForm)}
                tone="secondary"
                disabled={uploadingField !== ""}
              />
              {profileForm.cnicFrontImage ? (
                <Image source={{ uri: profileForm.cnicFrontImage }} style={styles.previewImage} />
              ) : null}
              <PrimaryButton
                label={uploadingField === "cnicBackImage" ? "Uploading CNIC back..." : "Upload CNIC back"}
                onPress={() => pickAndUploadImage("cnicBackImage", setProfileForm)}
                tone="secondary"
                disabled={uploadingField !== ""}
              />
              {profileForm.cnicBackImage ? (
                <Image source={{ uri: profileForm.cnicBackImage }} style={styles.previewImage} />
              ) : null}
              <ChoiceGrid
                title="Enabled services"
                items={PROVIDER_SERVICE_OPTIONS.map((item) => ({
                  key: item.code,
                  label: item.label,
                  active: profileForm.serviceCodes.includes(item.code),
                  onPress: () => toggleProfileProviderService(item.code),
                  short: item.short,
                }))}
              />
            </>
          ) : (
            <LocationCard
              title="Current device location"
              subtitle={deviceLocation.address || "Location still resolving"}
              loading={locationLoading}
              onPress={() => syncCurrentLocation({ silent: false })}
            />
          )}

          <PrimaryButton
            label={busyAction === "save-profile" ? "Saving..." : "Save profile"}
            onPress={saveProfile}
            loading={busyAction === "save-profile"}
            disabled={busyAction !== "" || uploadingField !== ""}
          />
        </Reveal>
      </>
    );
  }

  function renderDashboard() {
    const isProvider = session.user?.role === "provider";

    return (
      <AppCanvas>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Reveal delay={0}>
            <TopHeader
              title={session.user?.name || "RoadRescue"}
              subtitle={
                isProvider
                  ? "Provider dispatch, rebuilt for faster scanning and cleaner control."
                  : "Customer dispatch, rebuilt around fewer choices and stronger feedback."
              }
              phone={session.user?.phone}
              onLogout={resetSession}
            />
          </Reveal>

          <Reveal delay={60} style={styles.tabWrap}>
            <SegmentedControl items={tabs} value={screenTab} onChange={setScreenTab} />
          </Reveal>

          {screenTab === "home" ? (isProvider ? renderProviderHome() : renderCustomerHome()) : null}
          {screenTab === "history" ? renderHistory() : null}
          {screenTab === "profile" ? renderProfile() : null}

          {!!message ? <FeedbackMessage message={message} type={messageType} /> : null}
        </ScrollView>
      </AppCanvas>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderShell}>
        <ActivityIndicator size="large" color="#6D28D9" />
      </View>
    );
  }

  if (!session.user) {
    return renderAuthScreen();
  }

  return renderDashboard();
}

function AppCanvas({ children }) {
  return (
    <View style={styles.safeArea}>
      <View style={styles.backdropOrbA} />
      <View style={styles.backdropOrbB} />
      <View style={styles.backdropGrid} />
      {children}
    </View>
  );
}

function TopHeader({ title, subtitle, phone, onLogout }) {
  const firstName = String(title || "Ali").trim().split(" ")[0];

  return (
    <View style={styles.topHeader}>
      <View style={styles.topHeaderCopy}>
        <Text style={styles.appMark}>ROADRESCUE</Text>
        <Text style={styles.topTitle}>{`Hello, ${firstName}`}</Text>
        <Text style={styles.topSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.topHeaderMeta}>
        <Text style={styles.phoneBadge}>{phone}</Text>
        <PrimaryButton label="Logout" onPress={onLogout} tone="secondary" compact />
      </View>
    </View>
  );
}

function HeroPanel({ title, subtitle, accent, bg, border }) {
  return (
    <View style={[styles.heroPanel, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.heroAccent, { backgroundColor: accent }]} />
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ActiveOrderHero({ order, providerMode = false }) {
  const tone = getStatusTone(order.status);

  return (
    <View style={styles.heroPanel}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.monoLabel}>{providerMode ? "ACTIVE JOB" : "ACTIVE REQUEST"}</Text>
          <Text style={styles.heroTitle}>{order.serviceName}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.statusChipText, { color: tone.text }]}>{titleFromCode(order.status)}</Text>
        </View>
      </View>
      <Text style={styles.heroSubtitle}>
        {providerMode
          ? "Keep one active job visible, track the next required action, and close COD cleanly."
          : "One clear progress rail, one provider strip, and one obvious next step."}
      </Text>
      <View style={styles.metricBand}>
        <MetricPill label="Order no" value={order.orderNo} />
        <MetricPill label="Vehicle" value={order.customerVehicle.licensePlate} />
        <MetricPill label="Total" value={formatMoney(order.pricing.total)} />
      </View>
    </View>
  );
}

function ProviderStrip({ provider }) {
  return (
    <View style={styles.providerStrip}>
      <View style={styles.providerBadge}>
        <Text style={styles.providerBadgeText}>
          {provider.name
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.providerName}>{provider.name}</Text>
        <Text style={styles.providerPhone}>{provider.phone}</Text>
      </View>
    </View>
  );
}

function OrderTimeline({ order }) {
  const steps = buildTimeline(order);

  return (
    <View style={styles.timelineWrap}>
      {steps.map((step, index) => {
        const complete = isTimelineStepComplete(order, step.key);

        return (
          <View style={styles.timelineItem} key={step.key}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, complete && styles.timelineDotActive]} />
              {index < steps.length - 1 ? (
                <View style={[styles.timelineLine, complete && styles.timelineLineActive]} />
              ) : null}
            </View>
            <Text style={[styles.timelineLabel, complete && styles.timelineLabelActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ServiceCard({ title, subtitle, short, active, accent, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.serviceCard,
        active && [styles.serviceCardActive, { borderColor: accent }],
        pressed && styles.pressedLite,
      ]}
    >
      <View style={styles.serviceCardTop}>
        <View style={styles.serviceGlyphShell}>
          <View style={[styles.serviceGlyph, { backgroundColor: accent }]}>
            <Text style={styles.serviceGlyphText}>{short}</Text>
          </View>
        </View>
        <View style={[styles.serviceStatePill, active && styles.serviceStatePillActive]}>
          <Text style={[styles.serviceStateText, active && styles.serviceStateTextActive]}>
            {active ? "Selected" : "On demand"}
          </Text>
        </View>
      </View>
      <Text style={styles.serviceCardTitle}>{title}</Text>
      <Text style={styles.serviceCardSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function ProviderQueueCard({ order, busy, onAccept }) {
  const option = PROVIDER_SERVICE_OPTIONS.find((item) => item.code === order.serviceCode);

  return (
    <View style={styles.queueCard}>
      <View style={styles.queueCardHead}>
        <View style={styles.queueBadge}>
          <Text style={styles.queueBadgeText}>{option?.short || "JB"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.queueTitle}>{order.serviceName}</Text>
          <Text style={styles.queueMeta}>
            {order.customer?.name} • {Number(order.providerDistanceKm || 0).toFixed(2)} km away
          </Text>
        </View>
      </View>
      <Text style={styles.queueHint}>{order.pickupLocation.address || "Pinned location only"}</Text>
      <Text style={styles.queueHint}>Vehicle: {order.customerVehicle.licensePlate}</Text>
      <MetricRow label="Current total" value={formatMoney(order.pricing.total)} emphasized />
      <PrimaryButton label={busy ? "Accepting..." : "Accept job"} onPress={onAccept} loading={busy} />
    </View>
  );
}

function SegmentedControl({ items, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onChange(item.key)}
          style={({ pressed }) => [
            styles.segmentedItem,
            value === item.key && styles.segmentedItemActive,
            pressed && styles.pressedLite,
          ]}
        >
          <Text style={[styles.segmentedLabel, value === item.key && styles.segmentedLabelActive]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChoiceGrid({ title, items }) {
  return (
    <View style={styles.choiceGridWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.choiceGrid}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.choiceCard,
              item.active && styles.choiceCardActive,
              pressed && styles.pressedLite,
            ]}
          >
            <Text style={[styles.choiceShort, item.active && styles.choiceShortActive]}>{item.short}</Text>
            <Text style={[styles.choiceLabel, item.active && styles.choiceLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ChoicePill({ label, active, onPress, tone = "default" }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        active && tone === "default" && styles.choicePillActive,
        active && tone === "danger" && styles.choicePillDanger,
        pressed && styles.pressedLite,
      ]}
    >
      <Text
        style={[
          styles.choicePillText,
          active && tone === "default" && styles.choicePillTextActive,
          active && tone === "danger" && styles.choicePillDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, multiline = false, style, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#9B94B3"
        style={[styles.fieldInput, multiline && styles.fieldTextarea, style]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

function LocationCard({ title, subtitle, loading, onPress }) {
  return (
    <View style={styles.locationCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.locationText}>{subtitle}</Text>
      </View>
      <PrimaryButton
        label={loading ? "Locating..." : "Refresh"}
        onPress={onPress}
        loading={loading}
        tone="secondary"
        compact
        disabled={loading}
      />
    </View>
  );
}

function SectionEyebrow({ label }) {
  return <Text style={styles.sectionEyebrow}>{label}</Text>;
}

function MetricRow({ label, value, emphasized = false }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, emphasized && styles.metricValueStrong]}>{value}</Text>
    </View>
  );
}

function MetricPill({ label, value }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, strong = false }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>{value}</Text>
    </View>
  );
}

function FeedbackMessage({ message, type }) {
  return (
    <View
      style={[
        styles.feedback,
        type === "error" && styles.feedbackError,
        type === "success" && styles.feedbackSuccess,
      ]}
    >
      <Text
        style={[
          styles.feedbackText,
          type === "error" && styles.feedbackErrorText,
          type === "success" && styles.feedbackSuccessText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function HistoryCard({ order }) {
  const tone = getStatusTone(order.status);

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyHead}>
        <View>
          <Text style={styles.historyTitle}>{order.serviceName}</Text>
          <Text style={styles.historyMeta}>{order.orderNo}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.statusChipText, { color: tone.text }]}>{titleFromCode(order.status)}</Text>
        </View>
      </View>
      <InfoRow label="Pickup" value={order.pickupLocation.address || "Pinned location"} />
      <InfoRow label="Vehicle" value={order.customerVehicle.licensePlate} />
      <InfoRow label="Total" value={formatMoney(order.pricing.total)} strong />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary",
  compact = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        (pressed || loading) && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.buttonInner}>
        <View style={styles.buttonCopy}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={tone === "secondary" ? "#5B3DB4" : tone === "danger" ? "#B64141" : "#FFFFFF"}
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              compact && styles.buttonTextCompact,
              tone === "secondary" && styles.buttonTextSecondary,
              tone === "danger" && styles.buttonTextDanger,
            ]}
          >
            {label}
          </Text>
        </View>
        {!compact && !loading ? (
          <View
            style={[
              styles.buttonOrb,
              tone === "secondary" && styles.buttonOrbSecondary,
              tone === "danger" && styles.buttonOrbDanger,
            ]}
          >
            <Text
              style={[
                styles.buttonOrbText,
                tone === "secondary" && styles.buttonOrbTextSecondary,
                tone === "danger" && styles.buttonOrbTextDanger,
              ]}
            >
              {tone === "danger" ? "!" : "→"}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F4FF",
  },
  backdropOrbA: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(109, 40, 217, 0.11)",
  },
  backdropOrbB: {
    position: "absolute",
    top: 210,
    left: -85,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(168, 85, 247, 0.09)",
  },
  backdropGrid: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderColor: "rgba(109, 40, 217, 0.05)",
  },
  loaderShell: {
    flex: 1,
    backgroundColor: "#F7F4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 72,
    gap: 18,
  },
  appMark: {
    color: "#7B5CD6",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  authTitle: {
    color: "#1F1537",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 34,
    lineHeight: 38,
    maxWidth: 360,
  },
  authSubtitle: {
    color: "#6D6587",
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 340,
  },
  switchWrap: {
    gap: 10,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E7DFFF",
    gap: 6,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  segmentedItemActive: {
    backgroundColor: "#6D28D9",
  },
  segmentedLabel: {
    color: "#82789D",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
  segmentedLabelActive: {
    color: "#FFFFFF",
  },
  formPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E8DFFF",
    padding: 18,
    gap: 14,
    shadowColor: "#4C1D95",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  topHeaderCopy: {
    flex: 1,
    maxWidth: 280,
  },
  topHeaderMeta: {
    alignItems: "flex-end",
    gap: 10,
  },
  topTitle: {
    color: "#1D1630",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 30,
    lineHeight: 34,
  },
  topSubtitle: {
    color: "#6F6986",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  phoneBadge: {
    color: "#6D28D9",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
    backgroundColor: "#F6F1FF",
    borderWidth: 1,
    borderColor: "#E0D2FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabWrap: {
    marginTop: 2,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E8DFFF",
    padding: 18,
    gap: 14,
    shadowColor: "#4C1D95",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroPanel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFFF",
    borderRadius: 30,
    padding: 20,
    gap: 14,
    overflow: "hidden",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroAccent: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 72,
    height: 72,
    borderRadius: 22,
    opacity: 0.18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  heroTitle: {
    color: "#20163A",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 28,
    lineHeight: 32,
    maxWidth: 300,
  },
  heroSubtitle: {
    color: "#6E6788",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 330,
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipText: {
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  monoLabel: {
    color: "#8A79BC",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  metricBand: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricPill: {
    backgroundColor: "#F8F5FF",
    borderWidth: 1,
    borderColor: "#E4D9FF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 96,
    flexGrow: 1,
  },
  metricPillLabel: {
    color: "#8A83A5",
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 10,
    marginBottom: 4,
  },
  metricPillValue: {
    color: "#241840",
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  sectionEyebrow: {
    color: "#7D57E7",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
    letterSpacing: 1.8,
  },
  sectionTitle: {
    color: "#22193C",
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    lineHeight: 26,
  },
  sectionHint: {
    color: "#6F6886",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  serviceSyncCard: {
    backgroundColor: "#FFF8EB",
    borderWidth: 1,
    borderColor: "#F0D6A1",
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  serviceGrid: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: "#FCFAFF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 24,
    padding: 16,
    gap: 10,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  serviceCardActive: {
    backgroundColor: "#F5EDFF",
  },
  serviceCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceGlyphShell: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 18,
    padding: 4,
  },
  serviceGlyph: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceGlyphText: {
    color: "#FFFFFF",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 13,
  },
  serviceStatePill: {
    backgroundColor: "#F4EEFF",
    borderWidth: 1,
    borderColor: "#E2D5FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceStatePillActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  serviceStateText: {
    color: "#765BBD",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.4,
  },
  serviceStateTextActive: {
    color: "#FFFFFF",
  },
  serviceCardTitle: {
    color: "#261A42",
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
  },
  serviceCardSubtitle: {
    color: "#6E6688",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  fieldWrap: {
    gap: 7,
  },
  fieldLabel: {
    color: "#47346F",
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
  },
  fieldInput: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#231A3B",
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
  },
  fieldTextarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  locationCard: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  locationText: {
    color: "#2A1E44",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  groupTitle: {
    color: "#281D45",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
  },
  choiceGridWrap: {
    gap: 10,
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceCard: {
    width: "31%",
    minWidth: 96,
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  choiceCardActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  choiceShort: {
    color: "#8B82A8",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 11,
  },
  choiceShortActive: {
    color: "#FFFFFF",
  },
  choiceLabel: {
    color: "#251B40",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
  },
  choiceLabelActive: {
    color: "#FFFFFF",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 2,
  },
  metricLabel: {
    color: "#807999",
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 12,
    flex: 1,
  },
  metricValue: {
    color: "#23193D",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
  },
  metricValueStrong: {
    color: "#6D28D9",
    fontFamily: "Outfit_800ExtraBold",
  },
  providerStrip: {
    backgroundColor: "#FCFAFF",
    borderWidth: 1,
    borderColor: "#E7DCFF",
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  providerBadgeText: {
    color: "#FFFFFF",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 13,
  },
  providerName: {
    color: "#261C40",
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
  },
  providerPhone: {
    color: "#7D7696",
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  timelineWrap: {
    gap: 10,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  timelineRail: {
    width: 20,
    alignItems: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E4D7FF",
    borderWidth: 2,
    borderColor: "#D5C2FF",
  },
  timelineDotActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: "#E6DDFF",
    marginTop: 4,
  },
  timelineLineActive: {
    backgroundColor: "#6D28D9",
  },
  timelineLabel: {
    color: "#7E7898",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    lineHeight: 18,
    paddingBottom: 16,
  },
  timelineLabelActive: {
    color: "#251B40",
  },
  inlineHint: {
    color: "#716B88",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  signalPanel: {
    backgroundColor: "#FFF8EB",
    borderWidth: 1,
    borderColor: "#F0D6A1",
    borderRadius: 28,
    padding: 18,
    gap: 12,
  },
  signalTitle: {
    color: "#6D4300",
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    lineHeight: 26,
  },
  signalBody: {
    color: "#9A7A45",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  sosPanel: {
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F1C4C4",
    borderRadius: 28,
    padding: 18,
    gap: 12,
  },
  sosTitle: {
    color: "#A93232",
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    lineHeight: 26,
  },
  waitingPanel: {
    backgroundColor: "#F5F0FF",
    borderWidth: 1,
    borderColor: "#DECFFF",
    borderRadius: 28,
    padding: 18,
    gap: 10,
  },
  waitingTitle: {
    color: "#44268F",
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    lineHeight: 24,
  },
  waitingBody: {
    color: "#6D648B",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  workItemCard: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  workItemTitle: {
    color: "#261B41",
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
  },
  workItemValue: {
    color: "#6D28D9",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  choicePill: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E3D9FB",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choicePillActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  choicePillDanger: {
    backgroundColor: "#D04A4A",
    borderColor: "#D04A4A",
  },
  choicePillText: {
    color: "#4D3B78",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
  choicePillTextActive: {
    color: "#FFFFFF",
  },
  choicePillDangerText: {
    color: "#FFF6F6",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: {
    color: "#847E9C",
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 11,
    flex: 1,
  },
  infoValue: {
    color: "#251B41",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    flex: 1,
    textAlign: "right",
  },
  infoValueStrong: {
    color: "#6D28D9",
    fontFamily: "Outfit_700Bold",
  },
  queueCard: {
    backgroundColor: "#FCFAFF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  queueCardHead: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  queueBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  queueBadgeText: {
    color: "#FFFFFF",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 12,
  },
  queueTitle: {
    color: "#241A3E",
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
  },
  queueMeta: {
    color: "#736C8B",
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    marginTop: 4,
  },
  queueHint: {
    color: "#706987",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  historyCard: {
    backgroundColor: "#FCFAFF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  historyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  historyTitle: {
    color: "#261C40",
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
  },
  historyMeta: {
    color: "#807A99",
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
  workDraftCard: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E6DBFF",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rowField: {
    flex: 1,
    minWidth: 84,
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD3FF",
  },
  buttonDanger: {
    backgroundColor: "#E34E4E",
  },
  buttonInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  buttonCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  buttonOrb: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOrbSecondary: {
    backgroundColor: "#F2EBFF",
  },
  buttonOrbDanger: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  buttonOrbText: {
    color: "#FFFFFF",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 13,
  },
  buttonOrbTextSecondary: {
    color: "#6D28D9",
  },
  buttonOrbTextDanger: {
    color: "#FFFFFF",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
  },
  buttonTextCompact: {
    fontSize: 13,
  },
  buttonTextSecondary: {
    color: "#5B3DB4",
  },
  buttonTextDanger: {
    color: "#FFFFFF",
  },
  feedback: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  feedbackError: {
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F2C3C3",
  },
  feedbackSuccess: {
    backgroundColor: "#EEF8F0",
    borderWidth: 1,
    borderColor: "#BEE4C7",
  },
  feedbackText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
  },
  feedbackErrorText: {
    color: "#B33838",
  },
  feedbackSuccessText: {
    color: "#237748",
  },
  previewImage: {
    width: "100%",
    height: 176,
    borderRadius: 22,
    resizeMode: "cover",
  },
  searchCard: {
    backgroundColor: "#FBF9FF",
    borderWidth: 1,
    borderColor: "#E5DAFF",
    borderRadius: 18,
    padding: 14,
  },
  searchCardPressed: {
    opacity: 0.85,
  },
  searchCardText: {
    color: "#281D45",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  alertText: {
    color: "#B73838",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  pressedLite: {
    opacity: 0.9,
  },
});
