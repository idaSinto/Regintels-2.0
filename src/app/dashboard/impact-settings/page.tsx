'use client';

import { useState, useEffect } from "react";
import { Plus, Trash2, AlertCircle, Zap, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ImpactKeyword = {
  id: number;
  keyword: string;
  level: "high" | "medium" | "low";
};

const getLevelColor = (level: string) => {
  switch (level) {
    case "high": return { 
      color: "bg-rose-600", 
      textColor: "text-rose-100",
      icon: <AlertCircle className="h-4 w-4 inline mr-1" />
    };
    case "medium": return { 
      color: "bg-amber-500", 
      textColor: "text-amber-100",
      icon: <Zap className="h-4 w-4 inline mr-1" />
    };
    case "low": return { 
      color: "bg-emerald-600", 
      textColor: "text-emerald-100",
      icon: <CheckCircle className="h-4 w-4 inline mr-1" />
    };
    default: return { 
      color: "bg-gray-400", 
      textColor: "text-gray-100",
      icon: null 
    };
  }
};

export default function ImpactSettingsPage() {
  const [keywords, setKeywords] = useState<ImpactKeyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLevel, setNewLevel] = useState<"high" | "medium" | "low">("high");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Fetch keywords from API
  const fetchKeywords = async () => {
    setLoading(true);
    const res = await fetch("/api/impact-keywords");
    const data = await res.json();
    setKeywords(data);
    setLoading(false);
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;

    await fetch("/api/impact-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword, level: newLevel }),
    });

    setNewKeyword("");
    fetchKeywords();
  };

  const updateLevel = async (id: number, level: "high" | "medium" | "low") => {
    await fetch("/api/impact-keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, level }),
    });
    fetchKeywords();
  };

  const deleteKeyword = async (id: number) => {
    setDeletingId(id);
    await fetch(`/api/impact-keywords?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchKeywords();
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl">
        
        {/* HEADER */}
        <section className="mb-8 w-full px-1 text-center sm:px-2">
          <div className="mb-6 inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)]">
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent)] mr-2"></span>
            Impact Configuration
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Impact Keywords
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--foreground)]/80 mb-10">
            Configure keywords that determine impact level of regulatory updates
          </p>
        </section>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Total Keywords</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-2">{keywords.length}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">High Impact</p>
            <p className="text-2xl font-bold text-rose-500 mt-2">
              {keywords.filter(k => k.level === 'high').length}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Low Impact</p>
            <p className="text-2xl font-bold text-emerald-500 mt-2">
              {keywords.filter(k => k.level === 'low').length}
            </p>
          </div>
        </div>

        {/* Add new keyword */}
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Add New Keyword</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={newKeyword}
              placeholder="Enter keyword (e.g., 'ban', 'restrict', 'prohibit')"
              onChange={(e) => setNewKeyword(e.target.value)}
            />
            <select
              aria-label="Select impact level for new keyword"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value as any)}
            >
              <option value="high">High Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="low">Low Impact</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={addKeyword}
              className="bg-[var(--accent)] text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20"
            >
              <Plus className="w-5 h-5" /> Add Keyword
            </motion.button>
          </div>
        </div>

        {/* Keyword list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full border-t-2 border-b-2 border-[var(--accent)] animate-spin"></div>
            <p className="mt-4 text-lg text-[var(--foreground)]/70">
              Loading keywords...
            </p>
          </div>
        ) : keywords.length === 0 ? (
          <div className="text-center py-20 bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
              No keywords configured
            </h3>
            <p className="text-[var(--foreground)]/70 mb-6">
              Add your first impact keyword to start
            </p>
          </div>
        ) : (
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Configured Keywords ({keywords.length})
              </h2>
              <p className="text-sm text-[var(--foreground)]/70 mt-1">
                Update impact levels by selecting from dropdown
              </p>
            </div>
            <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              <AnimatePresence>
                {keywords.map((k) => {
                  const level = getLevelColor(k.level);
                  return (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`flex items-center justify-between p-4 hover:bg-white/30 dark:hover:bg-gray-800/30 transition-all ${
                        deletingId === k.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-lg ${level.color} flex items-center justify-center`}>
                          {level.icon}
                        </div>
                        <span className="font-medium text-[var(--foreground)] text-lg">{k.keyword}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          aria-label={`Select impact level for keyword: ${k.keyword}`}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          value={k.level}
                          onChange={(e) => updateLevel(k.id, e.target.value as any)}
                        >
                          <option value="high">High Impact</option>
                          <option value="medium">Medium Impact</option>
                          <option value="low">Low Impact</option>
                        </select>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteKeyword(k.id)}
                          className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
