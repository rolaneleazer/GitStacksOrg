import { Coffee, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const BMC_HANDLE = 'ronelmol';
const BMC_URL = `https://buymeacoffee.com/${BMC_HANDLE}`;

/**
 * BuyMeACoffeeWidget
 * Loads the official Buy Me a Coffee floating widget script.
 * Includes a native floating fallback launcher so the button is always visible
 * even when third-party CDN scripts are blocked by browser ad-blockers.
 */
export function BuyMeACoffeeWidget({
  yOffset = 84,
  position = 'Right'
}: {
  yOffset?: number;
  position?: 'Right' | 'Left';
}) {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Avoid re-injecting if script or widget already present
    const existing = document.querySelector('script[data-name="BMC-Widget"]');
    if (existing) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-name', 'BMC-Widget');
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
    script.setAttribute('data-id', BMC_HANDLE);
    script.setAttribute('data-description', 'Support me on Buy me a coffee!');
    script.setAttribute('data-message', '');
    script.setAttribute('data-color', '#5F7FFF');
    script.setAttribute('data-position', position);
    script.setAttribute('data-x_margin', '18');
    script.setAttribute('data-y_margin', String(yOffset));
    script.async = true;

    script.onload = () => {
      setScriptLoaded(true);
    };

    script.onerror = () => {
      // If CDN fails or is blocked by ad-blocker, fallback stays active
      setScriptLoaded(false);
    };

    document.body.appendChild(script);

    return () => {
      // Retain or clean up widget container if needed
      const bmcContainer = document.getElementById('bmc-wbtn');
      if (bmcContainer) {
        bmcContainer.style.display = 'none';
      }
    };
  }, [yOffset, position]);

  // If the third-party widget didn't inject its button after 2.5s, show the native floating fallback
  const [showFallback, setShowFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const bmcBtn = document.getElementById('bmc-wbtn');
      if (!bmcBtn) {
        setShowFallback(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!showFallback) return null;

  return (
    <aside
      aria-label="Support via Buy Me a Coffee"
      className="fixed z-40 transition-all duration-200"
      style={{
        bottom: `${yOffset}px`,
        right: position === 'Right' ? '18px' : 'auto',
        left: position === 'Left' ? '18px' : 'auto'
      }}
    >
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 rounded-full bg-[#FFDD00] px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:shadow-xl hover:bg-[#FFE333] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFDD00]"
        title="Support ronelmol on Buy me a coffee"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-slate-900 group-hover:scale-110 transition-transform">
          <Coffee className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold tracking-tight">Buy me a coffee</span>
      </a>
    </aside>
  );
}

/**
 * BuyMeACoffeeButton
 * Reusable official brand button for Header and Footer
 */
interface BuyMeACoffeeButtonProps {
  variant?: 'compact' | 'full' | 'icon-only';
  className?: string;
}

export function BuyMeACoffeeButton({
  variant = 'compact',
  className = ''
}: BuyMeACoffeeButtonProps) {
  if (variant === 'compact') {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#FFDD00] px-3 py-1.5 text-xs font-bold text-slate-950 shadow-2xs hover:bg-[#FFE333] hover:shadow-xs transition-all whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFDD00] shrink-0 ${className}`}
        title="Buy me a coffee @ronelmol"
      >
        <Coffee className="h-3.5 w-3.5 text-slate-900 shrink-0" />
        <span>Buy me a coffee</span>
      </a>
    );
  }

  if (variant === 'icon-only') {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFDD00] text-slate-950 shadow-2xs hover:bg-[#FFE333] transition-all focus-visible:outline-2 focus-visible:outline-[#FFDD00] ${className}`}
        title="Buy me a coffee @ronelmol"
        aria-label="Buy me a coffee"
      >
        <Coffee className="h-4 w-4" />
      </a>
    );
  }

  // 'full' variant for Footer and support callouts
  return (
    <div className={`space-y-2 ${className}`}>
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2.5 rounded-xl bg-[#FFDD00] px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-[#FFE333] hover:shadow-md transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFDD00]"
        title="Support ronelmol on Buy me a coffee"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/10">
          <Coffee className="h-3.5 w-3.5 text-slate-950" />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="font-extrabold tracking-tight">Buy me a coffee</span>
          <span className="text-[10px] font-medium text-slate-800">Support @ronelmol</span>
        </div>
        <ExternalLink className="ml-1 h-3 w-3 text-slate-700" />
      </a>
      <p className="text-[11px] text-slate-500 leading-snug">
        Support independent open-source tools, technical research, and live sandbox maintenance.
      </p>
    </div>
  );
}
