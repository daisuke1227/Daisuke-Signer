
import { Helmet } from "react-helmet";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ExternalLink, Github } from "lucide-react";

const Credits = () => {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Helmet>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Credits - Daisuke Signer</title>
      </Helmet>
      
      <Navigation />
      
      <main className="flex-1 container py-8 md:py-12 px-4 md:px-6">
        <div className="w-full max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground animate-fade-in">Daisuke Signer Team</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              Meet all the people who made this possible
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {/* Daisuke */}
            <div className="glass p-8 rounded-3xl flex flex-col items-center text-center space-y-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <img 
                  src="https://cdn.discordapp.com/avatars/630151942135480370/a5e0a5e61923da95643b447691ca6bca.png?size=1024" 
                  alt="Daisuke" 
                  className="w-24 h-24 rounded-full object-cover relative z-10 ring-2 ring-background shadow-lg"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Daisuke</h3>
                <p className="text-primary font-medium">Owner & Backend Developer</p>
                <p className="text-muted-foreground text-sm px-4">
                  Backend engineer who also manages the signer and the Discord server.
                </p>
              </div>
              <div className="flex gap-3 text-muted-foreground">
                <a href="https://github.com/daisuke1227" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  <Github className="h-5 w-5" />
                  <span className="sr-only">GitHub</span>
                </a>
              </div>
            </div>
            
            {/* moonydev */}
            <div className="glass p-8 rounded-3xl flex flex-col items-center text-center space-y-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/40 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <img 
                  src="https://avatars.githubusercontent.com/u/176533579?v=4" 
                  alt="moonydev" 
                  className="w-24 h-24 rounded-full object-cover relative z-10 ring-2 ring-background shadow-lg"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">moonydev</h3>
                <p className="text-[#8B5CF6] font-medium">Frontend Developer</p>
                <p className="text-muted-foreground text-sm px-4">
                  UI/UX expert, creating intuitive and beautiful interfaces.
                </p>
              </div>
              <div className="flex gap-3 text-muted-foreground">
                <a href="https://moony-dev.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#8B5CF6] transition-colors flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm">Portfolio</span>
                </a>
              </div>
            </div>
            
            {/* zig.wangles */}
            <div className="glass p-8 rounded-3xl flex flex-col items-center text-center space-y-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl animate-fade-up" style={{ animationDelay: "300ms" }}>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/20 to-[#F97316]/40 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <img 
                  src="https://avatars.githubusercontent.com/u/153235983?v=4" 
                  alt="zig.wangles" 
                  className="w-24 h-24 rounded-full object-cover relative z-10 ring-2 ring-background shadow-lg"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">zig.wangles</h3>
                <p className="text-[#F97316] font-medium">Contributor</p>
                <p className="text-muted-foreground text-sm px-4">
                  Allowed us to add the permanent download install feature.
                </p>
              </div>
              <div className="flex gap-3 text-muted-foreground">
                <a href="https://pirating.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#F97316] transition-colors flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm">Portfolio</span>
                </a>
              </div>
            </div>
          </div>
          
          <div className="text-center pt-8">
            <p className="text-muted-foreground">
              Want to contribute? Join our <a href="https://discord.gg/BRjSCXNzan" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Discord server</a>.
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Credits;
