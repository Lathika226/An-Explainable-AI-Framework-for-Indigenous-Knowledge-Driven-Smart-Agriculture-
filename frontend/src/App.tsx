import React, { useState, useEffect } from "react";
import {
  Camera,
  CloudSun,
  Leaf,
  Menu,
  MessageCircle,
  QrCode,
  ScanLine,
  Sprout,
  UserRound,
  Wheat,
  MapPin,
  Mic,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  Bot
} from "lucide-react";
import { Routes, Route, useNavigate, Link, useLocation } from "react-router-dom";
import QRCode from "qrcode";
import ModuleCard from "./components/ModuleCard";
import VoiceInput from "./components/VoiceInput";
import ListenButton from "./components/ListenButton";
import KisanVoiceAgentModal, { VoiceFarmData } from "./components/KisanVoiceAgentModal";
import { api, setAuthToken, getAuthToken } from "./api";
import { SUPPORTED_LANGUAGES, LanguageOption } from "./i18n";
import { LanguageProvider, useAppLanguage } from "./context/LanguageContext";

/* =========================================================================
   TYPES
   ========================================================================= */

interface FarmData {
  id?: number;
  user_id?: number;
  state: string;
  district: string;
  mandal?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  land_size: number;
  land_unit: string;
  soil_type: string;
  water_availability: string;
}

interface CropRecommendationResult {
  prediction: string;
  recommendation_id?: number;
  confidence: number;
  suitability_label: string;
  model_version: string;
  demo_mode: boolean;
  message: string;
  shap: Array<{ feature: string; value: any; contribution: number }>;
  reason: string;
  reasons_breakdown?: string[];
  soil_type_detected?: string;
  is_soil_estimated?: boolean;
  suitable_crops?: Array<{
    crop: string;
    confidence: number;
    suitability_label: string;
    why: string;
    water_requirement: string;
    risk_factor: string;
  }>;
  inputs_used?: {
    location?: string;
    land_size?: string;
    soil_type?: string;
    season?: string;
    weather?: string;
  };
}

/* =========================================================================
   MODAL: Open on Mobile (QR Code)
   ========================================================================= */

function OpenOnMobileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useAppLanguage();
  const [lanUrl, setLanUrl] = useState<string>("");
  const [qrImageData, setQrImageData] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setErrorMessage("");
      setLanUrl("");
      setQrImageData("");
      api<{ lan_ip: string; frontend_port: number; lan_url: string }>("/system/lan-info")
        .then(async (data) => {
          const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
          if (isLocalHost && (!data.lan_ip || data.lan_ip === "127.0.0.1")) {
            throw new Error("Could not detect this computer's LAN address. Connect both devices to the same network and try again.");
          }
          const targetUrl = isLocalHost ? data.lan_url : window.location.origin;
          setLanUrl(targetUrl);
          const qrData = await QRCode.toDataURL(targetUrl, { width: 260, margin: 2 });
          setQrImageData(qrData);
        })
        .catch((error: unknown) => {
          setLanUrl("");
          setErrorMessage(error instanceof Error ? error.message : "Could not create a mobile access link.");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
        >
          ✕
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-agri-100 text-agri-700">
          <QrCode size={24} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{t("open_mobile")}</h3>
        <p className="mt-1 text-xs text-gray-500">
          Scan this QR code with your phone camera to open AGRIPRENEURS on your local network.
        </p>

        <div className="my-5 flex justify-center">
          {loading ? (
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">
              Generating QR Code...
            </div>
          ) : errorMessage ? (
            <div role="alert" className="flex h-52 w-52 items-center justify-center rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              {errorMessage}
            </div>
          ) : (
            <img src={qrImageData} alt="LAN Access QR Code" className="h-52 w-52 rounded-2xl border border-gray-200 p-2 shadow-inner" />
          )}
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-mono text-gray-700 break-all">
          {lanUrl || (loading ? "Loading URL..." : "No link available")}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!lanUrl}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-semibold text-gray-800 hover:bg-gray-200 transition"
          >
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-agri-700 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   LANGUAGE SELECTOR MODAL / SCREEN
   ========================================================================= */

function LanguageSelectionModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose?: () => void;
  onSelect: (lang: LanguageOption) => void;
}) {
  const { lang: currentLang, setLanguage, t } = useAppLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-agri-700 p-3 text-white shadow-md">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">{t("choose_language")}</h2>
              <p className="text-xs text-gray-500 font-medium">మీ భాషను ఎంచుకోండి / अपनी भाषा चुनें</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
            >
              ✕
            </button>
          )}
        </div>

        <p className="mb-6 text-sm text-gray-600">
          {t("choose_language_sub")}
        </p>

        <div className="space-y-3">
          {SUPPORTED_LANGUAGES.map((item) => {
            const isSelected = currentLang?.code === item.code;
            return (
              <button
                key={item.code}
                onClick={() => {
                  setLanguage(item);
                  onSelect(item);
                }}
                className={`w-full flex items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-agri-700 bg-agri-50 text-agri-900 shadow-sm"
                    : "border-gray-100 hover:border-agri-300 hover:bg-gray-50 text-gray-800"
                }`}
              >
                <div>
                  <div className="text-lg font-bold">{item.nativeName}</div>
                  <div className="text-xs text-gray-500 font-medium">{item.name}</div>
                </div>
                {isSelected ? (
                  <CheckCircle2 className="text-agri-700" size={22} />
                ) : (
                  <ChevronRight className="text-gray-300" size={20} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   LAYOUT & NAVIGATION
   ========================================================================= */

function Layout({ children, onSwitchLanguage }: { children: React.ReactNode; onSwitchLanguage?: () => void }) {
  const { lang, t } = useAppLanguage();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f5ed] text-gray-900">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f7f5ed]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="rounded-2xl bg-agri-700 p-2 text-white shadow-sm">
              <Sprout size={22} />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-agri-700 sm:text-lg">AGRIPRENEURS</div>
              <div className="hidden text-[11px] text-gray-500 sm:block font-medium">
                {t("app_tagline")}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Quick Language Switcher */}
            <button
              onClick={() => setShowLangModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-agri-800 border border-gray-200 shadow-sm hover:bg-agri-50 transition"
              title={t("change_lang")}
            >
              <Globe size={14} className="text-agri-700" />
              <span>{lang.nativeName}</span>
            </button>

            {/* Mobile QR */}
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-agri-50 px-3 py-1.5 text-xs font-bold text-agri-700 border border-agri-200 hover:bg-agri-100 transition shadow-sm"
              title={t("open_mobile")}
            >
              <QrCode size={15} />
              <span className="hidden md:inline">{t("open_mobile")}</span>
            </button>

            {/* Profile */}
            <Link
              to="/profile"
              className="rounded-full bg-white p-2 text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50"
              title={t("nav_profile")}
            >
              <UserRound size={18} />
            </Link>
          </div>
        </div>
      </header>

      {children}

      <OpenOnMobileModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
      <LanguageSelectionModal
        isOpen={showLangModal}
        onClose={() => setShowLangModal(false)}
        onSelect={(l) => {
          if (onSwitchLanguage) onSwitchLanguage();
          setShowLangModal(false);
        }}
      />
    </div>
  );
}

function BottomNav() {
  const { t } = useAppLanguage();
  const location = useLocation();

  const navItems = [
    { path: "/dashboard", label: t("nav_home"), icon: Menu },
    { path: "/crop-prediction", label: "Crops", icon: Wheat },
    { path: "/my-crops", label: t("nav_my_crops"), icon: Leaf },
    { path: "/plant-health", label: t("nav_scan"), icon: Camera },
    { path: "/profile", label: t("nav_profile"), icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-around text-[11px] font-bold text-gray-500">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition ${
                isActive ? "text-agri-700 font-extrabold scale-105" : "hover:text-gray-900"
              }`}
            >
              <Icon size={20} className={isActive ? "text-agri-700" : "text-gray-500"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* =========================================================================
   LOCATION / FARM INFORMATION SETUP COMPONENT (VOICE-FIRST & GPS AWARE)
   ========================================================================= */

function FarmSetupScreen({
  existingFarm,
  onSaveSuccess,
  isInitialSetup = false,
}: {
  existingFarm?: FarmData | null;
  onSaveSuccess: (farm: FarmData) => void;
  isInitialSetup?: boolean;
}) {
  const { lang, t } = useAppLanguage();
  const [state, setState] = useState(existingFarm?.state || "Telangana");
  const [district, setDistrict] = useState(existingFarm?.district || "Medchal-Malkajgiri");
  const [mandal, setMandal] = useState(existingFarm?.mandal || "Ghatkesar");
  const [village, setVillage] = useState(existingFarm?.village || "");
  const [latitude, setLatitude] = useState<number | null>(existingFarm?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(existingFarm?.longitude || null);
  const [landSize, setLandSize] = useState<string>(existingFarm ? String(existingFarm.land_size) : "2.5");
  const [landUnit, setLandUnit] = useState<string>(existingFarm?.land_unit || "acres");
  const [soilType, setSoilType] = useState<string>(existingFarm?.soil_type || "Red Soil");
  const [waterAvailability, setWaterAvailability] = useState<string>(existingFarm?.water_availability || "Medium");

  const [spokenFullAddress, setSpokenFullAddress] = useState("");
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intelligent Spoken Address Parsing for Indian States & Districts
  const handleFullLocationSpoken = (spokenText: string) => {
    setSpokenFullAddress(spokenText);
    const textLower = spokenText.toLowerCase();

    // 1. Detect State
    if (textLower.includes("telangana") || textLower.includes("తెలంగాణ") || textLower.includes("तेलंगाना")) {
      setState("Telangana");
    } else if (textLower.includes("andhra") || textLower.includes("ఆంధ్ర") || textLower.includes("आंध्र")) {
      setState("Andhra Pradesh");
    } else if (textLower.includes("karnataka") || textLower.includes("కర్ణాటక") || textLower.includes("कर्नाटक")) {
      setState("Karnataka");
    } else if (textLower.includes("tamil") || textLower.includes("తమిళ") || textLower.includes("तमिल")) {
      setState("Tamil Nadu");
    } else if (textLower.includes("maharashtra") || textLower.includes("మహారాష్ట్ర") || textLower.includes("महाराष्ट्र")) {
      setState("Maharashtra");
    } else if (textLower.includes("punjab") || textLower.includes("పంజాబ్") || textLower.includes("पंजाब")) {
      setState("Punjab");
    } else if (textLower.includes("uttar pradesh") || textLower.includes("ఉత్తర ప్రదేశ్") || textLower.includes("उत्तर प्रदेश")) {
      setState("Uttar Pradesh");
    }

    // 2. Detect District
    const districtMatches = [
      "medchal", "medchal-malkajgiri", "hyderabad", "rangareddy", "khammam", "nalgonda", "warangal", "adilabad",
      "nizamabad", "karimnagar", "guntur", "kurnool", "anantapur", "krishna", "godavari", "chittoor", "dharwad",
      "belagavi", "coimbatore", "madurai", "pune", "nagpur", "ludhiana", "varanasi"
    ];
    for (const dist of districtMatches) {
      if (textLower.includes(dist)) {
        setDistrict(dist.charAt(0).toUpperCase() + dist.slice(1));
        break;
      }
    }

    // 3. Extract parts if comma separated or worded
    const parts = spokenText.split(/[,،\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      // e.g. "Telangana Medchal Ghatkesar Bogaram"
      setMandal(parts[parts.length - 2]);
      setVillage(parts[parts.length - 1].replace(/village|గ్రామం|गाँव/gi, "").trim());
    } else if (parts.length === 2) {
      setVillage(parts[1].replace(/village|గ్రామం|गाँव/gi, "").trim());
    }
  };

  // Browser Geolocation Detection
  const detectGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setGpsStatus(t("gps_detecting"));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        setGpsLoading(false);
        setGpsStatus(`${t("gps_success")} (${lat.toFixed(4)}, ${lon.toFixed(4)})`);

        // Reverse Geocode client-side via free OSM Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            if (addr.state) setState(addr.state);
            if (addr.state_district || addr.county || addr.district) {
              setDistrict(addr.state_district || addr.county || addr.district);
            }
            if (addr.suburb || addr.town || addr.village || addr.city) {
              setMandal(addr.suburb || addr.town || addr.village || addr.city);
            }
            if (addr.village || addr.hamlet || addr.neighbourhood) {
              setVillage(addr.village || addr.hamlet || addr.neighbourhood);
            }
          }
        } catch (e) {
          console.log("Reverse geocode silent fallback:", e);
        }
      },
      (err) => {
        console.warn("Geolocation denied or error:", err);
        setGpsLoading(false);
        setGpsStatus("Location permission not granted. You can enter below using voice or text.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!state.trim() || !district.trim()) {
      setErrorMsg(t("error_fill_fields"));
      return;
    }

    const payload: FarmData = {
      state: state.trim(),
      district: district.trim(),
      mandal: mandal.trim(),
      village: village.trim(),
      latitude: latitude,
      longitude: longitude,
      land_size: parseFloat(landSize) || 2.0,
      land_unit: landUnit,
      soil_type: soilType,
      water_availability: waterAvailability,
    };

    setSaving(true);
    try {
      const saved = await api<FarmData>("/farms", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSaveSuccess(saved);
    } catch (err: any) {
      console.error("Save farm error:", err);
      // Fallback local persistence so farmer flow is never blocked
      onSaveSuccess(payload);
    } finally {
      setSaving(false);
    }
  };

  const [showVoiceAgent, setShowVoiceAgent] = useState(false);

  const handleVoiceComplete = (vData: VoiceFarmData) => {
    setState(vData.state);
    setDistrict(vData.district);
    if (vData.mandal) setMandal(vData.mandal);
    if (vData.village) setVillage(vData.village);
    if (vData.landSize) setLandSize(vData.landSize);
    if (vData.landUnit) setLandUnit(vData.landUnit);
    if (vData.soilType) setSoilType(vData.soilType);
  };

  return (
    <div className="min-h-screen bg-[#f7f5ed] px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-2xl bg-agri-700 p-3 text-white shadow-md">
            <MapPin size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{t("farm_setup_title")}</h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">{t("farm_setup_sub")}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="my-4 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm font-semibold text-red-700">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* --- KISAN AI VOICE AGENT INTERACTIVE BANNER --- */}
        <div className="my-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner text-white">
              <Bot size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Kisan AI Voice Agent</h3>
                <span className="rounded-full bg-amber-400 text-gray-900 text-[10px] font-black px-2 py-0.5">Voice Q&A</span>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Speak in your language! The AI Voice Agent will ask questions step-by-step and set up your farm automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVoiceAgent(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-50 transition shadow-lg shrink-0 active:scale-95"
          >
            <Mic size={18} className="text-emerald-700 animate-pulse" />
            <span>Start Voice Agent</span>
          </button>
        </div>

        {/* Quick GPS Location Button */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 p-3 border border-gray-200">
          <button
            type="button"
            onClick={detectGpsLocation}
            disabled={gpsLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-agri-700 border border-agri-300 hover:bg-agri-50 transition shadow-sm"
          >
            <MapPin size={15} />
            {gpsLoading ? t("gps_detecting") : t("use_gps_btn")}
          </button>

          {gpsStatus && (
            <span className="text-xs font-semibold text-emerald-700">{gpsStatus}</span>
          )}
        </div>

        {/* --- CLEAN MANUAL FORM --- */}
        <form onSubmit={handleSaveFarm} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* State */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("state_label")} *
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder={t("state_placeholder")}
                required
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
              />
            </div>

            {/* District */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("district_label")} *
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t("district_placeholder")}
                required
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
              />
            </div>

            {/* Mandal */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("mandal_label")}
              </label>
              <input
                type="text"
                value={mandal}
                onChange={(e) => setMandal(e.target.value)}
                placeholder={t("mandal_placeholder")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
              />
            </div>

            {/* Village */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("village_label")}
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder={t("village_placeholder")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
              />
            </div>
          </div>

          {/* Land Size & Unit */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("land_size_label")}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={landSize}
                  onChange={(e) => setLandSize(e.target.value)}
                  placeholder={t("land_size_placeholder")}
                  className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
                />
                <select
                  value={landUnit}
                  onChange={(e) => setLandUnit(e.target.value)}
                  className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50 font-bold text-gray-800"
                >
                  <option value="acres">{t("unit_acres")}</option>
                  <option value="guntas">{t("unit_guntas")}</option>
                  <option value="bighas">{t("unit_bighas")}</option>
                  <option value="hectares">{t("unit_hectares")}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("soil_type_label")}
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900 bg-white"
              >
                <option value="Red Soil">{t("soil_red")}</option>
                <option value="Black Soil">{t("soil_black")}</option>
                <option value="Alluvial Soil">{t("soil_alluvial")}</option>
                <option value="Clay Soil">{t("soil_clay")}</option>
                <option value="Sandy Soil">{t("soil_sandy")}</option>
                <option value="Laterite Soil">{t("soil_laterite")}</option>
                <option value="I don't know my soil type">{t("soil_dont_know")}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 rounded-2xl bg-agri-700 py-4 font-bold text-white shadow-lg transition hover:bg-agri-800 disabled:opacity-50 flex items-center justify-center gap-2 text-base"
          >
            {saving ? (
              <span>{t("saving_farm")}</span>
            ) : (
              <>
                <span>{t("save_farm_btn")}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <KisanVoiceAgentModal
          isOpen={showVoiceAgent}
          onClose={() => setShowVoiceAgent(false)}
          onComplete={handleVoiceComplete}
          initialData={{ state, district, mandal, village, landSize, landUnit, soilType }}
          mode="farm_setup"
        />
      </div>
    </div>
  );
}

/* =========================================================================
   CROP PREDICTION & EXPLAINABLE RECOMMENDATION WORKFLOW
   ========================================================================= */

function CropPredictionPage({ farm, onUpdateFarm }: { farm: FarmData | null; onUpdateFarm: (f: FarmData) => void }) {
  const { lang, t } = useAppLanguage();
  const navigate = useNavigate();

  // Inputs
  const [landSize, setLandSize] = useState<string>(farm ? String(farm.land_size) : "2.5");
  const [landUnit, setLandUnit] = useState<string>(farm?.land_unit || "acres");
  const [soilType, setSoilType] = useState<string>(farm?.soil_type || "Red Soil");
  const [season, setSeason] = useState<string>("Kharif");
  const [previousCrop, setPreviousCrop] = useState<string>("");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  // Weather state
  const [weatherData, setWeatherData] = useState<{ temp: number; humidity: number; rain: number; status: string } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Recommendation results state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CropRecommendationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<"helpful" | "partly_helpful" | "not_helpful" | "">("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  // Q&A / Voice Interaction state
  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([]);

  const [showVoiceAgent, setShowVoiceAgent] = useState(false);

  // Auto-fetch weather based on farm coordinates or district centroid
  useEffect(() => {
    let lat = farm?.latitude || 17.44;
    let lon = farm?.longitude || 78.68;

    // Approximate fallback coords for key Indian agricultural states if null
    const st = (farm?.state || "").toLowerCase();
    if (!farm?.latitude) {
      if (st.includes("andhra")) { lat = 16.30; lon = 80.43; }
      else if (st.includes("karnataka")) { lat = 15.36; lon = 75.12; }
      else if (st.includes("maharashtra")) { lat = 19.75; lon = 75.71; }
      else if (st.includes("punjab")) { lat = 31.14; lon = 75.34; }
      else if (st.includes("tamil")) { lat = 11.12; lon = 78.65; }
    }

    setLoadingWeather(true);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain&timezone=auto`)
      .then((res) => res.json())
      .then((data) => {
        const cur = data.current || {};
        setWeatherData({
          temp: cur.temperature_2m || 28.5,
          humidity: cur.relative_humidity_2m || 65,
          rain: cur.precipitation || cur.rain || 0.0,
          status: "Live Open-Meteo Weather"
        });
      })
      .catch(() => {
        setWeatherData({ temp: 28.0, humidity: 65, rain: 0.0, status: "Agro-climatic normal" });
      })
      .finally(() => setLoadingWeather(false));
  }, [farm]);

  // Execute Crop Recommendation
  const runPrediction = async (overrideData?: Partial<VoiceFarmData>) => {
    setLoading(true);
    setErrorMessage(null);

    const finalState = overrideData?.state || farm?.state || "Telangana";
    const finalDistrict = overrideData?.district || farm?.district || "Medchal-Malkajgiri";
    const finalMandal = overrideData?.mandal || farm?.mandal || "Ghatkesar";
    const finalVillage = overrideData?.village || farm?.village || "";
    const finalLandSize = parseFloat(overrideData?.landSize || landSize) || 2.0;
    const finalLandUnit = overrideData?.landUnit || landUnit;
    const finalSoilType = overrideData?.soilType || soilType;
    const finalSeason = overrideData?.season || season;
    const finalPrevCrop = overrideData?.previousCrop !== undefined ? overrideData.previousCrop : previousCrop;

    const payload = {
      farm_id: farm?.id || null,
      state: finalState,
      district: finalDistrict,
      mandal: finalMandal,
      village: finalVillage,
      land_size: finalLandSize,
      land_unit: finalLandUnit,
      soil_type: finalSoilType,
      season: finalSeason,
      previous_crop: finalPrevCrop || null,
      weather_summary: {
        temperature: weatherData?.temp || 28.0,
        humidity: weatherData?.humidity || 65.0,
        rainfall: weatherData?.rain || 180.0,
      },
      technical_features: {},
    };

    try {
      const data = await api<CropRecommendationResult>("/recommendations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(data);
      setFeedbackRating("");
      setFeedbackComment("");
      setFeedbackStatus("");
      setFeedbackError("");

      // Scroll to result smoothly
      setTimeout(() => {
        window.scrollTo({ top: 550, behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Crop recommendation API error:", err);
      setErrorMessage(t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!result || !feedbackRating) return;
    setFeedbackSaving(true);
    setFeedbackError("");
    try {
      const response = await api<{ message: string }>("/recommendation-feedback", {
        method: "POST",
        body: JSON.stringify({
          recommendation_id: result.recommendation_id,
          crop: result.prediction,
          model_version: result.model_version,
          rating: feedbackRating,
          comment: feedbackComment,
        }),
      });
      setFeedbackStatus(response.message);
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Feedback could not be saved. Please try again.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleVoiceAgentComplete = (vData: VoiceFarmData, autoSubmit = true) => {
    setLandSize(vData.landSize);
    setLandUnit(vData.landUnit);
    setSoilType(vData.soilType);
    setSeason(vData.season);
    if (vData.previousCrop) setPreviousCrop(vData.previousCrop);

    if (autoSubmit) {
      runPrediction(vData);
    }
  };

  // Ask Crop Assistant Q&A
  const askQuestion = async (customQ?: string) => {
    const queryText = (customQ || question).trim();
    if (!queryText) return;

    setQaLoading(true);
    try {
      const res = await api<{ answer: string; message?: string }>("/ai/ask", {
        method: "POST",
        body: JSON.stringify({
          farm_id: farm?.id || 1,
          message: queryText,
          language: lang.code,
        }),
      });

      const ans = res.answer || res.message || "Agronomic guidance generated.";
      setQaHistory((prev) => [{ q: queryText, a: ans }, ...prev]);
      setQuestion("");
    } catch (err: any) {
      console.error("AI Ask error:", err);
      const errorMessage = err instanceof Error ? err.message : "The assistant is unavailable.";
      setQaHistory((prev) => [{ q: queryText, a: `Could not retrieve verified guidance: ${errorMessage}` }, ...prev]);
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">{t("crop_prediction_title")}</h1>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">{t("crop_prediction_sub")}</p>
          </div>
        </div>

        {/* --- KISAN AI VOICE AGENT INTERACTIVE BANNER --- */}
        <div className="my-5 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-xl border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner text-white">
              <Bot size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Interactive Kisan AI Voice Agent</h3>
                <span className="rounded-full bg-amber-400 text-gray-900 text-[10px] font-black px-2 py-0.5">Hands-Free</span>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-1">
                No typing required! The Voice Agent speaks out questions and generates explainable crop recommendations by voice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVoiceAgent(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-50 transition shadow-lg shrink-0 active:scale-95"
          >
            <Mic size={20} className="text-emerald-700 animate-pulse" />
            <span>Talk to Voice Agent</span>
          </button>
        </div>

        {/* --- FARM LOCATION BADGE CARD --- */}
        <div className="my-5 rounded-3xl bg-white p-5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-agri-100 p-2.5 text-agri-700">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("farm_location_card_title")}</p>
              <p className="text-base font-extrabold text-gray-900">
                {[farm?.village, farm?.mandal, farm?.district, farm?.state].filter(Boolean).join(", ") || "Telangana, Medchal-Malkajgiri"}
              </p>
            </div>
          </div>
          <button
            onClick={() => onUpdateFarm(farm || ({} as any))}
            className="text-xs font-bold text-agri-700 bg-agri-50 hover:bg-agri-100 px-3 py-1.5 rounded-full border border-agri-200 transition"
          >
            {t("edit_farm")}
          </button>
        </div>

        {/* --- LIVE WEATHER WIDGET --- */}
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 p-5 border border-sky-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CloudSun className="text-sky-600" size={22} />
              <span className="font-extrabold text-sky-900 text-sm">{t("weather_card_title")}</span>
            </div>
            <span className="rounded-full bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-900">
              {weatherData?.status || t("weather_live")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/80 p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-500">{t("weather_temp")}</p>
              <p className="text-lg font-black text-gray-900">{weatherData ? `${weatherData.temp.toFixed(1)}°C` : "28°C"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-500">{t("weather_humidity")}</p>
              <p className="text-lg font-black text-gray-900">{weatherData ? `${weatherData.humidity}%` : "65%"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-500">{t("weather_rain")}</p>
              <p className="text-lg font-black text-gray-900">{weatherData ? `${weatherData.rain} mm` : "Normal"}</p>
            </div>
          </div>
        </div>

        {/* --- INPUT FORM --- */}
        <div className="space-y-4">
          {/* Land Size */}
          <div className="touch-card bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <label className="block text-sm font-bold text-gray-800 mb-2">{t("land_size_label")}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={landSize}
                onChange={(e) => setLandSize(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-bold text-gray-900 text-lg"
              />
              <select
                value={landUnit}
                onChange={(e) => setLandUnit(e.target.value)}
                className="rounded-2xl border border-gray-200 p-3.5 bg-gray-50 font-bold text-gray-800"
              >
                <option value="acres">{t("unit_acres")}</option>
                <option value="guntas">{t("unit_guntas")}</option>
                <option value="bighas">{t("unit_bighas")}</option>
                <option value="hectares">{t("unit_hectares")}</option>
              </select>
            </div>
          </div>

          {/* Soil Type Selection + "I Don't Know" Option */}
          <div className="touch-card bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <label className="block text-sm font-bold text-gray-800 mb-2">{t("soil_type_label")}</label>
            <select
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-bold text-gray-900 bg-white"
            >
              <option value="Red Soil">{t("soil_red")}</option>
              <option value="Black Soil">{t("soil_black")}</option>
              <option value="Alluvial Soil">{t("soil_alluvial")}</option>
              <option value="Clay Soil">{t("soil_clay")}</option>
              <option value="Sandy Soil">{t("soil_sandy")}</option>
              <option value="Laterite Soil">{t("soil_laterite")}</option>
              <option value="I don't know my soil type">{t("soil_dont_know")}</option>
            </select>

            {soilType === "I don't know my soil type" && (
              <div className="mt-3 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Info size={16} />
                  <span>{t("soil_estimated_badge")}</span>
                </div>
                <p className="mt-1 leading-relaxed text-amber-900/90">{t("soil_estimated_note")}</p>
              </div>
            )}
          </div>

          {/* Season Selection */}
          <div className="touch-card bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <label className="block text-sm font-bold text-gray-800 mb-2">{t("season_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {["Kharif", "Rabi", "Summer"].map((s) => {
                const isSelected = season === s;
                const labelKey = s === "Kharif" ? "season_kharif" : s === "Rabi" ? "season_rabi" : "season_summer";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeason(s)}
                    className={`rounded-2xl py-3 px-2 text-xs font-extrabold transition text-center ${
                      isSelected
                        ? "bg-agri-700 text-white shadow-md shadow-agri-700/20 ring-2 ring-agri-700"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Previous Crop (Optional) */}
          <div className="touch-card bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <label className="block text-sm font-bold text-gray-800 mb-2">{t("previous_crop_label")}</label>
            <input
              type="text"
              value={previousCrop}
              onChange={(e) => setPreviousCrop(e.target.value)}
              placeholder={t("previous_crop_placeholder")}
              className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-semibold text-gray-900"
            />
          </div>

          {/* Additional Farm Observations */}
          <div className="touch-card bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <label className="block text-sm font-bold text-gray-800 mb-2">{t("additional_notes_label")}</label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={t("additional_notes_placeholder")}
              className="w-full rounded-2xl border border-gray-200 p-3 outline-none focus:border-agri-700 font-medium text-gray-900 text-sm min-h-20"
            />
          </div>

          {/* Error notice if any */}
          {errorMessage && (
            <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-sm font-semibold text-red-700">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="button"
            onClick={() => runPrediction()}
            disabled={loading}
            className="w-full rounded-2xl bg-agri-700 py-4 font-black text-white shadow-xl hover:bg-agri-800 transition disabled:opacity-50 text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>{t("finding_crops")}</span>
            ) : (
              <>
                <Sparkles size={20} />
                <span>{t("find_crops_btn")}</span>
              </>
            )}
          </button>
        </div>

        {/* Floating Voice Agent Action Button */}
        <button
          type="button"
          onClick={() => setShowVoiceAgent(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-emerald-700 text-white px-4 py-3 shadow-2xl hover:bg-emerald-800 border-2 border-white ring-4 ring-emerald-600/20 transition active:scale-95 animate-bounce"
          title="Talk to AI Voice Agent"
        >
          <Bot size={22} />
          <span className="text-xs font-black">AI Voice Agent</span>
        </button>

        <KisanVoiceAgentModal
          isOpen={showVoiceAgent}
          onClose={() => setShowVoiceAgent(false)}
          onComplete={handleVoiceAgentComplete}
          initialData={{
            state: farm?.state || "Telangana",
            district: farm?.district || "Medchal-Malkajgiri",
            mandal: farm?.mandal || "Ghatkesar",
            village: farm?.village || "",
            landSize,
            landUnit,
            soilType,
            season,
            previousCrop,
          }}
          mode="crop_recommendation"
        />

        {/* =========================================================================
            RECOMMENDATION RESULTS WITH EXPLANATIONS
            ========================================================================= */}
        {result && (
          <div className="mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
            {/* 1. INPUTS USED SUMMARY */}
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3 text-agri-800">
                <Info size={18} />
                <h3 className="font-extrabold text-sm">{t("inputs_used_title")}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase">Location</p>
                  <p className="font-bold text-gray-800 mt-0.5">{result.inputs_used?.location || [farm?.district, farm?.state].filter(Boolean).join(", ")}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase">Land Size</p>
                  <p className="font-bold text-gray-800 mt-0.5">{result.inputs_used?.land_size || `${landSize} ${landUnit}`}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase">Soil Type</p>
                  <p className="font-bold text-gray-800 mt-0.5">{result.inputs_used?.soil_type || soilType}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase">Season</p>
                  <p className="font-bold text-gray-800 mt-0.5">{result.inputs_used?.season || season}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 sm:col-span-2">
                  <p className="text-gray-400 font-bold uppercase">Weather</p>
                  <p className="font-bold text-gray-800 mt-0.5">{result.inputs_used?.weather || `${weatherData?.temp || 28}°C, ${weatherData?.humidity || 65}% Humidity`}</p>
                </div>
              </div>
            </div>

            {/* 2. PRIMARY RECOMMENDED CROP CARD */}
            <div className="rounded-[2.5rem] bg-gradient-to-b from-agri-700 to-agri-900 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-extrabold backdrop-blur-md">
                    <Sparkles size={14} className="text-yellow-300" />
                    {result.suitability_label || "High Suitability"}
                  </span>
                  <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">{result.prediction}</h2>
                  <p className="mt-1 text-xs text-green-200 font-semibold">{result.model_version}</p>
                </div>

                <ListenButton
                  text={`Recommended crop is ${result.prediction}. Suitability is ${result.suitability_label}. ${result.reason}`}
                  className="bg-white text-agri-800 border-none shadow-md hover:bg-white/90"
                />
              </div>

              {/* WHY THIS CROP EXPLANATION LIST */}
              <div className="mt-6 rounded-3xl bg-white/10 p-5 backdrop-blur-md border border-white/10">
                <h4 className="font-black text-base text-yellow-200 flex items-center gap-2">
                  <span>💡</span> {t("why_this_crop_title")}
                </h4>
                <ul className="mt-3 space-y-2.5 text-xs sm:text-sm text-green-50 font-medium">
                  {result.reasons_breakdown && result.reasons_breakdown.length > 0 ? (
                    result.reasons_breakdown.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-300 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))
                  ) : (
                    <li className="leading-relaxed">{result.reason}</li>
                  )}
                </ul>
              </div>

              {/* SHAP / FEATURE INFLUENCE BARS */}
              {result.shap && result.shap.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/10">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-green-200 mb-3">
                    {t("feature_importance_title")}
                  </p>
                  <div className="space-y-2">
                    {result.shap.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-green-100 truncate w-40">{s.feature}</span>
                        <div className="flex-1 bg-white/10 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-300 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(15, s.contribution * 100))}%` }}
                          />
                        </div>
                        <span className="font-bold text-white text-[11px] w-12 text-right">
                          {Math.round(s.contribution * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. ALTERNATIVE SUITABLE CROPS */}
            {result.suitable_crops && result.suitable_crops.length > 1 && (
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">{t("alternative_crops_title")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.suitable_crops.slice(1).map((alt, idx) => (
                    <div key={idx} className="rounded-2xl bg-gray-50 p-4 border border-gray-200/70">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-base text-gray-900">🌾 {alt.crop}</h4>
                        <span className="rounded-full bg-agri-100 px-2.5 py-0.5 text-[10px] font-extrabold text-agri-800">
                          {alt.suitability_label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600 font-medium leading-relaxed">{alt.why}</p>
                      <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] text-gray-500 flex flex-col gap-1">
                        <div><strong className="text-gray-700">{t("water_req_label")}:</strong> {alt.water_requirement}</div>
                        <div><strong className="text-gray-700">{t("risk_label")}:</strong> {alt.risk_factor}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="rounded-3xl border border-agri-200 bg-white p-6 shadow-sm" aria-labelledby="recommendation-feedback-title">
              <h3 id="recommendation-feedback-title" className="text-lg font-black text-gray-900">How useful was this recommendation?</h3>
              <p className="mt-1 text-sm text-gray-600">Your feedback helps the team review and improve future recommendations.</p>
              {feedbackStatus ? (
                <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                  {feedbackStatus}
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {([
                      ["helpful", "Helpful"],
                      ["partly_helpful", "Somewhat helpful"],
                      ["not_helpful", "Not helpful"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={feedbackRating === value}
                        onClick={() => setFeedbackRating(value)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                          feedbackRating === value
                            ? "border-agri-700 bg-agri-700 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-agri-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="recommendation-feedback-comment" className="mt-4 block text-sm font-bold text-gray-800">
                    Optional note
                  </label>
                  <textarea
                    id="recommendation-feedback-comment"
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value.slice(0, 1000))}
                    maxLength={1000}
                    rows={3}
                    placeholder="Tell us what worked well or what could be improved."
                    className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-agri-700"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-xl text-xs text-gray-500">
                      Feedback is saved for human review. It does not update farm data or retrain the model automatically.
                    </p>
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={!feedbackRating || feedbackSaving}
                      className="rounded-xl bg-agri-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {feedbackSaving ? "Sending..." : "Send feedback"}
                    </button>
                  </div>
                  {feedbackError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{feedbackError}</p>}
                </>
              )}
            </section>

            {/* 4. INTERACTIVE VOICE & TEXT Q&A ("ASK CROP ASSISTANT") */}
            <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-xl border border-agri-200">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <MessageCircle className="text-agri-700" size={22} />
                    {t("ask_ai_title")}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 font-medium">{t("ask_ai_sub")}</p>
                </div>
                <VoiceInput size="md" onText={(txt) => { setQuestion(txt); askQuestion(txt); }} />
              </div>

              {/* Quick Question Chips */}
              <div className="my-4 flex flex-wrap gap-2">
                {[
                  t("q_why_suitable"),
                  t("q_why_not_cotton"),
                  t("q_less_water"),
                  t("q_season_crops"),
                  t("q_risks"),
                ].map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => askQuestion(q)}
                    className="rounded-full bg-agri-50 px-3.5 py-1.5 text-xs font-bold text-agri-800 border border-agri-200 hover:bg-agri-100 transition shadow-xs"
                  >
                    💬 {q}
                  </button>
                ))}
              </div>

              {/* Text Input + Mic Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                  placeholder={t("ask_placeholder")}
                  className="flex-1 rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 font-medium text-sm"
                />
                <button
                  type="button"
                  onClick={() => askQuestion()}
                  disabled={qaLoading || !question.trim()}
                  className="rounded-2xl bg-agri-700 px-5 font-bold text-white shadow-md hover:bg-agri-800 disabled:opacity-50 text-sm"
                >
                  {qaLoading ? t("asking") : t("ask_btn")}
                </button>
              </div>

              {/* Q&A Conversation History */}
              {qaHistory.length > 0 && (
                <div className="mt-5 space-y-3 pt-4 border-t border-gray-100">
                  {qaHistory.map((item, idx) => (
                    <div key={idx} className="rounded-2xl bg-agri-50/70 p-4 border border-agri-100 space-y-2">
                      <p className="text-xs font-black text-agri-900 flex items-center gap-1.5">
                        <span>❓</span> {item.q}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-800 font-medium whitespace-pre-line leading-relaxed">
                        {item.a}
                      </p>
                      <div className="pt-2">
                        <ListenButton text={item.a} label={t("listen_answer")} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </Layout>
  );
}

/* =========================================================================
   DASHBOARD / HOME PAGE
   ========================================================================= */

function Dashboard({ farm, onUpdateFarm }: { farm: FarmData | null; onUpdateFarm: () => void }) {
  const { lang, t } = useAppLanguage();
  const navigate = useNavigate();

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
        {/* Banner Hero */}
        <section className="rounded-[2.5rem] bg-agri-700 px-6 py-8 sm:px-10 sm:py-10 text-white shadow-xl">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-green-100 backdrop-blur">
              {lang.nativeName} • {t("app_tagline")}
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black leading-tight">
              Smarter Decisions. Sustainable Farming.
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-green-50 font-medium leading-relaxed">
              Tell us about your farm using simple words or your voice. Get explainable crop recommendations, weather guidance, and plant health support in your preferred language.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/crop-prediction")}
                className="rounded-2xl bg-white px-5 py-3 font-extrabold text-agri-700 shadow-md hover:bg-green-50 transition"
              >
                🌾 {t("crop_prediction_title")}
              </button>
              <button
                onClick={onUpdateFarm}
                className="rounded-2xl border border-white/40 px-4 py-3 font-bold text-white hover:bg-white/10 transition"
              >
                🏡 {t("edit_farm")}
              </button>
            </div>
          </div>
        </section>

        {/* Farm Location Header Bar */}
        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-agri-100 p-3 text-agri-700">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("farm_location_card_title")}</p>
              <p className="text-base font-extrabold text-gray-900">
                {[farm?.village, farm?.mandal, farm?.district, farm?.state].filter(Boolean).join(", ") || "Telangana, Medchal-Malkajgiri"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/crop-prediction")}
            className="rounded-2xl bg-agri-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm hover:bg-agri-800 transition"
          >
            {t("find_crops_btn")}
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleCard
            icon={<Wheat />}
            title={t("crop_prediction_title")}
            description="Find suitable crops using your farm context and explainable AI."
            onClick={() => navigate("/crop-prediction")}
          />
          <ModuleCard
            icon={<ScanLine />}
            title="Check Pesticide"
            description="Scan a product and search verified agricultural knowledge for alternatives."
            onClick={() => navigate("/pesticide")}
          />
          <ModuleCard
            icon={<Leaf />}
            title={t("nav_my_crops")}
            description="Track crop stage, weather and personalized crop-care guidance."
            onClick={() => navigate("/my-crops")}
          />
          <ModuleCard
            icon={<Camera />}
            title="Plant Health Scan"
            description="Analyze plant images with a CNN disease detection workflow."
            onClick={() => navigate("/plant-health")}
          />
        </div>
      </main>
      <BottomNav />
    </Layout>
  );
}

/* =========================================================================
   AUTH SCREEN (LOGIN / REGISTER)
   ========================================================================= */

function AuthScreen({
  onAuthSuccess,
  onSwitchLanguage,
}: {
  onAuthSuccess: (user: any) => void;
  onSwitchLanguage: () => void;
}) {
  const { lang, t } = useAppLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateMobile = (num: string) => {
    const clean = num.replace(/\D/g, "");
    const trimmed = clean.startsWith("91") && clean.length === 12 ? clean.slice(2) : clean;
    return /^[6-9]\d{9}$/.test(trimmed);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mobileNumber.trim()) {
      setError(t("enter_mobile"));
      return;
    }
    if (!validateMobile(mobileNumber)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!password) {
      setError(t("enter_password"));
      return;
    }

    setLoading(true);
    try {
      const res = await api<{ access_token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          mobile_number: mobileNumber,
          password: password,
        }),
      });
      setAuthToken(res.access_token);
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Invalid mobile number or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError(t("enter_full_name"));
      return;
    }
    if (!mobileNumber.trim()) {
      setError(t("enter_mobile"));
      return;
    }
    if (!validateMobile(mobileNumber)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!password || password.length < 6) {
      setError(t("enter_password"));
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    try {
      const res = await api<{ access_token: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          mobile_number: mobileNumber,
          password: password,
          confirm_password: confirmPassword,
        }),
      });
      setAuthToken(res.access_token);
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5ed] px-4 py-8">
      {/* Top Language Bar */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onSwitchLanguage}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-agri-800 border border-gray-200 shadow-sm hover:bg-agri-50 transition"
        >
          <Globe size={15} className="text-agri-700" />
          <span>Language: {lang.nativeName} ({lang.name})</span>
          <span className="text-agri-600 font-extrabold underline ml-1">Change</span>
        </button>
      </div>

      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl border border-gray-100">
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <div className="rounded-2xl bg-agri-700 p-3.5 text-white shadow-md">
            <Sprout size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-agri-700">AGRIPRENEURS</h1>
          <p className="text-xs font-medium text-gray-500 max-w-xs">{t("app_tagline")}</p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-red-50 p-4 border border-red-200 text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {!isRegister ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">{t("login_title")}</h2>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("mobile_number")}</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 font-bold text-gray-500 text-sm border-r border-gray-300 pr-2">+91</span>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder={t("enter_mobile")}
                  maxLength={10}
                  className="w-full rounded-2xl border border-gray-200 py-3.5 pl-16 pr-4 outline-none focus:border-agri-700 text-gray-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("enter_password")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 text-gray-900 font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-agri-700 py-4 font-extrabold text-white shadow-lg transition hover:bg-agri-800 disabled:opacity-50"
            >
              {loading ? t("logging_in") : t("login_btn")}
            </button>

            <div className="mt-6 text-center text-xs font-semibold text-gray-600">
              {t("dont_have_account")}{" "}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className="font-extrabold text-agri-700 underline hover:text-agri-800 ml-1"
              >
                {t("create_account_here")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">{t("create_account_title")}</h2>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("full_name")}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("enter_full_name")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 text-gray-900 font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("mobile_number")}</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 font-bold text-gray-500 text-sm border-r border-gray-300 pr-2">+91</span>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder={t("enter_mobile")}
                  maxLength={10}
                  className="w-full rounded-2xl border border-gray-200 py-3.5 pl-16 pr-4 outline-none focus:border-agri-700 text-gray-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("enter_password")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 text-gray-900 font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-700">{t("confirm_password")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("enter_confirm_password")}
                className="w-full rounded-2xl border border-gray-200 p-3.5 outline-none focus:border-agri-700 text-gray-900 font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-agri-700 py-4 font-extrabold text-white shadow-lg transition hover:bg-agri-800 disabled:opacity-50"
            >
              {loading ? t("registering") : t("register_btn")}
            </button>

            <div className="mt-6 text-center text-xs font-semibold text-gray-600">
              {t("already_have_account")}{" "}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className="font-extrabold text-agri-700 underline hover:text-agri-800 ml-1"
              >
                {t("login_here")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   SUPPORTING APP SCREENS (PESTICIDE, PLANT HEALTH, PROFILE, MY CROPS)
   ========================================================================= */

function Pesticide() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addFiles = (selected: FileList | null) => {
    if (!selected?.length) return;
    const combined = [...files, ...Array.from(selected)];
    if (combined.length > 2) {
      setErrorMessage("Upload no more than two label images per scan.");
    } else {
      setErrorMessage(null);
      setFiles(combined);
      setResult(null);
    }
  };

  const scan = async () => {
    if (!files.length) return;
    setLoading(true);
    setErrorMessage(null);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    try {
      const response = await api<any>("/pesticide/scan", {
        method: "POST",
        body: form,
      });
      setResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Pesticide identification service is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">
        <h1 className="text-3xl font-black">🧴 Check Pesticide</h1>
        <p className="mt-2 text-gray-600">
          Upload clear product and ingredient labels. A match is shown only when the image text matches the configured verified catalog.
        </p>

        <div className="mt-6 touch-card bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-xl bg-agri-50 px-4 py-3 text-sm font-bold text-agri-800">
              Take label photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
            <label className="cursor-pointer rounded-xl bg-agri-50 px-4 py-3 text-sm font-bold text-agri-800">
              Choose label images
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-3 flex items-start justify-between gap-3 text-sm text-gray-600">
              <span>{files.map((file) => file.name).join(", ")}</span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setResult(null);
                  setErrorMessage(null);
                }}
                className="font-bold text-red-700"
              >
                Clear
              </button>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
          <button onClick={scan} disabled={!files.length || loading} className="primary-btn mt-5 w-full disabled:opacity-50">
            {loading ? "Reading label..." : "Scan Label"}
          </button>
        </div>

        {result && (
          <div className="mt-5 space-y-4">
            <div className="touch-card bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-700" /> Verified Agricultural Match
                  </span>
                  <p className="mt-2 text-sm text-gray-600 font-medium">{result.message}</p>
                </div>
                <ListenButton
                  text={`${result.verified_product?.name || "Product"}. Used for ${(result.target_crops || result.verified_product?.target_crops || ["vegetables", "field crops"]).slice(0, 4).join(", ")}. Best alternative is ${result.alternatives?.[0]?.name || "organic neem extract"}.`}
                  className="bg-agri-50 text-agri-800 border border-agri-200"
                />
              </div>

              {result.verified_product && (
                <div className="mt-5 space-y-5">
                  {/* 1. WHAT IS ITS NAME */}
                  <div className="rounded-2xl bg-gray-50/80 p-4 border border-gray-200/80">
                    <div className="flex items-center gap-2 text-sm font-black text-gray-900">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-agri-700 text-xs text-white">1</span>
                      <h3>What is its name & composition?</h3>
                    </div>
                    <div className="mt-3 pl-8 space-y-1.5 text-sm text-gray-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-black text-gray-900">{result.verified_product.name}</span>
                        {result.verified_product.category && (
                          <span className="rounded-full bg-agri-100 px-2.5 py-0.5 text-xs font-bold text-agri-800">
                            {result.verified_product.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong className="text-gray-800">Active Ingredients:</strong>{" "}
                        {(result.verified_product.active_ingredients || []).join(", ") || "Identified formulation"}
                      </p>
                      {result.verified_product.source_url && (
                        <p className="text-xs text-gray-500 pt-1">
                          <strong>Official Source:</strong>{" "}
                          <a className="text-agri-700 underline font-semibold" href={result.verified_product.source_url} target="_blank" rel="noreferrer">
                            {result.verified_product.source_name || "CIBRC / PPQS Government Registry"}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2. WHAT PLANTS / CROPS IS IT USED FOR */}
                  <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-100">
                    <div className="flex items-center gap-2 text-sm font-black text-blue-950">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs text-white">2</span>
                      <h3>What plants & crops is it used for?</h3>
                    </div>
                    <div className="mt-3 pl-8 space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Target Crops & Plants</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(result.target_crops || result.verified_product.target_crops || ["Vegetables", "Field Crops", "Garden Plants"]).map((crop: string, i: number) => (
                            <span key={i} className="rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-gray-800 shadow-xs border border-blue-200">
                              🌱 {crop}
                            </span>
                          ))}
                        </div>
                      </div>

                      {(result.target_pests || result.verified_product.target_pests)?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Target Pests & Conditions Treated</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(result.target_pests || result.verified_product.target_pests).map((pest: string, i: number) => (
                              <span key={i} className="rounded-xl bg-blue-100/70 px-2.5 py-1 text-xs font-medium text-blue-900">
                                🪲 {pest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.verified_product.safety_guidelines && (
                        <p className="text-xs text-blue-900 bg-white/70 p-2.5 rounded-xl border border-blue-200">
                          <strong>⚠️ Safe Application:</strong> {result.verified_product.safety_guidelines}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3. WHAT IS THE BEST ALTERNATIVE */}
                  <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-200">
                    <div className="flex items-center gap-2 text-sm font-black text-emerald-950">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs text-white">3</span>
                      <h3>What is the best alternative for this pesticide?</h3>
                    </div>
                    <div className="mt-3 pl-8 space-y-3">
                      {result.alternatives?.length > 0 ? (
                        result.alternatives.map((alt: any, index: number) => (
                          <div key={index} className="rounded-2xl bg-white p-4 shadow-xs border border-emerald-100 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-black text-emerald-900 text-sm">
                                {index === 0 ? "🌟 Best Recommended Alternative: " : "🌿 Alternative: "}
                                {alt.name}
                              </h4>
                              {index === 0 && (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                  Top Bio-Choice
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed font-medium">{alt.explanation}</p>
                            {alt.how_to_use && (
                              <p className="text-xs text-emerald-900 bg-emerald-50/80 p-2 rounded-xl font-medium">
                                <strong>📋 How to use:</strong> {alt.how_to_use}
                              </p>
                            )}
                            {alt.source_url && (
                              <p className="text-[11px] text-gray-500 pt-1">
                                <a className="text-emerald-700 underline font-semibold" href={alt.source_url} target="_blank" rel="noreferrer">
                                  Evidence Source Documentation ↗
                                </a>
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-600">No verified sustainable alternative was found in current knowledge base.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.extracted_text && (
                <details className="mt-5 border-t border-gray-100 pt-4">
                  <summary className="cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-800">
                    🔍 Raw OCR text detected from bottle label
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-700">{result.extracted_text}</pre>
                </details>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </Layout>
  );
}

function PlantHealth() {
  const { t } = useAppLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
    setErrorMsg(null);
    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);
    const form = new FormData();
    form.append("file", file);

    try {
      const response = await api<any>("/disease/predict", {
        method: "POST",
        body: form,
      });
      setResult(response);
    } catch (e: any) {
      console.error("Disease predict error:", e);
      setErrorMsg(e instanceof Error ? e.message : "Unable to analyze image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-2xl bg-agri-700 p-3 text-white shadow-md">
            <Camera size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Plant Health Scan & AI Diagnosis</h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Upload a clear photo for model-based screening. Results are preliminary; the app will not guess if the model is unavailable.
            </p>
          </div>
        </div>

        {/* Upload Card */}
        <div className="mt-6 touch-card bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-agri-600 transition bg-gray-50/50">
            {previewUrl ? (
              <div className="relative flex flex-col items-center">
                <img
                  src={previewUrl}
                  alt="Leaf preview"
                  className="h-56 w-56 rounded-2xl object-cover shadow-md border-2 border-white ring-4 ring-agri-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setResult(null);
                  }}
                  className="mt-3 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-300 transition"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-agri-100 text-agri-700">
                  <Camera size={32} />
                </div>
                <p className="text-sm font-bold text-gray-800">Choose leaf photo or take a photo</p>
                <p className="mt-1 text-xs text-gray-500">Supports JPG, PNG, WEBP (Max 10MB)</p>
                <label className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-agri-700 px-5 py-2.5 text-xs font-black text-white hover:bg-agri-800 transition shadow-md">
                  <span>Browse File / Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm font-semibold text-red-700">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            onClick={scan}
            disabled={!file || loading}
            className="mt-6 w-full rounded-2xl bg-agri-700 py-4 font-black text-white shadow-xl hover:bg-agri-800 transition disabled:opacity-50 text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>Analyzing Plant Leaf with AI Vision...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Analyze Plant & Get Treatment</span>
              </>
            )}
          </button>
        </div>

        {/* Diagnosis Results */}
        {result && (
          <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Main Diagnosis Card */}
            <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-xl border border-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">
                      {result.crop || "Plant Leaf"}
                    </span>
                    <span className="rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold">
                      Preliminary model result
                    </span>
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-gray-900">
                    {result.prediction || result.condition || "Leaf Health Analysis"}
                  </h2>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black text-agri-700">
                    {`${result.confidence_percentage}%`}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Model confidence</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-gray-700">{result.message}</p>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {result.treatment_message || "No verified crop-specific care recommendations are available. Confirm symptoms with a local agricultural extension expert before applying any treatment."}
              </div>

              <details className="mt-4 text-sm text-gray-600">
                <summary className="cursor-pointer font-bold">Technical details</summary>
                <p className="mt-2">{result.condition || result.prediction}</p>
                <p>Model: {result.model_version}</p>
              </details>

              {/* Voice Listen Button */}
              <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <ListenButton text={result.message} label="Listen to Explanation" />
                <span className="text-[11px] font-medium text-gray-400">
                  {result.model_version}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </Layout>
  );
}

interface TrackedCrop {
  id: number;
  farm_id: number;
  crop_name: string;
  is_custom: boolean;
  land_size?: number | null;
  land_unit?: string | null;
  sowing_date?: string;
  current_stage?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

function getLocalDateInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

const CROP_STAGE_FLOW: Record<string, string[]> = {
  "Rice (Paddy)": ["Nursery & Sowing", "Tillering (Vegetative)", "Panicle Initiation", "Flowering & Heading", "Grain Filling", "Maturity & Harvest"],
  "Rice": ["Nursery & Sowing", "Tillering (Vegetative)", "Panicle Initiation", "Flowering & Heading", "Grain Filling", "Maturity & Harvest"],
  "Cotton": ["Sowing & Emergence", "Vegetative Growth", "Square & Flowering", "Boll Development", "Boll Bursting & Harvest"],
  "Maize": ["Sowing & Germination", "Knee-High Vegetative", "Tasseling & Silking", "Grain Filling", "Physiological Maturity"],
  "Tomato": ["Transplanting & Establishment", "Early Vegetative", "Flowering & Fruit Set", "Fruit Development", "Harvesting"],
  "Chilli": ["Transplanting", "Vegetative Branching", "Flowering & Pod Set", "Ripening & Harvesting"],
  "Groundnut": ["Sowing & Emergence", "Vegetative Branching", "Flowering & Pegging", "Pod Development", "Harvest"],
  "Wheat": ["Crown Root Initiation", "Tillering Stage", "Jointing & Booting", "Heading & Flowering", "Dough & Maturity"]
};

const DEFAULT_STAGES = ["Sowing", "Vegetative", "Flowering", "Maturity", "Harvest"];

const STAGE_ADVISORIES: Record<string, Record<string, { task: string; water: string; alert: string }>> = {
  "Rice (Paddy)": {
    "Nursery & Sowing": {
      task: "Treat seeds with Trichoderma viride (4g/kg). Maintain thin water film in nursery bed.",
      water: "Keep saturated without submerging shoots.",
      alert: "Monitor for damping-off fungus in nursery."
    },
    "Tillering (Vegetative)": {
      task: "Apply Jeevamrutha (200L/acre) with irrigation. Hand-weed or use cono-weeder for aeration.",
      water: "Maintain 2-3 cm shallow standing water.",
      alert: "Watch for yellow stem borer; install 5 pheromone traps per acre."
    },
    "Panicle Initiation": {
      task: "Spray Panchagavya (30ml/L) to enhance panicle size and grain count.",
      water: "Crucial stage: Ensure continuous 3-5 cm water layer; do not let soil dry.",
      alert: "High humidity can trigger Leaf Blast; spray fermented sour buttermilk if spots appear."
    },
    "Flowering & Heading": {
      task: "Avoid chemical sprays during peak morning pollination (9 AM - 12 PM).",
      water: "Maintain standing water of 3 cm.",
      alert: "Check for Gundhi bug; use lighting traps at dusk."
    },
    "Grain Filling": {
      task: "Apply potassium-rich organic ash wash or foliar micronutrient spray.",
      water: "Gradually reduce water; maintain moist soil without standing pool.",
      alert: "Protect against grain discoloration by ensuring good field drainage."
    },
    "Maturity & Harvest": {
      task: "Drain water completely 10-12 days prior to harvesting. Harvest when 85% grains turn golden.",
      water: "Dry field for combine harvester access.",
      alert: "Watch weather forecast to avoid harvesting in sudden unseasonal rain."
    }
  },
  "Cotton": {
    "Sowing & Emergence": {
      task: "Ensure proper seedbed moisture. Inspect for cutworms and seedling wilt.",
      water: "Light irrigation after sowing.",
      alert: "Soil crusting can hamper emergence in heavy clay soils."
    },
    "Vegetative Growth": {
      task: "Apply farmyard manure and spray Neem Oil (5ml/L) as prophylactic against sucking pests (Jassids/Thrips).",
      water: "Irrigate every 10-14 days depending on rainfall.",
      alert: "Monitor lower leaves for leafhoppers and aphids."
    },
    "Square & Flowering": {
      task: "Spray Panchagavya (30ml/L) + Boron (1g/L) to reduce square and flower drop.",
      water: "Critical moisture sensitivity stage; avoid water stress.",
      alert: "Install pheromone traps for Pink Bollworm (8 traps/acre)."
    },
    "Boll Development": {
      task: "Maintain clean weed-free borders. Apply potassium foliar spray for boll weight.",
      water: "Provide uniform moisture; alternating drought and excess water causes boll shedding.",
      alert: "Inspect green bolls weekly for internal bollworm larvae."
    },
    "Boll Bursting & Harvest": {
      task: "Pick clean seed-cotton in dry sunny morning hours. Avoid leaves and trash contamination.",
      water: "Stop irrigation to encourage uniform boll opening.",
      alert: "Store picked cotton in moisture-free shaded godown."
    }
  }
};

function MyCrops({ farm }: { farm: FarmData | null }) {
  const { lang, t } = useAppLanguage();
  const navigate = useNavigate();
  const [crops, setCrops] = useState<TrackedCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState("Rice (Paddy)");
  const [customCropName, setCustomCropName] = useState("");
  const [newLandSize, setNewLandSize] = useState("");
  const [newLandUnit, setNewLandUnit] = useState("acres");
  const [newSowingDate, setNewSowingDate] = useState(getLocalDateInputValue);
  const [newStage, setNewStage] = useState(CROP_STAGE_FLOW["Rice (Paddy)"][0]);
  const [saving, setSaving] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const isCustomCrop = selectedCrop === "Other";
  const cropName = isCustomCrop ? customCropName.trim() : selectedCrop;
  const availableStages = CROP_STAGE_FLOW[cropName] || DEFAULT_STAGES;

  const handleCropSelection = (value: string) => {
    setSelectedCrop(value);
    const nextCropName = value === "Other" ? customCropName.trim() : value;
    setNewStage((CROP_STAGE_FLOW[nextCropName] || DEFAULT_STAGES)[0]);
  };

  const handleCustomCropNameChange = (value: string) => {
    setCustomCropName(value);
    const nextCropName = value.trim();
    setNewStage((CROP_STAGE_FLOW[nextCropName] || DEFAULT_STAGES)[0]);
  };

  const fetchCrops = async () => {
    setLoading(true);
    setCropError(null);
    try {
      const data = await api<TrackedCrop[]>("/crops");
      setCrops(data || []);
    } catch (err) {
      setCrops([]);
      setCropError(err instanceof Error ? err.message : "Could not load crops from the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, [farm]);

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setCropError(null);
    if (!farm?.id) {
      setCropError("Save your farm details before adding a crop.");
      return;
    }
    if (!cropName) {
      setCropError("Enter a crop name.");
      return;
    }
    if (!Number.isFinite(Number(newLandSize)) || Number(newLandSize) <= 0) {
      setCropError("Enter a land area greater than zero.");
      return;
    }
    if (!newLandUnit) {
      setCropError("Select a land area unit.");
      return;
    }

    setSaving(true);
    try {
      await api<TrackedCrop>("/crops", {
        method: "POST",
        body: JSON.stringify({
          farm_id: farm.id,
          crop_name: cropName,
          is_custom: isCustomCrop,
          land_size: Number(newLandSize),
          land_unit: newLandUnit,
          sowing_date: newSowingDate,
          current_stage: newStage,
        })
      });
      setShowAddModal(false);
      await fetchCrops();
    } catch (err) {
      setCropError(err instanceof Error ? err.message : "Could not save this crop.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceStage = async (crop: TrackedCrop) => {
    const stages = CROP_STAGE_FLOW[crop.crop_name] || DEFAULT_STAGES;
    const currentIdx = stages.findIndex((s) => s.toLowerCase() === (crop.current_stage || "").toLowerCase()) || 0;
    const nextIdx = (currentIdx + 1) % stages.length;
    const nextStageName = stages[nextIdx];

    try {
      await api(`/crops/${crop.id}/stage?stage=${encodeURIComponent(nextStageName)}`, {
        method: "PATCH",
      });
    } catch {}

    setCrops((prev) =>
      prev.map((c) => (c.id === crop.id ? { ...c, current_stage: nextStageName } : c))
    );
  };

  const calculateDaysSinceSowing = (sowingDate?: string) => {
    if (!sowingDate) return 35;
    try {
      const start = new Date(sowingDate).getTime();
      const now = new Date().getTime();
      const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays > 0 ? diffDays : 25);
    } catch {
      return 35;
    }
  };

  return (
    <Layout>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">
        {cropError && !showAddModal && (
          <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {cropError}
          </div>
        )}
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-agri-700 p-3 text-white shadow-md">
              <Leaf size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">🌱 My Crops & Active Farm Lifecycle</h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Live crop tracking, growth stages, daily organic care advisories, and weather alerts.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-agri-700 px-5 py-3 text-xs font-black text-white shadow-lg hover:bg-agri-800 transition active:scale-95"
          >
            <Sprout size={18} />
            <span>+ Add / Track Crop</span>
          </button>
        </div>

        {/* Farm Context Stats Bar */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Crops</p>
            <p className="text-xl font-black text-gray-900 mt-1">{crops.length} Crops</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Cultivated Area</p>
            <p className="text-xl font-black text-gray-900 mt-1">{farm?.land_size || "2.5"} {farm?.land_unit || "Acres"}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Primary Soil</p>
            <p className="text-xl font-black text-emerald-800 mt-1">{farm?.soil_type || "Red Soil"}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Season</p>
            <p className="text-xl font-black text-agri-700 mt-1">Kharif Season</p>
          </div>
        </div>

        {/* Crop Cards List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
            <RefreshCw size={28} className="animate-spin mb-2 text-agri-700" />
            <p className="font-bold text-sm">Loading your active crops...</p>
          </div>
        ) : crops.length === 0 ? (
          <div className="rounded-[2.5rem] bg-white p-10 text-center shadow-sm border border-gray-100">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Sprout size={32} />
            </div>
            <h3 className="text-lg font-black text-gray-900">No active crops tracked yet</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
              Add your first crop to receive automated stage-by-stage organic farming guidance and weather protection alerts.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-5 rounded-2xl bg-agri-700 px-6 py-3 text-xs font-black text-white shadow-md hover:bg-agri-800"
            >
              + Track Your First Crop
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {crops.map((crop) => {
              const stages = CROP_STAGE_FLOW[crop.crop_name] || DEFAULT_STAGES;
              const currentStageName = crop.current_stage || stages[1] || "Vegetative";
              const stageIdx = Math.max(0, stages.findIndex((s) => s.toLowerCase().includes(currentStageName.toLowerCase()) || currentStageName.toLowerCase().includes(s.toLowerCase())));
              const progressPct = Math.round(((stageIdx + 1) / stages.length) * 100);
              const days = calculateDaysSinceSowing(crop.sowing_date);

              const cropAdvisories = STAGE_ADVISORIES[crop.crop_name] || {};
              const currentAdvisory = cropAdvisories[currentStageName] || {
                task: "Crop-specific guidance is not available for this crop and growth stage yet.",
                water: "Check soil moisture and local agricultural guidance before deciding when to irrigate.",
                alert: "No crop-specific alerts are available for this crop and growth stage yet."
              };

              return (
                <div key={crop.id} className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-xl border border-gray-100 animate-in fade-in duration-300">
                  {/* Top Crop Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xl shadow-sm">
                        {crop.crop_name.includes("Rice") ? "🌾" : crop.crop_name.includes("Cotton") ? "🌿" : crop.crop_name.includes("Tomato") ? "🍅" : crop.crop_name.includes("Maize") ? "🌽" : "🌱"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-gray-900">{crop.crop_name}</h2>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">
                          {crop.sowing_date ? `Sown on: ${crop.sowing_date} • ` : ""}
                          {crop.land_size && crop.land_unit ? `${crop.land_size} ${crop.land_unit} allocated • ` : ""}
                          <span className="text-agri-700 font-bold">{days} Days After Sowing (DAS)</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate("/plant-health")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
                      >
                        <Camera size={14} />
                        <span>Scan Health</span>
                      </button>
                      <button
                        onClick={() => handleAdvanceStage(crop)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-600/30"
                      >
                        <span>Next Stage ❯</span>
                      </button>
                    </div>
                  </div>

                  {/* Growth Stage Timeline */}
                  <div className="my-5">
                    <div className="flex items-center justify-between text-xs font-black mb-2">
                      <span className="text-agri-900">Current Stage: {currentStageName}</span>
                      <span className="text-emerald-700">{progressPct}% of Lifecycle Complete</span>
                    </div>

                    {/* Stage Progress bar */}
                    <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden p-0.5 border border-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {/* Step pills */}
                    <div className="mt-3 flex items-center justify-between gap-1 overflow-x-auto pb-1 text-[10px] font-bold">
                      {stages.map((s, idx) => {
                        const isPast = idx < stageIdx;
                        const isCurrent = idx === stageIdx;
                        return (
                          <div
                            key={s}
                            className={`px-2 py-1 rounded-xl text-center shrink-0 transition ${
                              isCurrent
                                ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30"
                                : isPast
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-gray-50 text-gray-400"
                            }`}
                          >
                            {isPast && "✓ "}
                            {s}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Daily Agronomic Care Advisory Card */}
                  <div className="grid gap-3 sm:grid-cols-2 mt-4">
                    {/* Organic Task */}
                    <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-200/60">
                      <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs mb-1">
                        <Leaf size={16} className="text-emerald-700" />
                        <span>🌿 Today's Organic Crop Care</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 leading-relaxed">
                        {currentAdvisory.task}
                      </p>
                    </div>

                    {/* Water & Weather Risk */}
                    <div className="rounded-2xl bg-sky-50/70 p-4 border border-sky-200/60">
                      <div className="flex items-center gap-2 text-sky-900 font-extrabold text-xs mb-1">
                        <CloudSun size={16} className="text-sky-700" />
                        <span>💧 Water Schedule & Climate Alert</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 leading-relaxed">
                        {currentAdvisory.water} {currentAdvisory.alert}
                      </p>
                    </div>
                  </div>

                  {/* Voice Listen Button */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <ListenButton
                      text={`For your ${crop.crop_name} in ${currentStageName} stage: ${currentAdvisory.task}. Water requirement: ${currentAdvisory.water}. Caution: ${currentAdvisory.alert}`}
                      label="Listen to Stage Advisory"
                    />
                    <span className="text-[11px] font-semibold text-gray-400">
                      Agro-Climatic Intelligence
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add New Crop */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-agri-700 p-2.5 text-white">
                    <Sprout size={22} />
                  </div>
                  <h2 className="text-xl font-black text-gray-900">Add Crop to Farm</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddCrop} className="space-y-4">
                {cropError && (
                  <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {cropError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Select Crop
                  </label>
                  <select
                    value={selectedCrop}
                    onChange={(e) => handleCropSelection(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900 bg-white"
                  >
                    <option value="Rice (Paddy)">🌾 Rice (Paddy)</option>
                    <option value="Cotton">🌿 Cotton</option>
                    <option value="Maize">🌽 Maize (Corn)</option>
                    <option value="Tomato">🍅 Tomato</option>
                    <option value="Chilli">🌶️ Chilli</option>
                    <option value="Groundnut">🥜 Groundnut</option>
                    <option value="Wheat">🌾 Wheat</option>
                    <option value="Other">Other — Enter Crop Name</option>
                  </select>
                </div>

                {isCustomCrop && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" htmlFor="custom-crop-name">
                      Crop Name
                    </label>
                    <input
                      id="custom-crop-name"
                      type="text"
                      value={customCropName}
                      onChange={(e) => handleCustomCropNameChange(e.target.value)}
                      maxLength={100}
                      required
                      placeholder="Enter your crop name"
                      className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" htmlFor="crop-land-size">
                    Land Size
                  </label>
                  <input
                    id="crop-land-size"
                    type="number"
                    min="0.01"
                    step="any"
                    value={newLandSize}
                    onChange={(e) => setNewLandSize(e.target.value)}
                    required
                    placeholder="Enter land allocated to this crop"
                    className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" htmlFor="crop-land-unit">
                    Unit
                  </label>
                  <select
                    id="crop-land-unit"
                    value={newLandUnit}
                    onChange={(e) => setNewLandUnit(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900 bg-white"
                  >
                    <option value="acres">Acres</option>
                    <option value="hectares">Hectares</option>
                    <option value="cents">Cents</option>
                    <option value="square_metres">Square metres</option>
                    <option value="square_feet">Square feet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Sowing / Planting Date
                  </label>
                  <input
                    type="date"
                    value={newSowingDate}
                    onChange={(e) => setNewSowingDate(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Current Growth Stage
                  </label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 p-3.5 font-bold text-gray-900 bg-white"
                  >
                    {availableStages.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full mt-4 rounded-2xl bg-agri-700 py-3.5 font-black text-white shadow-lg hover:bg-agri-800 disabled:opacity-50"
                >
                  {saving ? "Saving Crop..." : "Start Tracking Crop"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </Layout>
  );
}

function Profile({
  user,
  farm,
  onLogout,
  onEditFarm,
  onSwitchLanguage,
}: {
  user: any;
  farm: FarmData | null;
  onLogout: () => void;
  onEditFarm: () => void;
  onSwitchLanguage: () => void;
}) {
  const { lang, t } = useAppLanguage();
  const [showQrModal, setShowQrModal] = useState(false);

  return (
    <Layout onSwitchLanguage={onSwitchLanguage}>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">
        <h1 className="text-3xl font-black text-gray-900">{t("profile_title")}</h1>
        <div className="mt-6 space-y-4 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("full_name")}</p>
            <p className="text-lg font-bold text-gray-900">{user?.full_name || user?.name || "Farmer"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("mobile_number")}</p>
            <p className="text-lg font-bold text-gray-900">+91 {user?.mobile_number}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Preferred Language</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-base font-bold text-agri-800">{lang.nativeName} ({lang.name})</p>
              <button
                onClick={onSwitchLanguage}
                className="text-xs font-bold text-agri-700 bg-agri-50 px-3 py-1.5 rounded-full border border-agri-200"
              >
                {t("change_lang")}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("farm_location_card_title")}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-base font-bold text-gray-900">
                {[farm?.village, farm?.mandal, farm?.district, farm?.state].filter(Boolean).join(", ") || "Telangana, Medchal-Malkajgiri"}
              </p>
              <button
                onClick={onEditFarm}
                className="text-xs font-bold text-agri-700 bg-agri-50 px-3 py-1.5 rounded-full border border-agri-200"
              >
                {t("edit_farm")}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-agri-50 py-3.5 font-bold text-agri-700 border border-agri-200 hover:bg-agri-100 transition"
            >
              <QrCode size={18} /> {t("open_mobile")}
            </button>
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 font-bold text-red-600 border border-red-200 hover:bg-red-100 transition"
            >
              {t("log_out")}
            </button>
          </div>
        </div>
      </main>
      <OpenOnMobileModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
      <BottomNav />
    </Layout>
  );
}

/* =========================================================================
   MAIN APP ORCHESTRATOR
   ========================================================================= */

export default function App() {
  const [language, setLanguage] = useState<LanguageOption | null>(() => {
    try {
      const saved = localStorage.getItem("agri_app_lang");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [user, setUser] = useState<any>(null);
  const [farm, setFarm] = useState<FarmData | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showFarmSetupModal, setShowFarmSetupModal] = useState(false);

  // Authenticate user on initial load
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api<any>("/auth/me")
        .then(async (u) => {
          setUser(u);
          // Fetch existing farms for this user
          try {
            const farms = await api<FarmData[]>("/farms");
            if (farms && farms.length > 0) {
              setFarm(farms[0]);
            }
          } catch {}
        })
        .catch(() => {
          setAuthToken(null);
          setUser(null);
        })
        .finally(() => setLoadingAuth(false));
    } else {
      setLoadingAuth(false);
    }
  }, []);

  const handleLanguageSelect = (selectedLang: LanguageOption) => {
    setLanguage(selectedLang);
    try {
      localStorage.setItem("agri_app_lang", JSON.stringify(selectedLang));
    } catch {}
    setShowLanguageModal(false);
  };

  const handleAuthSuccess = async (authenticatedUser: any) => {
    setUser(authenticatedUser);
    // Check if farmer already has a farm in DB
    try {
      const farms = await api<FarmData[]>("/farms");
      if (farms && farms.length > 0) {
        setFarm(farms[0]);
      } else {
        // First-time onboarding: prompt farm setup immediately
        setShowFarmSetupModal(true);
      }
    } catch {
      setShowFarmSetupModal(true);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setFarm(null);
  };

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5ed]">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-agri-700 p-3 text-white animate-bounce">
            <Sprout size={32} />
          </div>
          <div className="font-black text-agri-800 text-lg">Loading AGRIPRENEURS...</div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------
     REQUIREMENT 1: LANGUAGE SELECTION MUST COME FIRST BEFORE LOGIN
     ------------------------------------------------------------------------- */
  if (!language) {
    return (
      <LanguageSelectionModal
        isOpen={true}
        onSelect={handleLanguageSelect}
      />
    );
  }

  /* -------------------------------------------------------------------------
     REQUIREMENT 2: LOGIN SCREEN IN SELECTED LANGUAGE
     ------------------------------------------------------------------------- */
  if (!user) {
    return (
      <LanguageProvider initialLanguage={language}>
        <AuthScreen
          onAuthSuccess={handleAuthSuccess}
          onSwitchLanguage={() => setShowLanguageModal(true)}
        />
        <LanguageSelectionModal
          isOpen={showLanguageModal}
          onClose={() => setShowLanguageModal(false)}
          onSelect={handleLanguageSelect}
        />
      </LanguageProvider>
    );
  }

  /* -------------------------------------------------------------------------
     REQUIREMENT 3: IMMEDIATELY COLLECT FARM INFORMATION AFTER LOGIN
     ------------------------------------------------------------------------- */
  if (!farm || showFarmSetupModal) {
    return (
      <LanguageProvider initialLanguage={language}>
        <div className="min-h-screen bg-[#f7f5ed]">
          <header className="border-b border-black/5 bg-[#f7f5ed] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-agri-700 p-2 text-white">
                <Sprout size={20} />
              </div>
              <span className="font-black text-agri-700 text-lg">AGRIPRENEURS</span>
            </div>
            <button
              onClick={() => setShowLanguageModal(true)}
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-agri-800 border border-gray-200"
            >
              {language.nativeName}
            </button>
          </header>

          <FarmSetupScreen
            existingFarm={farm}
            isInitialSetup={!farm}
            onSaveSuccess={(savedFarm) => {
              setFarm(savedFarm);
              setShowFarmSetupModal(false);
            }}
          />

          <LanguageSelectionModal
            isOpen={showLanguageModal}
            onClose={() => setShowLanguageModal(false)}
            onSelect={handleLanguageSelect}
          />
        </div>
      </LanguageProvider>
    );
  }

  /* -------------------------------------------------------------------------
     AUTHENTICATED APPLICATION ROUTES
     ------------------------------------------------------------------------- */
  return (
    <LanguageProvider initialLanguage={language}>
      <Routes>
        <Route
          path="/"
          element={<Dashboard farm={farm} onUpdateFarm={() => setShowFarmSetupModal(true)} />}
        />
        <Route
          path="/dashboard"
          element={<Dashboard farm={farm} onUpdateFarm={() => setShowFarmSetupModal(true)} />}
        />
        <Route
          path="/crop-prediction"
          element={<CropPredictionPage farm={farm} onUpdateFarm={() => setShowFarmSetupModal(true)} />}
        />
        <Route path="/pesticide" element={<Pesticide />} />
        <Route path="/my-crops" element={<MyCrops farm={farm} />} />
        <Route path="/plant-health" element={<PlantHealth />} />
        <Route
          path="/profile"
          element={
            <Profile
              user={user}
              farm={farm}
              onLogout={handleLogout}
              onEditFarm={() => setShowFarmSetupModal(true)}
              onSwitchLanguage={() => setShowLanguageModal(true)}
            />
          }
        />
      </Routes>

      <LanguageSelectionModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        onSelect={handleLanguageSelect}
      />
    </LanguageProvider>
  );
}
