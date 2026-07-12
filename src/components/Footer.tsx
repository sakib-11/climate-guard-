import { Leaf, Linkedin, Send, Shield } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = {
    linkedin: "#",
    email: "#",
  };

  const resourceLinks = {
    documentation: "#",
    researchPapers: "https://www.ipcc.ch/reports/",
    geminiAPI: "https://ai.google.dev/gemini-api",
    climateAPI: "https://open-meteo.com/",
  };

  return (
    <footer className="bg-primary text-primary-foreground py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Logo + Mission */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-7 h-7" />
            <span className="text-2xl font-semibold">ClimateGuard</span>
          </div>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-10 text-center sm:text-left">
          {/* About */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">About Me</h3>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>Sakib Inamdar</li>
              <li>B.Tech Data Science</li>
              <li>Department of Technology, SPPU Pune</li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Resources & Tools</h3>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <a
                  href={resourceLinks.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Sakib Project
                </a>
              </li>
              <li>
                <a
                  href={resourceLinks.researchPapers}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Research Papers
                </a>
              </li>
              <li>
                <a
                  href={resourceLinks.geminiAPI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Gemini API
                </a>
              </li>
              <li>
            
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="font-semibold mb-4 text-lg">Connect with Me</h3>
            <div className="flex gap-4">
              {/* LinkedIn */}
              <a
                href={socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>



              {/* Email */}
              <a
                href={socialLinks.email}
                className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition"
                aria-label="Email"
              >
                <Send className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/20 text-center text-sm text-primary-foreground/70">
          <p>© {currentYear} ClimateGuard. All rights reserved.</p>
          <p className="mt-2 text-xs text-primary-foreground/60">
            Built with 🌍 by Sakib Inamdar | AI for Earth
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
