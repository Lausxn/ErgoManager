import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CompanyResponse } from '../../../shared/models/company.model';
import { HistoryResponse } from '../../../shared/models/history.model';
import { HistoryResponse, HistoryType } from '../../../shared/models/history.model';
import { ToastService } from '../../../shared/services/toast.service';
import { markFormAsDirty } from '../../../shared/utils/form';
import { CompanyService } from '../../companies/company.service';
import { PersonalizedEvaluationService } from '../../personalized-evaluation/personalized-evaluation.service';
import { HistoryService } from '../history.service';

type SearchMode = 'company' | 'employee';

/** Kind of event a history entry records, grouped for the timeline. */
type EntryType = 'PERSONALIZED' | 'SELF' | 'APPOINTMENT' | 'CANCELLED';

/** Group of each milestone recorded by the backend. */
const ENTRY_TYPE_BY_HISTORY_TYPE: Record<HistoryType, EntryType> = {
    SELF_EVALUATION: 'SELF',
    APPOINTMENT_BOOKED: 'APPOINTMENT',
    APPOINTMENT_CANCELLED: 'CANCELLED',
    PERSONALIZED_EVALUATION: 'PERSONALIZED'
};

/**
 * Group of an entry. Older entries have no type, so it is deduced from the
 * evaluations they link.
 */
function entryTypeOf(entry: HistoryResponse): EntryType {
    if (entry.type) {
        return ENTRY_TYPE_BY_HISTORY_TYPE[entry.type];
    }
    return entry.personalizedEvaluationId ? 'PERSONALIZED' : entry.selfEvaluationId ? 'SELF' : 'APPOINTMENT';
}

/** Longest email accepted by the backend. */
const MAX_EMAIL_LENGTH = 120;

/** Entries shown at first and added by every "Mostrar más". */
const PAGE_SIZE = 20;

const ENTRY_TYPES: Record<EntryType, { label: string; icon: string; tagClass: string }> = {
    PERSONALIZED: { label: 'Evaluación personalizada', icon: 'fa-solid fa-clipboard-check', tagClass: 'mgs-tag mgs-tag--accent' },
    SELF: { label: 'Autoevaluación', icon: 'fa-solid fa-square-check', tagClass: 'mgs-tag mgs-tag--strong' },
    APPOINTMENT: { label: 'Cita agendada', icon: 'fa-regular fa-calendar-check', tagClass: 'mgs-tag mgs-tag--neutral' },
    CANCELLED: { label: 'Cita cancelada', icon: 'fa-regular fa-calendar-xmark', tagClass: 'mgs-tag mgs-tag--muted' }
};

/** History entry with the values the timeline shows, computed once per search. */
interface HistoryRow extends HistoryResponse {
    kind: EntryType;
    typeLabel: string;
    icon: string;
    tagClass: string;
    searchKey: string;
}

/** Search sent to the backend: a company or an employee email. */
type HistoryQuery = { mode: 'company'; companyId: number } | { mode: 'employee'; email: string };

/** Result of a search, successful or not, so the stream never completes on errors. */
type SearchResult = { ok: true; list: HistoryResponse[] } | { ok: false };

/**
 * Reports screen: evaluation history of a client company, or of a single
 * employee, as a timeline with the PDF report of every personalized
 * evaluation.
 */
@Component({
    selector: 'app-history-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        FormsModule,
        ReactiveFormsModule,
        ButtonModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        SelectModule,
        SelectButtonModule,
        SkeletonModule,
        TagModule,
        EmptyStateComponent,
        FormFieldComponent,
        PageHeaderComponent,
        StatCardComponent
    ],
    templateUrl: './history-list.component.html',
    styles: [
        `
            .history-search {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 1rem;
            }

            .history-search .mgs-field {
                flex: 1 1 20rem;
                max-width: 36rem;
            }

            .history-search__submit {
                margin-top: 1.75rem;
            }

            .history-results {
                padding: 1.25rem;
            }

            .history-results .mgs-toolbar {
                margin-bottom: 1.5rem;
            }

            .history-entry__head {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                justify-content: space-between;
                gap: 0.75rem;
            }

            .history-entry__description {
                margin: 0.5rem 0 0.35rem;
                font-weight: 600;
                line-height: 1.45;
                color: var(--heading-color);
            }

            .history-entry .mgs-timeline__meta > span {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
            }

            .history-entry .mgs-timeline__meta svg,
            .history-entry .mgs-timeline__meta i {
                font-size: 0.75rem;
            }

            .history-company__tax {
                font-size: 0.8rem;
                color: var(--text-color-secondary);
            }
        `
    ]
})
export class HistoryListComponent {
    private readonly historyService = inject(HistoryService);

