'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Edit2, Globe, Calendar, Search, ArrowUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// ==========================================
// TYPES
// ==========================================
type Regulation = {
  id: number;
  name: string;
  last_scanned_at: string | null;
  regulation_search_profiles?: {
    authority: string;
    search_queries: string[];
    primary_sources?: string[] | null;
    secondary_sources?: string[] | null;
  };
};

type RegulationFormProps = {
  regulation?: Regulation;
  onClose: () => void;
  onSave: () => void;
};

const normalizeList = (values?: string[] | null) =>
  Array.from(new Set((values ?? []).map(value => value.trim()).filter(Boolean)));

function ChipField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const item = draft.trim();
    if (!item) return;
    onChange(Array.from(new Set([...items, item])));
    setDraft('');
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-[var(--foreground)]/70">{label}</label>
      <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 p-3">
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-1.5 text-sm text-[var(--accent)]"
            >
              <span className="max-w-[220px] truncate">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter(existing => existing !== item))}
                className="text-[var(--accent)]/70 hover:text-[var(--accent)]"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-lg border border-gray-300/70 dark:border-gray-600 bg-white/60 dark:bg-gray-900/40 px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// FORM MODAL
// ==========================================
function RegulationForm({ regulation, onClose, onSave }: RegulationFormProps) {
  const [name, setName] = useState(regulation?.name || '');
  const [authority, setAuthority] = useState(regulation?.regulation_search_profiles?.authority || '');
  const [queries, setQueries] = useState(normalizeList(regulation?.regulation_search_profiles?.search_queries));
  const [primarySources, setPrimarySources] = useState(normalizeList(regulation?.regulation_search_profiles?.primary_sources));
  const [secondarySources, setSecondarySources] = useState(normalizeList(regulation?.regulation_search_profiles?.secondary_sources));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !authority.trim()) return alert('Please fill all required fields');

    setSaving(true);
    try {
      const method = regulation ? 'PUT' : 'POST';
      const url = regulation ? `/api/regulations/${regulation.id}` : '/api/regulations';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          regulation_search_profiles: {
            authority: authority.trim(),
            search_queries: queries,
            primary_sources: primarySources,
            secondary_sources: secondarySources,
          },
        }),
      });

      if (res.ok) { onSave(); onClose(); }
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] p-5 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 w-full max-w-md text-sm"
        onClick={e => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">
            {regulation ? 'Edit Regulation' : 'Add Regulation'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--foreground)]/70">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., GDPR"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--foreground)]/70">Authority *</label>
            <input
              type="text"
              value={authority}
              onChange={e => setAuthority(e.target.value)}
              placeholder="e.g., European Commission"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              required
            />
          </div>
          <ChipField
            label="Search Queries"
            items={queries}
            onChange={setQueries}
            placeholder="Type a search query and press Enter"
          />
          <ChipField
            label="Primary Source Domains"
            items={primarySources}
            onChange={setPrimarySources}
            placeholder="Type a domain and press Enter"
          />
          <ChipField
            label="Secondary Source Domains"
            items={secondarySources}
            onChange={setSecondarySources}
            placeholder="Type a backup domain and press Enter"
          />
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-[var(--foreground)] hover:bg-white/50 dark:hover:bg-gray-800/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

// ==========================================
// ANIMATION VARIANTS
// ==========================================
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  hover: { y: -4, transition: { duration: 0.2 } },
};

