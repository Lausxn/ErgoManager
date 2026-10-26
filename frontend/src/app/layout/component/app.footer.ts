import { Component } from '@angular/core';

@Component({
    selector: 'app-footer',
    template: `<div class="layout-footer">
        <span>ErgoManager · Madrigal Group Solutions</span>
        <span>© {{ currentYear }}</span>
    </div>`
})
export class AppFooterComponent {
    protected readonly currentYear = new Date().getFullYear();
}
