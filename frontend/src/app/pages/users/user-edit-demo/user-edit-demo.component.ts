// DEMO TEMPORAL: eliminar esta carpeta y su ruta en users.routes.ts cuando ya no se necesite.
import { Component, Injectable } from '@angular/core';
import { MessageModule } from 'primeng/message';
import { Observable, delay, of } from 'rxjs';

import { UserRequest, UserResponse } from '../../../shared/models/user.model';
import { UserEditComponent } from '../user-edit/user-edit.component';
import { UserService } from '../user.service';

/** Fictitious user shown by the demo. */
const DEMO_USER: UserResponse = {
    id: 7,
    firstName: 'Carlos',
    firstLastName: 'Mora',
    secondLastName: 'Jiménez',
    email: 'carlos.mora@empresa.com',
    role: 'ERGONOMIST',
    active: true,
    createdAt: '2026-09-01T10:30:00'
};

/** Delay that imitates the network, so the loading state is visible. */
const DEMO_DELAY_MS = 600;

/**
 * Replaces UserService only inside the demo: it answers with the fictitious
 * user and never calls the backend.
 */
@Injectable()
class DemoUserService {
    findById(): Observable<UserResponse> {
        return of(DEMO_USER).pipe(delay(DEMO_DELAY_MS));
    }

    update(_id: number, request: UserRequest): Observable<UserResponse> {
        return of({ ...DEMO_USER, ...request }).pipe(delay(DEMO_DELAY_MS));
    }
}

/**
 * Example of the edit dashboard with fictitious data, reachable at
 * /users/edit-user/testId. It renders the real UserEditComponent, so it looks
 * exactly like the real screen.
 */
@Component({
    selector: 'app-user-edit-demo',
    standalone: true,
    imports: [MessageModule, UserEditComponent],
    providers: [{ provide: UserService, useClass: DemoUserService }],
    template: `
        <p-message severity="warn" icon="pi pi-eye" styleClass="mb-6">Vista de ejemplo con datos ficticios. No se guarda nada en el backend.</p-message>
        <app-user-edit [id]="demoUserId" />
    `
})
export class UserEditDemoComponent {
    protected readonly demoUserId = DEMO_USER.id;
}
