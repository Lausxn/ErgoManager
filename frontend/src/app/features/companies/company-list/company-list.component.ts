import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompanyResponse } from '../../../shared/models/company.model';
import { CompanyService } from '../company.service';

/**
 * Table of the client companies registered in ErgoManager.
 */
@Component({
  selector: 'app-company-list',
  imports: [RouterLink],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.css',
})
export class CompanyListComponent {
  private readonly companyService = inject(CompanyService);

  protected readonly companyList = signal<CompanyResponse[]>([]);

  constructor() {
    this.loadCompanies();
  }

  /**
   * Reads the companies shown by the table.
   */
  protected loadCompanies(): void {
    this.companyService.findAll().subscribe((companyList) => this.companyList.set(companyList));
  }
}
