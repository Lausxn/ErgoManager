import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

/** Sections of the forms workspace, shared by the list and editor. */
export type FormSection = 'self-evaluation' | 'personalized';

/** Local navigation without changing the application's main menu. */
@Component({
    selector: 'app-form-navigation',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, ButtonModule],
    template: `
        <nav class="flex flex-wrap gap-2 mb-6" aria-label="Secciones de formularios">
            @for (item of items; track item.section) {
                <a pButton [routerLink]="item.route" severity="secondary" [outlined]="section() !== item.section" [attr.aria-current]="section() === item.section ? 'page' : null">
                    <i [class]="item.icon" aria-hidden="true"></i>
                    <span pButtonLabel>{{ item.label }}</span>
                </a>
            }
        </nav>
    `
})
export class FormNavigationComponent {
    readonly section = input<FormSection>('self-evaluation');
    protected readonly items = [
        { section: 'self-evaluation', label: 'Autoevaluaciones', icon: 'fa-solid fa-list-check', route: '/forms/self-evaluation' },
        { section: 'personalized', label: 'Evaluaciones personalizadas', icon: 'fa-solid fa-user-check', route: '/forms/personalized' }
    ] as const;
}
