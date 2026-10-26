import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { CompanyResponse } from '../../../shared/models/company.model';
import { ACTIVE_TAG_CLASSES } from '../../../shared/utils/labels';
import { companyInitials } from '../company-initials';

/**
 * Pop-up that asks the user to confirm the deactivation of a client company
 * profile. It shows the profile, explains what happens when it is deactivated
 * and only emits the decision: the page that opens it calls the backend.
 */
@Component({
    selector: 'app-deactivate-company-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AvatarModule, ButtonModule, DialogModule, TagModule],
    templateUrl: './deactivate-company-dialog.component.html',
    styleUrl: './deactivate-company-dialog.component.scss'
})
export class DeactivateCompanyDialogComponent {
    /** Whether the pop-up is open, two-way bound by the page. */
    readonly visible = model(false);

    /** Company whose profile would be deactivated. */
    readonly company = input<CompanyResponse | null>(null);

    /** True while the page waits for the backend, locks the pop-up. */
    readonly isDeactivating = input(false);

    /** Emitted when the user confirms the deactivation. */
    readonly confirmed = output<CompanyResponse>();

    protected readonly activeTagClasses = ACTIVE_TAG_CLASSES;
    protected readonly initials = computed(() => companyInitials(this.company()?.businessName ?? ''));

    /** Closes the pop-up without deactivating, unless the request is already running. */
    protected cancel(): void {
        if (!this.isDeactivating()) {
            this.visible.set(false);
        }
    }

    /** Sends the decision to the page, which runs the deactivation. */
    protected confirm(): void {
        const company = this.company();
        if (company && !this.isDeactivating()) {
            this.confirmed.emit(company);
        }
    }
}
