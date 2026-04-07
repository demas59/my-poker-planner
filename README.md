# Poker Planner (NestJS + Angular 21)

Application de Poker Planning avec:
- salons partages
- votes Fibonacci caches jusqu'a revelation
- backend Node.js NestJS (instance HTTP classique)
- frontend Angular 21
- synchronisation temps reel via SSE entre navigateurs

## Structure

- `backend/`: API NestJS
- `frontend/`: application Angular

## Fonctionnalites

- creation d'un salon (`POST /rooms`)
- flux temps reel d'une room (`GET /rooms/{roomId}/events`)
- rejoindre un salon (`POST /rooms/{roomId}/join`)
- voter avec la suite Fibonacci (`POST /rooms/{roomId}/vote`)
- cacher les votes tant que non reveles
- reveler les votes (`POST /rooms/{roomId}/reveal`)
- reinitialiser un tour (`POST /rooms/{roomId}/reset`)

## Backend (NestJS)

```bash
cd backend
npm install
npm run start:dev
```

API locale par defaut: `http://localhost:3000`

## Frontend (Angular 21)

```bash
cd frontend
npm install
npm start
```

Application locale: `http://localhost:4200`

Le frontend pointe vers `http://localhost:3000` via `frontend/src/environments/environment.ts`.

Note:
- l'etat partage de la room reste cote backend
- le navigateur ne conserve que l'identite locale du participant pour reconnaitre un utilisateur deja connecte sur la meme machine et le meme onglet

## Flux utilisateur

1. Creer un salon depuis la page d'accueil (avec ton nom).
2. Redirection automatique vers l'URL de room: `/room/:roomId`.
3. Partager ce lien direct avec les autres participants.
4. Les autres ouvrent le lien et n'ont plus qu'a saisir leur nom pour rejoindre.
5. Chacun vote en Fibonacci.
6. Les votes restent masques (`VOTED`) jusqu'au reveal.
7. Cliquer sur `Reveler` pour afficher toutes les cartes.
8. Cliquer sur `Nouveau tour` pour recommencer.
