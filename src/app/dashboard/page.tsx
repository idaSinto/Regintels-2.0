'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, X, AlertCircle, CheckCircle, Zap, RefreshCw, ExternalLink, ChevronRight, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

type Article = {
  id: number;
  title: string;
  url: string;
};

type VerifiedUpdate = {
  id: number;
  regulation: string;
  regulation_name: string;
  deduced_title: string;
  summary_text: string;
  impact_level: 'high' | 'medium' | 'low';
  primary_source_url: string | null;
  related_articles: Article[];
  deduced_published_date: string | null;
  created_at: string;
};

// ==========================================
// 2. HELPER / UTILITY FUNCTIONS
// ==========================================

/**
 * Returns UI labels and colors based on how many articles support the update
 */
const getConfidence = (count: number) => {
  if (count >= 4) return { 
    label: 'High', 
    color: 'bg-emerald-600',
    textColor: 'text-emerald-100',
    icon: <CheckCircle className="h-4 w-4 inline mr-1" /> 
  };
  if (count >= 2) return { 
    label: 'Medium', 
    color: 'bg-amber-500',
    textColor: 'text-amber-100',
    icon: <Zap className="h-4 w-4 inline mr-1" /> 
  };
  return { 
    label: 'Low', 
    color: 'bg-rose-600',
    textColor: 'text-rose-100',
    icon: <AlertCircle className="h-4 w-4 inline mr-1" /> 
  };
};

/**
 * Formats a date string into UK format (DD/MM/YYYY)
 */
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'No date available';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? 'No date available' : date.toLocaleDateString('en-GB');
};

/**
 * Determines the color and icon based on the impact level (High/Medium/Low)
 */
const impactColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'high': return { 
      color: 'bg-rose-600',
      textColor: 'text-rose-100',
      icon: <AlertCircle className="h-4 w-4 inline mr-1" />
    };
    case 'medium': return { 
      color: 'bg-amber-500',
      textColor: 'text-amber-100',
      icon: <Zap className="h-4 w-4 inline mr-1" />
    };
    case 'low': return { 
      color: 'bg-emerald-600',
      textColor: 'text-emerald-100',
      icon: <CheckCircle className="h-4 w-4 inline mr-1" />
    };
    default: return { 
      color: 'bg-gray-400',
      textColor: 'text-gray-100',
      icon: null 
    };
  }
};

// ==========================================
// 3. ANIMATION SETTINGS (Framer Motion)
// ==========================================

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  hover: { y: -4, transition: { duration: 0.2 } },
  tap: { scale: 0.98 }
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

// ==========================================
// 4. MAIN COMPONENT
// ==========================================

