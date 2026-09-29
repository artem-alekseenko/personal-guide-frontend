# Personal Guide frontend

Nuxt frontend and API proxy for the sibling backend at `../personal-guide.ai`.
See [AGENTS.md](AGENTS.md) for architecture, API mappings, and development conventions.

## Local development

Use Node 24 through NVM and the pinned pnpm version through Corepack:

```sh
source "$HOME/.nvm/nvm.sh"
nvm use
corepack pnpm install --frozen-lockfile
cp .env.example .env
# Fill in Firebase client configuration and the public Mapbox token.
corepack pnpm dev
```

Start the backend and workers using its README. The frontend runs on port 3000
and connects to `http://localhost:3001`. Use the same Firebase project on both
sides. Never put service-account keys in public configuration.

```sh
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test:smoke
corepack pnpm test:dev
corepack pnpm prettier:check
```

Tests cover proxy errors/authentication/idempotency, store isolation, settings,
coordinates, and playback behavior. `test:smoke` exercises the built Nitro server against a local fixture backend. Real sign-in, maps, GPS, and speech providers
still require a browser and valid credentials. Existing repository formatting
may differ from Prettier; format only the files you change.

## Docker

```sh
docker compose up --build
```

Compose supplies public Firebase/Mapbox configuration as build arguments and
connects to the backend through `host.docker.internal:3001` (including the Linux
host-gateway mapping). Override `DOCKER_PG_API_BASE_URL` if necessary. Rebuild when
changing Firebase client configuration. A built server reads the backend origin
from `NUXT_PG_API_BASE_URL`.

The current UI supports English/Russian and backend default/Cartesia/sample
audio. Generation-management and account-deletion screens are outside the
current UI scope.