// ==========================================
// MAIN PAGE
// ==========================================
export default function RegulationsPage() {
  const [regs, setRegs] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Regulation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'last_scanned_at'>('name');
  const [showBackToTop, setShowBackToTop] = useState(false);

  const fetchRegs = async () => {
    setLoading(true);
    const res = await fetch('/api/regulations');
    const data = await res.json();
    setRegs(data);
    setLoading(false);
  };

  useEffect(() => { fetchRegs(); }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/regulations/${id}`, { method: 'DELETE' });
    fetchRegs();
  };

  const handleAdd = () => { setEditingReg(null); setModalOpen(true); };
  const handleEdit = (reg: Regulation) => { setEditingReg(reg); setModalOpen(true); };
  const handleReset = () => {
    setSearchTerm('');
    setSortBy('name');
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : 'Never';

  const filteredRegs = regs
    .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 r.regulation_search_profiles?.authority?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a,b) => sortBy==='name'? a.name.localeCompare(b.name) :
      (b.last_scanned_at ? new Date(b.last_scanned_at).getTime() : 0) - (a.last_scanned_at ? new Date(a.last_scanned_at).getTime() : 0)
    );

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl">
        
        {/* HEADER */}
        <section className="mb-8 w-full px-1 text-center sm:px-2">
          <div className="mb-6 inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)]">
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent)] mr-2"></span>
            Configuration Manager
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-7xl mb-6">
            Regulations
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--foreground)]/80 mb-10">
            Configure and manage regulatory monitoring profiles
          </p>
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--accent)]/20"
            >
              <Plus className="h-5 w-5" />
              Add Regulation
            </motion.button>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Total Regulations</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-2">{regs.length}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Active Scanning</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-2">
              {regs.filter(r => r.last_scanned_at).length}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Avg. Queries</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-2">
              {regs.length > 0 ? Math.round(regs.reduce((acc, r) => acc + (r.regulation_search_profiles?.search_queries.length || 0), 0) / regs.length) : 0}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-[var(--foreground)]/70">Last Updated</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-2">
              {regs.filter(r => r.last_scanned_at).length > 0 ? 'Today' : '--'}
            </p>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 p-3 md:p-4 mb-6">
          <div className="flex flex-col xl:flex-row gap-2 xl:gap-3 xl:items-stretch">
            <div className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-gray-300/80 dark:border-gray-600 bg-white/90 px-3.5 py-2.5 shadow-sm dark:bg-gray-900/75">
              <Search className="h-4 w-4 text-[var(--foreground)]/60" />
              <input
                type="text"
                placeholder="Search by name or authority..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[var(--foreground)] placeholder-[var(--foreground)]/40 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex min-h-10 items-center gap-2 rounded-xl border border-gray-300/80 dark:border-gray-600 bg-white/90 px-3.5 py-2.5 shadow-sm dark:bg-gray-900/75">
                <label className="text-sm font-medium whitespace-nowrap text-[var(--foreground)]/70">Sort by</label>
                <div className="relative">
                  <select
                    id="sort-select"
                    aria-label="sort regulations"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'name' | 'last_scanned_at')}
                    className="min-w-[180px] appearance-none rounded-lg border border-gray-300/80 bg-white px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-gray-500 dark:bg-gray-900 dark:text-[var(--foreground)]"
                  >
                    <option value="name">Name</option>
                    <option value="last_scanned_at">Last Scanned</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/50" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-300/80 bg-white/90 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-white dark:border-gray-600 dark:bg-gray-900/75 dark:hover:bg-gray-900"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full border-t-2 border-b-2 border-[var(--accent)] animate-spin"></div>
            <p className="mt-4 text-lg text-[var(--foreground)]/70">
              Loading regulations...
            </p>
          </div>
        ) : filteredRegs.length === 0 ? (
          <div className="text-center py-20 bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <Globe className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
              No regulations found
            </h3>
            <p className="text-[var(--foreground)]/70 mb-6">
              Adjust your search or add a new regulation
            </p>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-base font-semibold hover:opacity-90 transition-all"
            >
              <Plus className="h-5 w-5" />
              Add Regulation
            </button>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
          >
            {filteredRegs.map(reg => (
              <motion.div
                key={reg.id}
                variants={cardVariants}
                whileHover="hover"
                className="bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[280px] border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mr-4">
                      <Globe className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(reg)}
                        className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(reg.id)}
                        className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-[var(--foreground)] line-clamp-2 mb-2">
                    {reg.name}
                  </h2>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-[var(--foreground)]/80">
                      <span className="font-medium mr-2">Authority:</span>
                      {reg.regulation_search_profiles?.authority || '-'}
                    </div>
                    
                    <div className="flex items-center text-sm text-[var(--foreground)]/80">
                      <Calendar className="h-3 w-3 mr-2 text-[var(--foreground)]/60" />
                      <span className={reg.last_scanned_at ? 'text-emerald-500' : 'text-amber-500'}>
                        Last Scanned: {formatDate(reg.last_scanned_at)}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {reg.regulation_search_profiles?.search_queries.length ? (
                        <>
                          {reg.regulation_search_profiles.search_queries.slice(0, 3).map((query, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded text-xs bg-[var(--accent)]/10 text-[var(--accent)]"
                            >
                              {query}
                            </span>
                          ))}
                          {reg.regulation_search_profiles.search_queries.length > 3 && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              +{reg.regulation_search_profiles.search_queries.length - 3} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          No search queries
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition hover:scale-105 active:scale-95"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
          Scroll Up
        </button>
      )}

      <AnimatePresence>
        {modalOpen && (
          <RegulationForm
            regulation={editingReg || undefined}
            onClose={() => setModalOpen(false)}
            onSave={fetchRegs}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
