import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Member, Room, VoteValue } from '../../models/planning.model';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-room-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.css'
})
export class RoomPageComponent implements OnInit {
  private readonly planningService = inject(PlanningService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  roomCode = '';
  room: Room | null = null;
  currentMember: Member | null = null;
  selectedVote: VoteValue | null = null;
  userName = '';
  joinLoading = false;
  voteLoading = false;
  error = '';

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId')?.toUpperCase();
    if (!roomId) {
      this.error = 'Code room invalide.';
      return;
    }

    this.roomCode = roomId;
    this.hydrateFromNavigationState();
    this.restoreMember();
    this.fetchRoomOnce();
    this.startRoomStream();
  }

  joinRoom(): void {
    const name = this.userName.trim();
    if (!name) {
      this.error = 'Ton nom est obligatoire.';
      return;
    }

    this.joinLoading = true;
    this.error = '';

    this.planningService.joinRoom(this.roomCode, name).subscribe({
      next: ({ member, room }) => {
        this.currentMember = member;
        this.room = room;
        this.persistMember(member.id, member.name);
        this.joinLoading = false;
      },
      error: () => {
        this.error = 'Impossible de rejoindre cette room.';
        this.joinLoading = false;
      }
    });
  }

  castVote(value: VoteValue): void {
    if (!this.room || !this.currentMember || this.voteLoading) {
      return;
    }

    this.error = '';
    this.voteLoading = true;
    this.selectedVote = value;
    this.planningService.vote(this.roomCode, this.currentMember.id, value).subscribe({
      next: (room) => {
        this.room = room;
        this.voteLoading = false;
      },
      error: () => {
        this.error = 'Vote impossible.';
        this.voteLoading = false;
      }
    });
  }

  revealVotes(): void {
    if (!this.room) {
      return;
    }

    this.planningService.reveal(this.roomCode).subscribe({
      next: (room) => {
        this.room = room;
      },
      error: () => {
        this.error = 'Impossible de reveler les votes.';
      }
    });
  }

  resetRound(): void {
    if (!this.room) {
      return;
    }

    this.selectedVote = null;
    this.planningService.reset(this.roomCode).subscribe({
      next: (room) => {
        this.room = room;
      },
      error: () => {
        this.error = 'Impossible de reinitialiser le tour.';
      }
    });
  }

  memberVote(memberId: string): string {
    if (!this.room) {
      return '-';
    }

    const vote = this.room.votes[memberId];
    return vote ?? '-';
  }

  roomUrl(): string {
    return `${window.location.origin}/room/${this.roomCode}`;
  }

  private fetchRoomOnce(): void {
    this.planningService.getRoom(this.roomCode).subscribe({
      next: (room) => {
        this.applyRoomUpdate(room);
      },
      error: () => {
        this.error = 'Impossible de charger la room.';
      }
    });
  }

  private startRoomStream(): void {
    this.planningService
      .streamRoom(this.roomCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === 'room-updated') {
            this.applyRoomUpdate(event.room);
          }
        },
        error: () => {
          this.error = 'Erreur de synchronisation avec la room.';
        }
      });
  }

  private hydrateFromNavigationState(): void {
    const navigationState = history.state as { room?: Room; member?: Member };
    if (navigationState.room?.roomId?.toUpperCase() === this.roomCode) {
      this.room = navigationState.room;
    }

    if (navigationState.member?.id && navigationState.member?.name) {
      this.currentMember = navigationState.member;
      this.userName = navigationState.member.name;
      this.persistMember(navigationState.member.id, navigationState.member.name);
    }
  }

  private restoreMember(): void {
    if (this.currentMember) {
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

      this.currentMember = {
        id: parsed.memberId,
        name: parsed.name
      };
      this.userName = parsed.name;
    } catch {
      sessionStorage.removeItem(this.memberStorageKey());
    }
  }

  private persistMember(memberId: string, name: string): void {
    sessionStorage.setItem(this.memberStorageKey(), JSON.stringify({ memberId, name }));
  }

  private clearMemberSession(): void {
    sessionStorage.removeItem(this.memberStorageKey());
    this.selectedVote = null;
  }

  private applyRoomUpdate(room: Room): void {
    this.room = room;

    if (!this.currentMember) {
      return;
    }

    const existsInRoom = room.members.some((member) => member.id === this.currentMember?.id);
    if (!existsInRoom) {
      this.clearMemberSession();
      this.currentMember = null;
      return;
    }

    if (room.revealed) {
      const myVote = room.votes[this.currentMember.id];
      this.selectedVote = (myVote as VoteValue) ?? this.selectedVote;
      return;
    }

    if (!room.votes[this.currentMember.id]) {
      this.selectedVote = null;
    }
  }

  private memberStorageKey(): string {
    return `pp_member_${this.roomCode}`;
  }
}
