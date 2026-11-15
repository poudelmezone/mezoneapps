'use client';

import { useMemo, useState } from 'react';
import type { AppSummary } from '@/lib/types';
import AppCard from './AppCard';
import { IconSearch } from './icons';

type SortKey = 'newest' | 'name' | 'downloads' | 'updated';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'name', label: 'A → Z' },
];

export default function AppExplorer({ apps, categories }: { apps: AppSummary[]; categories: string[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('newest');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = apps.filter((app) => {
      const matchesCategory = category === 'All' || app.category === category;
      if (!matchesCategory) return false;
      if (!needle) return true;
      return (
        app.name.toLowerCase().includes(needle) ||
        app.short_description.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle) ||
        app.category.toLowerCase().includes(needle)
      );
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'downloads':
          return b.downloads - a.downloads;
        case 'updated':
          return b.updated_at - a.updated_at;
        case 'newest':
        default: {
          const aDate = a.released_at ?? a.created_at;
          const bDate = b.released_at ?? b.created_at;
          return bDate - aDate;
        }
      }
    });
  }, [apps, query, category, sort]);

  const hasFilters = query.trim().length > 0 || category !== 'All';

  return (
    <div className="explorer">
      <div className="explorer-bar">
        <div className="search">
          <IconSearch size={18} />
          <label className="sr-only" htmlFor="app-search">
            Search apps by name, description or category
          </label>
          <input
            id="app-search"
            type="search"
            placeholder="Search apps, categories, features…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <label className="sr-only" htmlFor="app-sort">
          Sort apps
        </label>
        <select
          id="app-sort"
          className="select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="explorer-count" aria-live="polite">
          {visible.length} of {apps.length} apps
        </span>
      </div>

      <div className="chip-row" role="group" aria-label="Filter by category">
        {['All', ...categories].map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${category === item ? 'is-active' : ''}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <strong>{apps.length === 0 ? 'No apps published yet' : 'Nothing matches that search'}</strong>
          {apps.length === 0
            ? 'The catalogue is empty. New builds will appear here as soon as they are published.'
            : 'Try a different name, or clear the filters to see everything.'}
          {hasFilters && apps.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="app-grid">
          {visible.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
