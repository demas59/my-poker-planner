import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { MemberRole } from '../../models/planning.model';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LobbyPageComponent {
  private readonly planningService = inject(PlanningService);
  private readonly router = inject(Router);

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
          this.persistMember(room.roomId, member.id, member.name, member.role);
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

  private persistMember(roomId: string, memberId: string, name: string, role: MemberRole): void {
    sessionStorage.setItem(`pp_member_${roomId}`, JSON.stringify({ memberId, name, role }));
  }
}
