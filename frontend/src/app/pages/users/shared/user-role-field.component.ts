import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';

import { Role } from '../../../shared/models/role.model';
import { ROLE_LABELS } from '../../../shared/utils/labels';
import { ROLE_CHOICES } from './user-fields';

/**
 * Role of a user chosen with option cards that describe each role. It binds
 * to the role control of the parent form.
 */
@Component({
    selector: 'app-user-role-field',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RadioButtonModule],
    viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
    template: `
        <h2 class="mgs-section-title mt-8">Rol</h2>
        <div class="mgs-form-grid" role="radiogroup" aria-label="Rol del usuario">
            @for (choice of choices; track choice.value) {
                <label class="mgs-field mgs-field--half mgs-choice" [class.mgs-choice--selected]="selected() === choice.value" [for]="'role-' + choice.value">
                    <p-radiobutton [inputId]="'role-' + choice.value" formControlName="role" [value]="choice.value" />
                    <i [class]="choice.icon + ' mgs-choice__icon'"></i>
                    <span class="flex flex-col gap-1">
                        <span class="font-semibold">{{ labels[choice.value] }}</span>
                        <span class="text-sm text-muted-color">{{ choice.description }}</span>
                    </span>
                </label>
            }
        </div>
    `
})
export class UserRoleFieldComponent {
    /** Role currently picked in the form, used to highlight its card. */
    readonly selected = input.required<Role>();

    protected readonly choices = ROLE_CHOICES;

    protected readonly labels = ROLE_LABELS;
}
