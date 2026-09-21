import { Routes } from '@angular/router';

import { HistoryListComponent } from './history-list/history-list.component';

/** Routes of the evaluation history feature. */
export const historyRoutes: Routes = [
  {
    path: '',
    component: HistoryListComponent,
    title: 'ErgoManager - History',
  },
];
