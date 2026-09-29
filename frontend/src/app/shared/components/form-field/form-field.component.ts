import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { fieldErrorMessage, isControlInvalid } from '../../utils/form';

/**
 * Label, hint and error message around a form control, so every form of
 * ErgoManager explains its fields the same way. The control itself is
 * projected:
 *
 * ```html
 * <app-form-field label="Nombre" inputId="firstName" [control]="form.controls.firstName">
 *     <input pInputText id="firstName" formControlName="firstName" />
 * </app-form-field>
 * ```
 */
@Component({
    selector: 'app-form-field',
    standalone: true,
    host: { class: 'mgs-field', '[class.mgs-field--half]': 'half()', '[class.mgs-field--invalid]': 'showError()' },
    template: `
        @if (label()) {
            <label [attr.for]="inputId() || null">
                {{ label() }}
                @if (optional()) {
                    <span class="mgs-field__optional">Opcional</span>
                }
            </label>
        }
        <ng-content />
        @if (showError()) {
            <small class="mgs-field__error" role="alert" [attr.id]="inputId() ? inputId() + '-error' : null"> <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ message() }} </small>
        } @else if (hint()) {
            <small class="mgs-field__hint" [attr.id]="inputId() ? inputId() + '-hint' : null">{{ hint() }}</small>
        }
    `
})
export class FormFieldComponent {
    readonly label = input('');

    /** Id of the projected input, links the label and the messages to it. */
    readonly inputId = input('');

    /** Control whose errors are shown. */
    readonly control = input<AbstractControl | null>(null);

    /** Help text shown while there is no error. */
    readonly hint = input('');

    /** Adds the "Opcional" badge next to the label. */
    readonly optional = input(false);

    /** Takes half of the row of an mgs-form-grid from 768 px. */
    readonly half = input(false);

    /** Messages for specific error keys, see fieldErrorMessage. */
    readonly errors = input<Record<string, string>>({});

    protected showError(): boolean {
        return isControlInvalid(this.control());
    }

    protected message(): string {
        return fieldErrorMessage(this.control(), this.errors());
    }
}
