import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.css'
})
export class LobbyPageComponent {
  private readonly planningService = inject(PlanningService);
  private readonly router = inject(Router);

  roomCode = '';
  userName = '';
  loading = false;
  error = '';

  createRoom(): void {
    const name = this.userName.trim();
    if (!name) {
      this.error = 'Ton nom est obligatoire pour creer un salon.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.planningService
      .createRoom()
      .pipe(switchMap((room) => this.planningService.joinRoom(room.roomId, name)))
      .subscribe({
        next: ({ member, room }) => {
          this.persistMember(room.roomId, member.id, member.name);
          this.loading = false;
          this.router.navigate(['/room', room.roomId], {
            state: { room, member }
          });
        },
        error: () => {
          this.error = 'Impossible de creer le salon.';
          this.loading = false;
        }
      });
  }

  goToRoom(): void {
    const code = this.roomCode.trim().toUpperCase();
    if (!code) {
      this.error = 'Le code du salon est obligatoire.';
      return;
    }

    this.router.navigate(['/room', code]);
  }

  private persistMember(roomId: string, memberId: string, name: string): void {
    sessionStorage.setItem(`pp_member_${roomId}`, JSON.stringify({ memberId, name }));
  }
}
