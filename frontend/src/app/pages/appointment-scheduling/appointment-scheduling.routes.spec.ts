import { OptionHubComponent } from '../../shared/components/option-hub/option-hub.component';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { appointmentSchedulingRoutes } from './appointment-scheduling.routes';
import { AvailabilityFormComponent } from './availability-form/availability-form.component';

describe('Rutas de citas', () => {
    const find = (path: string) => appointmentSchedulingRoutes.find((route) => route.path === path);

    it('abre las tarjetas de Agenda y Disponibilidad en la ruta principal', () => {
        expect(find('')?.component).toBe(OptionHubComponent);
        expect(find('')?.data?.['heading']).toBe('Citas');
        expect(find('')?.data?.['options'].map((option: { title: string; route: string }) => [option.title, option.route])).toEqual([
            ['Agenda', '/appointments/agenda'],
            ['Disponibilidad', '/appointments/availabilities']
        ]);
    });

    it('lleva cada tarjeta a la pantalla ya implementada', () => {
        expect(find('agenda')?.component).toBe(AppointmentListComponent);
        expect(find('availabilities')?.component).toBe(AvailabilityFormComponent);
    });
});
