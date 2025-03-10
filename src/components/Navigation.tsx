
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Navigation = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="w-full border-b z-50 bg-background/80 backdrop-blur-xl sticky top-0">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-base md:text-lg font-semibold whitespace-nowrap">Daisuke Signer</span>
          
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground text-sm md:text-base whitespace-nowrap"
            >
              Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/config")}
              className="text-muted-foreground hover:text-foreground text-sm md:text-base whitespace-nowrap"
            >
              Configurations
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/credits")}
              className="text-muted-foreground hover:text-foreground text-sm md:text-base whitespace-nowrap"
            >
              Credits
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden p-4 bg-background/95 backdrop-blur-lg border-b border-border animate-fade-in">
          <div className="flex flex-col space-y-3">
            <Button
              variant="ghost"
              onClick={() => {
                navigate("/");
                setMobileMenuOpen(false);
              }}
              className="justify-start"
            >
              Home
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigate("/config");
                setMobileMenuOpen(false);
              }}
              className="justify-start"
            >
              Configurations
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigate("/credits");
                setMobileMenuOpen(false);
              }}
              className="justify-start"
            >
              Credits
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};