export default function DashboardPage() {
  // --- STATE ---
  const [updates, setUpdates] = useState<VerifiedUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState<VerifiedUpdate | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  // --- API FUNCTIONS ---

  /**
   * Loads data from the database
   */
  const fetchUpdates = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/latest-verified-updates');
      const data = await res.json();
      setUpdates(data);
    } catch (err) {
      console.error('Fetch latest updates error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Starts the background scanning process
   */
  const runPipeline = async () => {
    setPipelineRunning(true);
    try {
      const res = await fetch('/api/run-pipeline');
      await res.json();
      await fetchUpdates(); // Refresh list after scan finish
    } catch (err) {
      console.error('Pipeline error', err);
    } finally {
      setPipelineRunning(false);
    }
  };

  // Run on initial page load
  useEffect(() => {
    fetchUpdates();
  }, []);

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  // Calculate total article count
  const articleCount = updates.reduce((acc, u) => acc + (u.related_articles?.length || 0), 0);

  // --- FILTERING & SORTING LOGIC ---
  const filteredAndSortedUpdates = updates
    .filter(u =>
      u.regulation_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by Name
      if (sortKey === 'name') {
        const nameA = a.regulation_name.toLowerCase();
        const nameB = b.regulation_name.toLowerCase();
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      // Sort by Date
      const dateA = a.deduced_published_date
        ? new Date(a.deduced_published_date).getTime()
        : 0;
      const dateB = b.deduced_published_date
        ? new Date(b.deduced_published_date).getTime()
        : 0;

      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.32))] w-full bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] px-4 py-8">
      
      {/* Background gradient hint */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-[var(--secondary)] to-transparent -z-10" />

      <div className="container mx-auto">
        
        {/* HEADER */}
        <section className="w-full text-center px-4 mb-8">
          <div className="inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)] mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent)] mr-2"></span>
            Live Monitoring
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-7xl mb-6">
            Regulatory Intelligence
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--foreground)]/80 mb-10">
            Real-time monitoring of regulatory changes
          </p>
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={runPipeline}
              disabled={pipelineRunning}
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--accent)]/20"
            >
              {pipelineRunning ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Start Scanning
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
            
            <button
              onClick={() => router.push('/dashboard/regulations')}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-6 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
            >
              <Filter className="h-5 w-5" />
              Edit Regulations
            </button>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Total Updates</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-2">{updates.length}</p>
          </div>
          <div 
            onClick={() => router.push('/dashboard/impact-settings')}
            className="cursor-pointer bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-all"
          >
            <p className="text-sm text-[var(--foreground)]/70">High Impact</p>
            <p className="text-3xl font-bold text-rose-500 mt-2">
              {updates.filter(u => u.impact_level === 'high').length}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Avg. Confidence</p>
            <p className="text-3xl font-bold text-blue-500 mt-2">
              {updates.length > 0 
                ? Math.round((updates.reduce((acc, u) => acc + (u.related_articles?.length || 0), 0) / updates.length) * 25) + '%'
                : '0%'
              }
            </p>
            <p className="text-sm text-[var(--foreground)]/70">{articleCount} Total articles</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50">
              <Search className="h-4 w-4 text-[var(--foreground)]/60" />
              <input
                type="text"
                placeholder="Search by regulation name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[var(--foreground)] focus:outline-none"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as 'date' | 'name')}
                className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Regulation Name</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            <button
              onClick={() => fetchUpdates(true)}
              disabled={refreshing}
              className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-[var(--foreground)] hover:bg-white/50 dark:hover:bg-gray-800/50 flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading / Empty / Data Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full border-t-2 border-b-2 border-[var(--accent)] animate-spin"></div>
            <p className="mt-4 text-lg text-[var(--foreground)]/70">
              Loading latest updates...
            </p>
          </div>
        ) : updates.length === 0 ? (
          <div className="text-center py-20 bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
              No updates found
            </h3>
            <p className="text-[var(--foreground)]/70 mb-6">
              Start scanning to discover regulatory changes
            </p>
            <button
              onClick={runPipeline}
              className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-base font-semibold hover:opacity-90 transition-all"
            >
              <Zap className="h-5 w-5" />
              Run First Scan
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredAndSortedUpdates.map((update) => {
              const articleCount = update.related_articles?.length ?? 0;
              const confidence = getConfidence(articleCount);
              const impact = impactColor(update.impact_level);

              return (
                <motion.div
                  key={update.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                  className="group cursor-pointer"
                  onClick={() => setModalOpen(update)}
                >
                  <div className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[300px] border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-[var(--foreground)] line-clamp-2 mb-2">
                            {update.deduced_title}
                          </h2>
                          <p className="text-[var(--foreground)]/70 text-sm">
                            {update.regulation_name}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-[var(--foreground)]/40 group-hover:text-[var(--accent)] transform group-hover:translate-x-1 transition-all" />
                      </div>
                      
                      {update.deduced_published_date && (
                        <div className="flex items-center text-[var(--foreground)]/50 text-xs mb-3">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                          Updated: {formatDate(update.deduced_published_date)}
                        </div>
                      )}
                      
                      <p className="text-[var(--foreground)]/80 text-sm mt-3 line-clamp-3 leading-relaxed">
                        {update.summary_text}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-6">
                      <span className={`px-4 py-2 rounded-full text-xs font-semibold ${impact.textColor} ${impact.color} flex items-center`}>
                        {impact.icon} {capitalize(update.impact_level)} Impact
                      </span>

                      <span className={`px-4 py-2 rounded-full text-xs font-semibold ${confidence.textColor} ${confidence.color} flex items-center`}>
                        {confidence.icon} {confidence.label} Confidence
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* DETAIL MODAL POPUP */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setModalOpen(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200/50 dark:border-gray-700/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER */}
              <div className="sticky top-0 z-10 p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60">
                <div className="flex items-start justify-between">
                  <div className="pr-8">
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">{modalOpen.deduced_title}</h2>
                    <p className="text-[var(--foreground)]/70 text-sm mt-1">{modalOpen.regulation_name}</p>
                  </div>
                  <button
                    onClick={() => setModalOpen(null)}
                    className="text-gray-500 hover:text-gray-400"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 mt-4">
                  <span className={`px-4 py-2 rounded-full text-xs font-semibold ${impactColor(modalOpen.impact_level).textColor} ${impactColor(modalOpen.impact_level).color} flex items-center`}>
                    {impactColor(modalOpen.impact_level).icon} {capitalize(modalOpen.impact_level)} Impact
                  </span>
                  <span className="text-[var(--foreground)]/60 text-sm flex items-center">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                    {formatDate(modalOpen.deduced_published_date)}
                  </span>
                </div>
              </div>

              {/* MODAL CONTENT BODY */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <section className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Summary
                  </h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed bg-white/50 dark:bg-gray-800/50 rounded-xl p-5">
                    {modalOpen.summary_text}
                  </p>
                </section>

                {modalOpen.primary_source_url && (
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
                      Primary Source
                    </h3>
                    <a
                      href={modalOpen.primary_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white font-semibold rounded-xl hover:opacity-90 transition-all"
                    >
                      View Source Document
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </section>
                )}

                <section>
                  <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Related Articles ({modalOpen.related_articles?.length || 0})
                  </h3>
                  {modalOpen.related_articles?.length > 0 ? (
                    <div className="space-y-3">
                      {modalOpen.related_articles.map((article) => (
                        <a
                          key={article.id}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:border-[var(--accent)]/50 bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all group"
                        >
                          <span className="text-blue-600 dark:text-blue-400 group-hover:underline text-sm font-medium">
                            {article.title || article.url}
                          </span>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-[var(--foreground)]/60">No related articles found.</p>
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
