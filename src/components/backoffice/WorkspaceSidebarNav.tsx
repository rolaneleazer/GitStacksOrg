import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  createDefaultWorkspaceLayout,
  DEFAULT_MODULE_LABELS
} from '../../shared/workspaceLayout.ts';
import type {
  StudioModuleId,
  UserProfile,
  UserRole,
  WorkspaceCategoryConfig,
  WorkspaceLayoutConfig,
  WorkspaceModuleId
} from '../../shared/types.ts';

export interface StudioNavDescriptor {
  id: StudioModuleId;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface WorkspaceSidebarNavProps {
  layout: WorkspaceLayoutConfig;
  savingLayout: boolean;
  navMap: Record<StudioModuleId, StudioNavDescriptor>;
  allowedTabs: StudioModuleId[];
  activeTab: StudioModuleId;
  onSelectTab: (tabId: StudioModuleId) => void;
  onChangeLayout: (next: WorkspaceLayoutConfig, persistImmediately?: boolean) => void;
  currentUserRole: UserRole;
  roleLabel: string;
  displayName: string;
  avatarInitials: string;
  editorEmail: string;
  currentProfile: UserProfile | null;
  storageBackend: 'supabase' | 'local-json';
  mobileDrawerOpen: boolean;
  onSetMobileDrawerOpen: (open: boolean) => void;
  onLogout: () => void;
}

export function WorkspaceSidebarNav({
  layout,
  savingLayout,
  navMap,
  allowedTabs,
  activeTab,
  onSelectTab,
  onChangeLayout,
  currentUserRole,
  roleLabel,
  displayName,
  avatarInitials,
  editorEmail,
  currentProfile,
  storageBackend,
  mobileDrawerOpen,
  onSetMobileDrawerOpen,
  onLogout
}: WorkspaceSidebarNavProps) {
  const [editMode, setEditMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [draggedModule, setDraggedModule] = useState<{
    moduleId: WorkspaceModuleId;
    fromCatId: string;
  } | null>(null);

  const allowedSet = useMemo(() => new Set<StudioModuleId>(allowedTabs), [allowedTabs]);
  const showSuperAdminMcpHub =
    currentUserRole === 'super_admin' && allowedSet.has('mcp_hub') && Boolean(navMap.mcp_hub);
  const showArtexReports = allowedSet.has('artex_reports') && Boolean(navMap.artex_reports);
  const mcpHostCategoryId = useMemo(
    () =>
      layout.categories.find((c) => c.id === 'cat-command')?.id ||
      layout.categories[0]?.id ||
      null,
    [layout.categories]
  );
  const artexHostCategoryId = useMemo(
    () =>
      layout.categories.find((c) => c.id === 'cat-system')?.id ||
      layout.categories[layout.categories.length - 1]?.id ||
      null,
    [layout.categories]
  );

  const getCategoryVisibleModules = (category: WorkspaceCategoryConfig, includeVirtual = true): StudioModuleId[] => {
    const base: StudioModuleId[] = category.moduleIds.filter(
      (id) => allowedSet.has(id) && Boolean(navMap[id])
    );
    if (includeVirtual && showSuperAdminMcpHub && category.id === mcpHostCategoryId) {
      return ['mcp_hub', ...base];
    }
    if (includeVirtual && showArtexReports && category.id === artexHostCategoryId) {
      const cyberIdx = base.indexOf('cybersecurity');
      if (cyberIdx >= 0) {
        const next = [...base];
        next.splice(cyberIdx + 1, 0, 'artex_reports');
        return next;
      }
      return [...base, 'artex_reports'];
    }
    return base;
  };

  const getModuleLabel = (id: StudioModuleId): string => {
    if (id === 'mcp_hub') return navMap[id]?.defaultLabel || 'Gemini & MCP Hub';
    if (id === 'artex_reports') return navMap[id]?.defaultLabel || 'ARTEX Pentest Reports';
    return (
      layout.moduleAliases[id]?.trim() ||
      navMap[id]?.defaultLabel ||
      DEFAULT_MODULE_LABELS[id] ||
      id
    );
  };

  const activeCategory = useMemo(() => {
    if (activeTab === 'mcp_hub') {
      return layout.categories.find((c) => c.id === mcpHostCategoryId) || layout.categories[0] || null;
    }
    if (activeTab === 'artex_reports') {
      return layout.categories.find((c) => c.id === artexHostCategoryId) || layout.categories[0] || null;
    }
    return (
      layout.categories.find((c) => c.moduleIds.includes(activeTab)) ||
      layout.categories[0] ||
      null
    );
  }, [layout.categories, activeTab, mcpHostCategoryId, artexHostCategoryId]);

  const activeCategoryModules = useMemo(() => {
    if (!activeCategory) return [];
    return getCategoryVisibleModules(activeCategory, true);
  }, [activeCategory, allowedSet, navMap, showSuperAdminMcpHub, showArtexReports, mcpHostCategoryId, artexHostCategoryId]);

  const toggleSidebarCollapsed = () => {
    onChangeLayout(
      {
        ...layout,
        sidebarCollapsed: !layout.sidebarCollapsed
      },
      true
    );
  };

  const toggleCategoryCollapsed = (catId: string) => {
    onChangeLayout(
      {
        ...layout,
        categories: layout.categories.map((c) =>
          c.id === catId ? { ...c, collapsed: !c.collapsed } : c
        )
      },
      true
    );
  };

  const renameCategory = (catId: string, nextName: string) => {
    onChangeLayout(
      {
        ...layout,
        categories: layout.categories.map((c) => (c.id === catId ? { ...c, name: nextName } : c))
      },
      false
    );
  };

  const renameModule = (moduleId: WorkspaceModuleId, nextAlias: string) => {
    onChangeLayout(
      {
        ...layout,
        moduleAliases: {
          ...layout.moduleAliases,
          [moduleId]: nextAlias
        }
      },
      false
    );
  };

  const moveCategoryOrder = (catIndex: number, dir: -1 | 1) => {
    const targetIdx = catIndex + dir;
    if (targetIdx < 0 || targetIdx >= layout.categories.length) return;
    const next = [...layout.categories];
    const [moved] = next.splice(catIndex, 1);
    next.splice(targetIdx, 0, moved);
    onChangeLayout({ ...layout, categories: next }, true);
  };

  const moveModuleInOrAcrossCategories = (
    moduleId: WorkspaceModuleId,
    fromCatId: string,
    toCatId: string,
    targetIndex?: number
  ) => {
    const nextCategories = layout.categories.map((c) => ({ ...c, moduleIds: [...c.moduleIds] }));
    const sourceCat = nextCategories.find((c) => c.id === fromCatId);
    const destCat = nextCategories.find((c) => c.id === toCatId);
    if (!sourceCat || !destCat) return;

    const currentIdx = sourceCat.moduleIds.indexOf(moduleId);
    if (currentIdx === -1) return;
    sourceCat.moduleIds.splice(currentIdx, 1);

    const insertIdx =
      typeof targetIndex === 'number'
        ? Math.max(0, Math.min(targetIndex, destCat.moduleIds.length))
        : destCat.moduleIds.length;
    destCat.moduleIds.splice(insertIdx, 0, moduleId);
    destCat.collapsed = false;

    onChangeLayout({ ...layout, categories: nextCategories }, true);
  };

  const reorderModuleStep = (catId: string, moduleId: WorkspaceModuleId, dir: -1 | 1) => {
    const cat = layout.categories.find((c) => c.id === catId);
    if (!cat) return;
    const visibleIds = cat.moduleIds.filter((id) => allowedSet.has(id));
    const visibleIdx = visibleIds.indexOf(moduleId);
    const swapWithId = visibleIds[visibleIdx + dir];
    if (!swapWithId) return;

    const nextIds = [...cat.moduleIds];
    const a = nextIds.indexOf(moduleId);
    const b = nextIds.indexOf(swapWithId);
    if (a === -1 || b === -1) return;
    [nextIds[a], nextIds[b]] = [nextIds[b], nextIds[a]];

    onChangeLayout(
      {
        ...layout,
        categories: layout.categories.map((c) =>
          c.id === catId ? { ...c, moduleIds: nextIds } : c
        )
      },
      true
    );
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim().slice(0, 60);
    if (!clean) return;
    const created: WorkspaceCategoryConfig = {
      id: `cat-custom-${Date.now()}`,
      name: clean,
      collapsed: false,
      moduleIds: []
    };
    setNewCategoryName('');
    onChangeLayout(
      {
        ...layout,
        categories: [...layout.categories, created]
      },
      true
    );
  };

  const handleDeleteCategory = (catId: string) => {
    if (layout.categories.length <= 1) return;
    const target = layout.categories.find((c) => c.id === catId);
    const remaining = layout.categories.filter((c) => c.id !== catId);
    if (!target || remaining.length === 0) return;

    if (target.moduleIds.length > 0) {
      remaining[0] = {
        ...remaining[0],
        collapsed: false,
        moduleIds: [...remaining[0].moduleIds, ...target.moduleIds]
      };
    }
    onChangeLayout({ ...layout, categories: remaining }, true);
  };

  const handleResetDefault = () => {
    const def = createDefaultWorkspaceLayout();
    onChangeLayout(
      {
        ...def,
        sidebarCollapsed: layout.sidebarCollapsed
      },
      true
    );
  };

  const handleFinishEditMode = () => {
    setEditMode(false);
    onChangeLayout(layout, true);
  };

  const renderCategoryList = (isMobileContext: boolean) => (
    <div className="space-y-3">
      {/* Edit Mode Toolbar */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          onClick={() => (editMode ? handleFinishEditMode() : setEditMode(true))}
          className={`min-h-[38px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            editMode
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span>{editMode ? (savingLayout ? 'Saving...' : 'Done & Save') : 'Customize Modules'}</span>
        </button>

        {editMode && (
          <button
            type="button"
            onClick={handleResetDefault}
            title="Reset default categories & names"
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editMode && (
        <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name..."
            maxLength={50}
            className="min-h-[38px] flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Add Category"
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg bg-[var(--gs-primary)] text-white hover:bg-[var(--gs-primary-hover)] shrink-0"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* Categorized Sections */}
      <div className="space-y-2.5">
        {layout.categories.map((category, catIdx) => {
          const visibleModuleIds = getCategoryVisibleModules(category, !editMode);
          if (!editMode && visibleModuleIds.length === 0) return null;

          const isCollapsed = !editMode && Boolean(category.collapsed);

          return (
            <div
              key={category.id}
              onDragOver={(e) => {
                if (!editMode || !draggedModule) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!editMode || !draggedModule) return;
                e.preventDefault();
                moveModuleInOrAcrossCategories(
                  draggedModule.moduleId,
                  draggedModule.fromCatId,
                  category.id
                );
                setDraggedModule(null);
              }}
              className={`rounded-lg ${
                editMode ? 'border border-slate-200 bg-slate-50/50 p-2' : ''
              }`}
            >
              {/* Category Header */}
              {editMode ? (
                <div className="flex items-center gap-1 pb-2 border-b border-slate-200/80">
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => renameCategory(category.id, e.target.value)}
                    onBlur={() => onChangeLayout(layout, true)}
                    maxLength={55}
                    aria-label={`Rename category ${category.name}`}
                    className="min-h-[34px] flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={catIdx === 0}
                    onClick={() => moveCategoryOrder(catIdx, -1)}
                    aria-label="Move category up"
                    className="min-h-[34px] min-w-[28px] inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-200/60 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={catIdx === layout.categories.length - 1}
                    onClick={() => moveCategoryOrder(catIdx, 1)}
                    aria-label="Move category down"
                    className="min-h-[34px] min-w-[28px] inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-200/60 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {layout.categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(category.id)}
                      aria-label={`Delete category ${category.name}`}
                      className="min-h-[34px] min-w-[28px] inline-flex items-center justify-center rounded text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapsed(category.id)}
                  className="w-full min-h-[34px] flex items-center justify-between gap-2 px-2 py-1 text-left text-[11px] font-bold tracking-wide text-slate-500 hover:text-slate-900"
                >
                  <span className="truncate">{category.name}</span>
                  <span className="inline-flex items-center gap-1 shrink-0 font-mono tabular-nums text-[10px] text-slate-400">
                    <span>{visibleModuleIds.length}</span>
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
              )}

              {/* Category Modules */}
              {!isCollapsed && (
                <div className={`${editMode ? 'mt-2 space-y-2' : 'mt-1 space-y-1'}`}>
                  {visibleModuleIds.length === 0 && editMode && (
                    <div className="rounded-md border border-dashed border-slate-300 py-2.5 text-center text-[11px] text-slate-400">
                      Drop or move any module here
                    </div>
                  )}

                  {visibleModuleIds.map((modId, modIdx) => {
                    const item = navMap[modId];
                    const Icon = item.icon;
                    const active = activeTab === modId;
                    const displayLabel = getModuleLabel(modId);

                    if (editMode && modId !== 'mcp_hub' && modId !== 'artex_reports') {
                      const baseModId = modId as WorkspaceModuleId;
                      return (
                        <div
                          key={baseModId}
                          draggable
                          onDragStart={() => setDraggedModule({ moduleId: baseModId, fromCatId: category.id })}
                          onDragEnd={() => setDraggedModule(null)}
                          onDragOver={(e) => {
                            if (draggedModule) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (!draggedModule) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggedModule.moduleId !== baseModId) {
                              const targetIdx = category.moduleIds.indexOf(baseModId);
                              moveModuleInOrAcrossCategories(
                                draggedModule.moduleId,
                                draggedModule.fromCatId,
                                category.id,
                                targetIdx >= 0 ? targetIdx : undefined
                              );
                            }
                            setDraggedModule(null);
                          }}
                          className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab shrink-0" />
                            <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <input
                              type="text"
                              value={
                                layout.moduleAliases[baseModId] !== undefined
                                  ? layout.moduleAliases[baseModId]
                                  : item.defaultLabel
                              }
                              onChange={(e) => renameModule(baseModId, e.target.value)}
                              onBlur={() => onChangeLayout(layout, true)}
                              maxLength={55}
                              placeholder={item.defaultLabel}
                              aria-label={`Rename ${item.defaultLabel}`}
                              className="min-h-[34px] flex-1 min-w-0 rounded border border-slate-200 bg-slate-50/70 px-2 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={modIdx === 0}
                              onClick={() => reorderModuleStep(category.id, baseModId, -1)}
                              aria-label={`Move ${displayLabel} up`}
                              className="min-h-[32px] min-w-[26px] inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={modIdx === visibleModuleIds.length - 1}
                              onClick={() => reorderModuleStep(category.id, baseModId, 1)}
                              aria-label={`Move ${displayLabel} down`}
                              className="min-h-[32px] min-w-[26px] inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-1.5 pl-5">
                            <span className="text-[10px] text-slate-400 truncate">
                              Category:
                            </span>
                            <select
                              value={category.id}
                              onChange={(e) =>
                                moveModuleInOrAcrossCategories(
                                  baseModId,
                                  category.id,
                                  e.target.value
                                )
                              }
                              aria-label={`Move ${displayLabel} to category`}
                              className="min-h-[30px] max-w-[175px] flex-1 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                            >
                              {layout.categories.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={modId}
                        type="button"
                        onClick={() => {
                          onSelectTab(modId);
                          if (isMobileContext) onSetMobileDrawerOpen(false);
                        }}
                        className={`min-h-[42px] w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors text-left ${
                          active
                            ? 'bg-[var(--gs-primary)] text-white'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{displayLabel}</span>
                        </span>
                        {typeof item.count === 'number' && (
                          <span
                            className={`font-mono text-[11px] tabular-nums shrink-0 ${
                              active ? 'text-white/80' : 'text-slate-400'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProfileHeader = (compact = false) => (
    <div className={`border-b border-slate-200 pb-3 flex items-center gap-2.5 ${compact ? 'justify-center' : ''}`}>
      {currentProfile?.avatar_url ? (
        <img
          src={currentProfile.avatar_url}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="h-9 w-9 rounded-full border border-slate-200 object-cover shrink-0"
        />
      ) : (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: 'var(--gs-primary)' }}
        >
          {avatarInitials || 'GS'}
        </div>
      )}
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-[var(--gs-primary)] truncate">
            {roleLabel}
          </div>
          <div className="font-display text-sm font-bold text-slate-900 truncate">
            {displayName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{editorEmail}</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* MOBILE / IPHONE 15 QUICK-SWITCHER BAR (Non-sticky so header stays well under 15% cap) */}
      <div className="lg:hidden rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSetMobileDrawerOpen(true)}
            aria-label="Open Back Office Category Menu"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Menu className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
            <span>Categories</span>
          </button>

          <div className="min-w-0 flex-1 text-center px-1">
            <div className="text-[10px] font-medium text-slate-500 truncate">
              {activeCategory?.name || 'Workspace'}
            </div>
            <div className="text-xs font-bold text-slate-900 truncate">
              {getModuleLabel(activeTab)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              onSetMobileDrawerOpen(true);
            }}
            aria-label="Customize Modules"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Horizontal One-Thumb Sibling Module Quick Switcher */}
        {activeCategoryModules.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {activeCategoryModules.map((modId) => {
              const active = modId === activeTab;
              return (
                <button
                  key={modId}
                  type="button"
                  onClick={() => onSelectTab(modId)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--gs-primary)] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {getModuleLabel(modId)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MOBILE / IPHONE 15 SLIDE-OUT CATEGORY DRAWER */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => onSetMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <aside
            aria-label="Mobile Back Office Navigation"
            className="relative z-10 flex h-full w-[88vw] max-w-[340px] flex-col bg-white border-r border-slate-200 pt-safe pb-safe"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="font-display text-sm font-bold text-slate-900">
                Workspace Modules
              </div>
              <button
                type="button"
                onClick={() => onSetMobileDrawerOpen(false)}
                aria-label="Close Module Drawer"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {renderProfileHeader(false)}
              {renderCategoryList(true)}
            </div>

            <div className="border-t border-slate-200 px-4 py-3 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span>Store</span>
                <span className="font-mono text-slate-700">{storageBackend}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP COLLAPSIBLE SIDEBAR (264px <-> 68px Icon Rail) */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          layout.sidebarCollapsed && !editMode ? 'w-[68px]' : 'w-[264px]'
        }`}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] flex flex-col">
          {/* Collapse / Expand Rail Control */}
          <div
            className={`flex items-center ${
              layout.sidebarCollapsed && !editMode ? 'justify-center' : 'justify-between gap-2'
            }`}
          >
            {(!layout.sidebarCollapsed || editMode) && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                Navigation
              </span>
            )}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title={
                layout.sidebarCollapsed ? 'Expand navigation rail' : 'Collapse sidebar for max width'
              }
              aria-label={
                layout.sidebarCollapsed ? 'Expand navigation rail' : 'Collapse sidebar for max width'
              }
              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              {layout.sidebarCollapsed && !editMode ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {layout.sidebarCollapsed && !editMode ? (
            <>
              {renderProfileHeader(true)}
              <nav
                aria-label="Collapsed Back Office Sections"
                className="flex-1 overflow-y-auto space-y-3 pr-0.5"
              >
                {layout.categories.map((cat) => {
                  const visibleIds = getCategoryVisibleModules(cat, true);
                  if (visibleIds.length === 0) return null;
                  return (
                    <div
                      key={cat.id}
                      className="space-y-1 border-b border-slate-100 pb-2 last:border-b-0"
                    >
                      {visibleIds.map((modId) => {
                        const item = navMap[modId];
                        const Icon = item.icon;
                        const active = activeTab === modId;
                        const label = getModuleLabel(modId);
                        return (
                          <button
                            key={modId}
                            type="button"
                            title={`${cat.name} · ${label}`}
                            aria-label={label}
                            onClick={() => onSelectTab(modId)}
                            className={`min-h-[40px] w-full flex items-center justify-center rounded-lg transition-colors ${
                              active
                                ? 'bg-[var(--gs-primary)] text-white'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-slate-200 pt-2">
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="min-h-[40px] w-full flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              {renderProfileHeader(false)}
              <nav
                aria-label="Back Office Sections"
                className="flex-1 overflow-y-auto pr-1"
              >
                {renderCategoryList(false)}
              </nav>
              <div className="border-t border-slate-200 pt-2.5 space-y-2 text-[11px] text-slate-500">
                <div className="flex items-center justify-between px-1">
                  <span>Store</span>
                  <span className="font-mono text-slate-700">{storageBackend}</span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
