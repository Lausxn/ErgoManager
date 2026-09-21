import { Component } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        <span>ErgoManager · Madrigal Group Solutions</span>
        <span>© {{ currentYear }}</span>
    </div>`
})
export class AppFooter {
    protected readonly currentYear = new Date().getFullYear();
}
