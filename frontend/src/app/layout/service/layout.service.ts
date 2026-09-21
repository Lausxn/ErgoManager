import { Injectable, effect, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

/** Sizes the user can pick to make the whole page easier to read. */
export type PageSize = 'small' | 'normal' | 'large' | 'extraLarge';

export interface PageSizeOption {
    label: string;
    value: PageSize;
    fontSize: number;
}

/**
 * Base font size of every page size. The layout is built with rem units, so
 * changing the root font size scales text, spacing and components together.
 */
export const PAGE_SIZE_OPTIONS: readonly PageSizeOption[] = [
    { label: 'Compacto', value: 'small', fontSize: 12 },
    { label: 'Normal', value: 'normal', fontSize: 14 },
    { label: 'Grande', value: 'large', fontSize: 16 },
    { label: 'Muy grande', value: 'extraLarge', fontSize: 18 }
];

/** Key of the browser storage entry that keeps the site preferences. */
export const PREFERENCES_STORAGE_KEY = 'ergomanager.preferences';

export interface layoutConfig {
    darkTheme: boolean;
    menuMode: 'static' | 'overlay';
    pageSize: PageSize;
}

interface LayoutState {
    staticMenuDesktopInactive?: boolean;
    overlayMenuActive?: boolean;
    configSidebarVisible?: boolean;
    staticMenuMobileActive?: boolean;
    menuHoverActive?: boolean;
}

interface MenuChangeEvent {
    key: string;
    routeEvent?: boolean;
}

/** Preferences used on the first visit: the dark theme is the default one. */
const DEFAULT_CONFIG: layoutConfig = {
    darkTheme: true,
    menuMode: 'static',
    pageSize: 'normal'
};

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    _config: layoutConfig = readStoredConfig();

    _state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false
    };

    layoutConfig = signal<layoutConfig>(this._config);

    layoutState = signal<LayoutState>(this._state);

    private configUpdate = new Subject<layoutConfig>();

    private overlayOpen = new Subject<any>();

    private menuSource = new Subject<MenuChangeEvent>();

    private resetSource = new Subject();

    menuSource$ = this.menuSource.asObservable();

    resetSource$ = this.resetSource.asObservable();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().staticMenuMobileActive);

    isDarkTheme = computed(() => this.layoutConfig().darkTheme);

    pageSize = computed(() => this.layoutConfig().pageSize);

    /** Position of the current page size inside PAGE_SIZE_OPTIONS. */
    pageSizeIndex = computed(() =>
        Math.max(
            PAGE_SIZE_OPTIONS.findIndex((item) => item.value === this.pageSize()),
            0
        )
    );

    pageSizeLabel = computed(() => PAGE_SIZE_OPTIONS[this.pageSizeIndex()].label);

    canIncreasePageSize = computed(() => this.pageSizeIndex() < PAGE_SIZE_OPTIONS.length - 1);

    canDecreasePageSize = computed(() => this.pageSizeIndex() > 0);

    isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

    constructor() {
        // Applied right away, so the first paint already uses the stored preferences.
        this.applyTheme(this._config.darkTheme);
        this.applyPageSize(this._config.pageSize);

        effect(() => {
            const config = this.layoutConfig();
            if (config) {
                this.onConfigUpdate();
                this.applyTheme(config.darkTheme);
                this.applyPageSize(config.pageSize);
                storeConfig(config);
            }
        });
    }

    /**
     * Switches between the dark and the light theme.
     *
     * @param darkTheme true for the dark theme
     */
    setDarkTheme(darkTheme: boolean): void {
        this.layoutConfig.update((state) => ({ ...state, darkTheme }));
    }

    /**
     * Switches between the dark and the light theme.
     */
    toggleTheme(): void {
        this.setDarkTheme(!this.isDarkTheme());
    }

    /**
     * Moves the page size one step up or down, staying inside the available sizes.
     *
     * @param step +1 to enlarge, -1 to reduce
     */
    stepPageSize(step: 1 | -1): void {
        const index = Math.min(Math.max(this.pageSizeIndex() + step, 0), PAGE_SIZE_OPTIONS.length - 1);
        this.setPageSize(PAGE_SIZE_OPTIONS[index].value);
    }

    /**
     * Changes the size of the whole page.
     *
     * @param pageSize size picked by the user
     */
    setPageSize(pageSize: PageSize): void {
        this.layoutConfig.update((state) => ({ ...state, pageSize }));
    }

    private applyTheme(darkTheme: boolean): void {
        document.documentElement.classList.toggle('app-dark', darkTheme);
    }

    private applyPageSize(pageSize: PageSize): void {
        const option = PAGE_SIZE_OPTIONS.find((item) => item.value === pageSize) ?? PAGE_SIZE_OPTIONS[1];
        document.documentElement.style.fontSize = `${option.fontSize}px`;
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));

            if (this.layoutState().overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive }));
        } else {
            this.layoutState.update((prev) => ({ ...prev, staticMenuMobileActive: !this.layoutState().staticMenuMobileActive }));

            if (this.layoutState().staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isMobile() {
        return !this.isDesktop();
    }

    onConfigUpdate() {
        this._config = { ...this.layoutConfig() };
        this.configUpdate.next(this.layoutConfig());
    }

    onMenuStateChange(event: MenuChangeEvent) {
        this.menuSource.next(event);
    }

    reset() {
        this.resetSource.next(true);
    }
}

/**
 * Reads the preferences saved by a previous visit, falling back to the
 * defaults for anything missing or unreadable.
 *
 * @returns the preferences to start with
 */
function readStoredConfig(): layoutConfig {
    try {
        const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as Partial<layoutConfig>) : {};
        return {
            darkTheme: typeof stored.darkTheme === 'boolean' ? stored.darkTheme : DEFAULT_CONFIG.darkTheme,
            menuMode: DEFAULT_CONFIG.menuMode,
            pageSize: PAGE_SIZE_OPTIONS.some((item) => item.value === stored.pageSize) ? (stored.pageSize as PageSize) : DEFAULT_CONFIG.pageSize
        };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

/**
 * Saves the theme and the page size in the browser, so they survive a reload.
 *
 * @param config preferences of the session
 */
function storeConfig(config: layoutConfig): void {
    try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ darkTheme: config.darkTheme, pageSize: config.pageSize }));
    } catch {
        // Storage can be blocked (private mode); the preferences then last for the session only.
    }
}
