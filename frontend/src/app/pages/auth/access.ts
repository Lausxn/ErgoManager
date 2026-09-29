import { Component } from '@angular/core';
import { StatusPageComponent } from '../../shared/components/status-page/status-page.component';

@Component({
    selector: 'app-access',
    standalone: true,
    imports: [StatusPageComponent],
    template: `<app-status-page code="403 · Acceso denegado" title="No tiene permiso para ver esta página" message="Su rol no permite abrir esta sección. Si lo necesita, contacte a un administrador." />`
})
export class Access {}
