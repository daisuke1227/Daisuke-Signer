import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

interface CertConfig {
  id: string;
  name: string;
  p12File: string;
  provisionFile: string;
  password: string;
}

const Config = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<CertConfig[]>([]);
  const [newConfig, setNewConfig] = useState({
    p12File: null as File | null,
    provisionFile: null as File | null,
    password: "",
    name: ""
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedConfigs = localStorage.getItem("certConfigs");
    if (savedConfigs) {
      setConfigs(JSON.parse(savedConfigs));
    }
  }, []);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "p12File" | "provisionFile"
  ) => {
    if (e.target.files?.[0]) {
      setNewConfig((prev) => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleSave = () => {
    if (!newConfig.p12File || !newConfig.provisionFile || !newConfig.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    const configName = newConfig.name.trim() || `Cert ${configs.length + 1}`;

    const p12Reader = new FileReader();
    const provisionReader = new FileReader();

    p12Reader.onload = () => {
      const p12Data = p12Reader.result as string;
      provisionReader.readAsDataURL(newConfig.provisionFile!);

      provisionReader.onload = () => {
        const provisionData = provisionReader.result as string;

        const newConfigs = [
          ...configs,
          {
            id: Date.now().toString(),
            name: configName,
            p12File: p12Data,
            provisionFile: provisionData,
            password: newConfig.password
          }
        ];

        setConfigs(newConfigs);
        localStorage.setItem("certConfigs", JSON.stringify(newConfigs));
        toast.success("Configuration saved successfully");
        setNewConfig({
          p12File: null,
          provisionFile: null,
          password: "",
          name: ""
        });
      };
    };

    p12Reader.readAsDataURL(newConfig.p12File!);
  };

  const handleConfigSelect = (config: CertConfig) => {
    sessionStorage.setItem(
      "selectedConfig",
      JSON.stringify({
        p12File: config.p12File,
        provisionFile: config.provisionFile,
        password: config.password
      })
    );

    navigate("/");
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
      <Helmet>
        <title>Configurations - Daisuke Signer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Helmet>
      
      <Navigation />

      <main className="flex-1 container py-8">
        <div className="w-full space-y-8 animate-fade-in max-w-4xl mx-auto">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Certificate Configurations</h1>
            <p className="text-lg text-muted-foreground">
              Save your certificate configurations for quick access
            </p>
          </div>

          <div className="space-y-8">
            {configs.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Saved Configurations</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {configs.map((config) => (
                    <Button
                      key={config.id}
                      variant="outline"
                      className="h-auto p-4 text-left flex flex-col items-start space-y-2 rounded-xl"
                      onClick={() => handleConfigSelect(config)}
                    >
                      <span className="font-medium">{config.name}</span>
                      <span className="text-sm text-muted-foreground">Click to use this configuration</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6 glass p-8 rounded-xl border">
              <h2 className="text-xl font-semibold">New Configuration</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Configuration Name</label>
                  <Input
                    value={newConfig.name}
                    onChange={(e) => setNewConfig((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter a name (optional)"
                    className="rounded-xl focus:ring-0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">P12 Certificate</label>
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById("p12-input")?.click()}>
                    <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm">
                      <span className="text-muted-foreground">
                        {newConfig.p12File?.name || "Select P12 certificate"}
                      </span>
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Input id="p12-input" type="file" accept=".p12" onChange={(e) => handleFileChange(e, "p12File")} className="hidden" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Provisioning Profile</label>
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById("provision-input")?.click()}>
                    <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-input bg-background text-sm">
                      <span className="text-muted-foreground">
                        {newConfig.provisionFile?.name || "Select provisioning profile"}
                      </span>
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="provision-input"
                      type="file"
                      accept=".mobileprovision"
                      onChange={(e) => handleFileChange(e, "provisionFile")}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Certificate Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newConfig.password}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter certificate password"
                      className="rounded-xl focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                className="w-full bg-[#1e90ff] hover:bg-[#1e90ff]/90 text-white rounded-xl"
                size="lg"
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Config;
