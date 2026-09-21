import { Component } from '@angular/core';
import { StatusPageComponent } from '../../shared/components/status-page/status-page.component';

@Component({
    selector: 'app-notfound',
    standalone: true,
    imports: [StatusPageComponent],
    template: `<app-status-page code="404" title="Página no encontrada" message="La dirección que abrió no existe o fue movida." />`
})
export class Notfound {}
