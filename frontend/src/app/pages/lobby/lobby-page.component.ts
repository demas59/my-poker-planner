import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.css'
})
export class LobbyPageComponent {
  private readonly planningService = inject(PlanningService);
  private readonly router = inject(Router);

  readonly roomCode = signal('');
  readonly userName = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  createRoom(): void {
    const name = this.userName().trim();
    if (!name) {
      this.error.set('Ton nom est obligatoire pour creer un salon.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.planningService
      .createRoom()
      .pipe(switchMap((room) => this.planningService.joinRoom(room.roomId, name)))
      .subscribe({
        next: ({ member, room }) => {
          this.persistMember(room.roomId, member.id, member.name);
          this.loading.set(false);
          this.router.navigate(['/room', room.roomId], {
            state: { room, member }
          });
        },
        error: () => {
          this.error.set('Impossible de creer le salon.');
          this.loading.set(false);
        }
      });
  }

  goToRoom(): void {
    const code = this.roomCode().trim().toUpperCase();
    if (!code) {
      this.error.set('Le code du salon est obligatoire.');
      return;
    }

    this.router.navigate(['/room', code]);
  }

  private persistMember(roomId: string, memberId: string, name: string): void {
    sessionStorage.setItem(`pp_member_${roomId}`, JSON.stringify({ memberId, name }));
  }
}
