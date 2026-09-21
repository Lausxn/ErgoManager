import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UserResponse } from '../../../shared/models/user.model';
import { UserService } from '../user.service';

/**
 * Table of the administrators and ergonomists of ErgoManager.
 */
@Component({
  selector: 'app-user-list',
  imports: [RouterLink],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent {
  private readonly userService = inject(UserService);

  protected readonly userList = signal<UserResponse[]>([]);

  constructor() {
    this.loadUsers();
  }

  /**
   * Reads the users shown by the table.
   */
  protected loadUsers(): void {
    this.userService.findAll().subscribe((userList) => this.userList.set(userList));
  }
}
