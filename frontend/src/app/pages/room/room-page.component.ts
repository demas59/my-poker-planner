import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Member, Room, VoteValue } from '../../models/planning.model';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-room-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.css'
})
export class RoomPageComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly planningService = inject(PlanningService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomCode = signal('');
  readonly room = signal<Room | null>(null);
  readonly currentMember = signal<Member | null>(null);
  readonly selectedVote = signal<VoteValue | null>(null);
  readonly userName = signal('');
  readonly joinLoading = signal(false);
  readonly voteLoading = signal(false);
  readonly error = signal('');
  readonly roomUrl = computed(() => {
    const origin = this.document.location?.origin ?? '';
    return `${origin}/room/${this.roomCode()}`;
  });

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId')?.toUpperCase();
    if (!roomId) {
      this.error.set('Code room invalide.');
      return;
    }

    this.roomCode.set(roomId);
    this.hydrateFromNavigationState();
    this.restoreMember();
    this.fetchRoomOnce();
    this.startRoomStream();
  }

  joinRoom(): void {
    const name = this.userName().trim();
    if (!name) {
      this.error.set('Ton nom est obligatoire.');
      return;
    }

    this.joinLoading.set(true);
    this.error.set('');

    this.planningService.joinRoom(this.roomCode(), name).subscribe({
      next: ({ member, room }) => {
        this.currentMember.set(member);
        this.room.set(room);
        this.persistMember(member.id, member.name);
        this.joinLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de rejoindre cette room.');
        this.joinLoading.set(false);
      }
    });
  }

  castVote(value: VoteValue): void {
    const room = this.room();
    const currentMember = this.currentMember();

    if (!room || !currentMember || this.voteLoading()) {
      return;
    }

    this.error.set('');
    this.voteLoading.set(true);
    this.selectedVote.set(value);
    this.planningService.vote(this.roomCode(), currentMember.id, value).subscribe({
      next: (updatedRoom) => {
        this.room.set(updatedRoom);
        this.voteLoading.set(false);
      },
      error: () => {
        this.error.set('Vote impossible.');
        this.voteLoading.set(false);
      }
    });
  }

  revealVotes(): void {
    if (!this.room()) {
      return;
    }

    this.planningService.reveal(this.roomCode()).subscribe({
      next: (room) => {
        this.room.set(room);
      },
      error: () => {
        this.error.set('Impossible de reveler les votes.');
      }
    });
  }

  resetRound(): void {
    if (!this.room()) {
      return;
    }

    this.selectedVote.set(null);
    this.planningService.reset(this.roomCode()).subscribe({
      next: (room) => {
        this.room.set(room);
      },
      error: () => {
        this.error.set('Impossible de reinitialiser le tour.');
      }
    });
  }

  memberVote(memberId: string): string {
    const room = this.room();
    if (!room) {
      return '-';
    }

    const vote = room.votes[memberId];
    return vote ?? '-';
  }

  private fetchRoomOnce(): void {
    this.planningService.getRoom(this.roomCode()).subscribe({
      next: (room) => {
        this.applyRoomUpdate(room);
      },
      error: () => {
        this.error.set('Impossible de charger la room.');
      }
    });
  }

  private startRoomStream(): void {
    this.planningService
      .streamRoom(this.roomCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === 'room-updated') {
            this.applyRoomUpdate(event.room);
          }
        },
        error: () => {
          this.error.set('Erreur de synchronisation avec la room.');
        }
      });
  }

  private hydrateFromNavigationState(): void {
    const navigationState = history.state as { room?: Room; member?: Member };
    if (navigationState.room?.roomId?.toUpperCase() === this.roomCode()) {
      this.room.set(navigationState.room);
    }

    if (navigationState.member?.id && navigationState.member?.name) {
      this.currentMember.set(navigationState.member);
      this.userName.set(navigationState.member.name);
      this.persistMember(navigationState.member.id, navigationState.member.name);
    }
  }

  private restoreMember(): void {
    if (this.currentMember()) {
      return;
    }

    const raw = sessionStorage.getItem(this.memberStorageKey());
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { memberId?: string; name?: string };
      if (!parsed.memberId || !parsed.name) {
        return;
      }

      this.currentMember.set({
        id: parsed.memberId,
        name: parsed.name
      });
      this.userName.set(parsed.name);
    } catch {
      sessionStorage.removeItem(this.memberStorageKey());
    }
  }

  private persistMember(memberId: string, name: string): void {
    sessionStorage.setItem(this.memberStorageKey(), JSON.stringify({ memberId, name }));
  }

  private clearMemberSession(): void {
    sessionStorage.removeItem(this.memberStorageKey());
    this.selectedVote.set(null);
  }

  private applyRoomUpdate(room: Room): void {
    this.room.set(room);

    const currentMember = this.currentMember();

    if (!currentMember) {
      return;
    }

    const existsInRoom = room.members.some((member) => member.id === currentMember.id);
    if (!existsInRoom) {
      this.clearMemberSession();
      this.currentMember.set(null);
      return;
    }

    if (room.revealed) {
      const myVote = room.votes[currentMember.id];
      this.selectedVote.set((myVote as VoteValue) ?? this.selectedVote());
      return;
    }

    if (!room.votes[currentMember.id]) {
      this.selectedVote.set(null);
    }
  }

  private memberStorageKey(): string {
    return `pp_member_${this.roomCode()}`;
  }
}
