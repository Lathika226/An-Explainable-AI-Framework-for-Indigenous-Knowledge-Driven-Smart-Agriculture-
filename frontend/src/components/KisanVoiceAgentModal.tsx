import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Check, ChevronRight, RotateCcw, X, MessageSquare, Bot, User, CheckCircle2 } from "lucide-react";
import { useAppLanguage } from "../context/LanguageContext";

export interface VoiceFarmData {
  state: string;
  district: string;
  mandal: string;
  village: string;
  landSize: string;
  landUnit: string;
  soilType: string;
  season: string;
  previousCrop: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: VoiceFarmData, autoSubmit?: boolean) => void;
  initialData?: Partial<VoiceFarmData>;
  mode?: "farm_setup" | "crop_recommendation";
}

interface StepQuestion {
  id: "location" | "land" | "season" | "soil" | "notes";
  title: string;
  question: Record<string, string>;
  hint: Record<string, string>;
}

const QUESTIONS: StepQuestion[] = [
  {
    id: "location",
    title: "Farm Location",
    question: {
      "en-IN": "Namaste! Which state and district is your farm located in?",
      "te-IN": "నమస్కారం! మీ పొలం ఏ రాష్ట్రం మరియు ఏ జిల్లాలో ఉంది?",
      "hi-IN": "नमस्ते! आपका खेत किस राज्य और किस जिले में है?",
      "ta-IN": "வணக்கம்! உங்கள் பண்ணை எந்த மாநிலம் மற்றும் மாவட்டத்தில் உள்ளது?",
      "kn-IN": "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಜಮೀನು ಯಾವ ರಾಜ್ಯ ಮತ್ತು ಜಿಲ್ಲೆಯಲ್ಲಿದೆ?",
    },
    hint: {
      "en-IN": "Speak your state and district (e.g., 'Telangana, Medchal')",
      "te-IN": "రాష్ట్రం మరియు జిల్లా పేరు చెప్పండి (ఉదాహరణ: తెలంగాణ, మేడ్చల్)",
      "hi-IN": "राज्य और जिला बताएं (उदा: तेलंगाना, मेडचल)",
      "ta-IN": "மாநிலம் மற்றும் மாவட்டத்தை கூறுங்கள்",
      "kn-IN": "ರಾಜ್ಯ ಮತ್ತು ಜಿಲ್ಲೆಯನ್ನು ತಿಳಿಸಿ",
    },
  },
  {
    id: "land",
    title: "Land Size",
    question: {
      "en-IN": "How much land do you have for cultivation, in acres or guntas?",
      "te-IN": "మీకు సాగు కోసం ఎన్ని ఎకరాలు లేదా గుంటల భూమి ఉంది?",
      "hi-IN": "खेती के लिए आपके पास कितनी जमीन है, एकड़ या गुंठे में?",
      "ta-IN": "உங்களிடம் எத்தனை ஏக்கர் நிலம் உள்ளது?",
      "kn-IN": "ನಿಮ್ಮಲ್ಲಿ ಎಷ್ಟು ಎಕರೆ ಜಮೀನು ಇದೆ?",
    },
    hint: {
      "en-IN": "e.g., '2.5 acres' or '3 acres 20 guntas'",
      "te-IN": "ఉదా: '2.5 ఎకరాలు' లేదా '3 ఎకరాలు'",
      "hi-IN": "उदा: '2.5 एकड़' या '3 एकड़'",
      "ta-IN": "எ.கா: '2.5 ஏக்கர்'",
      "kn-IN": "ಉದಾ: '2.5 ಎಕರೆ'",
    },
  },
  {
    id: "season",
    title: "Farming Season",
    question: {
      "en-IN": "Which season are you planning crops for — Kharif monsoon, Rabi winter, or Summer?",
      "te-IN": "మీరు ఏ పంట కాలం కోసం చూస్తున్నారు — ఖరీఫ్ వర్షాకాలం, రబీ శీతాకాలం లేదా వేసవి?",
      "hi-IN": "आप किस मौसम के लिए फसल की योजना बना रहे हैं — खरीफ, रबी, या जायद गर्मी?",
      "ta-IN": "நீங்கள் எந்த பருவத்திற்கு பயிரிட திட்டமிடுகிறீர்கள்?",
      "kn-IN": "ನೀವು ಯಾವ ಋತುವಿಗೆ ಬೆಳೆ ಬೆಳೆಯಲು ಯೋಜಿಸುತ್ತಿದ್ದೀರಿ?",
    },
    hint: {
      "en-IN": "Say 'Kharif', 'Rabi', or 'Summer'",
      "te-IN": "'ఖరీఫ్', 'రబీ' లేదా 'వేసవి' అని చెప్పండి",
      "hi-IN": "'खरीफ', 'रबी' या 'गर्मी' कहें",
      "ta-IN": "'காரீப்', 'ரபி' அல்லது 'கோடை' என சொல்லுங்கள்",
      "kn-IN": "'ಖಾರೀಫ್', 'ರಬಿ' ಅಥವಾ 'ಬೇಸಿಗೆ' ಎಂದು ಹೇಳಿ",
    },
  },
  {
    id: "soil",
    title: "Soil Type",
    question: {
      "en-IN": "What type of soil does your farm have, like Red soil or Black soil? Or should I estimate it automatically?",
      "te-IN": "మీ పొలంలో ఏ రకం మట్టి ఉంది, ఎర్ర నేలా లేదా నల్ల రేగడి నేలా? లేదా నేను స్వయంచాలకంగా అంచనా వేయమంటారా?",
      "hi-IN": "आपके खेत में कैसी मिट्टी है, लाल मिट्टी या काली मिट्टी? या मैं स्वचालित रूप से अनुमान लगाऊं?",
      "ta-IN": "உங்கள் நிலத்தில் என்ன வகையான மண் உள்ளது?",
      "kn-IN": "ನಿಮ್ಮ ಜಮೀನಿನಲ್ಲಿ ಯಾವ ರೀತಿಯ ಮಣ್ಣು ಇದೆ?",
    },
    hint: {
      "en-IN": "Say 'Red Soil', 'Black Soil', 'Alluvial', or 'Estimate it'",
      "te-IN": "'ఎర్ర నేల', 'నల్ల రేగడి' లేదా 'అంచనా వేయి' అని చెప్పండి",
      "hi-IN": "'लाल मिट्टी', 'काली मिट्टी' या 'अनुमान लगाएं' कहें",
      "ta-IN": "'செம்மண்' அல்லது 'கரிசல் மண்' சொல்லுங்கள்",
      "kn-IN": "'ಕೆಂಪು ಮಣ್ಣು' ಅಥವಾ 'ಕಪ್ಪು ಮಣ್ಣು' ಹೇಳಿ",
    },
  },
  {
    id: "notes",
    title: "Previous Crop & Irrigation",
    question: {
      "en-IN": "What was your previous crop, and what water source or irrigation do you have?",
      "te-IN": "గతంలో మీరు ఏ పంట వేశారు, అలాగే మీకు ఏ విధమైన నీటి వసతి ఉంది?",
      "hi-IN": "आपकी पिछली फसल कौन सी थी, और पानी या सिंचाई की क्या सुविधा है?",
      "ta-IN": "உங்கள் முந்தைய பயிர் மற்றும் நீர் பாசன வசதி என்ன?",
      "kn-IN": "ಹಿಂದಿನ ಬೆಳೆ ಯಾವುದು ಮತ್ತು ನೀರಿನ ವ್ಯವಸ್ಥೆ ಹೇಗಿದೆ?",
    },
    hint: {
      "en-IN": "e.g., 'Cotton previously, borewell water' or 'None'",
      "te-IN": "ఉదా: 'పత్తి వేసాము, బోరు బావి నీరు ఉంది' లేదా 'ఏమీ లేదు'",
      "hi-IN": "उदा: 'कपास, बोरवेल का पानी' या 'कुछ नहीं'",
      "ta-IN": "எ.கா: 'பருத்தி, ஆழ்துளை கிணறு'",
      "kn-IN": "ಉದಾ: 'ಹತ್ತಿ, ಕೊಳವೆಬಾವಿ'",
    },
  },
];

