SHELL := /bin/bash
MAKEFLAGS += -s   # suppress command echoing, only show our messages

BASE_PATH 			  ?= /srv/faelis.art/app
WEB_ROOT 			  ?= /var/www

DEV_APP        		  ?= ${BASE_PATH}/dev
DEV_DIST  			  ?= ${DEV_APP}/dist
DEV_PUB			      ?= ${WEB_ROOT}/dev.faelis.art/public

PROD_APP        	  ?= ${BASE_PATH}/prod
PROD_DIST  			  ?= ${PROD_APP}/dist
PROD_PUB			  ?= ${WEB_ROOT}/faelis.art/public

.PHONY: sync-src do-release \
        dev-install dev-dev dev-build dev-deploy dev-fetch dev-gen dev-publish dev-clean-gen \
        prod-install prod-dev prod-build prod-deploy prod-fetch prod-gen prod-publish prod-clean-gen prod-pretty-publish

# ===== Common =====

sync-src:
	@echo "⚙️  Syncing DEV → PROD sources"
	@rsync -avh --delete --exclude-from=scripts/excludes.list $(DEV_APP)/ $(PROD_APP)/
	@echo "✅ Sources synced"

do-release:
	@echo "🚀 Starting release (sync + build + deploy)"
	$(MAKE) sync-src
	$(MAKE) prod-clean-gen
	$(MAKE) prod-deploy
	@echo "🎉 Release finished"

# ===== DEV =====

dev-install:
	@echo "📦 Installing DEV dependencies"
	cd "$(DEV_APP)" && npm install
	@echo "✅ DEV install done"

dev-dev:
	@echo "🛠️  Starting DEV server"
	cd "$(DEV_APP)" && npm run dev

dev-build:
	@echo "🔨 Building DEV project"
	cd "$(DEV_APP)" && npm ci && npm run build
	@echo "✅ DEV build complete"

dev-deploy:
	@echo "📤 Deploying DEV build → $(DEV_PUB)"
	sudo rsync -a --delete "$(DEV_DIST)/" "$(DEV_PUB)/"
	@echo "✅ DEV deploy complete"

dev-fetch:
	@echo "🔄 Fetching DEV data"
	cd "$(DEV_APP)" && npm run fetch
	@echo "✅ DEV fetch done"

dev-gen:
	@echo "🔄 Fetch + build (DEV)"
	cd "$(DEV_APP)" && npm run fetch && npm run build
	@echo "✅ DEV gen done"

dev-publish:
	@echo "🚀 Publishing DEV (fetch+build+deploy)"
	$(MAKE) dev-gen
	$(MAKE) dev-deploy
	@echo "✅ DEV publish done"

dev-clean-gen:
	@echo "🧹 Cleaning DEV node_modules + lockfile"
	rm -rf "$(DEV_APP)/node_modules" "$(DEV_APP)/package-lock.json"
	$(MAKE) dev-install
	$(MAKE) dev-gen
	@echo "✅ DEV clean-gen done"

# ===== PROD =====

prod-install:
	@echo "📦 Installing PROD dependencies"
	cd "$(PROD_APP)" && npm install
	@echo "✅ PROD install done"

prod-dev:
	@echo "🛠️  Starting PROD server"
	cd "$(PROD_APP)" && npm run dev

prod-build:
	@echo "🔨 Building PROD project"
	cd "$(PROD_APP)" && npm ci && npm run build
	@echo "✅ PROD build complete"

prod-deploy:
	@echo "📤 Deploying PROD build → $(PROD_PUB)"
	sudo rsync -a --delete "$(PROD_DIST)/" "$(PROD_PUB)/"
	@echo "✅ PROD deploy complete"

prod-fetch:
	@echo "🔄 Fetching PROD data"
	cd "$(PROD_APP)" && npm run fetch
	@echo "✅ PROD fetch done"

prod-gen:
	@echo "🔄 Fetch + build (PROD)"
	cd "$(PROD_APP)" && npm run fetch && npm run build
	@echo "✅ PROD gen done"

prod-publish:
	@echo "🚀 Publishing PROD (fetch+build+deploy)"
	$(MAKE) prod-gen
	$(MAKE) prod-deploy
	@echo "✅ PROD publish done"

prod-clean-gen:
	@echo "🧹 Cleaning PROD node_modules + lockfile"
	rm -rf "$(PROD_APP)/node_modules" "$(PROD_APP)/package-lock.json"
	$(MAKE) prod-install
	$(MAKE) prod-gen
	@echo "✅ PROD clean-gen done"

prod-pretty-publish:
	echo "✨ Gallery update started! ✨" 
	exec > >(tee -a "scripts/prod-pretty-publish.log") 

	echo "";echo "🔄 [1/3] Fetching images... this may take a while..." 
	$(MAKE) -s prod-fetch 
	echo "✅ [1/3] Fetch done." 

	echo ""; echo "⚙️  [2/3] Building site..." 
	$(MAKE) -s prod-build >/dev/null 2>&1
	echo "✅ [2/3] Build done." 
	
	echo ""; echo "📤 [3/3] Publishing site..." 
	$(MAKE) -s prod-deploy >/dev/null 2>&1
	echo "✅ [3/3] Deploy done." 
	
	echo ""; echo "🐱🎉 [INFO] successfully updated site galleries! 🦊🎉"
