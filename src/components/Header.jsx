import React from 'react';
import { Layout as LayoutIcon } from 'lucide-react';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--foreground)]/10 bg-[var(--background)]/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* 1. Added 'relative' here so the absolute child positions itself relative to this box */}
        <div className="relative flex h-16 items-center justify-between">
          
          {/* Logo Area */}
          <div className="flex items-center gap-2 font-bold text-xl text-[var(--accent)]">
            <LayoutIcon className="h-6 w-6" />
            <span>Regintels</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gap-6 text-sm font-medium text-[var(--foreground)]/80">
            <a href="/" className="hover:text-[var(--accent)] transition-colors">Home</a>
            <a href="/dashboard" className="hover:text-[var(--accent)] transition-colors">Dashboard</a>
            <a href="/login" className="hover:text-[var(--accent)] transition-colors">Staff Login</a>
          </nav>

          {/* Right Side / Mobile Placeholder */}
          <div className="w-8"></div>
        </div>
      </div>
    </header>
  );
};

export default Header;