export default function KisanVoiceAgentModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  mode = "crop_recommendation",
}: Props) {
  const { lang } = useAppLanguage();
  const langCode = lang?.code || "en-IN";

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<VoiceFarmData>({
    state: initialData?.state || "Telangana",
    district: initialData?.district || "Medchal-Malkajgiri",
    mandal: initialData?.mandal || "Ghatkesar",
    village: initialData?.village || "",
    landSize: initialData?.landSize || "2.5",
    landUnit: initialData?.landUnit || "acres",
    soilType: initialData?.soilType || "Red Soil",
    season: initialData?.season || "Kharif",
    previousCrop: initialData?.previousCrop || "",
  });

  const [chatLog, setChatLog] = useState<Array<{ sender: "agent" | "user"; text: string }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isAgentSpeakingRef = useRef(false);

  // Initialize Speech Synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // When modal opens, reset and start conversation
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setChatLog([]);
      setFormData({
        state: initialData?.state || "Telangana",
        district: initialData?.district || "Medchal-Malkajgiri",
        mandal: initialData?.mandal || "Ghatkesar",
        village: initialData?.village || "",
        landSize: initialData?.landSize || "2.5",
        landUnit: initialData?.landUnit || "acres",
        soilType: initialData?.soilType || "Red Soil",
        season: initialData?.season || "Kharif",
        previousCrop: initialData?.previousCrop || "",
      });

      // Start asking question 0 after a slight delay
      const t = setTimeout(() => {
        askQuestion(0);
      }, 400);
      return () => clearTimeout(t);
    } else {
      stopAllAudio();
    }
  }, [isOpen, langCode]);

  const stopAllAudio = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsSpeaking(false);
    setIsListening(false);
    isAgentSpeakingRef.current = false;
  };

  const getQuestionText = (stepIdx: number) => {
    const q = QUESTIONS[stepIdx];
    if (!q) return "";
    return q.question[langCode] || q.question["en-IN"] || "";
  };

  const speakText = (text: string, onDone?: () => void) => {
    if (!synthRef.current) {
      if (onDone) onDone();
      return;
    }

    synthRef.current.cancel();
    isAgentSpeakingRef.current = true;
    setIsSpeaking(true);

    const clean = text.replace(/[*_#`[\]()]/g, " ").replace(/\s+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = langCode;
    utterance.rate = 0.95;

    const voices = synthRef.current.getVoices();
    const matchingVoice = voices.find(
      (v) => v.lang === langCode || v.lang.startsWith(langCode.split("-")[0])
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      isAgentSpeakingRef.current = false;
      if (onDone) onDone();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      isAgentSpeakingRef.current = false;
      if (onDone) onDone();
    };

    synthRef.current.speak(utterance);
  };

  const askQuestion = (stepIdx: number) => {
    if (stepIdx >= QUESTIONS.length) {
      finishConversation();
      return;
    }

    const qText = getQuestionText(stepIdx);
    setChatLog((prev) => [...prev, { sender: "agent", text: qText }]);
    setCurrentStepIndex(stepIdx);

    speakText(qText, () => {
      startListening();
    });
  };

  const startListening = () => {
    const Recognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!Recognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = langCode;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim) setInterimTranscript(interim);
        if (final) {
          setIsListening(false);
          setInterimTranscript("");
          handleFarmerAnswer(final.trim());
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const handleFarmerAnswer = (spokenText: string) => {
    setChatLog((prev) => [...prev, { sender: "user", text: spokenText }]);
    const textLower = spokenText.toLowerCase();

    const currentQ = QUESTIONS[currentStepIndex];
    let confirmation = "";
    let nextStep = currentStepIndex + 1;

    // STEP 1: LOCATION
    if (currentQ.id === "location") {
      let detectedState = formData.state;
      let detectedDistrict = formData.district;

      if (textLower.includes("telangana") || textLower.includes("తెలంగాణ") || textLower.includes("तेलंगाना")) {
        detectedState = "Telangana";
      } else if (textLower.includes("andhra") || textLower.includes("ఆంధ్ర") || textLower.includes("आंध्र")) {
        detectedState = "Andhra Pradesh";
      } else if (textLower.includes("karnataka") || textLower.includes("కర్ణాటక") || textLower.includes("कर्नाटक")) {
        detectedState = "Karnataka";
      } else if (textLower.includes("tamil") || textLower.includes("తమిళ") || textLower.includes("तमिल")) {
        detectedState = "Tamil Nadu";
      } else if (textLower.includes("maharashtra") || textLower.includes("మహారాష్ట్ర") || textLower.includes("महाराष्ट्र")) {
        detectedState = "Maharashtra";
      }

      const districts = [
        "medchal", "medchal-malkajgiri", "hyderabad", "rangareddy", "khammam", "nalgonda",
        "warangal", "karimnagar", "nizamabad", "guntur", "kurnool", "anantapur", "krishna", "chittoor"
      ];
      for (const d of districts) {
        if (textLower.includes(d)) {
          detectedDistrict = d.charAt(0).toUpperCase() + d.slice(1);
          break;
        }
      }

      setFormData((prev) => ({ ...prev, state: detectedState, district: detectedDistrict }));

      if (langCode === "te-IN") {
        confirmation = `ధన్యవాదాలు! ${detectedDistrict}, ${detectedState} నమోదు చేశాను.`;
      } else if (langCode === "hi-IN") {
        confirmation = `धन्यवाद! ${detectedDistrict}, ${detectedState} दर्ज किया गया।`;
      } else {
        confirmation = `Great! Noted ${detectedDistrict}, ${detectedState}.`;
      }
    }

    // STEP 2: LAND SIZE
    else if (currentQ.id === "land") {
      const numMatch = spokenText.match(/\d+(\.\d+)?/);
      let size = numMatch ? numMatch[0] : formData.landSize;
      let unit = "acres";
      if (textLower.includes("gunta") || textLower.includes("గుంట") || textLower.includes("गुंठा")) {
        unit = "guntas";
      } else if (textLower.includes("hectare") || textLower.includes("హెక్టార్") || textLower.includes("हेक्टेयर")) {
        unit = "hectares";
      } else if (textLower.includes("bigha") || textLower.includes("బీఘా") || textLower.includes("बीघा")) {
        unit = "bighas";
      }

      if (!numMatch) {
        if (textLower.includes("two and half") || textLower.includes("రెండున్నర") || textLower.includes("ढाई")) size = "2.5";
        else if (textLower.includes("one") || textLower.includes("ఒకటి") || textLower.includes("एक")) size = "1.0";
        else if (textLower.includes("two") || textLower.includes("రెండు") || textLower.includes("दो")) size = "2.0";
        else if (textLower.includes("three") || textLower.includes("మూడు") || textLower.includes("तीन")) size = "3.0";
        else if (textLower.includes("four") || textLower.includes("నాలుగు") || textLower.includes("चार")) size = "4.0";
        else if (textLower.includes("five") || textLower.includes("ఐదు") || textLower.includes("पाँच")) size = "5.0";
      }

      setFormData((prev) => ({ ...prev, landSize: size, landUnit: unit }));

      if (langCode === "te-IN") {
        confirmation = `${size} ${unit === "acres" ? "ఎకరాలు" : unit} నమోదు చేసుకున్నాను.`;
      } else if (langCode === "hi-IN") {
        confirmation = `${size} ${unit === "acres" ? "एकड़" : unit} दर्ज किया गया।`;
      } else {
        confirmation = `Noted ${size} ${unit}.`;
      }
    }

    // STEP 3: SEASON
    else if (currentQ.id === "season") {
      let season = "Kharif";
      if (textLower.includes("rabi") || textLower.includes("winter") || textLower.includes("శీతా") || textLower.includes("రబీ") || textLower.includes("रबी")) {
        season = "Rabi";
      } else if (textLower.includes("summer") || textLower.includes("zaid") || textLower.includes("వేసవి") || textLower.includes("ఎండ") || textLower.includes("गर्मी") || textLower.includes("जायद")) {
        season = "Summer";
      } else {
        season = "Kharif";
      }

      setFormData((prev) => ({ ...prev, season }));

      if (langCode === "te-IN") {
        confirmation = `${season === "Kharif" ? "ఖరీఫ్ వర్షాకాలం" : season === "Rabi" ? "రబీ శీతాకాలం" : "వేసవి"} ఎంపిక చేయబడింది.`;
      } else if (langCode === "hi-IN") {
        confirmation = `${season} मौसम चुना गया।`;
      } else {
        confirmation = `${season} season recorded.`;
      }
    }

    // STEP 4: SOIL TYPE
    else if (currentQ.id === "soil") {
      let soil = "Red Soil";
      if (textLower.includes("black") || textLower.includes("నల్ల") || textLower.includes("काली")) {
        soil = "Black Soil";
      } else if (textLower.includes("alluvial") || textLower.includes("ఒండ్రు") || textLower.includes("जलोढ़")) {
        soil = "Alluvial Soil";
      } else if (textLower.includes("clay") || textLower.includes("మట్టి") || textLower.includes("चिकनी")) {
        soil = "Clay Soil";
      } else if (textLower.includes("sandy") || textLower.includes("ఇసుక") || textLower.includes("रेतीली")) {
        soil = "Sandy Soil";
      } else if (textLower.includes("estimate") || textLower.includes("don't know") || textLower.includes("తెలియదు") || textLower.includes("అంచనా") || textLower.includes("पता नहीं")) {
        soil = "I don't know my soil type";
      }

      setFormData((prev) => ({ ...prev, soilType: soil }));

      if (langCode === "te-IN") {
        confirmation = `${soil === "I don't know my soil type" ? "ప్రాంతీయ అంచనా ప్రకారం మట్టి వివరాలు తీసుకుంటున్నాను." : soil + " నమోదు చేసాను."}`;
      } else if (langCode === "hi-IN") {
        confirmation = `${soil === "I don't know my soil type" ? "स्थान के आधार पर मिट्टी का अनुमान लगाया जाएगा।" : soil + " दर्ज किया गया।"}`;
      } else {
        confirmation = `${soil === "I don't know my soil type" ? "Will auto-estimate soil from regional data." : soil + " recorded."}`;
      }
    }

    // STEP 5: NOTES & PREVIOUS CROP
    else if (currentQ.id === "notes") {
      let prevCrop = spokenText;
      if (textLower.includes("cotton") || textLower.includes("పత్తి") || textLower.includes("कपास")) prevCrop = "Cotton";
      else if (textLower.includes("rice") || textLower.includes("వరి") || textLower.includes("धान") || textLower.includes("चावल")) prevCrop = "Rice";
      else if (textLower.includes("maize") || textLower.includes("మొక్కజొన్న") || textLower.includes("मक्का")) prevCrop = "Maize";
      else if (textLower.includes("chilli") || textLower.includes("మిర్చి") || textLower.includes("मिर्च")) prevCrop = "Chilli";

      setFormData((prev) => ({ ...prev, previousCrop: prevCrop }));

      if (langCode === "te-IN") {
        confirmation = `చాలా ధన్యవాదాలు! మీ పొలం వివరాలన్నీ పూర్తయ్యాయి. ఇప్పుడే AI పంట సూచనలు సిద్ధం చేస్తున్నాను...`;
      } else if (langCode === "hi-IN") {
        confirmation = `धन्यवाद! आपके खेत का संपूर्ण विवरण प्राप्त हो गया। अब AI फसल सुझाव तैयार किए जा रहे हैं...`;
      } else {
        confirmation = `Thank you! All details collected. Generating your explainable AI crop recommendations now...`;
      }
    }

    // Speak confirmation and proceed
    setChatLog((prev) => [...prev, { sender: "agent", text: confirmation }]);
    speakText(confirmation, () => {
      if (nextStep < QUESTIONS.length) {
        askQuestion(nextStep);
      } else {
        finishConversation();
      }
    });
  };

  const finishConversation = () => {
    stopAllAudio();
    setTimeout(() => {
      onComplete(formData, true);
      onClose();
    }, 1200);
  };

  const handleManualNext = () => {
    stopAllAudio();
    if (currentStepIndex + 1 < QUESTIONS.length) {
      askQuestion(currentStepIndex + 1);
    } else {
      finishConversation();
    }
  };

  const handleManualReplay = () => {
    stopAllAudio();
    const qText = getQuestionText(currentStepIndex);
    speakText(qText, () => startListening());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-lg flex-col rounded-[2.5rem] bg-gradient-to-b from-white via-emerald-50/30 to-white p-6 shadow-2xl border border-emerald-100 max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30">
              <Bot size={26} />
              {(isSpeaking || isListening) && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-gray-900">Kisan AI Voice Agent</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  {lang?.nativeName || "తెలుగు / Voice"}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500">
                {isSpeaking ? "🔊 AI is speaking..." : isListening ? "🎙️ Listening to you... Speak now" : "Interactive Voice Advisory"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopAllAudio();
              onClose();
            }}
            className="rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="my-3 flex items-center justify-between gap-1 px-2">
          {QUESTIONS.map((q, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={q.id} className="flex-1 flex flex-col items-center">
                <div
                  className={`h-2 w-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-600"
                      : isCurrent
                      ? "bg-amber-500 animate-pulse"
                      : "bg-gray-200"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Active Animated Voice Visualizer Orb */}
        <div className="my-2 flex flex-col items-center justify-center py-4 text-center">
          <div className="relative flex items-center justify-center">
            {/* Wave Pulse rings */}
            {(isListening || isSpeaking) && (
              <>
                <div className={`absolute h-28 w-28 rounded-full opacity-20 animate-ping ${isListening ? "bg-red-500" : "bg-emerald-500"}`} />
                <div className={`absolute h-24 w-24 rounded-full opacity-40 animate-pulse ${isListening ? "bg-red-400" : "bg-teal-400"}`} />
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  if (recognitionRef.current) recognitionRef.current.stop();
                  setIsListening(false);
                } else {
                  startListening();
                }
              }}
              className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-xl transition-all duration-300 ${
                isListening
                  ? "bg-red-500 text-white ring-8 ring-red-200 scale-110 shadow-red-500/40"
                  : isSpeaking
                  ? "bg-emerald-600 text-white ring-8 ring-emerald-200 scale-105 shadow-emerald-600/40"
                  : "bg-gray-900 text-white hover:bg-black"
              }`}
            >
              {isListening ? (
                <Mic size={36} className="animate-bounce" />
              ) : isSpeaking ? (
                <Volume2 size={36} className="animate-pulse" />
              ) : (
                <Mic size={32} />
              )}
            </button>
          </div>

          <p className="mt-3 text-sm font-extrabold text-gray-800">
            {isListening ? "🎙️ I am listening... Speak your answer" : isSpeaking ? "🔊 AI is speaking..." : "Tap mic to speak"}
          </p>
          {interimTranscript && (
            <p className="mt-1 max-w-sm rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 animate-pulse">
              "{interimTranscript}..."
            </p>
          )}
        </div>

        {/* Live Conversation Chatbox */}
        <div className="flex-1 overflow-y-auto rounded-3xl bg-white/90 p-4 border border-gray-100 shadow-inner space-y-3 min-h-[160px] max-h-[220px]">
          {chatLog.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "agent" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  AI
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-3 text-xs sm:text-sm font-semibold leading-relaxed shadow-xs ${
                  msg.sender === "user"
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-gray-100 text-gray-900 rounded-tl-none border border-gray-200/60"
                }`}
              >
                {msg.text}
              </div>
              {msg.sender === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold">
                  <User size={14} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live Form Preview summary */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-emerald-50/80 p-2.5 border border-emerald-200/60 text-[11px] font-bold text-emerald-900">
          <span className="text-emerald-700 font-extrabold">Collected:</span>
          <span className="rounded-lg bg-white px-2 py-0.5 shadow-xs border border-emerald-200">📍 {formData.district}, {formData.state}</span>
          <span className="rounded-lg bg-white px-2 py-0.5 shadow-xs border border-emerald-200">🌾 {formData.landSize} {formData.landUnit}</span>
          <span className="rounded-lg bg-white px-2 py-0.5 shadow-xs border border-emerald-200">🗓️ {formData.season}</span>
          <span className="rounded-lg bg-white px-2 py-0.5 shadow-xs border border-emerald-200">🌱 {formData.soilType}</span>
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleManualReplay}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
          >
            <RotateCcw size={14} />
            <span>Repeat Question</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualNext}
              className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
            >
              <span>Skip / Next</span>
              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              onClick={finishConversation}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/30"
            >
              <Sparkles size={15} />
              <span>Get Recommendation</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
