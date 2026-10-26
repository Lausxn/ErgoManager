import { Injectable, computed, effect, signal } from '@angular/core';
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
    { label: 'Compacto', value: 'small', fontSize: 13 },
    { label: 'Normal', value: 'normal', fontSize: 15 },
    { label: 'Grande', value: 'large', fontSize: 17 },
    { label: 'Muy grande', value: 'extraLarge', fontSize: 19 }
];

/** Key of the browser storage entry that keeps the site preferences. */
export const PREFERENCES_STORAGE_KEY = 'ergomanager.preferences';

export interface LayoutConfig {
    darkTheme: boolean;
    menuMode: 'static' | 'overlay';
    pageSize: PageSize;
}

/** Open or closed state of the side menu on each kind of screen. */
interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    staticMenuMobileActive: boolean;
}

/**
 * Preferences used on the first visit: the light theme, because the brand book
 * asks for "Papel" backgrounds on working pages (page 3, "Claridad").
 */
const DEFAULT_CONFIG: LayoutConfig = {
    darkTheme: false,
    menuMode: 'static',
    pageSize: 'normal'
};

/**
 * Display preferences of the user (theme and page size, kept in the browser)
 * and the open or closed state of the side menu.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
    readonly layoutConfig = signal<LayoutConfig>(readStoredConfig());
    readonly layoutState = signal<LayoutState>({ staticMenuDesktopInactive: false, overlayMenuActive: false, staticMenuMobileActive: false });

    /** Emits when the menu opens over the page, so the layout can close it on an outside click. */
    private readonly overlayOpen = new Subject<void>();
    readonly overlayOpen$ = this.overlayOpen.asObservable();

    readonly isDarkTheme = computed(() => this.layoutConfig().darkTheme);
    readonly pageSize = computed(() => this.layoutConfig().pageSize);

    /** Position of the current page size inside PAGE_SIZE_OPTIONS. */
    readonly pageSizeIndex = computed(() =>
        Math.max(
            PAGE_SIZE_OPTIONS.findIndex((item) => item.value === this.pageSize()),
            0
        )
    );

    readonly pageSizeLabel = computed(() => PAGE_SIZE_OPTIONS[this.pageSizeIndex()].label);
    private readonly isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

    constructor() {
        // Applied right away, so the first paint already uses the stored preferences.
        this.applyTheme(this.layoutConfig().darkTheme);
        this.applyPageSize(this.layoutConfig().pageSize);

        effect(() => {
            const config = this.layoutConfig();
            this.applyTheme(config.darkTheme);
            this.applyPageSize(config.pageSize);
            storeConfig(config);
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

    /** Opens or closes the side menu, the way the current screen shows it. */
    onMenuToggle(): void {
        if (this.isOverlay()) {
            this.layoutState.update((state) => ({ ...state, overlayMenuActive: !state.overlayMenuActive }));
            if (this.layoutState().overlayMenuActive) {
                this.overlayOpen.next();
            }
        }
        if (this.isDesktop()) {
            this.layoutState.update((state) => ({ ...state, staticMenuDesktopInactive: !state.staticMenuDesktopInactive }));
        } else {
            this.layoutState.update((state) => ({ ...state, staticMenuMobileActive: !state.staticMenuMobileActive }));
            if (this.layoutState().staticMenuMobileActive) {
                this.overlayOpen.next();
            }
        }
    }

    /**
     * Tells whether the screen is wide enough for the fixed side menu.
     *
     * @returns true on desktop widths
     */
    isDesktop(): boolean {
        return window.innerWidth > 991;
    }
}

/**
 * Reads the preferences saved by a previous visit, falling back to the
 * defaults for anything missing or unreadable.
 *
 * @returns the preferences to start with
 */
function readStoredConfig(): LayoutConfig {
    try {
        const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as Partial<LayoutConfig>) : {};
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
function storeConfig(config: LayoutConfig): void {
    try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ darkTheme: config.darkTheme, pageSize: config.pageSize }));
    } catch {
        // Storage can be blocked (private mode); the preferences then last for the session only.
    }
}
