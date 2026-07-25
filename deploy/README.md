# Autodeploy on baumserver

Pushing to the **`deploy`** branch puts that commit on
<https://character.klatt.pro> within a couple of minutes.

The server pulls; nothing pushes to it. A systemd timer runs
[`update.sh`](update.sh), which checks the deploy branch and rebuilds when it
has moved. GitHub therefore holds no credentials to the machine, and the
machine needs no inbound port, no webhook receiver and no runner.

## How a deploy goes

1. The timer fires (every two minutes) and fetches the deploy branch.
2. If `HEAD` already equals `origin/deploy` it exits — that is the usual case,
   and costs one fetch.
3. Otherwise it checks the new commit out and **builds the image before
   touching the running container**. A commit that does not build costs a log
   line; the site keeps serving the old one.
4. It starts the new container and waits for the healthcheck. If the container
   never goes healthy, the previously deployed commit is rebuilt and restored
   automatically.
5. Old images are pruned.

Only one deploy runs at a time; a timer fire that lands during a long build
steps aside and lets the next one pick the work up.

## Activating CI

The workflow lives here as [`ci.yml`](ci.yml) rather than in
`.github/workflows/`, because the credentials this repo's Claude sessions push
with deliberately lack GitHub's `workflow` scope — nothing automated can add or
change a workflow file. Move it into place yourself, once:

```sh
mkdir -p .github/workflows && git mv deploy/ci.yml .github/workflows/ci.yml
git commit -m "Activate CI" && git push
```

To let the browser suite run, add a repository secret `E2E_DATA_ZIP` pointing
at a 5etools data zip (Settings → Secrets and variables → Actions). Without it
that step prints a line and passes; the rest of the job runs either way.

## What is *not* automatic

CI (`.github/workflows/ci.yml`) runs the type-check, unit tests, build and e2e
suite on every push, but the deploy does **not** wait for it or require it to be
green. Whatever is on the deploy branch is what gets deployed. Promote commits
deliberately:

```sh
git push origin main:deploy          # ship what is on main
git push origin <sha>:deploy         # ship one specific commit
```

## Install

Run once on baumserver, as root.

```sh
# 1. The checkout. /srv/charactersheet is the path the units assume.
git clone git@github.com:fennsorenn/charactersheet.git /srv/charactersheet
cd /srv/charactersheet
git checkout deploy

# 2. Read-only access for the fetch. A deploy key is the least-privilege
#    option: Settings → Deploy keys on the repo, *without* write access.
ssh-keygen -t ed25519 -N '' -f /root/.ssh/charactersheet_deploy
cat /root/.ssh/charactersheet_deploy.pub      # paste this into the repo
cat >> /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/charactersheet_deploy
  IdentitiesOnly yes
EOF

# 3. The timer.
cp deploy/charactersheet-deploy.service deploy/charactersheet-deploy.timer \
   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now charactersheet-deploy.timer

# 4. First deploy, now rather than in two minutes.
systemctl start charactersheet-deploy.service
```

The `deploy` branch has to exist before step 1 — create it from whatever you
want live first (`git push origin main:deploy`).

## Operating it

```sh
journalctl -u charactersheet-deploy -f      # what the deployer is doing
systemctl list-timers charactersheet-deploy # when it next fires
systemctl start charactersheet-deploy       # deploy now, don't wait
docker compose -f /srv/charactersheet/docker-compose.yml logs -f   # the app
```

Redeploy the current commit (after editing `.env`, say):

```sh
CS_DEPLOY_FORCE=1 /srv/charactersheet/deploy/update.sh
```

Settings can be overridden in `/etc/default/charactersheet-deploy`:

| Variable           | Default              | Meaning                                  |
| ------------------ | -------------------- | ---------------------------------------- |
| `CS_DEPLOY_DIR`    | `/srv/charactersheet`| Checkout to update                       |
| `CS_DEPLOY_BRANCH` | `deploy`             | Branch to follow                         |
| `CS_DEPLOY_REMOTE` | `origin`             | Remote to fetch from                     |
| `CS_DEPLOY_FORCE`  | `0`                  | Redeploy even when the branch has not moved |
| `CS_DEPLOY_LOCK`   | under `/tmp`         | Lock file, deliberately outside the checkout |

To pause deploys without uninstalling: `systemctl stop charactersheet-deploy.timer`.

## Your data is not in the blast radius

The deploy does `git reset --hard` and `git clean -fd` in the checkout, which
would be alarming if accounts and characters did not live in a bind-mounted
`./data` — and `/data/` is gitignored, so both commands leave it alone.

Two rules keep it that way:

- **Never add `-x` to the `git clean`.** That is the one change that would
  delete every registered account and synced character.
- **Never commit anything to `data/`,** which would make it tracked and so
  resettable.

Back it up anyway; it is a single small directory:

```sh
tar czf ~/charactersheet-$(date +%F).tar.gz -C /srv/charactersheet data
```
