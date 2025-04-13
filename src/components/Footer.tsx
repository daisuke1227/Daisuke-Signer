
import { MessageCircle, Youtube } from "lucide-react";
import { useLocation } from "react-router-dom";

export const Footer = () => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";
  const showFooterContent = isHomePage;

  return (
    <footer className="mt-6 py-8 bg-background">
      <div className="container mx-auto text-center">
        {showFooterContent && (
          <>
            <p className="text-3xl font-bold text-foreground mb-6">Made by Daisuke</p>
            
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8">
              <a 
                href="https://discord.gg/ipasign" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full md:w-64 py-4 px-6 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/20 hover:border-[#5865F2]/40 transition-all duration-300 group"
              >
                <MessageCircle className="w-8 h-8 text-[#5865F2] group-hover:scale-110 transition-transform duration-300" />
                <div className="flex flex-col items-start">
                  <span className="text-lg font-medium text-foreground">Join our Discord</span>
                  <span className="text-sm text-muted-foreground">Get help and updates</span>
                </div>
              </a>
              
              <a 
                href="https://youtube.com/@dai1228." 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full md:w-64 py-4 px-6 rounded-xl bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/20 hover:border-[#FF0000]/40 transition-all duration-300 group"
              >
                <Youtube className="w-8 h-8 text-[#FF0000] group-hover:scale-110 transition-transform duration-300" />
                <div className="flex flex-col items-start">
                  <span className="text-lg font-medium text-foreground">YouTube Channel</span>
                  <span className="text-sm text-muted-foreground">Watch tutorials</span>
                </div>
              </a>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
