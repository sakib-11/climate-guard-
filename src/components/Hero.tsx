import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";
import heroForest from "@/assets/hero-forest.jpg";

interface HeroProps {
  onSearch: (location: string) => void;
}

export const Hero = ({ onSearch }: HeroProps) => {
  const [location, setLocation] = useState("");

  const handleSearch = () => {
    if (location.trim()) {
      onSearch(location);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${heroForest})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/50 to-primary/70" />
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
          Predict Climate Risks.<br />
          Protect What Matters.
        </h1>
        
        <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12 font-light">
          AI-powered localized climate hazard forecasting
        </p>

        {/* Interactive Location Input */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row gap-3 bg-card/95 backdrop-blur-sm p-3 rounded-2xl shadow-[var(--shadow-soft)]">
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Enter city, district, or coordinates..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-12 h-14 text-lg border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <Button
              onClick={handleSearch}
              size="lg"
              className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            >
              <Search className="w-5 h-5 mr-2" />
              Analyze Risk
            </Button>
          </div>
          
          <p className="text-primary-foreground/70 text-sm mt-4">
            Try: "San Francisco, CA" or "Mumbai, India" or coordinates
          </p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary-foreground/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};
