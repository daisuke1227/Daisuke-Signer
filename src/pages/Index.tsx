import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { Upload, ChevronDown, Settings, Eye, EyeOff, Menu, X, Copy, Download, CheckCircle2, Loader2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState({
    ipa: null as File | null,
    p12: null as File | null,
    mobileprovision: null as File | null,
  });
  const [fileNames, setFileNames] = useState({ p12: "", mobileprovision: "" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [directIpaLink, setDirectIpaLink] = useState("");
  const [advancedSettings, setAdvancedSettings] = useState({
    appName: "",
    version: "",
    bundleId: "",
    minOsVersion: "",
    iconFile: null as File | null,
    tweakFiles: null as FileList | null,
    removeUiDevices: false,
    removeWatchApps: false,
    enableDocumentSupport: false,
    fakesignBinaries: false,
    thinToArm64: false,
    removeExtensions: false,
    ignoreEncryption: false,
    compressionLevel: "6",
    dylibs: [] as { name: string; selected: boolean }[],
  });
  const [resultData, setResultData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [signingProgress, setSigningProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [storageOption, setStorageOption] = useState("none");
  const signingIntervalRef = useRef<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const storageOptions = [
    { id: "none", name: "No permanent link", description: "Standard signing without permanent storage" },
    { id: "storj", name: "Use perm direct link", description: "Be able to have a direct link forever and install your IPA files" },
  ];

  const handleToggleDylib = (index: number) => {
    setAdvancedSettings((prev) => {
      const newDylibs = prev.dylibs.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      );
      return { ...prev, dylibs: newDylibs };
    });
  };

  useEffect(() => {
    const selectedConfig = sessionStorage.getItem("selectedConfig");
    if (selectedConfig) {
      const config = JSON.parse(selectedConfig);
      Promise.all([
        fetch(config.p12File).then((r) => r.blob()),
        fetch(config.provisionFile).then((r) => r.blob()),
      ])
        .then(([p12Blob, provisionBlob]) => {
          const p12File = new File([p12Blob], "certificate.p12", { type: "application/x-pkcs12" });
          const provisionFile = new File([provisionBlob], "profile.mobileprovision", { type: "application/octet-stream" });
          setFiles((prev) => ({
            ...prev,
            p12: p12File,
            mobileprovision: provisionFile,
          }));
          setFileNames({ p12: "certificate.p12", mobileprovision: "profile.mobileprovision" });
          setPassword(config.password);
          sessionStorage.removeItem("selectedConfig");
        })
        .catch((err) => {
          console.error("Error loading files:", err);
        });
    }
  }, []);

  const isAllFieldsFilled =
    ((files.ipa) || directIpaLink.trim() !== "") && files.p12 && files.mobileprovision;

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: keyof typeof files
  ) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setFiles((prev) => ({ ...prev, [type]: file }));
      if (type === "p12" || type === "mobileprovision") {
        setFileNames((prev) => ({ ...prev, [type]: file.name }));
      }
    }
  };

  const handleAdvancedFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "iconFile" | "tweakFiles"
  ) => {
    if (field === "iconFile" && e.target.files?.[0]) {
      setAdvancedSettings((prev) => ({ ...prev, [field]: e.target.files?.[0] || null }));
    } else if (field === "tweakFiles" && e.target.files) {
      setAdvancedSettings((prev) => ({ ...prev, [field]: e.target.files || null }));
    }
  };

  const handleScanDylibs = async () => {
    let ipaFile = files.ipa;
    if (!ipaFile && directIpaLink.trim() !== "") {
      try {
        const response = await fetch(directIpaLink);
        if (!response.ok) {
          console.error("Failed to download IPA for scanning:", response.statusText);
          alert("Error downloading IPA file from direct link for scanning. Please upload the IPA file manually.");
          return;
        }
        const blob = await response.blob();
        ipaFile = new File([blob], "downloaded.ipa", { type: "application/octet-stream" });
        setFiles((prev) => ({ ...prev, ipa: ipaFile }));
      } catch (error) {
        console.error("Error downloading IPA from direct link for scanning:", error);
        alert("Error downloading IPA file from direct link for scanning. Please upload the IPA file manually.");
        return;
      }
    }
    if (!ipaFile) {
      alert("Please select an IPA file first.");
      return;
    }
    const zip = new JSZip();
    zip.loadAsync(ipaFile)
      .then((zipContent) => {
        const dylibFiles = [];
        zipContent.forEach((relativePath, file) => {
          if (relativePath.toLowerCase().endsWith(".dylib")) {
            const fileName = relativePath.split("/").pop() || relativePath;
            dylibFiles.push({ name: fileName, selected: true });
          }
        });
        setAdvancedSettings((prev) => ({ ...prev, dylibs: dylibFiles }));
      })
      .catch((err) => {
        console.error("Error scanning IPA for dylibs:", err);
        alert("Error scanning IPA for dylibs");
      });
  };

  const handleSign = () => {
    setErrorMessage("");
    setUploadProgress(0);
    setSigningProgress(0);
    setInProgress(true);
    const formData = new FormData();
    if (files.ipa) formData.append("ipa", files.ipa);
    if (directIpaLink.trim() !== "") formData.append("ipa_direct_link", directIpaLink);
    if (files.p12) formData.append("p12", files.p12);
    if (files.mobileprovision) formData.append("mobileprovision", files.mobileprovision);
    formData.append("p12_password", password);
    
    if (storageOption !== "none") {
      formData.append("use_storj", storageOption);
    }
    
    if (showAdvanced) {
      if (advancedSettings.appName.trim() !== "")
        formData.append("cyan_name", advancedSettings.appName);
      if (advancedSettings.version.trim() !== "")
        formData.append("cyan_version", advancedSettings.version);
      if (advancedSettings.bundleId.trim() !== "")
        formData.append("cyan_bundle_id", advancedSettings.bundleId);
      if (advancedSettings.minOsVersion.trim() !== "")
        formData.append("cyan_minimum", advancedSettings.minOsVersion);
      if (advancedSettings.iconFile) formData.append("cyan_icon", advancedSettings.iconFile);
      if (advancedSettings.tweakFiles) {
        Array.from(advancedSettings.tweakFiles).forEach((file) => {
          formData.append("cyan_tweaks", file);
        });
      }
      if (advancedSettings.removeUiDevices) formData.append("cyan_remove_supported", "on");
      if (advancedSettings.removeWatchApps) formData.append("cyan_no_watch", "on");
      if (advancedSettings.enableDocumentSupport)
        formData.append("cyan_enable_documents", "on");
      if (advancedSettings.fakesignBinaries) formData.append("cyan_fakesign", "on");
      if (advancedSettings.thinToArm64) formData.append("cyan_thin", "on");
      if (advancedSettings.removeExtensions) formData.append("cyan_remove_extensions", "on");
      if (advancedSettings.ignoreEncryption) formData.append("cyan_ignore_encrypted", "on");
      if (advancedSettings.compressionLevel.trim() !== "")
        formData.append("cyan_compress_level", advancedSettings.compressionLevel);
      if (advancedSettings.dylibs && advancedSettings.dylibs.length > 0) {
        const selectedDylibs = advancedSettings.dylibs
          .filter((d) => d.selected)
          .map((d) => d.name);
        if (selectedDylibs.length > 0) {
          formData.append("remove_dylibs", JSON.stringify(selectedDylibs));
        }
      }
    }
    
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/sign", true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setUploadProgress(percentComplete);
        if (percentComplete === 100 && !signingIntervalRef.current) {
          let simulatedProgress = 0;
          signingIntervalRef.current = window.setInterval(() => {
            simulatedProgress += 5;
            if (simulatedProgress < 95) {
              setSigningProgress(simulatedProgress);
            } else {
              setSigningProgress(95);
            }
          }, 500);
        }
      }
    };
    xhr.onload = () => {
      if (signingIntervalRef.current) {
        clearInterval(signingIntervalRef.current);
        signingIntervalRef.current = null;
      }
      if (xhr.status === 200) {
        setSigningProgress(100);
        try {
          const data = JSON.parse(xhr.responseText);
          setResultData(data);
        } catch (e) {
          setErrorMessage("Invalid response from server");
          alert("Error: Invalid response from server");
        }
      } else {
        let errorResponse;
        try {
          errorResponse = JSON.parse(xhr.responseText);
        } catch (e) {
          errorResponse = {};
        }
        const errorMsg = errorResponse.error || "Signing failed";
        setErrorMessage(errorMsg);
        alert("Error during signing: " + errorMsg);
      }
      setInProgress(false);
    };
    xhr.onerror = () => {
      if (signingIntervalRef.current) {
        clearInterval(signingIntervalRef.current);
        signingIntervalRef.current = null;
      }
      setErrorMessage("Network error during signing");
      alert("Network error during signing");
      setInProgress(false);
    };
    xhr.send(formData);
  };

  const handleCopyLink = async () => {
    if (resultData && resultData.installLink) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(resultData.installLink);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = resultData.installLink;
          textArea.style.position = "fixed";
          textArea.style.left = "-99999px";
          textArea.style.top = "-99999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        toast({
          title: "Link copied!",
          description: "Install link copied to clipboard",
        });
      } catch (err) {
        console.error("Failed to copy text: ", err);
        toast({
          title: "Copy failed",
          description: "Please copy the link manually",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Helmet>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Daisuke Signer" />
        <link rel="apple-touch-icon" href="https://ipasign.pro/assets/Cult.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Helmet>

      <Navigation />

      <main className="flex-1 container py-6 md:py-10 px-4 md:px-6">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Daisuke Signer</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              Sign your iOS applications with ease and install them on your devices
            </p>
          </div>
          
          {resultData && (
            <div className="mb-8 text-center glass rounded-2xl p-6 md:p-8 border-border/80 border-2 animate-fade-in shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle2 className="text-green-500 w-12 h-12" />
              </div>
              
              <h2 className="text-2xl font-bold mb-4 text-foreground">{resultData.displayName} Signed Successfully</h2>
              
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href={resultData.installLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                    <Button variant="default" size="lg" className="w-full sm:w-auto gap-2 rounded-full">
                      <Download className="w-5 h-5" />
                      Install App
                    </Button>
                  </a>
                  
                  <Button onClick={handleCopyLink} variant="secondary" size="lg" className="w-full sm:w-auto gap-2 rounded-full">
                    <Copy className="w-5 h-5" /> 
                    Copy ITMS Link
                  </Button>
                  
                  <Button onClick={() => setResultData(null)} variant="outline" size="lg" className="w-full sm:w-auto rounded-full">
                    Sign Another App
                  </Button>
                </div>
                
                <div className="mt-2 text-sm text-muted-foreground">
                  Add to your iOS device instantly or share the installation link with others
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-6 glass p-7 md:p-9 rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="grid gap-5 md:gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  IPA File
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Upload the iOS application file you want to sign</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <div
                  className="relative group cursor-pointer file-select-button"
                  onClick={() => document.getElementById("ipa-input")?.click()}
                >
                  <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm hover:border-foreground/30 transition-all duration-200">
                    <span className="text-muted-foreground">
                      {files.ipa?.name || "Select IPA file"}
                    </span>
                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                  </div>
                  <Input
                    id="ipa-input"
                    type="file"
                    accept=".ipa"
                    onChange={(e) => handleFileChange(e, "ipa")}
                    className="hidden"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  P12 Certificate
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Your signing certificate exported from Keychain or Developer Portal</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <div
                  className="relative group cursor-pointer file-select-button"
                  onClick={() => document.getElementById("p12-input")?.click()}
                >
                  <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm hover:border-foreground/30 transition-all duration-200">
                    <span className="text-muted-foreground">
                      {fileNames.p12 || files.p12?.name || "Select P12 certificate"}
                    </span>
                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                  </div>
                  <Input
                    id="p12-input"
                    type="file"
                    accept=".p12"
                    onChange={(e) => handleFileChange(e, "p12")}
                    className="hidden"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  Provisioning Profile
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">The mobile provisioning profile that defines which devices can install the app</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <div
                  className="relative group cursor-pointer file-select-button"
                  onClick={() => document.getElementById("provision-input")?.click()}
                >
                  <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm hover:border-foreground/30 transition-all duration-200">
                    <span className="text-muted-foreground">
                      {fileNames.mobileprovision ||
                        files.mobileprovision?.name ||
                        "Select provisioning profile"}
                    </span>
                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                  </div>
                  <Input
                    id="provision-input"
                    type="file"
                    accept=".mobileprovision"
                    onChange={(e) => handleFileChange(e, "mobileprovision")}
                    className="hidden"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  Certificate Password
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Enter the password for your P12 certificate if it's password-protected</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter certificate password (if needed)"
                    className="rounded-xl pl-3 pr-10 hover:border-foreground/30 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                Direct IPA URL
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-[220px] text-xs">You can provide a direct download URL instead of uploading an IPA file</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <Input
                type="text"
                value={directIpaLink}
                onChange={(e) => setDirectIpaLink(e.target.value)}
                placeholder="Enter direct IPA URL"
                className="rounded-xl hover:border-foreground/30 transition-all duration-200"
              />
              <p className="text-xs text-muted-foreground ml-1">
                If provided, the IPA will be downloaded for scanning and signing.
              </p>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">Storage Options</label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-[220px] text-xs">Choose how your IPA file will be stored and accessed</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <Select value={storageOption} onValueChange={setStorageOption}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select storage option" />
                </SelectTrigger>
                <SelectContent>
                  {storageOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{option.name}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSign}
              className={`w-full rounded-full text-white mt-4 transition-all duration-300 ${
                isAllFieldsFilled 
                  ? "bg-foreground text-background hover:opacity-90 shadow-md hover:shadow-lg" 
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              size="lg"
              disabled={!isAllFieldsFilled || inProgress}
            >
              {inProgress ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                "Sign IPA"
              )}
            </Button>
            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-center text-sm">
                {errorMessage}
              </div>
            )}
            {inProgress && (
              <div className="space-y-6 mt-6 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-foreground">Uploading Files</p>
                    <span className="text-sm font-medium">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="relative w-full h-3 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-foreground/80 rounded-full transition-all duration-300 flex items-center justify-end"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {uploadProgress === 100 && (
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-background" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Signing IPA</p>
                      {signingProgress < 100 && <Loader2 className="h-3.5 w-3.5 text-foreground/70 animate-spin" />}
                    </div>
                    <span className="text-sm font-medium">{Math.round(signingProgress)}%</span>
                  </div>
                  <div className="relative w-full h-3 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-300 flex items-center justify-end"
                      style={{ width: `${signingProgress}%` }}
                    >
                      {signingProgress === 100 && (
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-white" />
                      )}
                    </div>
                  </div>
                </div>
                
                {signingProgress > 0 && signingProgress < 100 && (
                  <p className="text-xs text-center text-muted-foreground animate-pulse">
                    Please wait while we sign your application...
                  </p>
                )}
              </div>
            )}
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full rounded-xl hover:bg-secondary/50 hover:border-foreground/20 transition-all duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                Advanced Modifications
                <ChevronDown
                  className={`w-4 h-4 ml-2 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
                />
              </Button>
              {showAdvanced && (
                <div className="space-y-6 border rounded-xl p-6 md:p-8 animate-fade-in border-input bg-background/50 backdrop-blur-sm">
                  <h3 className="text-lg font-medium mb-4 text-center text-foreground">Advanced IPA Modifications</h3>
                  
                  <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New App Name</label>
                      <Input
                        value={advancedSettings.appName}
                        onChange={(e) =>
                          setAdvancedSettings((prev) => ({ ...prev, appName: e.target.value }))
                        }
                        placeholder="Enter new app name"
                        className="rounded-xl hover:border-foreground/30 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Version</label>
                      <Input
                        value={advancedSettings.version}
                        onChange={(e) =>
                          setAdvancedSettings((prev) => ({ ...prev, version: e.target.value }))
                        }
                        placeholder="Enter new version"
                        className="rounded-xl hover:border-foreground/30 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Bundle ID</label>
                      <Input
                        value={advancedSettings.bundleId}
                        onChange={(e) =>
                          setAdvancedSettings((prev) => ({ ...prev, bundleId: e.target.value }))
                        }
                        placeholder="com.example.app"
                        className="rounded-xl hover:border-foreground/30 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Minimum OS Version</label>
                      <Input
                        value={advancedSettings.minOsVersion}
                        onChange={(e) =>
                          setAdvancedSettings((prev) => ({ ...prev, minOsVersion: e.target.value }))
                        }
                        placeholder="14.0"
                        className="rounded-xl hover:border-foreground/30 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Icon</label>
                      <div
                        className="relative group cursor-pointer file-select-button"
                        onClick={() => document.getElementById("icon-input")?.click()}
                      >
                        <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm hover:border-foreground/30 transition-all duration-200">
                          <span className="text-muted-foreground">
                            {advancedSettings.iconFile?.name || "Select new app icon"}
                          </span>
                          <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                        </div>
                        <Input
                          id="icon-input"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAdvancedFileChange(e, "iconFile")}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tweak Files</label>
                      <div
                        className="relative group cursor-pointer file-select-button"
                        onClick={() => document.getElementById("tweak-input")?.click()}
                      >
                        <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm hover:border-foreground/30 transition-all duration-200">
                          <span className="text-muted-foreground">
                            {advancedSettings.tweakFiles
                              ? `${advancedSettings.tweakFiles.length} files selected`
                              : "Select tweak files"}
                          </span>
                          <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                        </div>
                        <Input
                          id="tweak-input"
                          type="file"
                          multiple
                          onChange={(e) => handleAdvancedFileChange(e, "tweakFiles")}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Dylib Removal</label>
                      <Button 
                        variant="outline" 
                        onClick={handleScanDylibs} 
                        className="w-full hover:bg-accent/50 transition-all duration-200"
                      >
                        Scan for Dylibs
                      </Button>
                      {advancedSettings.dylibs && advancedSettings.dylibs.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {advancedSettings.dylibs.map((d, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              className={`w-full justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                                d.selected ? "border-primary/50 bg-primary/5" : ""
                              }`}
                              onClick={() => handleToggleDylib(index)}
                            >
                              {d.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Compression Level</label>
                      <Select
                        value={advancedSettings.compressionLevel}
                        onValueChange={(value) =>
                          setAdvancedSettings((prev) => ({ ...prev, compressionLevel: value }))
                        }
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select compression level" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(10)].map((_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i} {i === 6 && "(Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <p className="text-sm font-medium mb-2">Additional Options</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.removeUiDevices ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              removeUiDevices: !prev.removeUiDevices,
                            }))
                          }
                        >
                          Remove UISupportedDevices
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.removeWatchApps ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              removeWatchApps: !prev.removeWatchApps,
                            }))
                          }
                        >
                          Remove watch apps
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.enableDocumentSupport ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              enableDocumentSupport: !prev.enableDocumentSupport,
                            }))
                          }
                        >
                          Enable document support
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.fakesignBinaries ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              fakesignBinaries: !prev.fakesignBinaries,
                            }))
                          }
                        >
                          Fakesign all binaries
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.thinToArm64 ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              thinToArm64: !prev.thinToArm64,
                            }))
                          }
                        >
                          Thin to arm64
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.removeExtensions ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              removeExtensions: !prev.removeExtensions,
                            }))
                          }
                        >
                          Remove all extensions
                        </Button>
                        <Button
                          variant="outline"
                          className={`justify-start rounded-xl transition-all duration-200 hover:bg-accent/50 ${
                            advancedSettings.ignoreEncryption ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() =>
                            setAdvancedSettings((prev) => ({
                              ...prev,
                              ignoreEncryption: !prev.ignoreEncryption,
                            }))
                          }
                        >
                          Ignore encryption check
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Need help? <a href="/docs.html" target="_blank" className="text-foreground hover:underline">Read our documentation</a></p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
