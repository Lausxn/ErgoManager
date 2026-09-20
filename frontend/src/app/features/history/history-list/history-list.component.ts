import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { HistoryResponse } from '../../../shared/models/history.model';
import { HistoryService } from '../history.service';

/**
 * Screen where the evaluation history of a client company is consulted.
 */
@Component({
  selector: 'app-history-list',
  imports: [ReactiveFormsModule],
  templateUrl: './history-list.component.html',
  styleUrl: './history-list.component.css',
})
export class HistoryListComponent {
  private readonly formBuilder = inject(FormBuilder);

  private readonly historyService = inject(HistoryService);

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    companyId: [0, [Validators.required, Validators.min(1)]],
  });

  protected readonly historyList = signal<HistoryResponse[]>([]);

  /**
   * Reads the history entries of the company typed in the search form.
   */
  protected search(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    this.historyService
      .findByCompany(this.searchForm.controls.companyId.value)
      .subscribe((historyList) => this.historyList.set(historyList));
  }
}
