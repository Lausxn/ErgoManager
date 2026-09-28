import { Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { isControlInvalid } from '../../../shared/utils/form';
import { USER_LIMITS } from './user-fields';

/**
 * Personal data and email of a user, shared by the creation and the edition
 * forms. It binds to the controls of the parent form (see
 * createIdentityControls). Extra access fields, like the passwords, are
 * projected after the email.
 *
 * It keeps the default change detection: the parent marks the controls as
 * dirty on submit and this view has to show the errors right away.
 */
@Component({
    selector: 'app-user-identity-fields',
    standalone: true,
    imports: [ReactiveFormsModule, InputTextModule],
    viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
    template: `
        <h2 class="mgs-section-title">Datos personales</h2>
        <div class="mgs-form-grid">
            <div class="mgs-field">
                <label for="firstName">Nombre</label>
                <input pInputText id="firstName" formControlName="firstName" [maxlength]="limits.name" autocomplete="off" placeholder="Ej. María Fernanda" />
                @if (isInvalid('firstName')) {
                    <small class="mgs-field__error">El nombre es obligatorio (máximo {{ limits.name }} caracteres).</small>
                }
            </div>

            <div class="mgs-field mgs-field--half">
                <label for="firstLastName">Primer apellido</label>
                <input pInputText id="firstLastName" formControlName="firstLastName" [maxlength]="limits.name" autocomplete="off" placeholder="Ej. Madrigal" />
                @if (isInvalid('firstLastName')) {
                    <small class="mgs-field__error">El primer apellido es obligatorio (máximo {{ limits.name }} caracteres).</small>
                }
            </div>

            <div class="mgs-field mgs-field--half">
                <label for="secondLastName">Segundo apellido <span class="text-muted-color font-normal">(opcional)</span></label>
                <input pInputText id="secondLastName" formControlName="secondLastName" [maxlength]="limits.name" autocomplete="off" placeholder="Ej. Solano" />
                @if (isInvalid('secondLastName')) {
                    <small class="mgs-field__error">Máximo {{ limits.name }} caracteres.</small>
                }
            </div>
        </div>

        <h2 class="mgs-section-title mgs-section-title--spaced">Acceso</h2>
        <div class="mgs-form-grid">
            <div class="mgs-field">
                <label for="email">Correo electrónico</label>
                <input pInputText id="email" type="email" formControlName="email" [maxlength]="limits.email" autocomplete="off" placeholder="nombre@empresa.com" />
                <small class="text-muted-color">Es el usuario con el que inicia sesión.</small>
                @if (form.controls['email'].hasError('duplicated')) {
                    <small class="mgs-field__error">Ya existe otro usuario con este correo.</small>
                } @else if (isInvalid('email')) {
                    <small class="mgs-field__error">Escriba un correo válido (máximo {{ limits.email }} caracteres).</small>
                }
            </div>
            <ng-content />
        </div>
    `
})
export class UserIdentityFieldsComponent {
    private readonly formGroupDirective = inject(FormGroupDirective);

    /** Read on every use: the parent binds the form after this component is built. */
    protected get form() {
        return this.formGroupDirective.form;
    }

    protected readonly limits = USER_LIMITS;

    /**
     * Checks whether a field has to show its error message.
     *
     * @param field name of the control
     * @returns true when the value is invalid and the user worked on it
     */
    protected isInvalid(field: string): boolean {
        return isControlInvalid(this.form.get(field));
    }
}
