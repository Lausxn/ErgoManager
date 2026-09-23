import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppointmentResponse } from '../../../shared/models/appointment.model';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TAG_CLASSES } from '../../../shared/utils/labels';
import { AppointmentService } from '../appointment.service';

const DAYS_SHOWN_AHEAD = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Agenda of the signed in ergonomist for the coming weeks.
 */
@Component({
    selector: 'app-appointment-list',
    standalone: true,
    imports: [DatePipe, RouterLink, ButtonModule, TableModule, TagModule, TooltipModule, PageHeaderComponent],
    templateUrl: './appointment-list.component.html'
})
export class AppointmentListComponent {
    private readonly appointmentService = inject(AppointmentService);

    private readonly authService = inject(AuthService);

    private readonly confirmationService = inject(ConfirmationService);

    private readonly messageService = inject(MessageService);

    protected readonly appointmentList = signal<AppointmentResponse[]>([]);

    protected readonly isLoading = signal(true);

    protected readonly daysShownAhead = DAYS_SHOWN_AHEAD;

    protected readonly statusLabels: Record<string, string> = APPOINTMENT_STATUS_LABELS;

    protected readonly statusTagClasses: Record<string, string> = APPOINTMENT_STATUS_TAG_CLASSES;

    protected readonly isErgonomist = computed(() => this.authService.session()?.role === 'ERGONOMIST');

    protected readonly pendingCount = computed(() => this.appointmentList().filter((appointment) => appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED').length);

    constructor() {
        this.loadAgenda();
    }

    /**
     * Reads the appointments of the signed in ergonomist.
     */
    protected loadAgenda(): void {
        const userId = this.authService.session()?.userId;
        if (userId === undefined) {
            this.isLoading.set(false);
            return;
        }

        const from = new Date();
        const to = new Date(from.getTime() + DAYS_SHOWN_AHEAD * MILLISECONDS_PER_DAY);

        this.isLoading.set(true);
        this.appointmentService.findAgenda(userId, from.toISOString(), to.toISOString()).subscribe({
            next: (appointmentList) => {
                this.appointmentList.set(appointmentList);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false)
        });
    }

    /**
     * Asks for confirmation, cancels an appointment and refreshes the agenda.
     *
     * @param appointment appointment to cancel
     */
    protected confirmCancel(appointment: AppointmentResponse): void {
        this.confirmationService.confirm({
            header: 'Cancelar cita',
            message: `¿Desea cancelar la cita de ${appointment.employeeName}? El espacio quedará libre de nuevo.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Cancelar cita',
            rejectLabel: 'Volver',
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.appointmentService.cancel(appointment.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Cita cancelada', detail: appointment.employeeName });
                    this.loadAgenda();
                })
        });
    }
}
