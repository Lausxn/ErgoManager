import { Component } from '@angular/core';
import { StatusPageComponent } from '../../shared/components/status-page/status-page.component';

@Component({
    selector: 'app-error',
    standalone: true,
    imports: [StatusPageComponent],
    template: `<app-status-page code="Error" title="Ocurrió un problema" message="No se pudo completar la operación. Intente de nuevo en unos minutos." />`
})
export class Error {}
