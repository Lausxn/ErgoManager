import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormResponse } from '../../../shared/models/form.model';
import { FormService } from '../form.service';

/**
 * Table of the self evaluation forms, where the administrator can deactivate
 * the ones that are no longer in use.
 */
@Component({
  selector: 'app-form-list',
  imports: [RouterLink],
  templateUrl: './form-list.component.html',
  styleUrl: './form-list.component.css',
})
export class FormListComponent {
  private readonly formService = inject(FormService);

  protected readonly formList = signal<FormResponse[]>([]);

  constructor() {
    this.loadForms();
  }

  /**
   * Reads the forms shown by the table.
   */
  protected loadForms(): void {
    this.formService.findAll().subscribe((formList) => this.formList.set(formList));
  }

  /**
   * Deactivates a form and refreshes the table.
   *
   * @param id identifier of the form
   */
  protected deactivate(id: number): void {
    this.formService.deactivate(id).subscribe(() => this.loadForms());
  }
}