    private readonly companyService = inject(CompanyService);

    private readonly personalizedEvaluationService = inject(PersonalizedEvaluationService);

    private readonly toastService = inject(ToastService);

    private readonly toastService = inject(ToastService);

    /** Only administrators can read the company list, the others type the company number. */
    protected readonly isAdmin = computed(() => this.authService.session()?.role === 'ADMIN');
    private readonly destroyRef = inject(DestroyRef);

    /** Searches to run; null cancels the one in progress. */
    private readonly searches = new Subject<HistoryQuery | null>();

    protected readonly searchModeOptions: { label: string; value: SearchMode; icon: string }[] = [
        { label: 'Por empresa', value: 'company', icon: 'fa-solid fa-building' },
        { label: 'Por colaborador', value: 'employee', icon: 'fa-solid fa-user' }
    ];

    protected readonly searchMode = signal<SearchMode>('company');

    protected readonly companyList = signal<CompanyResponse[]>([]);

    protected readonly isLoadingCompanies = signal(true);

    protected readonly companyId = signal<number | null>(null);

    protected readonly emailControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL_LENGTH)] });

    protected readonly maxEmailLength = MAX_EMAIL_LENGTH;

    /** Company or email of the last search, shown above the results. */
    protected readonly subject = signal('');

    private readonly historyList = signal<HistoryResponse[]>([]);

    protected readonly hasSearched = signal(false);

    protected readonly hasError = signal(false);

    protected readonly isLoading = signal(false);

    constructor() {
        if (this.isAdmin()) {
            this.companyService.findAll().subscribe({
                next: (companyList) => this.companyList.set(companyList),
                error: () => this.toastService.error('No se pudieron cargar las empresas', 'Intente nuevamente en unos minutos.')
            });
    protected readonly filterText = signal('');

    protected readonly visibleCount = signal(PAGE_SIZE);

    /** Evaluations whose PDF is being downloaded. */
    protected readonly downloading = signal<ReadonlySet<number>>(new Set());

    protected readonly rows = computed<HistoryRow[]>(() =>
        this.historyList()
            .map((entry) => {
                const kind = entryTypeOf(entry);
                const { label, icon, tagClass } = ENTRY_TYPES[kind];
                return { ...entry, kind, typeLabel: label, icon, tagClass, searchKey: `${entry.description} ${entry.employeeEmail} ${entry.companyName}`.toLowerCase() };
            })
            .sort((first, second) => second.registeredAt.localeCompare(first.registeredAt))
    );

    /** Figures of the summary cards, counted in a single pass. */
    protected readonly summary = computed(() => {
        const emails = new Set<string>();
        const summary = { total: 0, self: 0, personalized: 0, employees: 0 };
        for (const row of this.rows()) {
            summary.total++;
            if (row.kind === 'SELF') {
                summary.self++;
            } else if (row.kind === 'PERSONALIZED') {
                summary.personalized++;
            }
            emails.add(row.employeeEmail.toLowerCase());
        }
        summary.employees = emails.size;
        return summary;
    });

    protected readonly filteredRows = computed(() => {
        const search = this.filterText().trim().toLowerCase();
        return search === '' ? this.rows() : this.rows().filter((row) => row.searchKey.includes(search));
    });

    protected readonly visibleRows = computed(() => this.filteredRows().slice(0, this.visibleCount()));

    constructor() {
        this.companyService
            .findAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (companyList) => {
                    this.companyList.set([...companyList].sort((first, second) => first.businessName.localeCompare(second.businessName, 'es')));
                    this.isLoadingCompanies.set(false);
                },
                error: () => {
                    this.isLoadingCompanies.set(false);
                    this.toastService.error('No se pudieron cargar las empresas', 'Intente de nuevo en unos minutos.');
                }
            });

        // switchMap drops the answer of an older search when a new one starts.
        this.searches
            .pipe(
                switchMap((query) =>
                    query === null
                        ? EMPTY
                        : this.request(query).pipe(
                              map((list): SearchResult => ({ ok: true, list })),
                              catchError(() => of<SearchResult>({ ok: false }))
                          )
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((result) => {
                this.isLoading.set(false);
                this.hasSearched.set(true);
                this.hasError.set(!result.ok);
                this.historyList.set(result.ok ? result.list : []);
                if (!result.ok) {
                    this.toastService.error('No se pudo consultar el historial', 'Intente de nuevo en unos minutos.');
                }
            });
    }

    /**
     * Switches between searching by company and by employee.
     *
     * @param mode search mode picked by the user
     */
    protected changeMode(mode: SearchMode): void {
        if (mode === this.searchMode()) {
            return;
        }
        this.searchMode.set(mode);
        this.companyId.set(null);
        this.emailControl.reset();
        this.resetResults();
    }

    /**
     * Searches as soon as a company is picked, or clears the results when the
     * selection is removed.
     *
     * @param companyId company picked in the select
     */
    protected search(): void {
        const field = this.searchMode() === 'company' ? this.searchForm.controls.companyId : this.searchForm.controls.employeeEmail;

        if (field.invalid) {
            markFormAsDirty(field);
    protected selectCompany(companyId: number | null): void {
        this.companyId.set(companyId);
        if (companyId === null) {
            this.resetResults();
            return;
        }
        this.startSearch({ mode: 'company', companyId });
    }

        const { companyId, employeeEmail } = this.searchForm.getRawValue();

        const history$: Observable<HistoryResponse[]> = this.searchMode() === 'company' ? this.historyService.findByCompany(companyId!) : this.historyService.findByEmployee(employeeEmail);
    /** Reads the history of the employee typed in the email field. */
    protected searchEmployee(): void {
        if (this.emailControl.invalid) {
            markFormAsDirty(this.emailControl);
            return;
        }
        this.startSearch({ mode: 'employee', email: this.emailControl.value.trim().toLowerCase() });
    }

    /** Runs the last search again, after a failure. */
    protected retry(): void {
        const companyId = this.companyId();
        if (this.searchMode() === 'company' && companyId !== null) {
            this.startSearch({ mode: 'company', companyId });
        } else if (this.searchMode() === 'employee') {
            this.searchEmployee();
        }
    }

    protected showMore(): void {
        this.visibleCount.update((count) => count + PAGE_SIZE);
    }

    /**
     * Downloads the PDF report of a personalized evaluation.
     *
     * @param row history entry of the evaluation
     */
    protected downloadReport(row: HistoryRow): void {
        const id = row.personalizedEvaluationId;
        if (id === undefined || this.downloading().has(id)) {
            return;
        }
        this.setDownloading(id, true);
        this.personalizedEvaluationService
            .downloadReport(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => {
                    this.setDownloading(id, false);
                    saveBlob(blob, `reporte-evaluacion-${id}.pdf`);
                },
                error: (error: unknown) => {
                    this.setDownloading(id, false);
                    this.toastService.error('No se pudo descargar el reporte', downloadErrorMessage(error));
                }
            });
    }

    private startSearch(query: HistoryQuery): void {
        this.subject.set(query.mode === 'company' ? (this.companyList().find((company) => company.id === query.companyId)?.businessName ?? `Empresa ${query.companyId}`) : query.email);
        this.filterText.set('');
        this.visibleCount.set(PAGE_SIZE);
        this.isLoading.set(true);

        history$.subscribe({
            next: (historyList) => {
                this.historyList.set(historyList);
                this.hasSearched.set(true);
                this.isLoading.set(false);
            },
            error: () => {
                this.historyList.set([]);
                this.hasSearched.set(true);
                this.isLoading.set(false);

                this.toastService.error('No se pudo consultar el historial', 'Verifique los datos o la conexión e intente nuevamente.');
        this.searches.next(query);
    }

    private request(query: HistoryQuery): Observable<HistoryResponse[]> {
        return query.mode === 'company' ? this.historyService.findByCompany(query.companyId) : this.historyService.findByEmployee(query.email);
    }

    private resetResults(): void {
        // Cancels a search still running, so its answer does not show up later.
        this.searches.next(null);
        this.historyList.set([]);
        this.hasSearched.set(false);
        this.hasError.set(false);
        this.isLoading.set(false);
        this.filterText.set('');
    }

    private setDownloading(id: number, active: boolean): void {
        this.downloading.update((ids) => {
            const next = new Set(ids);
            if (active) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }
}

/**
 * Saves a file received from the backend through a temporary link.
 *
 * @param blob     content of the file
 * @param fileName name proposed to the browser
 */
function saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // Give the browser time to start the download before releasing the url.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Explains why a report could not be downloaded. The body of a blob request
 * is not JSON, so the status is used instead of the backend message.
 */
function downloadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 0) return 'No fue posible conectar con el servidor. Revise su conexión.';
        if (error.status === 403) return 'No tiene permiso para descargar este reporte.';
        if (error.status === 404) return 'El reporte de esta evaluación no existe.';
    }
    return 'Intente de nuevo en unos minutos.';
}
