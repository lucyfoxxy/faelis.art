#!/bin/bash
set -e

LOGFILE="/srv/faelis.art/dev/deploy.log"

step() {
  local msg="$1"
  echo -e "\n⚙️ $msg ..."
}

ok() {
  echo "✅ done."
}

fail() {
  echo "❌ Error! Check $LOGFILE for details."
  exit 1
}

# Alles ins Log mitschreiben (inkl. Fehler)
exec > >(tee -a "$LOGFILE") 2>&1

# 1. Fetch
step "Fetching immich galleries. This may take a while"
cd /srv/faelis.art/dev/app >/dev/null 2>&1
if npm run fetch >/dev/null 2>&1; then
  ok
else
  fail
fi

# 2. Build
step "Building site"
if npm run build >/dev/null 2>&1; then
  ok
else
  fail
fi

# 3. Deploy
step "Deploying site"
if sudo rsync -a --delete /srv/faelis.art/dev/app/dist/ /var/www/dev.faelis.art/public >/dev/null 2>&1; then
  ok
else
  fail
fi

echo -e "\n🎉🎉🎉 All done! 🎉🎉🎉"
